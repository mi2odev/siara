-- Allow SUPPORT_MESSAGE_REPLY notifications to have both report_id and
-- operational_alert_id NULL.
--
-- When an admin replies to a contact-form message, a notification is dispatched
-- to the submitter via POST /api/admin/support-messages/:id/reply. That
-- notification has no associated accident report or operational alert, so both
-- source FK columns are legitimately NULL.
--
-- The previous constraint update (20260518_allow_system_notifications_without_source.sql)
-- only added TEST_PUSH / SYSTEM_NOTIFICATION / NOTIFICATION_TEST /
-- ACCOUNT_NOTIFICATION_TEST to the "both-NULL-allowed" allowlist, leaving
-- SUPPORT_MESSAGE_REPLY blocked. The INSERT would fail with a CHECK violation,
-- which was silently swallowed by the try/catch in the reply handler — so the
-- user never received the notification.
--
-- Re-runnable (DROP CONSTRAINT IF EXISTS + re-add).

BEGIN;

ALTER TABLE app.notifications
DROP CONSTRAINT IF EXISTS notifications_one_source_check;

ALTER TABLE app.notifications
ADD CONSTRAINT notifications_one_source_check
CHECK (
  (
    ((report_id IS NOT NULL)::integer + (operational_alert_id IS NOT NULL)::integer) = 1
  )
  OR (
    report_id IS NULL
    AND operational_alert_id IS NULL
    AND event_type IN (
      'TEST_PUSH',
      'SYSTEM_NOTIFICATION',
      'NOTIFICATION_TEST',
      'ACCOUNT_NOTIFICATION_TEST',
      'SUPPORT_MESSAGE_REPLY'
    )
  )
);

COMMIT;
