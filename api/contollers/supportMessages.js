/**
 * Support inbox controller.
 *
 * Public:
 *   POST /api/support/messages          — submit a contact form message
 *
 * Admin:
 *   GET   /api/admin/support-messages         — list messages (paginated)
 *   GET   /api/admin/support-messages/inbox   — unified inbox: contact
 *           messages + reporter info-responses to "Request More Info"
 *   PATCH /api/admin/support-messages/:id     — update status / admin_note
 *   DELETE /api/admin/support-messages/:id    — soft delete (status='archived')
 */

const createError = require("http-errors");
const publicRouter = require("express").Router();
const adminRouter = require("express").Router();

const pool = require("../db");
const { 
  resolveOptionalAuthenticatedUser,
  verifyTokenAndAdmin,
} = require("./verifytoken");
const { emitNotificationCreatedToUser } = require("../services/notificationSocket");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_STATUSES = new Set(["new", "read", "replied", "archived"]);
const MAX_NAME = 80;
const MAX_EMAIL = 320;
const MAX_SUBJECT = 160;
const MAX_MESSAGE = 4000;

function pickClientIp(req) {
  // Best-effort: trust the first item of X-Forwarded-For when behind a proxy,
  // otherwise fall back to the socket address.
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim().slice(0, 64);
  }
  return (req.ip || req.socket?.remoteAddress || "").slice(0, 64);
}

// ─── Public: submit a contact message ────────────────────────────────────
publicRouter.post("/messages", async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (name.length < 2 || name.length > MAX_NAME) {
      throw createError(400, "Name must be 2-80 characters");
    }
    if (!EMAIL_REGEX.test(email) || email.length > MAX_EMAIL) {
      throw createError(400, "A valid email is required");
    }
    if (subject.length > MAX_SUBJECT) {
      throw createError(400, `Subject must be at most ${MAX_SUBJECT} characters`);
    }
    if (message.length < 10 || message.length > MAX_MESSAGE) {
      throw createError(400, `Message must be 10-${MAX_MESSAGE} characters`);
    }

    // Attach the submitter's user_id when they happen to be signed in. The
    // form is also reachable by unauthenticated visitors, so failures here
    // are silent.
    let submitterUserId = null;
    try {
      const viewer = await resolveOptionalAuthenticatedUser(req);
      submitterUserId = viewer?.userId || viewer?.id || null;
    } catch (_error) {
      submitterUserId = null;
    }

    const userAgent = String(req.headers["user-agent"] || "").slice(0, 500) || null;
    const ipAddress = pickClientIp(req) || null;

    const result = await pool.query(
      `
        INSERT INTO app.support_messages (
          user_id, name, email, subject, message, user_agent, ip_address
        )
        VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7)
        RETURNING id, status, created_at
      `,
      [submitterUserId, name, email, subject, message, userAgent, ipAddress],
    );

    return res.status(201).json({
      message: "Message received. Thank you — we'll get back to you shortly.",
      ticket: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ─── Admin: list contact messages ────────────────────────────────────────
adminRouter.get("/support-messages", verifyTokenAndAdmin, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const statusFilter = String(req.query.status || "").trim().toLowerCase();
    const status = ALLOWED_STATUSES.has(statusFilter) ? statusFilter : null;

    const params = [limit, offset];
    const where = [];
    if (status) {
      params.push(status);
      where.push(`sm.status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const result = await pool.query(
      `
        SELECT sm.id, sm.user_id, sm.name, sm.email, sm.subject, sm.message,
               sm.status, sm.handled_by, sm.handled_at, sm.admin_note,
               sm.user_agent, sm.ip_address, sm.created_at, sm.updated_at,
               concat_ws(' ', submitter.first_name, submitter.last_name) AS submitter_name,
               concat_ws(' ', handler.first_name, handler.last_name)     AS handler_name
          FROM app.support_messages sm
     LEFT JOIN auth.users submitter ON submitter.id = sm.user_id
     LEFT JOIN auth.users handler   ON handler.id = sm.handled_by
       ${whereSql}
      ORDER BY (sm.status = 'new') DESC, sm.created_at DESC
         LIMIT $1 OFFSET $2
      `,
      params,
    );

    const counts = await pool.query(
      `
        SELECT
          count(*)::int                                       AS total,
          count(*) FILTER (WHERE status = 'new')::int         AS new_count,
          count(*) FILTER (WHERE status = 'read')::int        AS read_count,
          count(*) FILTER (WHERE status = 'replied')::int     AS replied_count,
          count(*) FILTER (WHERE status = 'archived')::int    AS archived_count
          FROM app.support_messages
      `,
    );

    return res.status(200).json({
      messages: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        submitterName: row.submitter_name || null,
        name: row.name,
        email: row.email,
        subject: row.subject,
        message: row.message,
        status: row.status,
        handledBy: row.handled_by,
        handlerName: row.handler_name || null,
        handledAt: row.handled_at ? new Date(row.handled_at).toISOString() : null,
        adminNote: row.admin_note,
        userAgent: row.user_agent,
        ipAddress: row.ip_address,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      })),
      pagination: { limit, offset, returned: result.rows.length },
      counts: counts.rows[0] || {},
    });
  } catch (error) {
    return next(error);
  }
});

// ─── Admin: unified inbox — contact messages + Request More Info replies ─
adminRouter.get("/support-messages/inbox", verifyTokenAndAdmin, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 30));

    // Contact form messages (latest first).
    const supportRows = await pool.query(
      `
        SELECT sm.id, sm.name, sm.email, sm.subject, sm.message,
               sm.status, sm.created_at,
               concat_ws(' ', submitter.first_name, submitter.last_name) AS submitter_name
          FROM app.support_messages sm
     LEFT JOIN auth.users submitter ON submitter.id = sm.user_id
      ORDER BY sm.created_at DESC
         LIMIT $1
      `,
      [limit],
    );

    // Reporter info-responses to admin "Request More Info" actions.
    // Archived rows are hidden from the default inbox view — the admin can
    // still see them via the explicit `archived` status filter.
    const infoRows = await pool.query(
      `
        SELECT ar.id AS report_id,
               ar.title AS report_title,
               ar.info_request_message,
               ar.info_response,
               ar.info_responded_at,
               ar.info_requested_at,
               ar.info_requested_by,
               coalesce(ar.info_response_status, 'new') AS info_response_status,
               concat_ws(' ', reporter.first_name, reporter.last_name) AS reporter_name,
               reporter.email AS reporter_email
          FROM app.accident_reports ar
     LEFT JOIN auth.users reporter ON reporter.id = ar.reported_by
         WHERE ar.info_responded_at IS NOT NULL
           AND coalesce(ar.info_response_status, 'new') <> 'archived'
      ORDER BY ar.info_responded_at DESC
         LIMIT $1
      `,
      [limit],
    );

    // Merge into one timeline-style inbox response, sorted by recency.
    const items = [
      ...supportRows.rows.map((row) => ({
        kind: "support_message",
        id: `sm-${row.id}`,
        sourceId: row.id,
        name: row.submitter_name || row.name,
        email: row.email,
        subject: row.subject || null,
        body: row.message,
        status: row.status,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      })),
      ...infoRows.rows.map((row) => ({
        kind: "info_response",
        id: `ir-${row.report_id}`,
        sourceId: row.report_id,
        reportId: row.report_id,
        reportTitle: row.report_title,
        name: row.reporter_name || "Reporter",
        email: row.reporter_email || null,
        subject: `Re: ${row.report_title || "report"}`,
        question: row.info_request_message || null,
        body: row.info_response,
        status: row.info_response_status || "new",
        respondedAt: row.info_responded_at
          ? new Date(row.info_responded_at).toISOString()
          : null,
        requestedAt: row.info_requested_at
          ? new Date(row.info_requested_at).toISOString()
          : null,
        createdAt: row.info_responded_at
          ? new Date(row.info_responded_at).toISOString()
          : null,
      })),
    ].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return res.status(200).json({ items });
  } catch (error) {
    return next(error);
  }
});

// ─── Admin: update status / admin_note ───────────────────────────────────
adminRouter.patch("/support-messages/:id", verifyTokenAndAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) throw createError(400, "id is required");

    const body = req.body && typeof req.body === "object" ? req.body : {};

    const sets = [];
    const params = [id];

    if (body.status !== undefined) {
      const status = String(body.status || "").trim().toLowerCase();
      if (!ALLOWED_STATUSES.has(status)) {
        throw createError(400, `status must be one of: ${[...ALLOWED_STATUSES].join(", ")}`);
      }
      params.push(status);
      sets.push(`status = $${params.length}`);
      params.push(req.user.userId);
      sets.push(`handled_by = $${params.length}`);
      sets.push(`handled_at = now()`);
    }

    if (body.adminNote !== undefined) {
      const note = body.adminNote == null ? null : String(body.adminNote).slice(0, 2000);
      params.push(note);
      sets.push(`admin_note = $${params.length}`);
    }

    if (sets.length === 0) {
      throw createError(400, "Nothing to update");
    }

    sets.push(`updated_at = now()`);
    const result = await pool.query(
      `UPDATE app.support_messages SET ${sets.join(", ")} WHERE id = $1 RETURNING id, status`,
      params,
    );
    if (result.rowCount === 0) throw createError(404, "Message not found");

    return res.status(200).json({ id: result.rows[0].id, status: result.rows[0].status });
  } catch (error) {
    return next(error);
  }
});

// ─── Admin: reply to a support message ──────────────────────────────────
// Stores the reply on the row and pushes a notification to the original
// submitter when they're a registered user. Anonymous submitters (no
// user_id) get the reply persisted so it's preserved in the audit log, but
// they can't receive an in-app notification — admin would email separately.
adminRouter.post("/support-messages/:id/reply", verifyTokenAndAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) throw createError(400, "id is required");

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const reply = String(body.reply || body.message || "").trim();
    if (reply.length < 1) {
      throw createError(400, "Reply cannot be empty");
    }
    if (reply.length > 4000) {
      throw createError(400, "Reply must be at most 4000 characters");
    }

    // Load the original message — need the submitter to notify them and the
    // existing email/name to render in the notification body.
    const existing = await pool.query(
      `SELECT id, user_id, name, email, subject, message
         FROM app.support_messages
        WHERE id = $1
        LIMIT 1`,
      [id],
    );
    if (existing.rowCount === 0) {
      throw createError(404, "Message not found");
    }
    const original = existing.rows[0];

    // Persist the reply, flip status to 'replied', stamp who & when.
    const updated = await pool.query(
      `
        UPDATE app.support_messages
           SET reply_body    = $2,
               reply_sent_at = now(),
               replied_by    = $3,
               status        = 'replied',
               handled_by    = $3,
               handled_at    = now(),
               updated_at    = now()
         WHERE id = $1
        RETURNING id, status, reply_sent_at
      `,
      [id, reply, req.user.userId],
    );

    // Notify the submitter (only if they have an account on the platform).
    if (original.user_id) {
      try {
        const adminRow = await pool.query(
          `SELECT first_name, last_name FROM auth.users WHERE id = $1::uuid LIMIT 1`,
          [req.user.userId],
        );
        const adminName = adminRow.rows[0]
          ? [adminRow.rows[0].first_name, adminRow.rows[0].last_name]
              .filter(Boolean).join(" ").trim() || "The SIARA team"
          : "The SIARA team";

        // Direct INSERT — same pattern as the request_info notification: the
        // orchestrator depends on side-tables we may not have; this keeps the
        // delivery guaranteed.
        const data = {
          messageId: original.id,
          eventType: "SUPPORT_MESSAGE_REPLY",
          category: "system",
          important: true,
          deepLink: "/notifications",
          originalSubject: original.subject || null,
          originalMessage: original.message,
          reply,
          repliedBy: adminName,
        };

        // report_id is now nullable (see db+ migration) so non-incident
        // notifications can be delivered cleanly.
        const insertResult = await pool.query(
          `
            INSERT INTO app.notifications (
              user_id, report_id, channel, status, priority, created_at,
              event_type, title, body, data
            )
            VALUES ($1::uuid, NULL, 'websocket', 'pending', 1, now(),
                    'SUPPORT_MESSAGE_REPLY', $2, $3, $4::jsonb)
            RETURNING id, user_id, report_id, channel, status, priority,
                      created_at, sent_at, delivered_at, read_at,
                      event_type, title, body, data
          `,
          [
            original.user_id,
            `${adminName} replied to your support request`,
            reply.slice(0, 200) + (reply.length > 200 ? "…" : ""),
            JSON.stringify(data),
          ],
        );
        const notificationRow = insertResult.rows[0];
        if (notificationRow) {
          try {
            emitNotificationCreatedToUser(original.user_id, {
              ...notificationRow,
              createdAt: notificationRow.created_at,
              eventType: notificationRow.event_type,
              readAt: notificationRow.read_at,
            });
          } catch (socketError) {
            console.warn("[supportMessages] reply socket emit failed", {
              message: socketError?.message,
            });
          }
          console.info("[supportMessages] reply notification inserted", {
            notificationId: notificationRow.id,
            userId: original.user_id,
          });
        }
      } catch (notifyError) {
        console.warn("[supportMessages] reply notify failed", {
          messageId: id,
          message: notifyError?.message,
        });
      }
    }

    return res.status(200).json({
      id: updated.rows[0].id,
      status: updated.rows[0].status,
      replySentAt: updated.rows[0].reply_sent_at,
      notified: Boolean(original.user_id),
    });
  } catch (error) {
    return next(error);
  }
});

// ─── Admin: update info-reply triage status ─────────────────────────────
// Info-request replies live on app.accident_reports, not app.support_messages.
// We only flip the admin-facing triage state (new → read → archived); the
// reporter's actual answer (info_response) is never touched.
adminRouter.patch("/support-messages/info-replies/:reportId", verifyTokenAndAdmin, async (req, res, next) => {
  try {
    const reportId = String(req.params.reportId || "").trim();
    if (!reportId) throw createError(400, "reportId is required");

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const status = String(body.status || "").trim().toLowerCase();
    if (!["new", "read", "archived"].includes(status)) {
      throw createError(400, "status must be one of: new, read, archived");
    }

    const result = await pool.query(
      `
        UPDATE app.accident_reports
           SET info_response_status     = $2,
               info_response_handled_at = now(),
               info_response_handled_by = $3
         WHERE id = $1
           AND info_responded_at IS NOT NULL
        RETURNING id, info_response_status, info_response_handled_at
      `,
      [reportId, status, req.user.userId],
    );

    if (result.rowCount === 0) {
      throw createError(404, "Info-reply not found for this report");
    }

    return res.status(200).json({
      reportId: result.rows[0].id,
      status:   result.rows[0].info_response_status,
      handledAt: result.rows[0].info_response_handled_at,
    });
  } catch (error) {
    return next(error);
  }
});

// ─── Admin: soft delete (archive) ────────────────────────────────────────
adminRouter.delete("/support-messages/:id", verifyTokenAndAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) throw createError(400, "id is required");
    const result = await pool.query(
      `UPDATE app.support_messages
          SET status = 'archived', handled_by = $2, handled_at = now(), updated_at = now()
        WHERE id = $1 RETURNING id`,
      [id, req.user.userId],
    );
    if (result.rowCount === 0) throw createError(404, "Message not found");
    return res.status(200).json({ id: result.rows[0].id, message: "Archived" });
  } catch (error) {
    return next(error);
  }
});

module.exports = { publicRouter, adminRouter };
