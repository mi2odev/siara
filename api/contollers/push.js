const createError = require("http-errors");
const router = require("express").Router();

const { verifyToken } = require("./verifytoken");
const pool = require("../db");
const {
  deactivatePushSubscription,
  deactivateMobilePushDevice,
  ensureUserNotificationPreferences,
  getPushPublicKey,
  sendPushToUser,
  upsertMobilePushDevice,
  upsertPushSubscription,
  updateUserNotificationPreferences,
} = require("../services/pushService");
const {
  mapNotificationRow,
  markNotificationAsSent,
} = require("../services/notificationsService");
const {
  emitNotificationCreatedToUser,
  hasActiveNotificationSubscriber,
} = require("../services/notificationSocket");

const TEST_IN_APP_NOTIFICATION_CHANNEL = "websocket";

router.get("/public-key", (req, res, next) => {
  try {
    return res.status(200).json({ publicKey: getPushPublicKey() });
  } catch (error) {
    return next(error);
  }
});

router.get("/preferences", verifyToken, async (req, res, next) => {
  try {
    const preferences = await ensureUserNotificationPreferences(req.user.userId);
    return res.status(200).json({ preferences });
  } catch (error) {
    return next(error);
  }
});

router.patch("/preferences", verifyToken, async (req, res, next) => {
  try {
    const preferences = await updateUserNotificationPreferences(req.user.userId, req.body || {});
    return res.status(200).json({ preferences });
  } catch (error) {
    return next(error);
  }
});

router.post("/subscribe", verifyToken, async (req, res, next) => {
  try {
    const subscription = await upsertPushSubscription(
      req.user.userId,
      req.body || {},
      { userAgent: req.get("user-agent") || null },
    );

    return res.status(200).json({ subscription });
  } catch (error) {
    return next(error);
  }
});

router.delete("/unsubscribe", verifyToken, async (req, res, next) => {
  try {
    const endpoint = String(req.body?.endpoint || "").trim();
    if (!endpoint) {
      throw createError(400, "endpoint is required");
    }

    const subscription = await deactivatePushSubscription(req.user.userId, endpoint);
    return res.status(200).json({
      ok: true,
      deactivated: Boolean(subscription),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/mobile/register", verifyToken, async (req, res, next) => {
  try {
    const device = await upsertMobilePushDevice(req.user.userId, req.body || {});
    return res.status(200).json({ device });
  } catch (error) {
    return next(error);
  }
});

router.delete("/mobile/unregister", verifyToken, async (req, res, next) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) {
      throw createError(400, "token is required");
    }

    const device = await deactivateMobilePushDevice(req.user.userId, token);
    return res.status(200).json({
      ok: true,
      deactivated: Boolean(device),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/test", verifyToken, async (req, res, next) => {
  try {
    const testSeed = Date.now();
    const testNotificationId = `test-${testSeed}`;
    const fallbackReportResult = await pool.query(
      `
        with latest_report as (
          select id as report_id
          from app.accident_reports report
          where not exists (
            select 1
            from app.notifications n
            where n.user_id = $1
              and n.report_id = report.id
              and n.channel = $2
              and coalesce(n.event_type, '') <> 'TEST_PUSH'
          )
          order by created_at desc nulls last, id desc
          limit 1
        ),
        latest_test_notification_report as (
          select report_id
          from app.notifications
          where user_id = $1
            and channel = $2
            and event_type = 'TEST_PUSH'
            and report_id is not null
          order by created_at desc nulls last, id desc
          limit 1
        )
        select coalesce(
          (select report_id from latest_report),
          (select report_id from latest_test_notification_report)
        ) as report_id
      `,
      [req.user.userId, TEST_IN_APP_NOTIFICATION_CHANNEL],
    );
    const fallbackReportId = fallbackReportResult.rows[0]?.report_id || null;
    if (!fallbackReportId) {
      throw createError(409, "Cannot create test alert yet because no report exists");
    }

    const notificationResult = await pool.query(
      `
        insert into app.notifications (
          user_id,
          report_id,
          channel,
          status,
          priority,
          event_type,
          title,
          body,
          data
        )
        values ($1, $2::uuid, $3::varchar, 'pending', 2, 'TEST_PUSH', $4::text, $5::text, $6::jsonb)
        on conflict (user_id, report_id, channel) do update
        set
          status = 'pending',
          priority = excluded.priority,
          event_type = excluded.event_type,
          title = excluded.title,
          body = excluded.body,
          data = excluded.data,
          created_at = now(),
          sent_at = null,
          delivered_at = null,
          read_at = null
        where app.notifications.event_type = 'TEST_PUSH'
        returning *
      `,
      [
        req.user.userId,
        fallbackReportId,
        TEST_IN_APP_NOTIFICATION_CHANNEL,
        "SIARA system alerts enabled",
        "This is a test browser notification from SIARA.",
        JSON.stringify({
          source: "push_test",
          mapUrl: "/notifications?pushTest=1",
          notificationId: testNotificationId,
          reportId: fallbackReportId,
          generatedAt: new Date(testSeed).toISOString(),
        }),
      ],
    );

    let notification = mapNotificationRow(notificationResult.rows[0] || null);
    if (notification && hasActiveNotificationSubscriber(req.user.userId)) {
      try {
        notification = await markNotificationAsSent(notification.id, pool) || notification;
      } catch (_error) {
      }
      emitNotificationCreatedToUser(req.user.userId, notification);
    }

    const payload = {
      notificationId: notification?.id || testNotificationId,
      eventType: "TEST_PUSH",
      title: "SIARA system alerts enabled",
      body: "This is a test browser notification from SIARA.",
      url: `/notifications?pushTest=1&notification=${notification?.id || ""}`,
      priority: 2,
      zoneName: null,
      icon: "/siara-push-icon.svg",
      badge: "/siara-push-badge.svg",
      data: {
        notificationId: notification?.id || testNotificationId,
        source: "push_test",
        url: `/notifications?pushTest=1&notification=${notification?.id || ""}`,
      },
    };

    const result = await sendPushToUser(req.user.userId, payload);
    return res.status(200).json({
      ok: result.ok,
      sentCount: result.sentCount,
      deactivatedCount: result.deactivatedCount,
      failureCount: result.failureCount,
      reason: result.reason,
      inAppCreated: Boolean(notification?.id),
      inAppNotificationId: notification?.id || null,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
