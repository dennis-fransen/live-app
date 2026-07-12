-- Life App — 0002 functions
-- The recurrence engine: initial-occurrence spawning, completion/skip with
-- re-queue, and fixed-schedule materialization.

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------

-- "Today" in a household's own timezone.
create or replace function household_today(p_household uuid)
returns date
language sql
stable
as $$
  select (now() at time zone (select timezone from households where id = p_household))::date;
$$;

-- Add a recurrence interval to a date, with month math that clamps to
-- end-of-month (Postgres date + interval already does this).
create or replace function add_interval(d date, cnt int, unit interval_unit)
returns date
language sql
immutable
as $$
  select (d + case unit
    when 'day'   then make_interval(days   => cnt)
    when 'week'  then make_interval(weeks  => cnt)
    when 'month' then make_interval(months => cnt)
  end)::date;
$$;

-- ---------------------------------------------------------------------------
-- Fixed-schedule materialization
-- ---------------------------------------------------------------------------

-- Materialize occurrences for ONE fixed definition across a rolling horizon.
-- Idempotent: only inserts dates that don't already have an open occurrence.
create or replace function materialize_fixed_for(p_def uuid, p_horizon_days int default 60)
returns int
language plpgsql
as $$
declare
  d          task_definitions%rowtype;
  today      date;
  horizon    date;
  weekdays   int[];
  dt         text;
  n          int;
  inserted   int := 0;
begin
  select * into d from task_definitions where id = p_def;
  if not found or d.recurrence_type <> 'fixed' or not d.is_active then
    return 0;
  end if;

  today   := household_today(d.household_id);
  horizon := today + p_horizon_days;

  -- Weekday rule, e.g. {"weekdays":[2]} => every Tuesday (0=Sun .. 6=Sat)
  if d.fixed_rule ? 'weekdays' then
    select array_agg((x)::int) into weekdays
    from jsonb_array_elements_text(d.fixed_rule->'weekdays') as x;

    insert into task_occurrences (household_id, definition_id, due_date, assignee_id)
    select d.household_id, d.id, gs::date, d.default_assignee_id
    from generate_series(today, horizon, interval '1 day') as gs
    where extract(dow from gs)::int = any(weekdays)
      and not exists (
        select 1 from task_occurrences o
        where o.definition_id = d.id and o.due_date = gs::date and o.status = 'open'
      );
    get diagnostics n = row_count;
    inserted := inserted + n;
  end if;

  -- Explicit dates rule, e.g. {"dates":["2026-08-11"]} (only today or later).
  if d.fixed_rule ? 'dates' then
    for dt in select jsonb_array_elements_text(d.fixed_rule->'dates')
    loop
      if dt::date >= today and not exists (
        select 1 from task_occurrences o
        where o.definition_id = d.id and o.due_date = dt::date and o.status = 'open'
      ) then
        insert into task_occurrences (household_id, definition_id, due_date, assignee_id)
        values (d.household_id, d.id, dt::date, d.default_assignee_id);
        inserted := inserted + 1;
      end if;
    end loop;
  end if;

  return inserted;
end;
$$;

-- Materialize all active fixed definitions (run nightly by pg_cron).
create or replace function materialize_fixed_occurrences(p_horizon_days int default 60)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  total    int := 0;
begin
  for r in select id from task_definitions where recurrence_type = 'fixed' and is_active loop
    total := total + materialize_fixed_for(r.id, p_horizon_days);
  end loop;
  return total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Initial occurrence spawning on definition insert
-- ---------------------------------------------------------------------------
create or replace function spawn_initial_occurrences()
returns trigger
language plpgsql
as $$
declare
  start date;
begin
  if not new.is_active then
    return new;
  end if;

  if new.recurrence_type in ('none', 'on_completion') then
    start := coalesce(new.start_date, household_today(new.household_id));
    insert into task_occurrences (household_id, definition_id, due_date, assignee_id)
    values (new.household_id, new.id, start, new.default_assignee_id);
  elsif new.recurrence_type = 'fixed' then
    perform materialize_fixed_for(new.id);
  end if;

  return new;
end;
$$;

create trigger task_definitions_spawn
  after insert on task_definitions
  for each row execute function spawn_initial_occurrences();

-- ---------------------------------------------------------------------------
-- Complete / skip an occurrence (with re-queue for on_completion)
-- ---------------------------------------------------------------------------

-- Shared closer: mark an occurrence in a terminal state and, for
-- on_completion definitions, anchor the next occurrence from the given date.
create or replace function close_occurrence(
  p_occurrence uuid,
  p_member uuid,
  p_status occurrence_status,
  p_anchor date
) returns uuid
language plpgsql
as $$
declare
  occ       task_occurrences%rowtype;
  d         task_definitions%rowtype;
  next_id   uuid;
  next_due  date;
begin
  select * into occ from task_occurrences where id = p_occurrence for update;
  if not found then
    raise exception 'occurrence % not found', p_occurrence;
  end if;
  if occ.status <> 'open' then
    return null; -- already closed; no-op keeps this idempotent
  end if;

  update task_occurrences
     set status       = p_status,
         completed_at = case when p_status = 'done' then now() else completed_at end,
         completed_by = p_member
   where id = occ.id;

  select * into d from task_definitions where id = occ.definition_id;

  if d.recurrence_type = 'on_completion' then
    -- Next due = anchor date (household tz) + interval. This is the core rule:
    -- a weekly task completed Wednesday re-queues for Wednesday next week.
    next_due := add_interval(p_anchor, d.interval_count, d.interval_unit);
    insert into task_occurrences (household_id, definition_id, due_date, assignee_id)
    values (occ.household_id, occ.definition_id, next_due, d.default_assignee_id)
    returning id into next_id;
  end if;

  return next_id;
end;
$$;

-- Complete: anchor the next occurrence from the completion date.
create or replace function complete_occurrence(p_occurrence uuid, p_member uuid)
returns uuid
language plpgsql
as $$
declare
  hh uuid;
begin
  select household_id into hh from task_occurrences where id = p_occurrence;
  return close_occurrence(p_occurrence, p_member, 'done', household_today(hh));
end;
$$;

-- Skip: still anchor the next occurrence (from the skip date) so cadence
-- doesn't stall for on_completion tasks.
create or replace function skip_occurrence(p_occurrence uuid, p_member uuid)
returns uuid
language plpgsql
as $$
declare
  hh uuid;
begin
  select household_id into hh from task_occurrences where id = p_occurrence;
  return close_occurrence(p_occurrence, p_member, 'skipped', household_today(hh));
end;
$$;

-- Re-open a mistakenly closed occurrence (undo). Does not touch any respawned
-- sibling; V1 keeps undo simple.
create or replace function reopen_occurrence(p_occurrence uuid)
returns void
language plpgsql
as $$
begin
  update task_occurrences
     set status = 'open', completed_at = null, completed_by = null
   where id = p_occurrence;
end;
$$;
