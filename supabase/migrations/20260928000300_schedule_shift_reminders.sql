-- =====================================================================
-- 근무 시작 알림 스케줄러 (pg_cron + pg_net → Edge Function)
-- 사전 준비 (SQL Editor에서 1회, 값은 프로젝트에 맞게):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<임의의 긴 랜덤 문자열>', 'shift_reminder_cron_secret');
--   → 같은 랜덤 문자열을 Edge Function 시크릿 CRON_SECRET 으로 등록
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 5분마다 발송 함수 호출 (같은 이름으로 재실행하면 기존 잡을 갱신)
select cron.schedule(
  'send-shift-reminders',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/send-shift-reminders',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                                   where name = 'shift_reminder_cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

-- 발송 이력 30일 보관
select cron.schedule(
  'purge-notification-log',
  '17 3 * * *',
  $job$ delete from public.notification_log where sent_at < now() - interval '30 days' $job$
);
