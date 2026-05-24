-- ============================================================================
-- Info-request replies — track admin triage state
-- ============================================================================
-- When a reporter answers an admin's "Request More Info" prompt, the reply
-- surfaces in the Admin Inbox alongside contact-form submissions. The admin
-- needs the same lightweight triage controls as for contact messages:
-- mark as read once reviewed, archive once handled.
--
-- We track this on app.accident_reports because that's where the info-reply
-- already lives (info_request_message / info_response / info_responded_at).
-- A separate audit table would split a 1-to-1 relationship for no benefit.
--
--   info_response_status        'new' | 'read' | 'archived'
--                                NULL when no info-reply exists (most rows)
--   info_response_handled_at    when status was last changed
--   info_response_handled_by    admin who changed it
--
-- Backfill: any existing row that already has info_responded_at gets
-- status='new' so it shows up in the inbox the first time.
-- Re-runnable.
-- ============================================================================
begin;

alter table app.accident_reports
  add column if not exists info_response_status     varchar(20),
  add column if not exists info_response_handled_at timestamptz,
  add column if not exists info_response_handled_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'accident_reports_info_response_status_check'
       and conrelid = 'app.accident_reports'::regclass
  ) then
    alter table app.accident_reports
      add constraint accident_reports_info_response_status_check
      check (info_response_status is null
             or info_response_status in ('new', 'read', 'archived'));
  end if;
end $$;

-- Backfill: stamp existing info-replies as 'new' so they appear in the inbox.
update app.accident_reports
   set info_response_status = 'new'
 where info_responded_at is not null
   and info_response_status is null;

-- Partial index for the inbox query — only the rows that actually have
-- a reply and aren't archived matter to the admin triage view.
create index if not exists idx_accident_reports_info_response_inbox
  on app.accident_reports (info_responded_at desc)
  where info_responded_at is not null
    and (info_response_status is null or info_response_status <> 'archived');

commit;
