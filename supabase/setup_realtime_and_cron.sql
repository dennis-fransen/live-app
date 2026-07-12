-- Life App — post-migration setup (run once in the Supabase SQL editor).
-- These depend on Supabase-managed features (Realtime publication, pg_cron),
-- so they live outside the numbered migrations.

-- 1) Realtime: let the mounted tablet receive live occurrence changes.
alter publication supabase_realtime add table public.task_occurrences;

-- 2) Nightly materialization of fixed-schedule occurrences (keeps "Bin day"
--    and school-closed dates generated across a rolling 60-day horizon).
--    Requires the pg_cron extension (enable it under Database -> Extensions).
create extension if not exists pg_cron;

select cron.schedule(
  'materialize-fixed-occurrences',
  '0 2 * * *',                              -- 02:00 daily
  $$ select public.materialize_fixed_occurrences(); $$
);
