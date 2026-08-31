-- Daily cron that invokes the `daily-pipeline` Edge Function.
-- OPT-IN: only apply this if you want the schedule managed in SQL rather than in the
-- Supabase Dashboard (Edge Functions > daily-pipeline > Schedules).
--
-- Prerequisite — store the function's bearer token in Vault so it is not hard-coded here:
--
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'daily_pipeline_token');
--
-- Then edit the cron expression below if desired and run `supabase db push`.
-- '15 6 * * *' = 06:15 UTC every day.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any previous copy of this job before (re)creating it.
select cron.unschedule('deal-check-daily-pipeline')
where exists (select 1 from cron.job where jobname = 'deal-check-daily-pipeline');

select cron.schedule(
  'deal-check-daily-pipeline',
  '15 6 * * *',
  $$
  select net.http_post(
    url     := 'https://nggfbjwpdggrezhtasys.supabase.co/functions/v1/daily-pipeline',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'daily_pipeline_token'
      )
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
