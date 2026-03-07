const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const createError = require("http-errors");

const pool = require("../db");

const JWT_COOKIE_NAME = "accessToken";
const TOKEN_TTL = "3d";
const TOKEN_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const SALT_ROUNDS = 12;
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";

function logRegister(message, details = {}) {
  if (IS_DEVELOPMENT) {
    console.info("[auth/register]", message, details);
  }
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

function mapUser(row) {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    avatar_url: row.avatar_url,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    roles: Array.isArray(row.roles) ? row.roles : [],
  };
}

router.post("/register", async (req, res, next) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const firstName = normalizeOptionalString(req.body.first_name);
    const lastName = normalizeOptionalString(req.body.last_name);
    const email = normalizeOptionalString(req.body.email)?.toLowerCase() || null;
    const phone = normalizeOptionalString(req.body.phone);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const avatarUrl = normalizeOptionalString(req.body.avatar_url);

    logRegister("received request", {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      has_avatar_url: Boolean(avatarUrl),
    });

    if (!firstName) {
      throw createError(400, "first_name is required");
    }

    if (!lastName) {
      throw createError(400, "last_name is required");
    }

    if (!password) {
      throw createError(400, "password is required");
    }

    if (!email && !phone) {
      throw createError(400, "Either email or phone is required");
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const existingUserResult = await client.query(
      `
        SELECT id
        FROM auth.users
        WHERE ($1::varchar IS NOT NULL AND email = $1)
           OR ($2::varchar IS NOT NULL AND phone = $2)
        LIMIT 1
      `,
      [email, phone]
    );

    if (existingUserResult.rows.length > 0) {
      logRegister("duplicate rejected", { email, phone });
      throw createError(409, "Email or phone already exists");
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const insertUserResult = await client.query(
      `
        INSERT INTO auth.users (
          first_name,
          last_name,
          email,
          phone,
          password_hash,
          avatar_url
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          first_name,
          last_name,
          email,
          phone,
          avatar_url,
          is_active,
          created_at,
          updated_at
      `,
      [firstName, lastName, email, phone, passwordHash, avatarUrl]
    );

    const newUser = insertUserResult.rows[0];

    const citizenRoleResult = await client.query(
      `
        SELECT id
        FROM auth.roles
        WHERE name = $1
        LIMIT 1
      `,
      ["citizen"]
    );

    if (citizenRoleResult.rows.length === 0) {
      throw createError(500, 'Default role "citizen" was not found');
    }

    await client.query(
      `
        INSERT INTO auth.user_roles (user_id, role_id)
        VALUES ($1, $2)
      `,
      [newUser.id, citizenRoleResult.rows[0].id]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    logRegister("user created", {
      user_id: newUser.id,
      email: newUser.email,
      phone: newUser.phone,
      role: "citizen",
    });

    return res.status(201).json({
      user: {
        ...mapUser({ ...newUser, roles: ["citizen"] }),
      },
    });
  } catch (err) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    logRegister("request failed", {
      message: err.message,
      code: err.code || null,
      status: err.status || 500,
    });

    if (err.code === "23505") {
      return next(createError(409, "Email or phone already exists"));
    }

    return next(err);
  } finally {
    client.release();
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const emailOrPhone = normalizeOptionalString(req.body.emailOrPhone);
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!emailOrPhone) {
      throw createError(400, "emailOrPhone is required");
    }

    if (!password) {
      throw createError(400, "password is required");
    }

    if (!process.env.JWT_ACCESSTOKEN) {
      throw createError(500, "JWT_ACCESSTOKEN is not configured");
    }

    const userResult = await pool.query(
      `
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          u.password_hash,
          u.avatar_url,
          u.is_active,
          u.created_at,
          u.updated_at,
          COALESCE(
            array_agg(r.name) FILTER (WHERE r.name IS NOT NULL),
            '{}'::varchar[]
          ) AS roles
        FROM auth.users u
        LEFT JOIN auth.user_roles ur ON ur.user_id = u.id
        LEFT JOIN auth.roles r ON r.id = ur.role_id
        WHERE u.email = $1 OR u.phone = $1
        GROUP BY u.id
        LIMIT 1
      `,
      [emailOrPhone]
    );

    if (userResult.rows.length === 0) {
      throw createError(401, "Invalid email/phone or password");
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      throw createError(403, "User account is inactive");
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      throw createError(401, "Invalid email/phone or password");
    }

    const accessToken = jwt.sign(
      { userId: user.id, roles: user.roles },
      process.env.JWT_ACCESSTOKEN,
      { expiresIn: TOKEN_TTL }
    );

    res.cookie(JWT_COOKIE_NAME, accessToken, {
      ...getCookieOptions(),
      maxAge: TOKEN_MAX_AGE_MS,
    });

    return res.status(200).json({
      accessToken,
      user: mapUser(user),
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    res.clearCookie(JWT_COOKIE_NAME, getCookieOptions());
    return res.status(200).json({ message: "User has been logged out" });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
