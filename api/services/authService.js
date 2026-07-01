const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const createError = require("http-errors");
const { OAuth2Client } = require("google-auth-library");

const pool = require("../db");
const { sendTemplatedEmail } = require("./emailService");
const {
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  createPasswordResetSession,
  consumePasswordResetSession,
  issueOtpCode,
  verifyOtpCode,
  verifyPasswordResetSession,
} = require("./otpService");

const JWT_COOKIE_NAME = "accessToken";
const REMEMBER_ME_TTL = "30d";
const SESSION_TTL = "12h";
const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;
const SUPPORTED_OTP_PURPOSES = new Set(["verify_email", "reset_password"]);
const GOOGLE_PROVIDER = "google";
const EMAIL_VERIFICATION_REQUIRED_CODE = "EMAIL_VERIFICATION_REQUIRED";
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";

// Demo access (one-click role login for showcasing SIARA). Identities + the
// read-only policy live in ./config/demoAccess so authService and verifytoken
// share one source of truth. IMPORTANT: the admin demo is read-only (enforced in
// verifytoken); disable everything with ALLOW_DEMO_LOGIN=false.
const {
  DEMO_ROLE_PROFILES,
  DEMO_ROLE_KEYS,
  DEMO_CONTACT_EMAIL,
  isDemoEmail,
  isReadOnlyDemoEmail,
  isDemoLoginEnabled,
  normalizeDemoRole,
} = require("../config/demoAccess");

let googleClient = null;

const USER_SELECT_SQL = `
  select
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.password_hash,
    u.avatar_url,
    u.auth_provider,
    u.google_sub,
    u.is_active,
    coalesce(u.moderation_status, 'active') as moderation_status,
    u.banned_until,
    u.ban_reason,
    u.warning_reason,
    u.warned_at,
    u.warning_expires_at,
    u.warning_acknowledged_at,
    u.created_at,
    u.updated_at,
    coalesce(uss.email_verified_at, u.email_verified_at) as email_verified_at,
    uss.last_login_at,
    uss.last_password_reset_at,
    coalesce(uss.session_version, 0) as session_version,
    (uss.user_id is not null) as has_security_state,
    coalesce(
      array_agg(distinct r.name) filter (where r.name is not null),
      '{}'::varchar[]
    ) as roles
  from auth.users u
  left join app.user_security_state uss
    on uss.user_id = u.id
  left join auth.user_roles ur
    on ur.user_id = u.id
  left join auth.roles r
    on r.id = ur.role_id
`;

function logAuth(message, details = {}) {
  if (!IS_DEVELOPMENT) {
    return;
  }

  console.info("[auth]", message, details);
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeEmail(value) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function splitFullName(fullName) {
  const normalized = normalizeOptionalString(fullName);
  if (!normalized) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: parts[0],
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeRememberMe(value) {
  return value === true;
}

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
}

function applySessionCookie(res, token, rememberMe) {
  const cookieOptions = getCookieOptions();
  if (rememberMe) {
    res.cookie(JWT_COOKIE_NAME, token, {
      ...cookieOptions,
      maxAge: REMEMBER_ME_MAX_AGE_MS,
    });
    return;
  }

  res.cookie(JWT_COOKIE_NAME, token, cookieOptions);
}

function clearSessionCookie(res) {
  res.clearCookie(JWT_COOKIE_NAME, getCookieOptions());
}

function getJwtSecret() {
  if (!process.env.JWT_ACCESSTOKEN) {
    throw createError(500, "JWT_ACCESSTOKEN is not configured");
  }

  return process.env.JWT_ACCESSTOKEN;
}

function isEmailVerified(user) {
  if (!user?.email) {
    return true;
  }

  if (user?.has_security_state === false) {
    return true;
  }

  return Boolean(user.email_verified_at);
}

function mapUser(row) {
  const roles = Array.isArray(row?.roles) ? row.roles : [];
  const name = [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim();
  const moderationStatus = String(row?.moderation_status || "active").toLowerCase();
  const bannedUntilIso = row?.banned_until ? new Date(row.banned_until).toISOString() : null;
  const isPermanentlyBanned = moderationStatus === "banned" && !bannedUntilIso;
  const warnedAtIso = row?.warned_at ? new Date(row.warned_at).toISOString() : null;
  const warningExpiresAtIso = row?.warning_expires_at
    ? new Date(row.warning_expires_at).toISOString()
    : null;
  const warningAckIso = row?.warning_acknowledged_at
    ? new Date(row.warning_acknowledged_at).toISOString()
    : null;
  const hasActiveWarning = moderationStatus === "warned" && !warningAckIso;

  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    avatar_url: row.avatar_url,
    auth_provider: row.auth_provider || "email",
    is_active: row.is_active,
    moderation_status: moderationStatus,
    moderationStatus,
    banned_until: bannedUntilIso,
    bannedUntil: bannedUntilIso,
    ban_reason: row?.ban_reason || null,
    banReason: row?.ban_reason || null,
    is_permanently_banned: isPermanentlyBanned,
    isPermanentlyBanned,
    warning_reason: row?.warning_reason || null,
    warningReason: row?.warning_reason || null,
    warned_at: warnedAtIso,
    warnedAt: warnedAtIso,
    warning_expires_at: warningExpiresAtIso,
    warningExpiresAt: warningExpiresAtIso,
    warning_acknowledged_at: warningAckIso,
    warningAcknowledgedAt: warningAckIso,
    has_active_warning: hasActiveWarning,
    hasActiveWarning,
    created_at: row.created_at,
    updated_at: row.updated_at,
    roles,
    name: name || row.email || row.phone || "SIARA User",
    email_verified_at: row.email_verified_at || null,
    email_verified: isEmailVerified(row),
    last_login_at: row.last_login_at || null,
    last_password_reset_at: row.last_password_reset_at || null,
    // Demo-account flags so the UI can badge the session + show the read-only
    // notice. Enforcement is server-side (verifytoken), never trusts these.
    demo: isDemoEmail(row?.email),
    readOnly: isReadOnlyDemoEmail(row?.email),
    demoContact: isReadOnlyDemoEmail(row?.email) ? DEMO_CONTACT_EMAIL : null,
  };
}

/**
 * If a 'warned' user has a warning_expires_at in the past (and they never
 * acknowledged it), clear the warning back to 'active' silently. Mutates the
 * row in place.
 */
async function liftExpiredWarning(row, client) {
  if (!row) return;
  const status = String(row.moderation_status || "active").toLowerCase();
  if (status !== "warned") return;
  if (row.warning_acknowledged_at) return; // acknowledged warnings are handled elsewhere
  if (!row.warning_expires_at) return;
  const ts = new Date(row.warning_expires_at).getTime();
  if (Number.isNaN(ts) || ts > Date.now()) return;

  await client.query(
    `
      update auth.users
         set moderation_status        = 'active',
             warning_reason           = null,
             warned_at                = null,
             warning_expires_at       = null,
             warning_acknowledged_at  = now(),
             updated_at               = now()
       where id = $1
    `,
    [row.id],
  );
  row.moderation_status = "active";
  row.warning_reason = null;
  row.warned_at = null;
  row.warning_expires_at = null;
  row.warning_acknowledged_at = new Date().toISOString();
}

/**
 * Returns true if the row should be treated as currently banned. Side-effect:
 * if `banned_until` is in the past, clears the ban on `auth.users` so the user
 * regains normal access without admin intervention.
 *
 * Mutates `row.moderation_status` / `row.banned_until` / `row.ban_reason` /
 * `row.is_active` in place so callers see the fresh state.
 */
async function evaluateAndLiftExpiredBan(row, client) {
  if (!row) return { banned: false };
  // Auto-clear an expired warning regardless of whether we're in a ban path.
  await liftExpiredWarning(row, client);
  const status = String(row.moderation_status || "active").toLowerCase();
  if (status !== "banned") {
    return { banned: false };
  }

  const bannedUntilTs = row.banned_until ? new Date(row.banned_until).getTime() : null;
  const hasExpiry = bannedUntilTs != null && !Number.isNaN(bannedUntilTs);

  // Permanent ban: status='banned' without an expiry.
  if (status === "banned" && !hasExpiry) {
    return { banned: true, permanent: true, until: null, reason: row.ban_reason || null };
  }

  // Expired temporary ban → auto-lift.
  if (hasExpiry && bannedUntilTs <= Date.now()) {
    await client.query(
      `
        update auth.users
           set moderation_status = 'active',
               is_active         = true,
               banned_until      = null,
               ban_reason        = null,
               updated_at        = now()
         where id = $1
      `,
      [row.id],
    );
    row.moderation_status = "active";
    row.banned_until = null;
    row.ban_reason = null;
    row.is_active = true;
    return { banned: false, autoLifted: true };
  }

  // Still in effect, with a future expiry.
  return {
    banned: true,
    permanent: false,
    until: new Date(bannedUntilTs).toISOString(),
    reason: row.ban_reason || null,
    status,
  };
}

function getSessionTtl(rememberMe) {
  return rememberMe ? REMEMBER_ME_TTL : SESSION_TTL;
}

function buildSessionPayload(user) {
  return {
    userId: user.id,
    roles: Array.isArray(user.roles) ? user.roles : [],
    sessionVersion: Number(user.session_version || 0),
    emailVerified: isEmailVerified(user),
  };
}

function issueSession(res, user, rememberMe) {
  const token = jwt.sign(
    buildSessionPayload(user),
    getJwtSecret(),
    { expiresIn: getSessionTtl(rememberMe) },
  );

  applySessionCookie(res, token, rememberMe);

  return {
    accessToken: token,
    ttl: getSessionTtl(rememberMe),
  };
}

function ensurePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw createError(400, "Password must be at least 8 characters long");
  }

  return password;
}

function ensureEmail(value) {
  const email = normalizeEmail(value);
  if (!email) {
    throw createError(400, "Email is required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createError(400, "Email is invalid");
  }

  return email;
}

async function fetchRoleId(client, roleName) {
  const result = await client.query(
    `
      select id
      from auth.roles
      where name = $1
      limit 1
    `,
    [roleName],
  );

  return result.rows[0]?.id || null;
}

async function fetchUserByCondition(conditionSql, values, db = pool) {
  const result = await db.query(
    `
      ${USER_SELECT_SQL}
      where ${conditionSql}
      group by
        u.id,
        uss.user_id,
        uss.email_verified_at,
        uss.last_login_at,
        uss.last_password_reset_at,
        uss.session_version
      limit 1
    `,
    values,
  );

  return result.rows[0] || null;
}

async function fetchUserById(userId, db = pool) {
  return fetchUserByCondition("u.id = $1", [userId], db);
}

async function fetchUserByEmail(email, db = pool) {
  return fetchUserByCondition("lower(u.email) = lower($1)", [email], db);
}

async function fetchUserByGoogleSub(googleSub, db = pool) {
  return fetchUserByCondition("u.google_sub = $1", [googleSub], db);
}

async function fetchUserByIdentifier(identifier, db = pool) {
  return fetchUserByCondition(
    "(lower(u.email) = lower($1) or u.phone = $1)",
    [identifier],
    db,
  );
}

async function ensureSupportRows(client, userId, options = {}) {
  const emailVerifiedAt = options.emailVerifiedAt || null;

  await client.query(
    `
      insert into app.user_security_state (
        user_id,
        email_verified_at,
        created_at,
        updated_at
      )
      values ($1, $2, now(), now())
      on conflict (user_id) do update
      set
        email_verified_at = coalesce(app.user_security_state.email_verified_at, excluded.email_verified_at),
        updated_at = now()
    `,
    [userId, emailVerifiedAt],
  );

  await client.query(
    `
      insert into app.user_email_preferences (
        user_id,
        transactional_enabled,
        weekly_summary_enabled,
        product_updates_enabled,
        marketing_enabled,
        created_at,
        updated_at
      )
      values ($1, true, true, false, false, now(), now())
      on conflict (user_id) do update
      set updated_at = app.user_email_preferences.updated_at
    `,
    [userId],
  );
}

async function bootstrapLegacySecurityState(client, user) {
  if (user?.has_security_state) {
    return;
  }

  const emailVerifiedAt = user?.email ? new Date().toISOString() : null;
  await ensureSupportRows(client, user.id, { emailVerifiedAt });
}

async function sendVerifyEmailMessage({ userId, email, code }) {
  return sendTemplatedEmail({
    userId,
    email,
    category: "transactional",
    templateKey: "verify_email_code",
    subject: "Verify your SIARA account",
    templateData: {
      code,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    },
    payload: {
      purpose: "verify_email",
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    },
  });
}

async function sendResetPasswordMessage({ userId, email, code }) {
  return sendTemplatedEmail({
    userId,
    email,
    category: "transactional",
    templateKey: "reset_password_code",
    subject: "Reset your SIARA password",
    templateData: {
      code,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    },
    payload: {
      purpose: "reset_password",
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    },
  });
}

function buildRateLimitError(message, resendAvailableAt) {
  const error = createError(429, message);
  error.code = "OTP_RATE_LIMITED";
  error.resendAvailableAt = resendAvailableAt;
  return error;
}

async function issueAndSendOtp({ userId, email, purpose }) {
  if (!SUPPORTED_OTP_PURPOSES.has(purpose)) {
    throw createError(500, "Unsupported OTP purpose");
  }

  const otp = await issueOtpCode({
    userId,
    email,
    purpose,
  });

  if (!otp.ok && otp.rateLimited) {
    throw buildRateLimitError(
      `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`,
      otp.resendAvailableAt,
    );
  }

  if (purpose === "verify_email") {
    await sendVerifyEmailMessage({
      userId,
      email,
      code: otp.code,
    });
  } else {
    await sendResetPasswordMessage({
      userId,
      email,
      code: otp.code,
    });
  }

  return otp;
}

async function registerUser({ email, password, fullName }) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const normalizedEmail = ensureEmail(email);
    const normalizedPassword = ensurePassword(password);
    const { firstName, lastName } = splitFullName(fullName);

    if (!firstName || !lastName) {
      throw createError(400, "Full name is required");
    }

    await client.query("begin");
    transactionStarted = true;

    const existingUser = await fetchUserByEmail(normalizedEmail, client);
    if (existingUser) {
      throw createError(409, "Email already exists");
    }

    const citizenRoleId = await fetchRoleId(client, "citizen");
    if (!citizenRoleId) {
      throw createError(500, 'Default role "citizen" was not found');
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, PASSWORD_SALT_ROUNDS);
    const insertedUser = await client.query(
      `
        insert into auth.users (
          first_name,
          last_name,
          email,
          phone,
          password_hash,
          avatar_url
        )
        values ($1, $2, $3, null, $4, null)
        returning id
      `,
      [firstName, lastName, normalizedEmail, passwordHash],
    );

    const userId = insertedUser.rows[0]?.id;
    await client.query(
      `
        insert into auth.user_roles (user_id, role_id)
        values ($1, $2)
      `,
      [userId, citizenRoleId],
    );

    await ensureSupportRows(client, userId);
    const otp = await issueOtpCode({
      userId,
      email: normalizedEmail,
      purpose: "verify_email",
    }, client);

    await client.query("commit");
    transactionStarted = false;

    let emailSent = true;
    try {
      await sendVerifyEmailMessage({
        userId,
        email: normalizedEmail,
        code: otp.code,
      });
    } catch (error) {
      emailSent = false;
      logAuth("verification_email_send_failed", {
        userId,
        email: normalizedEmail,
        message: error.message,
      });
    }

    const user = await fetchUserById(userId);
    return {
      ok: true,
      requiresEmailVerification: true,
      email: normalizedEmail,
      resendAvailableAt: otp.resendAvailableAt,
      emailSent,
      user: mapUser(user),
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("rollback").catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}

async function sendVerificationCode({ email }) {
  const normalizedEmail = ensureEmail(email);
  const user = await fetchUserByEmail(normalizedEmail);

  if (!user) {
    throw createError(404, "Account not found");
  }

  if (isEmailVerified(user)) {
    throw createError(400, "Email is already verified");
  }

  await issueAndSendOtp({
    userId: user.id,
    email: normalizedEmail,
    purpose: "verify_email",
  });

  return {
    ok: true,
    email: normalizedEmail,
    resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  };
}

async function confirmEmailVerification({ email, code, rememberMe, res }) {
  const normalizedEmail = ensureEmail(email);
  const normalizedCode = normalizeOptionalString(code);
  if (!normalizedCode) {
    throw createError(400, "Verification code is required");
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("begin");
    transactionStarted = true;

    const user = await fetchUserByEmail(normalizedEmail, client);
    if (!user) {
      throw createError(404, "Account not found");
    }

    await verifyOtpCode({
      email: normalizedEmail,
      purpose: "verify_email",
      code: normalizedCode,
    }, client);

    await ensureSupportRows(client, user.id);
    await client.query(
      `
        update app.user_security_state
        set
          email_verified_at = coalesce(email_verified_at, now()),
          last_login_at = now(),
          updated_at = now()
        where user_id = $1
      `,
      [user.id],
    );

    await client.query("commit");
    transactionStarted = false;

    const verifiedUser = await fetchUserById(user.id);
    const session = issueSession(res, verifiedUser, normalizeRememberMe(rememberMe));

    return {
      ok: true,
      user: mapUser(verifiedUser),
      accessToken: session.accessToken,
      requiresEmailVerification: false,
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("rollback").catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}

async function loginUser({ identifier, password, rememberMe, res }) {
  const normalizedIdentifier = normalizeOptionalString(identifier);
  const normalizedPassword = ensurePassword(password);

  if (!normalizedIdentifier) {
    throw createError(400, "Email is required");
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("begin");
    transactionStarted = true;

    let user = await fetchUserByIdentifier(normalizedIdentifier, client);
    if (!user) {
      throw createError(401, "Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(normalizedPassword, user.password_hash);
    if (!passwordMatches) {
      throw createError(401, "Invalid email or password");
    }

    // Auto-lift any expired ban then evaluate current ban state.
    const banState = await evaluateAndLiftExpiredBan(user, client);

    if (banState.permanent) {
      const error = createError(
        403,
        banState.reason
          ? `Your account has been permanently banned: ${banState.reason}`
          : "Your account has been permanently banned.",
      );
      error.code = "ACCOUNT_BANNED";
      error.ban = { permanent: true, until: null, reason: banState.reason || null };
      throw error;
    }

    // Block login when is_active=false but ban metadata wasn't set (legacy).
    if (!user.is_active) {
      const error = createError(403, "Your account is inactive. Contact support if this is unexpected.");
      error.code = "ACCOUNT_INACTIVE";
      throw error;
    }

    await bootstrapLegacySecurityState(client, user);
    if (!user.has_security_state) {
      user = await fetchUserById(user.id, client);
    }

    if (!isEmailVerified(user)) {
      const error = createError(403, "Please verify your email before continuing");
      error.code = EMAIL_VERIFICATION_REQUIRED_CODE;
      error.requiresEmailVerification = true;
      error.email = user.email;
      throw error;
    }

    await client.query(
      `
        update app.user_security_state
        set
          last_login_at = now(),
          updated_at = now()
        where user_id = $1
      `,
      [user.id],
    );

    await client.query("commit");
    transactionStarted = false;

    const authenticatedUser = await fetchUserById(user.id);
    const session = issueSession(res, authenticatedUser, normalizeRememberMe(rememberMe));

    return {
      ok: true,
      user: mapUser(authenticatedUser),
      accessToken: session.accessToken,
      requiresEmailVerification: false,
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("rollback").catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}

async function ensureRoleId(client, roleName) {
  const existing = await client.query(
    `select id from auth.roles where lower(name) = lower($1) limit 1`,
    [roleName],
  );
  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }
  // Create the role if a fresh DB is missing it (idempotent, mirrors the
  // WHERE NOT EXISTS seed pattern used by the role migrations).
  const inserted = await client.query(
    `insert into auth.roles (name)
     select $1
     where not exists (select 1 from auth.roles where lower(name) = lower($1))
     returning id`,
    [roleName],
  );
  if (inserted.rows[0]?.id) {
    return inserted.rows[0].id;
  }
  const again = await client.query(
    `select id from auth.roles where lower(name) = lower($1) limit 1`,
    [roleName],
  );
  return again.rows[0]?.id || null;
}

// One-click demo login. Provisions (or reuses) a labelled account for the
// requested role, marks it verified/active, assigns the role, and issues a
// normal session — no password entry required. Gated by ALLOW_DEMO_LOGIN.
async function demoLogin({ role, rememberMe, res }) {
  if (!isDemoLoginEnabled()) {
    throw createError(403, "Demo login is disabled");
  }

  const key = normalizeDemoRole(role);
  const profile = key ? DEMO_ROLE_PROFILES[key] : null;
  if (!profile) {
    throw createError(400, "Unknown demo role");
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("begin");
    transactionStarted = true;

    const roleId = await ensureRoleId(client, profile.roleName);
    if (!roleId) {
      throw createError(500, `Role "${profile.roleName}" is not available`);
    }

    const existing = await fetchUserByEmail(profile.email, client);
    let userId = existing?.id || null;

    if (!userId) {
      // No password path is exposed for demo accounts; store a random hash.
      const randomSecret = crypto.randomBytes(24).toString("hex");
      const passwordHash = await bcrypt.hash(randomSecret, PASSWORD_SALT_ROUNDS);
      const inserted = await client.query(
        `
          insert into auth.users (first_name, last_name, email, phone, password_hash, avatar_url)
          values ($1, $2, $3, null, $4, null)
          returning id
        `,
        [profile.firstName, profile.lastName, profile.email, passwordHash],
      );
      userId = inserted.rows[0].id;
    } else {
      // Keep the demo account usable even if a previous session deactivated it.
      await client.query(
        `
          update auth.users
          set is_active = true, moderation_status = 'active', banned_until = null, ban_reason = null, updated_at = now()
          where id = $1
        `,
        [userId],
      );
    }

    // Verified security state + email prefs so login-style gates pass.
    await ensureSupportRows(client, userId, { emailVerifiedAt: new Date().toISOString() });

    // Idempotent role assignment.
    await client.query(
      `
        insert into auth.user_roles (user_id, role_id)
        select $1, $2
        where not exists (
          select 1 from auth.user_roles where user_id = $1 and role_id = $2
        )
      `,
      [userId, roleId],
    );

    await client.query(
      `
        update app.user_security_state
        set last_login_at = now(), updated_at = now()
        where user_id = $1
      `,
      [userId],
    );

    await client.query("commit");
    transactionStarted = false;

    const authenticatedUser = await fetchUserById(userId);
    const session = issueSession(res, authenticatedUser, normalizeRememberMe(rememberMe));

    return {
      ok: true,
      demo: true,
      role: key,
      user: mapUser(authenticatedUser),
      accessToken: session.accessToken,
      requiresEmailVerification: false,
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("rollback").catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
}

async function requestPasswordReset({ email }) {
  const normalizedEmail = ensureEmail(email);
  const user = await fetchUserByEmail(normalizedEmail);

  if (!user) {
    return {
      ok: true,
      message: "If an account exists for that email, a reset code will be sent shortly.",
    };
  }

  try {
    await issueAndSendOtp({
      userId: user.id,
      email: normalizedEmail,
      purpose: "reset_password",
    });
  } catch (error) {
    if (error.code !== "OTP_RATE_LIMITED") {
      logAuth("password_reset_send_failed", {
        userId: user.id,
        email: normalizedEmail,
        message: error.message,
      });
    }
  }

  return {
    ok: true,
    message: "If an account exists for that email, a reset code will be sent shortly.",
  };
}

async function verifyResetCode({ email, code }) {
  const normalizedEmail = ensureEmail(email);
  const normalizedCode = normalizeOptionalString(code);
  if (!normalizedCode) {
    throw createError(400, "Reset code is required");
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("begin");
    transactionStarted = true;

    const user = await fetchUserByEmail(normalizedEmail, client);
    if (!user) {
      throw createError(400, "Invalid or expired code");
    }

    await verifyOtpCode({
      email: normalizedEmail,
      purpose: "reset_password",
      code: normalizedCode,
    }, client);

    const resetSession = await createPasswordResetSession({
      userId: user.id,
      email: normalizedEmail,
    }, client);

    await client.query("commit");
    transactionStarted = false;

    return {
      ok: true,
      resetToken: resetSession.resetToken,
      expiresAt: resetSession.expiresAt,
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("rollback").catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}

async function resetPassword({ email, resetToken, newPassword, res }) {
  const normalizedEmail = ensureEmail(email);
  const normalizedPassword = ensurePassword(newPassword);
  const normalizedResetToken = normalizeOptionalString(resetToken);
  if (!normalizedResetToken) {
    throw createError(400, "Reset token is required");
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("begin");
    transactionStarted = true;

    const session = await verifyPasswordResetSession({
      email: normalizedEmail,
      resetToken: normalizedResetToken,
    }, client);

    const passwordHash = await bcrypt.hash(normalizedPassword, PASSWORD_SALT_ROUNDS);
    await client.query(
      `
        update auth.users
        set
          password_hash = $2,
          updated_at = now()
        where id = $1
      `,
      [session.user_id, passwordHash],
    );

    await ensureSupportRows(client, session.user_id);
    await client.query(
      `
        update app.user_security_state
        set
          last_password_reset_at = now(),
          session_version = coalesce(session_version, 0) + 1,
          updated_at = now()
        where user_id = $1
      `,
      [session.user_id],
    );

    await consumePasswordResetSession(session.id, client);
    await client.query("commit");
    transactionStarted = false;

    clearSessionCookie(res);

    return {
      ok: true,
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("rollback").catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}

function getGoogleClientIds() {
  const raw = [
    ...String(process.env.GOOGLE_CLIENT_IDS || "").split(","),
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_MOBILE_WEB_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_AUTH_CLIENT_ID,
    process.env.VITE_GOOGLE_CLIENT_ID,
    process.env.VITE_GOOGLE_AUTH_CLIENT_ID,
  ];

  const seen = new Set();
  const allowed = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    allowed.push(trimmed);
  }

  return allowed;
}

function getGoogleClient() {
  const allowedClientIds = getGoogleClientIds();
  if (allowedClientIds.length === 0) {
    throw createError(
      500,
      "Google OAuth is not configured (set GOOGLE_CLIENT_IDS, GOOGLE_WEB_CLIENT_ID, or GOOGLE_MOBILE_WEB_CLIENT_ID)",
    );
  }

  if (!googleClient) {
    googleClient = new OAuth2Client(allowedClientIds[0]);
  }

  return {
    client: googleClient,
    allowedClientIds,
  };
}

async function verifyGoogleCredential(credential) {
  const normalizedCredential = normalizeOptionalString(credential);
  if (!normalizedCredential) {
    throw createError(400, "Google ID token is required");
  }

  const { client, allowedClientIds } = getGoogleClient();
  logAuth("google_verify_audience", { allowedAudienceCount: allowedClientIds.length });

  let ticket = null;
  try {
    ticket = await client.verifyIdToken({
      idToken: normalizedCredential,
      audience: allowedClientIds,
    });
  } catch (_error) {
    throw createError(401, "Google token is invalid or has the wrong audience");
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email) {
    throw createError(401, "Google account could not be verified");
  }

  return payload;
}

async function createUserFromGoogleIdentity(client, payload) {
  const citizenRoleId = await fetchRoleId(client, "citizen");
  if (!citizenRoleId) {
    throw createError(500, 'Default role "citizen" was not found');
  }

  const firstName = normalizeOptionalString(payload.given_name) || splitFullName(payload.name).firstName || "Google";
  const lastName = normalizeOptionalString(payload.family_name) || splitFullName(payload.name).lastName || "User";
  const randomPasswordHash = await bcrypt.hash(
    crypto.randomBytes(24).toString("hex"),
    PASSWORD_SALT_ROUNDS,
  );

  const insertedUser = await client.query(
    `
      insert into auth.users (
        first_name,
        last_name,
        email,
        phone,
        password_hash,
        avatar_url,
        auth_provider,
        google_sub,
        email_verified_at
      )
      values ($1, $2, $3, null, $4, $5, $6, $7, $8)
      returning id
    `,
    [
      firstName,
      lastName,
      payload.email.toLowerCase(),
      randomPasswordHash,
      payload.picture || null,
      GOOGLE_PROVIDER,
      payload.sub,
      payload.email_verified === true ? new Date().toISOString() : null,
    ],
  );

  const userId = insertedUser.rows[0]?.id;
  await client.query(
    `
      insert into auth.user_roles (user_id, role_id)
      values ($1, $2)
    `,
    [userId, citizenRoleId],
  );

  return userId;
}

async function upsertGoogleIdentityLink(client, userId, payload) {
  const existingProviderLink = await client.query(
    `
      select provider_subject
      from app.user_oauth_identities
      where user_id = $1
        and provider = $2
      limit 1
    `,
    [userId, GOOGLE_PROVIDER],
  );

  if (
    existingProviderLink.rows[0]?.provider_subject
    && existingProviderLink.rows[0].provider_subject !== payload.sub
  ) {
    throw createError(409, "This SIARA account is already linked to a different Google account");
  }

  await client.query(
    `
      insert into app.user_oauth_identities (
        user_id,
        provider,
        provider_subject,
        email,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, now(), now())
      on conflict (provider, provider_subject) do update
      set
        user_id = excluded.user_id,
        email = excluded.email,
        updated_at = now()
    `,
    [userId, GOOGLE_PROVIDER, payload.sub, payload.email.toLowerCase()],
  );
}

async function syncGoogleUserRecord(client, userId, payload) {
  await client.query(
    `
      update auth.users
      set
        avatar_url = coalesce(nullif(avatar_url, ''), $2),
        auth_provider = case
          when auth_provider is null or auth_provider = '' then $3
          else auth_provider
        end,
        google_sub = coalesce(google_sub, $4),
        email_verified_at = case
          when $5::boolean = true then coalesce(email_verified_at, now())
          else email_verified_at
        end,
        updated_at = now()
      where id = $1
    `,
    [
      userId,
      payload.picture || null,
      GOOGLE_PROVIDER,
      payload.sub,
      payload.email_verified === true,
    ],
  );
}

async function loginWithGoogle({ idToken, credential, rememberMe, res }) {
  const payload = await verifyGoogleCredential(idToken || credential);
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("begin");
    transactionStarted = true;

    const existingIdentityBySubject = await client.query(
      `
        select user_id
        from app.user_oauth_identities
        where provider = $1
          and provider_subject = $2
        limit 1
      `,
      [GOOGLE_PROVIDER, payload.sub],
    );

    let userId = existingIdentityBySubject.rows[0]?.user_id || null;

    if (!userId) {
      const existingGoogleUser = await fetchUserByGoogleSub(payload.sub, client);
      userId = existingGoogleUser?.id || null;
    }

    if (!userId && payload.email_verified !== true) {
      throw createError(403, "Google account email must be verified before it can be linked to SIARA");
    }

    if (!userId) {
      const existingUser = await fetchUserByEmail(payload.email, client);
      if (existingUser) {
        if (
          existingUser.google_sub
          && existingUser.google_sub !== payload.sub
        ) {
          throw createError(409, "This email is already linked to a different Google account");
        }
        userId = existingUser.id;
      } else {
        userId = await createUserFromGoogleIdentity(client, payload);
      }
    }

    await upsertGoogleIdentityLink(client, userId, payload);
    await syncGoogleUserRecord(client, userId, payload);
    await ensureSupportRows(client, userId, {
      emailVerifiedAt: payload.email_verified === true ? new Date().toISOString() : null,
    });

    await client.query(
      `
        update app.user_security_state
        set
          email_verified_at = case
            when $2::boolean = true then coalesce(email_verified_at, now())
            else email_verified_at
          end,
          last_login_at = now(),
          updated_at = now()
        where user_id = $1
      `,
      [userId, payload.email_verified === true],
    );

    await client.query("commit");
    transactionStarted = false;

    const user = await fetchUserById(userId);
    const session = issueSession(res, user, normalizeRememberMe(rememberMe));

    return {
      ok: true,
      success: true,
      user: mapUser(user),
      accessToken: session.accessToken,
      requiresEmailVerification: false,
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("rollback").catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}

async function fetchEmailPreferences(userId, db = pool) {
  await db.query(
    `
      insert into app.user_email_preferences (
        user_id,
        transactional_enabled,
        weekly_summary_enabled,
        product_updates_enabled,
        marketing_enabled,
        created_at,
        updated_at
      )
      values ($1, true, true, false, false, now(), now())
      on conflict (user_id) do nothing
    `,
    [userId],
  );

  const result = await db.query(
    `
      select
        user_id,
        weekly_summary_enabled,
        product_updates_enabled,
        marketing_enabled,
        transactional_enabled,
        created_at,
        updated_at
      from app.user_email_preferences
      where user_id = $1
      limit 1
    `,
    [userId],
  );

  return result.rows[0] || null;
}

async function updateEmailPreferences(userId, input = {}, db = pool) {
  const weeklySummaryEnabled = typeof input.weeklySummaryEnabled === "boolean"
    ? input.weeklySummaryEnabled
    : null;
  const productUpdatesEnabled = typeof input.productUpdatesEnabled === "boolean"
    ? input.productUpdatesEnabled
    : null;
  const marketingEnabled = typeof input.marketingEnabled === "boolean"
    ? input.marketingEnabled
    : null;

  const result = await db.query(
    `
      insert into app.user_email_preferences (
        user_id,
        transactional_enabled,
        weekly_summary_enabled,
        product_updates_enabled,
        marketing_enabled,
        created_at,
        updated_at
      )
      values (
        $1,
        true,
        coalesce($2, true),
        coalesce($3, false),
        coalesce($4, false),
        now(),
        now()
      )
      on conflict (user_id) do update
      set
        weekly_summary_enabled = coalesce($2, app.user_email_preferences.weekly_summary_enabled),
        product_updates_enabled = coalesce($3, app.user_email_preferences.product_updates_enabled),
        marketing_enabled = coalesce($4, app.user_email_preferences.marketing_enabled),
        updated_at = now()
      returning
        user_id,
        weekly_summary_enabled,
        product_updates_enabled,
        marketing_enabled,
        transactional_enabled,
        created_at,
        updated_at
    `,
    [userId, weeklySummaryEnabled, productUpdatesEnabled, marketingEnabled],
  );

  return result.rows[0] || null;
}

function relativeTimeLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;

  const years = Math.round(days / 365);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

function humanizeIncidentType(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return "Incident";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replace(/_/g, " ");
}

/**
 * Build a real, unified activity timeline for a user from their reports (and
 * the lifecycle of each: AI classification, officer verification/resolution,
 * admin review), the alert rules they created, and the times those alerts were
 * triggered. Returns newest-first, each event with an ISO `at` and a
 * human-friendly relative `timeLabel`.
 */
async function fetchUserActivityTimeline(userId, { limit = 30 } = {}, db = pool) {
  const safeLimit = Math.max(1, Math.min(60, Number(limit) || 30));
  const events = [];

  const reportsResult = await db.query(
    `
      select
        id, title, incident_type, location_label,
        created_at, reviewed_at, review_verdict,
        verified_at, resolved_at,
        latest_classified_at, latest_predicted_label, latest_ml_confidence
      from app.accident_reports
      where reported_by = $1
      order by created_at desc
      limit 40
    `,
    [userId],
  );

  for (const row of reportsResult.rows) {
    const label = normalizeOptionalString(row.title) || humanizeIncidentType(row.incident_type);
    const where = row.location_label ? ` · ${row.location_label}` : "";

    events.push({
      kind: "report_created",
      at: row.created_at,
      title: "Report created",
      description: `${label}${where}`,
    });

    if (row.latest_classified_at) {
      const predicted = String(row.latest_predicted_label || "").toLowerCase();
      const isSpam = predicted.includes("spam") || predicted.includes("fake");
      const confidence = row.latest_ml_confidence != null
        ? ` (${Math.round(Number(row.latest_ml_confidence) * 100)}% confidence)`
        : "";

      events.push({
        kind: isSpam ? "ai_flag" : "ai_validation",
        at: row.latest_classified_at,
        title: "AI validation",
        description: isSpam
          ? `Flagged for review${confidence}`
          : `Classified as legitimate${confidence}`,
      });
    }

    if (row.verified_at) {
      events.push({
        kind: "report_verified",
        at: row.verified_at,
        title: "Report verified",
        description: `${label} was confirmed by an officer`,
      });
    }

    if (row.resolved_at) {
      events.push({
        kind: "report_resolved",
        at: row.resolved_at,
        title: "Report resolved",
        description: `${label} was marked resolved`,
      });
    }

    if (row.reviewed_at && row.review_verdict) {
      const verdict = String(row.review_verdict).toLowerCase();
      if (verdict === "confirmed_spam") {
        events.push({
          kind: "report_rejected",
          at: row.reviewed_at,
          title: "Report flagged",
          description: `${label} was flagged as spam in review`,
        });
      } else if (verdict === "confirmed_legit") {
        events.push({
          kind: "report_verified",
          at: row.reviewed_at,
          title: "Report confirmed",
          description: `${label} was confirmed legitimate in review`,
        });
      }
    }
  }

  const alertsResult = await db.query(
    `
      select id, name, created_at
      from app.alert_rules
      where user_id = $1
      order by created_at desc
      limit 20
    `,
    [userId],
  );

  for (const row of alertsResult.rows) {
    events.push({
      kind: "alert_created",
      at: row.created_at,
      title: "Alert created",
      description: normalizeOptionalString(row.name) || "New alert rule",
    });
  }

  const triggersResult = await db.query(
    `
      select t.matched_at, t.message_preview, r.name as alert_name
      from app.alert_trigger_log t
      join app.alert_rules r on r.id = t.alert_id
      where r.user_id = $1
      order by t.matched_at desc
      limit 20
    `,
    [userId],
  );

  for (const row of triggersResult.rows) {
    events.push({
      kind: "alert_triggered",
      at: row.matched_at,
      title: "Alert triggered",
      description: normalizeOptionalString(row.message_preview)
        || `${normalizeOptionalString(row.alert_name) || "An alert"} matched a new incident`,
    });
  }

  const tripsResult = await db.query(
    `
      select
        origin_name, destination_name,
        started_at, arrived_at, created_at,
        distance_km, route_type
      from app.travel_histories
      where user_id = $1
      order by coalesce(arrived_at, started_at, created_at) desc
      limit 20
    `,
    [userId],
  );

  for (const row of tripsResult.rows) {
    const from = normalizeOptionalString(row.origin_name) || "Your location";
    const to = normalizeOptionalString(row.destination_name) || "Destination";
    const distance = row.distance_km != null
      ? ` · ${Number(row.distance_km).toFixed(1)} km`
      : "";

    events.push({
      kind: "trip",
      at: row.arrived_at || row.started_at || row.created_at,
      title: row.arrived_at ? "Trip completed" : "Trip taken",
      description: `${from} → ${to}${distance}`,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return events.slice(0, safeLimit).map((event) => ({
    kind: event.kind,
    title: event.title,
    description: event.description,
    at: event.at ? new Date(event.at).toISOString() : null,
    timeLabel: relativeTimeLabel(event.at),
  }));
}

module.exports = {
  EMAIL_VERIFICATION_REQUIRED_CODE,
  JWT_COOKIE_NAME,
  clearSessionCookie,
  confirmEmailVerification,
  demoLogin,
  DEMO_ROLE_KEYS,
  fetchEmailPreferences,
  fetchUserActivityTimeline,
  fetchUserByEmail,
  fetchUserById,
  getCookieOptions,
  isDemoLoginEnabled,
  issueSession,
  loginUser,
  loginWithGoogle,
  mapUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  sendVerificationCode,
  splitFullName,
  updateEmailPreferences,
  verifyResetCode,
};
