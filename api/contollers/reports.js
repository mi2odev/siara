const router = require("express").Router();
const createError = require("http-errors");

const pool = require("../db");
const { verifyToken } = require("./verifytoken");

const REPORT_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_INCIDENT_TYPES = new Set([
  "accident",
  "traffic",
  "danger",
  "weather",
  "roadworks",
  "other",
]);
const ALLOWED_STATUSES = new Set(["pending", "verified", "rejected", "resolved"]);
const SEVERITY_TO_HINT = Object.freeze({
  low: 1,
  medium: 2,
  high: 3,
});
const HINT_TO_SEVERITY = Object.freeze({
  1: "low",
  2: "medium",
  3: "high",
  4: "critical",
});

const REPORT_SELECT_SQL = `
  select
    ar.id,
    ar.reported_by,
    ar.incident_type,
    ar.title,
    ar.description,
    ar.status,
    ar.severity_hint,
    ar.location_label,
    ar.occurred_at,
    ar.created_at,
    ar.updated_at,
    ST_Y(ar.incident_location::geometry) as lat,
    ST_X(ar.incident_location::geometry) as lng,
    concat_ws(' ', u.first_name, u.last_name) as reporter_name,
    u.first_name as reporter_first_name,
    u.last_name as reporter_last_name
  from app.accident_reports ar
  left join auth.users u on u.id = ar.reported_by
`;

function hasRole(user, roleName) {
  return Array.isArray(user?.roles) && user.roles.includes(roleName);
}

function isValidUuid(value) {
  return REPORT_ID_REGEX.test(String(value || "").trim());
}

function normalizeRequiredString(value, fieldName, { minLength = 1, maxLength = 255 } = {}) {
  if (typeof value !== "string") {
    throw createError(400, `${fieldName} is required`);
  }

  const normalized = value.trim();
  if (normalized.length < minLength) {
    throw createError(400, `${fieldName} must be at least ${minLength} characters`);
  }
  if (normalized.length > maxLength) {
    throw createError(400, `${fieldName} must be at most ${maxLength} characters`);
  }
  return normalized;
}

function normalizeOptionalString(value, { maxLength = 1000 } = {}) {
  if (value == null) {
    return null;
  }
  if (typeof value !== "string") {
    throw createError(400, "Invalid text field");
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > maxLength) {
    throw createError(400, `Text field must be at most ${maxLength} characters`);
  }
  return normalized;
}

function normalizeIncidentType(value) {
  const incidentType = normalizeRequiredString(value, "incidentType", {
    minLength: 2,
    maxLength: 40,
  }).toLowerCase();

  if (!ALLOWED_INCIDENT_TYPES.has(incidentType)) {
    throw createError(400, "incidentType is invalid");
  }
  return incidentType;
}

function normalizeSeverity(value) {
  const severity = normalizeRequiredString(value, "severity", {
    minLength: 3,
    maxLength: 10,
  }).toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(SEVERITY_TO_HINT, severity)) {
    throw createError(400, "severity must be one of: low, medium, high");
  }

  return {
    severity,
    severityHint: SEVERITY_TO_HINT[severity],
  };
}

function normalizeStatus(value) {
  const status = normalizeRequiredString(value, "status", {
    minLength: 3,
    maxLength: 20,
  }).toLowerCase();

  if (!ALLOWED_STATUSES.has(status)) {
    throw createError(400, "status is invalid");
  }
  return status;
}

function normalizeCoordinate(value, fieldName, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw createError(400, `${fieldName} must be a valid number`);
  }
  if (numeric < min || numeric > max) {
    throw createError(400, `${fieldName} is out of range`);
  }
  return numeric;
}

function normalizeOccurredAt(value) {
  if (value == null || value === "") {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createError(400, "occurredAt must be a valid datetime");
  }

  if (parsed.getTime() > Date.now() + 5 * 60 * 1000) {
    throw createError(400, "occurredAt cannot be in the future");
  }

  return parsed.toISOString();
}

function mapReportRow(row) {
  if (!row) {
    return null;
  }

  const severityHint = Number(row.severity_hint);

  return {
    id: row.id,
    incidentType: row.incident_type,
    title: row.title,
    description: row.description || "",
    status: row.status,
    severityHint,
    severity: HINT_TO_SEVERITY[severityHint] || null,
    locationLabel: row.location_label || "",
    location: {
      lat: row.lat == null ? null : Number(row.lat),
      lng: row.lng == null ? null : Number(row.lng),
    },
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reportedBy: row.reported_by
      ? {
          id: row.reported_by,
          name:
            row.reporter_name ||
            [row.reporter_first_name, row.reporter_last_name].filter(Boolean).join(" ") ||
            null,
        }
      : null,
  };
}

async function fetchReportRowById(reportId) {
  const result = await pool.query(`${REPORT_SELECT_SQL} where ar.id = $1 limit 1`, [reportId]);
  return result.rows[0] || null;
}

async function requireExistingReport(reportId) {
  const row = await fetchReportRowById(reportId);
  if (!row) {
    throw createError(404, "Report not found");
  }
  return row;
}

function getLocationInput(body) {
  const nestedLocation =
    body?.location && typeof body.location === "object" && !Array.isArray(body.location)
      ? body.location
      : null;

  return {
    lat: nestedLocation?.lat ?? body?.lat,
    lng: nestedLocation?.lng ?? body?.lng,
    label: nestedLocation?.label ?? body?.locationLabel,
  };
}

function normalizeCreatePayload(body) {
  const { severity, severityHint } = normalizeSeverity(body?.severity);
  const locationInput = getLocationInput(body);

  return {
    incidentType: normalizeIncidentType(body?.incidentType),
    title: normalizeRequiredString(body?.title, "title", {
      minLength: 2,
      maxLength: 100,
    }),
    description: normalizeOptionalString(body?.description, { maxLength: 500 }),
    severity,
    severityHint,
    locationLabel: normalizeOptionalString(locationInput.label, { maxLength: 300 }),
    lat: normalizeCoordinate(locationInput.lat, "lat", -90, 90),
    lng: normalizeCoordinate(locationInput.lng, "lng", -180, 180),
    occurredAt: normalizeOccurredAt(body?.occurredAt),
  };
}

function normalizeUpdatePayload(body, { isAdmin }) {
  const updates = {};
  const recognizedKeys = new Set([
    "incidentType",
    "title",
    "description",
    "severity",
    "location",
    "locationLabel",
    "lat",
    "lng",
    "occurredAt",
    "status",
  ]);
  const hasRecognizedInput = Object.keys(body || {}).some((key) => recognizedKeys.has(key));

  if (!hasRecognizedInput) {
    throw createError(400, "No updatable fields were provided");
  }

  if (Object.prototype.hasOwnProperty.call(body, "incidentType")) {
    updates.incidentType = normalizeIncidentType(body.incidentType);
  }

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    updates.title = normalizeRequiredString(body.title, "title", {
      minLength: 2,
      maxLength: 100,
    });
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    updates.description = normalizeOptionalString(body.description, { maxLength: 500 });
  }

  if (Object.prototype.hasOwnProperty.call(body, "severity")) {
    const severity = normalizeSeverity(body.severity);
    updates.severity = severity.severity;
    updates.severityHint = severity.severityHint;
  }

  const locationInput = getLocationInput(body);
  const locationLatProvided = locationInput.lat !== undefined;
  const locationLngProvided = locationInput.lng !== undefined;
  if (locationLatProvided || locationLngProvided) {
    if (!locationLatProvided || !locationLngProvided) {
      throw createError(400, "Both lat and lng are required when updating location");
    }

    updates.lat = normalizeCoordinate(locationInput.lat, "lat", -90, 90);
    updates.lng = normalizeCoordinate(locationInput.lng, "lng", -180, 180);
  }

  if (Object.prototype.hasOwnProperty.call(body, "locationLabel") || locationInput.label !== undefined) {
    updates.locationLabel = normalizeOptionalString(locationInput.label, { maxLength: 300 });
  }

  if (Object.prototype.hasOwnProperty.call(body, "occurredAt")) {
    updates.occurredAt = normalizeOccurredAt(body.occurredAt);
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (!isAdmin) {
      throw createError(403, "Only admins can change report status");
    }
    updates.status = normalizeStatus(body.status);
  }

  if (Object.keys(updates).length === 0) {
    throw createError(400, "No valid updates were provided");
  }

  return updates;
}

function ensureCanManageReport(row, user) {
  const isAdmin = hasRole(user, "admin");
  const isOwner = row.reported_by && row.reported_by === user?.userId;

  if (!isOwner && !isAdmin) {
    throw createError(403, "You are not allowed to modify this report");
  }

  return { isAdmin, isOwner };
}

router.get("/:id", async (req, res, next) => {
  try {
    const reportId = String(req.params.id || "").trim();
    if (!isValidUuid(reportId)) {
      throw createError(400, "Invalid report id");
    }

    const row = await requireExistingReport(reportId);
    return res.status(200).json({ report: mapReportRow(row) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", verifyToken, async (req, res, next) => {
  try {
    const payload = normalizeCreatePayload(req.body || {});

    const insertResult = await pool.query(
      `
        insert into app.accident_reports (
          reported_by,
          incident_type,
          title,
          description,
          status,
          severity_hint,
          incident_location,
          location_label,
          occurred_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          'pending',
          $5,
          ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
          $8,
          $9::timestamptz
        )
        returning id
      `,
      [
        req.user.userId,
        payload.incidentType,
        payload.title,
        payload.description,
        payload.severityHint,
        payload.lng,
        payload.lat,
        payload.locationLabel,
        payload.occurredAt,
      ],
    );

    const createdRow = await requireExistingReport(insertResult.rows[0].id);
    return res.status(201).json({ report: mapReportRow(createdRow) });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", verifyToken, async (req, res, next) => {
  try {
    const reportId = String(req.params.id || "").trim();
    if (!isValidUuid(reportId)) {
      throw createError(400, "Invalid report id");
    }

    const existingRow = await requireExistingReport(reportId);
    const permission = ensureCanManageReport(existingRow, req.user);
    const updates = normalizeUpdatePayload(req.body || {}, permission);

    const setClauses = [];
    const values = [];
    let parameterIndex = 1;

    if (updates.incidentType !== undefined) {
      setClauses.push(`incident_type = $${parameterIndex++}`);
      values.push(updates.incidentType);
    }

    if (updates.title !== undefined) {
      setClauses.push(`title = $${parameterIndex++}`);
      values.push(updates.title);
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${parameterIndex++}`);
      values.push(updates.description);
    }

    if (updates.severityHint !== undefined) {
      setClauses.push(`severity_hint = $${parameterIndex++}`);
      values.push(updates.severityHint);
    }

    if (updates.locationLabel !== undefined) {
      setClauses.push(`location_label = $${parameterIndex++}`);
      values.push(updates.locationLabel);
    }

    if (updates.lat !== undefined && updates.lng !== undefined) {
      setClauses.push(
        `incident_location = ST_SetSRID(ST_MakePoint($${parameterIndex}, $${parameterIndex + 1}), 4326)::geography`,
      );
      values.push(updates.lng, updates.lat);
      parameterIndex += 2;
    }

    if (updates.occurredAt !== undefined) {
      setClauses.push(`occurred_at = $${parameterIndex++}::timestamptz`);
      values.push(updates.occurredAt);
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${parameterIndex++}`);
      values.push(updates.status);
    }

    setClauses.push("updated_at = now()");
    values.push(reportId);

    await pool.query(
      `
        update app.accident_reports
        set ${setClauses.join(", ")}
        where id = $${parameterIndex}
      `,
      values,
    );

    const updatedRow = await requireExistingReport(reportId);
    return res.status(200).json({ report: mapReportRow(updatedRow) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", verifyToken, async (req, res, next) => {
  try {
    const reportId = String(req.params.id || "").trim();
    if (!isValidUuid(reportId)) {
      throw createError(400, "Invalid report id");
    }

    const existingRow = await requireExistingReport(reportId);
    ensureCanManageReport(existingRow, req.user);

    await pool.query(`delete from app.accident_reports where id = $1`, [reportId]);
    return res.status(200).json({ id: reportId, message: "Report deleted successfully" });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
