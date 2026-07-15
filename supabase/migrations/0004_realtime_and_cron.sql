-- Life App — 0004 realtime + nightly cron
-- Enables Realtime for task_occurrences and schedules fixed-occurrence
-- materialization. Fully guarded so it is a safe no-op on environments that
-- lack these Supabase-managed features (e.g. plain Postgres in CI), which keeps
-- `supabase db push` green everywhere.

-- Realtime: add task_occurrences to the supabase_realtime publication.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'task_occurrences'
     ) then
    execute 'alter publication supabase_realtime add table public.task_occurrences';
  end if;
end $$;

-- Nightly materialization of fixed-schedule occurrences (rolling 60-day horizon).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    if exists (select 1 from cron.job where jobname = 'materialize-fixed-occurrences') then
      perform cron.unschedule('materialize-fixed-occurrences');
    end if;
    perform cron.schedule(
      'materialize-fixed-occurrences',
      '0 2 * * *',
      'select public.materialize_fixed_occurrences();'
    );
  end if;
end $$;
