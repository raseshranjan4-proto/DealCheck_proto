-- Daily cron that invokes the `daily-pipeline` Edge Function.
-- OPT-IN: only apply this if you want the schedule managed in SQL rather than clicked in
-- the Dashboard. This is, in fact, what ended up working for this project.
--
-- Auth: the function runs with verify_jwt = false and gates on PIPELINE_TRIGGER_SECRET
-- (query param `key` or header `x-trigger-key`). Set that secret first:
--   supabase secrets set PIPELINE_TRIGGER_SECRET=<a long random string>
--
-- Then replace <PIPELINE_TRIGGER_SECRET> below with the same value and run this.
-- '15 6 * * *' = 06:15 UTC daily.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('deal-check-daily')
where exists (select 1 from cron.job where jobname = 'deal-check-daily');

select cron.schedule(
  'deal-check-daily',
  '15 6 * * *',
  $$
  select net.http_post(
    url     := 'https://nggfbjwpdggrezhtasys.supabase.co/functions/v1/daily-pipeline?key=<PIPELINE_TRIGGER_SECRET>',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);
