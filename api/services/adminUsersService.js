const pool = require("../db");
const { recalculateUserTrustScore } = require("./reportSpamDetectionService");

const STATUS_OPTIONS = new Set(["active", "warned", "suspended", "banned"]);
const FILTER_OPTIONS = new Set([
  "all",
  "active",
  "trusted",
  "at-risk",
  "suspended",
  "banned",
  "police",
  "admin",
]);
const SORT_OPTIONS = new Set([
  "trust_asc",
  "trust_desc",
  "reports_desc",
  "created_desc",
  "last_active_desc",
]);
const POLICE_ROLES = ["police", "police_officer", "police officer"];
const TRUSTED_ROLES = ["trusted", "trusted_reporter"];
const ADMIN_ROLES = ["admin"];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const DEV_LOGS_ENABLED = (process.env.NODE_ENV || "development") !== "production";

function logAdmin(event, details = {}) {
  if (DEV_LOGS_ENABLED) {
    console.info("[admin-users]", event, details);
  }
}

const USERS_BASE_SQL = `
  with role_map as (
    select
      ur.user_id,
      array_agg(distinct r.name) filter (where r.name is not null) as roles
    from auth.user_roles ur
    join auth.roles r on r.id = ur.role_id
    group by ur.user_id
  ),
  report_stats as (
    select
      ar.reported_by as user_id,
      count(*)::int as total_reports,
      count(*) filter (
        where ar.verified_by_officer_id is not null
          or ar.review_verdict = 'confirmed_legit'
          or ar.status = 'verified'
      )::int as verified_reports,
      count(*) filter (
        where ar.latest_predicted_label = 'spam'
          or ar.review_verdict = 'confirmed_spam'
      )::int as spam_reports,
      count(*) filter (where ar.latest_predicted_label = 'out_of_context')::int
        as out_of_context_reports,
      count(*) filter (where ar.latest_predicted_label = 'invalid_location')::int
        as invalid_location_reports,
      count(*) filter (where ar.latest_predicted_label = 'suspicious')::int
        as suspicious_reports,
      count(*) filter (
        where ar.status = 'rejected'
          or ar.review_verdict in ('rejected', 'confirmed_spam')
      )::int as rejected_reports,
      count(*) filter (where ar.status = 'resolved' or ar.resolved_at is not null)::int
        as resolved_reports,
      max(ar.created_at) as last_report_at
    from app.accident_reports ar
    where ar.reported_by is not null
    group by ar.reported_by
  ),
  driver_quiz as (
    select
      dq.user_id,
      dq.latest_risk_score,
      dq.latest_result_label,
      dq.latest_result_title,
      dq.completed_attempts_count,
      dq.last_completed_at
    from app.user_driver_quiz_profile dq
  ),
  occurrence_latest as (
    select distinct on (uorp.user_id)
      uorp.user_id,
      uorp.global_occurrence_score,
      uorp.personalized_occurrence_score,
      uorp.global_risk_level,
      uorp.personalized_risk_level,
      uorp.created_at as latest_at
    from app.user_occurrence_risk_predictions uorp
    order by uorp.user_id, uorp.created_at desc
  )
  select
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.avatar_url,
    u.is_active,
    coalesce(u.moderation_status, 'active') as moderation_status,
    u.auth_provider,
    u.email_verified_at,
    u.created_at,
    u.updated_at,
    uss.last_login_at,
    u.trust_score,
    u.trust_last_updated_at,
    coalesce(rm.roles, '{}'::text[]) as roles,
    rs.total_reports,
    rs.verified_reports,
    rs.spam_reports,
    rs.out_of_context_reports,
    rs.invalid_location_reports,
    rs.suspicious_reports,
    rs.rejected_reports,
    rs.resolved_reports,
    rs.last_report_at,
    dq.latest_risk_score as driver_latest_risk_score,
    dq.latest_result_label as driver_latest_result_label,
    dq.latest_result_title as driver_latest_result_title,
    dq.completed_attempts_count as driver_completed_attempts,
    dq.last_completed_at as driver_last_completed_at,
    occ.global_occurrence_score as latest_global_occurrence_score,
    occ.personalized_occurrence_score as latest_personalized_occurrence_score,
    occ.global_risk_level as latest_global_risk_level,
    occ.personalized_risk_level as latest_personalized_risk_level,
    occ.latest_at as latest_occurrence_at
  from auth.users u
  left join role_map rm on rm.user_id = u.id
  left join report_stats rs on rs.user_id = u.id
  left join driver_quiz dq on dq.user_id = u.id
  left join occurrence_latest occ on occ.user_id = u.id
  LEFT JOIN app.user_security_state uss ON uss.user_id = u.id
`;

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function deriveStatus(row) {
  const moderation = String(row.moderation_status || "").toLowerCase();
  if (moderation === "suspended") return "suspended";
  if (moderation === "banned") return "banned";
  if (moderation === "warned") return "warned";
  if (row.is_active === false) return "inactive";
  return "active";
}

function pickPrimaryRole(roles) {
  const list = Array.isArray(roles) ? roles.map((role) => String(role).toLowerCase()) : [];
  if (list.some((role) => ADMIN_ROLES.includes(role))) return "admin";
  if (list.some((role) => POLICE_ROLES.includes(role))) return "police";
  if (list.some((role) => TRUSTED_ROLES.includes(role))) return "trusted";
  if (list.some((role) => role === "citizen")) return "citizen";
  return list[0] || "user";
}

function buildRiskTier(falseRatio, driverRiskScore, trustScore) {
  const ratio = safeNumber(falseRatio) ?? 0;
  const driver = safeNumber(driverRiskScore) ?? 0;
  const trust = safeNumber(trustScore) ?? 50;

  if (ratio >= 70 || driver >= 80 || trust < 20) {
    return { code: "critical", label: "Critical" };
  }
  if (ratio >= 40 || driver >= 60 || trust < 40) {
    return { code: "high", label: "High" };
  }
  if (ratio >= 15 || driver >= 40 || trust < 60) {
    return { code: "medium", label: "Medium" };
  }
  return { code: "low", label: "Low" };
}

function buildTrustTier(score) {
  const numeric = safeNumber(score);
  if (numeric == null) return { code: "unknown", label: "Reporter trust unknown" };
  if (numeric >= 80) return { code: "high", label: "High confidence reporter" };
  if (numeric >= 60) return { code: "trusted", label: "Trusted reporter" };
  if (numeric >= 40) return { code: "normal", label: "New/normal reporter" };
  if (numeric >= 20) return { code: "low", label: "Low confidence reporter" };
  return { code: "very_low", label: "Very low confidence reporter" };
}

function mapUserRow(row) {
  if (!row) return null;
  const totalReports = Number(row.total_reports || 0);
  const spamReports = Number(row.spam_reports || 0);
  const outOfContextReports = Number(row.out_of_context_reports || 0);
  const invalidLocationReports = Number(row.invalid_location_reports || 0);
  const rejectedReports = Number(row.rejected_reports || 0);
  const falseRatio =
    totalReports > 0
      ? Number(
          (((spamReports + outOfContextReports + invalidLocationReports + rejectedReports) /
            totalReports) *
            100).toFixed(2),
        )
      : 0;

  const trustScoreRaw = Number(row.trust_score);
  const trustScore = Number.isFinite(trustScoreRaw) ? trustScoreRaw : null;
  const driverRiskScore = safeNumber(row.driver_latest_risk_score);
  const status = deriveStatus(row);
  const roles = Array.isArray(row.roles) ? row.roles : [];
  const lastActiveAt = row.last_login_at || row.last_report_at || row.updated_at || null;

  return {
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || row.phone || "User",
    firstName: row.first_name || null,
    lastName: row.last_name || null,
    email: row.email || null,
    phone: row.phone || null,
    avatarUrl: row.avatar_url || null,
    isActive: row.is_active !== false,
    status,
    moderationStatus: String(row.moderation_status || "active").toLowerCase(),
    roles,
    primaryRole: pickPrimaryRole(roles),
    trustScore,
    trustLastUpdatedAt: row.trust_last_updated_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    emailVerifiedAt: row.email_verified_at || null,
    authProvider: row.auth_provider || null,
    lastActiveAt,
    reportStats: {
      totalReports,
      verifiedReports: Number(row.verified_reports || 0),
      spamReports,
      outOfContextReports,
      invalidLocationReports,
      suspiciousReports: Number(row.suspicious_reports || 0),
      rejectedReports,
      resolvedReports: Number(row.resolved_reports || 0),
      falseRatio,
    },
    driverQuiz: {
      latestRiskScore: driverRiskScore,
      latestResultLabel: row.driver_latest_result_label || null,
      latestResultTitle: row.driver_latest_result_title || null,
      completedAttemptsCount: Number(row.driver_completed_attempts || 0),
      lastCompletedAt: row.driver_last_completed_at || null,
    },
    occurrenceRisk: {
      latestPersonalizedScore: safeNumber(row.latest_personalized_occurrence_score),
      latestPersonalizedLevel: row.latest_personalized_risk_level || null,
      latestGlobalScore: safeNumber(row.latest_global_occurrence_score),
      latestGlobalLevel: row.latest_global_risk_level || null,
      latestAt: row.latest_occurrence_at || null,
    },
    riskTier: buildRiskTier(falseRatio, driverRiskScore, trustScore),
    trustTier: buildTrustTier(trustScore),
  };
}

function buildOrderClause(sort) {
  switch (sort) {
    case "trust_desc":
      return "u.trust_score desc nulls last, u.created_at desc";
    case "reports_desc":
      return "coalesce(rs.total_reports, 0) desc, u.created_at desc";
    case "created_desc":
      return "u.created_at desc";
    case "last_active_desc":
      return "coalesce(uss.last_login_at, rs.last_report_at, u.updated_at) desc nulls last";
    case "trust_asc":
    default:
      return "u.trust_score asc nulls last, u.created_at desc";
  }
}

function buildFilterClause(filter, paramOffset) {
  const clauses = [];
  const values = [];

  switch (filter) {
    case "active":
      clauses.push("u.is_active = true and coalesce(u.moderation_status, 'active') = 'active'");
      break;
    case "trusted":
      clauses.push(
        "(coalesce(u.trust_score, 50) >= 60 or exists (select 1 from unnest(coalesce(rm.roles, '{}'::text[])) role where lower(role) in ('trusted', 'trusted_reporter')))",
      );
      break;
    case "at-risk":
      clauses.push(
        "(coalesce(u.trust_score, 50) < 40 or coalesce(rs.total_reports, 0) > 0 and (coalesce(rs.spam_reports, 0) + coalesce(rs.out_of_context_reports, 0) + coalesce(rs.invalid_location_reports, 0) + coalesce(rs.rejected_reports, 0))::numeric / nullif(rs.total_reports, 0) >= 0.4 or coalesce(dq.latest_risk_score, 0) >= 60)",
      );
      break;
    case "suspended":
      clauses.push("coalesce(u.moderation_status, 'active') = 'suspended'");
      break;
    case "banned":
      clauses.push("coalesce(u.moderation_status, 'active') = 'banned'");
      break;
    case "police":
      clauses.push(
        "exists (select 1 from unnest(coalesce(rm.roles, '{}'::text[])) role where lower(role) in ('police', 'police_officer', 'police officer'))",
      );
      break;
    case "admin":
      clauses.push(
        "exists (select 1 from unnest(coalesce(rm.roles, '{}'::text[])) role where lower(role) = 'admin')",
      );
      break;
    case "all":
    default:
      break;
  }

  return { clauses, values, paramOffset };
}

async function getCounts(db = pool) {
  const result = await db.query(
    `
      with role_map as (
        select ur.user_id, array_agg(distinct r.name) filter (where r.name is not null) as roles
        from auth.user_roles ur
        join auth.roles r on r.id = ur.role_id
        group by ur.user_id
      ),
      report_stats as (
        select
          ar.reported_by as user_id,
          count(*)::int as total_reports,
          count(*) filter (
            where ar.latest_predicted_label = 'spam'
              or ar.review_verdict = 'confirmed_spam'
          )::int as spam_reports,
          count(*) filter (where ar.latest_predicted_label = 'out_of_context')::int as out_of_context_reports,
          count(*) filter (where ar.latest_predicted_label = 'invalid_location')::int as invalid_location_reports,
          count(*) filter (
            where ar.status = 'rejected'
              or ar.review_verdict in ('rejected', 'confirmed_spam')
          )::int as rejected_reports
        from app.accident_reports ar
        where ar.reported_by is not null
        group by ar.reported_by
      ),
      driver_quiz as (
        select user_id, latest_risk_score
        from app.user_driver_quiz_profile
      )
      select
        count(*)::int as all_count,
        count(*) filter (
          where u.is_active = true and coalesce(u.moderation_status, 'active') = 'active'
        )::int as active_count,
        count(*) filter (
          where coalesce(u.trust_score, 50) >= 60
            or exists (select 1 from unnest(coalesce(rm.roles, '{}'::text[])) role where lower(role) in ('trusted', 'trusted_reporter'))
        )::int as trusted_count,
        count(*) filter (
          where coalesce(u.trust_score, 50) < 40
            or (coalesce(rs.total_reports, 0) > 0
              and ((coalesce(rs.spam_reports, 0) + coalesce(rs.out_of_context_reports, 0) + coalesce(rs.invalid_location_reports, 0) + coalesce(rs.rejected_reports, 0))::numeric / nullif(rs.total_reports, 0)) >= 0.4)
            or coalesce(dq.latest_risk_score, 0) >= 60
        )::int as at_risk_count,
        count(*) filter (where coalesce(u.moderation_status, 'active') = 'suspended')::int as suspended_count,
        count(*) filter (where coalesce(u.moderation_status, 'active') = 'banned')::int as banned_count,
        count(*) filter (
          where exists (select 1 from unnest(coalesce(rm.roles, '{}'::text[])) role where lower(role) in ('police', 'police_officer', 'police officer'))
        )::int as police_count,
        count(*) filter (
          where exists (select 1 from unnest(coalesce(rm.roles, '{}'::text[])) role where lower(role) = 'admin')
        )::int as admin_count
      from auth.users u
      left join role_map rm on rm.user_id = u.id
      left join report_stats rs on rs.user_id = u.id
      left join driver_quiz dq on dq.user_id = u.id
    `,
  );
  const row = result.rows[0] || {};
  return {
    all: Number(row.all_count || 0),
    active: Number(row.active_count || 0),
    trusted: Number(row.trusted_count || 0),
    atRisk: Number(row.at_risk_count || 0),
    suspended: Number(row.suspended_count || 0),
    banned: Number(row.banned_count || 0),
    police: Number(row.police_count || 0),
    admin: Number(row.admin_count || 0),
  };
}

async function listAdminUsers(query = {}, db = pool) {
  const search = String(query.search || "").trim();
  const filterRaw = String(query.filter || "all").trim().toLowerCase();
  const filter = FILTER_OPTIONS.has(filterRaw) ? filterRaw : "all";
  const sortRaw = String(query.sort || "trust_asc").trim().toLowerCase();
  const sort = SORT_OPTIONS.has(sortRaw) ? sortRaw : "trust_asc";
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number.parseInt(query.offset, 10) || 0);

  const values = [];
  const whereClauses = [];

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    const idx = values.length;
    whereClauses.push(
      `(lower(coalesce(u.first_name, '')) like $${idx} or lower(coalesce(u.last_name, '')) like $${idx} or lower(coalesce(u.email, '')) like $${idx} or lower(coalesce(u.phone, '')) like $${idx} or lower(u.id::text) like $${idx})`,
    );
  }

  const filterParts = buildFilterClause(filter, values.length);
  whereClauses.push(...filterParts.clauses);

  const whereSql = whereClauses.length ? `where ${whereClauses.join(" and ")}` : "";
  const orderSql = `order by ${buildOrderClause(sort)}`;

  values.push(limit + 1);
  const limitParamIndex = values.length;
  values.push(offset);
  const offsetParamIndex = values.length;

  const result = await db.query(
    `${USERS_BASE_SQL} ${whereSql} ${orderSql} limit $${limitParamIndex} offset $${offsetParamIndex}`,
    values,
  );

  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const counts = await getCounts(db);
  const totalForFilter = (() => {
    if (filter === "all") return counts.all;
    if (filter === "active") return counts.active;
    if (filter === "trusted") return counts.trusted;
    if (filter === "at-risk") return counts.atRisk;
    if (filter === "suspended") return counts.suspended;
    if (filter === "banned") return counts.banned;
    if (filter === "police") return counts.police;
    if (filter === "admin") return counts.admin;
    return counts.all;
  })();

  return {
    users: rows.map(mapUserRow),
    counts,
    pagination: {
      limit,
      offset,
      hasMore,
      total: totalForFilter,
    },
  };
}

async function getAdminUserDetails(userId, db = pool) {
  const result = await db.query(`${USERS_BASE_SQL} where u.id = $1 limit 1`, [userId]);
  if (result.rowCount === 0) return null;
  const user = mapUserRow(result.rows[0]);

  const recentReports = await db.query(
    `
      select id, title, status, latest_predicted_label, latest_spam_score,
             review_verdict, verified_by_officer_id, created_at
      from app.accident_reports
      where reported_by = $1
      order by created_at desc
      limit 10
    `,
    [userId],
  );

  return {
    ...user,
    recentReports: recentReports.rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      latestPredictedLabel: row.latest_predicted_label,
      latestSpamScore: safeNumber(row.latest_spam_score),
      reviewVerdict: row.review_verdict,
      verifiedByOfficerId: row.verified_by_officer_id,
      createdAt: row.created_at,
    })),
  };
}

async function updateAdminUserStatus(userId, { status, note } = {}, actor = null) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!STATUS_OPTIONS.has(normalized)) {
    const error = new Error(`status must be one of: ${[...STATUS_OPTIONS].join(", ")}`);
    error.status = 400;
    throw error;
  }

  const isActiveValue = normalized === "active" || normalized === "warned";

  const result = await pool.query(
    `
      update auth.users
      set moderation_status = $2,
          is_active = $3,
          updated_at = now()
      where id = $1
      returning id
    `,
    [userId, normalized, isActiveValue],
  );

  if (result.rowCount === 0) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  logAdmin("status_updated", {
    userId,
    status: normalized,
    actorId: actor?.userId || actor?.id || null,
    note: note ? String(note).slice(0, 500) : null,
  });

  return getAdminUserDetails(userId);
}

async function updateAdminUserRoles(userId, { roles } = {}, actor = null) {
  if (!Array.isArray(roles)) {
    const error = new Error("roles must be an array");
    error.status = 400;
    throw error;
  }

  const normalizedRoles = [
    ...new Set(
      roles
        .map((role) => String(role || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  const client = await pool.connect();
  try {
    await client.query("begin");

    const userExists = await client.query(
      `select id from auth.users where id = $1 limit 1`,
      [userId],
    );
    if (userExists.rowCount === 0) {
      const error = new Error("User not found");
      error.status = 404;
      throw error;
    }

    const roleRows = normalizedRoles.length
      ? await client.query(`select id, name from auth.roles where lower(name) = any($1::text[])`, [
          normalizedRoles,
        ])
      : { rows: [] };

    const knownNames = new Set(roleRows.rows.map((row) => String(row.name).toLowerCase()));
    const unknownRoles = normalizedRoles.filter((role) => !knownNames.has(role));
    if (unknownRoles.length > 0) {
      const error = new Error(`Unknown role(s): ${unknownRoles.join(", ")}`);
      error.status = 400;
      throw error;
    }

    const adminRoleIds = roleRows.rows
      .filter((row) => String(row.name).toLowerCase() === "admin")
      .map((row) => row.id);
    const willHaveAdmin = adminRoleIds.length > 0;

    if (!willHaveAdmin) {
      const adminCheck = await client.query(
        `
          select count(*)::int as admin_count
          from auth.user_roles ur
          join auth.roles r on r.id = ur.role_id
          where lower(r.name) = 'admin' and ur.user_id <> $1
        `,
        [userId],
      );
      if (Number(adminCheck.rows[0]?.admin_count || 0) === 0) {
        const error = new Error("Cannot remove the last remaining admin");
        error.status = 409;
        throw error;
      }
    }

    await client.query(`delete from auth.user_roles where user_id = $1`, [userId]);
    for (const roleRow of roleRows.rows) {
      await client.query(
        `insert into auth.user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
        [userId, roleRow.id],
      );
    }

    await client.query(`update auth.users set updated_at = now() where id = $1`, [userId]);
    await client.query("commit");

    logAdmin("roles_updated", {
      userId,
      roles: normalizedRoles,
      actorId: actor?.userId || actor?.id || null,
    });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return getAdminUserDetails(userId);
}

async function recalculateUserTrustScoreForAdmin(userId, actor = null) {
  const updated = await recalculateUserTrustScore(userId, pool, {
    reason: "admin_manual_recalculation",
  });
  logAdmin("trust_recalculated", {
    userId,
    actorId: actor?.userId || actor?.id || null,
    newTrustScore: updated?.trust_score ?? null,
  });
  return getAdminUserDetails(userId);
}

module.exports = {
  STATUS_OPTIONS: [...STATUS_OPTIONS],
  FILTER_OPTIONS: [...FILTER_OPTIONS],
  SORT_OPTIONS: [...SORT_OPTIONS],
  listAdminUsers,
  getAdminUserDetails,
  updateAdminUserStatus,
  updateAdminUserRoles,
  recalculateUserTrustScoreForAdmin,
  buildRiskTier,
  buildTrustTier,
};
