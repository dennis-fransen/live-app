-- Life App — DRAFT Postgres schema (Supabase)
-- Status: illustrative draft for the V1 spec, NOT a finalized migration.
-- Purpose: make the recurrence model concrete. Review before implementing.
--
-- Conventions:
--   * Every domain row carries household_id for RLS + future multi-household.
--   * due_date is a DATE (no time) so daily/weekly cadence never drifts on DST.
--   * completed_at is timestamptz (UTC); "today"/recurrence math use the
--     household timezone.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type item_kind        as enum ('task', 'event');
create type item_scope       as enum ('personal', 'group');
create type recurrence_type  as enum ('none', 'on_completion', 'fixed');
create type interval_unit    as enum ('day', 'week', 'month');
create type occurrence_status as enum ('open', 'done', 'skipped');

-- ---------------------------------------------------------------------------
-- Core household tables
-- ---------------------------------------------------------------------------
create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  timezone    text not null default 'Europe/Oslo',
  created_at  timestamptz not null default now()
);

create table members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  color         text,             -- for avatar chip in tap-to-pick
  is_child      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  color         text,
  icon          text,
  sort_order    int not null default 0
);

-- ---------------------------------------------------------------------------
-- Task definitions (the durable rule; never appears on a list itself)
-- ---------------------------------------------------------------------------
create table task_definitions (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  title               text not null,
  notes               text,
  category_id         uuid references categories(id) on delete set null,

  kind                item_kind  not null default 'task',
  completable         boolean    not null default true,  -- events default to completable too
  scope               item_scope not null default 'group',
  owner_member_id     uuid references members(id) on delete set null, -- for scope=personal
  default_assignee_id uuid references members(id) on delete set null, -- null = "anyone"

  recurrence_type     recurrence_type not null default 'none',
  -- on_completion:
  interval_count      int,               -- e.g. 2
  interval_unit       interval_unit,     -- e.g. 'month'  => every 2 months from completion
  -- fixed: small V1 rule set, e.g.
  --   {"weekdays":[2]}                        -> every Tuesday
  --   {"dates":["2026-08-11","2026-10-16"]}   -> explicit dates (school closed)
  fixed_rule          jsonb,
  auto_skip_overdue_days int,            -- fixed only; null = keep overdue visible

  is_active           boolean not null default true, -- false = paused/archived
  created_by          uuid references members(id) on delete set null,
  created_at          timestamptz not null default now(),

  constraint on_completion_needs_interval check (
    recurrence_type <> 'on_completion'
    or (interval_count is not null and interval_unit is not null)
  ),
  constraint fixed_needs_rule check (
    recurrence_type <> 'fixed' or fixed_rule is not null
  ),
  constraint personal_needs_owner check (
    scope <> 'personal' or owner_member_id is not null
  )
);

-- ---------------------------------------------------------------------------
-- Occurrences (the concrete instances that show up on lists)
-- ---------------------------------------------------------------------------
create table task_occurrences (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  definition_id uuid not null references task_definitions(id) on delete cascade,

  due_date      date not null,
  status        occurrence_status not null default 'open',
  assignee_id   uuid references members(id) on delete set null,

  notes         text,                    -- per-instance notes (grow journal seed)
  completed_at  timestamptz,
  completed_by  uuid references members(id) on delete set null,

  created_at    timestamptz not null default now()
);

create index on task_occurrences (household_id, status, due_date);
create index on task_occurrences (definition_id, status);

-- At most one OPEN occurrence per on_completion definition is enforced in the
-- completion RPC (single transaction), keeping "exactly one live instance".

-- ---------------------------------------------------------------------------
-- Completion RPC (sketch) — atomic complete + respawn for on_completion.
-- ---------------------------------------------------------------------------
-- Pseudocode intent (final version lives in a migration):
--
-- function complete_occurrence(p_occurrence uuid, p_member uuid):
--   occ  := select * from task_occurrences where id = p_occurrence for update;
--   defn := select * from task_definitions where id = occ.definition_id;
--   update task_occurrences
--      set status='done', completed_at=now(), completed_by=p_member
--    where id = occ.id;
--
--   if defn.recurrence_type = 'on_completion' then
--     -- next due = completion date (household TZ) + interval
--     next_due := (now() at time zone hh.timezone)::date
--                 + make_interval_from(defn.interval_count, defn.interval_unit);
--     insert into task_occurrences(household_id, definition_id, due_date,
--                                  assignee_id)
--     values (occ.household_id, defn.id, next_due, defn.default_assignee_id);
--   end if;
--   -- 'none' and 'fixed' do not respawn here.
--
-- skip_occurrence(p_occurrence) mirrors this: status='skipped', and for
-- on_completion it anchors the next occurrence from the skip date so the
-- cadence doesn't stall.

-- ---------------------------------------------------------------------------
-- Fixed materialization (cron) — ensure each active fixed definition has
-- occurrences generated through a rolling horizon (default 60 days).
-- Runs nightly via pg_cron; idempotent (skip dates that already exist).
-- ---------------------------------------------------------------------------
-- select cron.schedule('materialize-fixed', '0 2 * * *',
--   $$ select materialize_fixed_occurrences(); $$);

-- ---------------------------------------------------------------------------
-- RLS (sketch) — every row scoped to the household of the shared login.
-- With a single shared household login in V1 this is a straightforward
-- "row.household_id = current household" policy on every table.
-- ---------------------------------------------------------------------------
