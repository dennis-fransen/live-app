-- Life App — 0001 schema
-- Core tables for the tasks-and-events foundation (V1).
--
-- Conventions:
--   * Every domain row carries household_id for RLS + future multi-household.
--   * due_date is a DATE (no time) so daily/weekly cadence never drifts on DST.
--   * completed_at is timestamptz (UTC); "today"/recurrence math use the
--     household timezone.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type item_kind         as enum ('task', 'event');
create type item_scope        as enum ('personal', 'group');
create type recurrence_type   as enum ('none', 'on_completion', 'fixed');
create type interval_unit     as enum ('day', 'week', 'month');
create type occurrence_status as enum ('open', 'done', 'skipped');

-- ---------------------------------------------------------------------------
-- Households + the mapping from an auth user (the shared login) to a household
-- ---------------------------------------------------------------------------
create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  timezone    text not null default 'Europe/Oslo',
  created_at  timestamptz not null default now()
);

-- A shared login (auth.users row) is linked to a household here. V1 uses one
-- link per household; per-member logins later just add more rows.
create table household_users (
  household_id  uuid not null references households(id) on delete cascade,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (household_id, auth_user_id)
);

create table members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  color         text,             -- hex for the avatar chip in tap-to-pick
  is_child      boolean not null default false,
  sort_order    int not null default 0,
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
  -- The date the first occurrence is due (in household tz). Defaults to today.
  start_date          date,
  -- on_completion:
  interval_count      int,
  interval_unit       interval_unit,
  -- fixed rule, one or both of:
  --   {"weekdays":[2]}                        -> every Tuesday (0=Sun .. 6=Sat)
  --   {"dates":["2026-08-11","2026-10-16"]}   -> explicit dates (school closed)
  fixed_rule          jsonb,
  auto_skip_overdue_days int,            -- fixed only; null = keep overdue visible

  is_active           boolean not null default true, -- false = paused/archived
  created_by          uuid references members(id) on delete set null,
  created_at          timestamptz not null default now(),

  constraint on_completion_needs_interval check (
    recurrence_type <> 'on_completion'
    or (interval_count is not null and interval_count > 0 and interval_unit is not null)
  ),
  constraint fixed_needs_rule check (
    recurrence_type <> 'fixed' or fixed_rule is not null
  ),
  constraint personal_needs_owner check (
    scope <> 'personal' or owner_member_id is not null
  )
);

create index task_definitions_household_idx on task_definitions (household_id, is_active);

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

  notes         text,                    -- per-instance notes (grow-journal seed)
  completed_at  timestamptz,
  completed_by  uuid references members(id) on delete set null,

  created_at    timestamptz not null default now()
);

create index task_occurrences_board_idx on task_occurrences (household_id, status, due_date);
create index task_occurrences_definition_idx on task_occurrences (definition_id, status);

-- At most one OPEN occurrence per fixed definition per date (idempotent
-- materialization relies on this).
create unique index task_occurrences_fixed_unique
  on task_occurrences (definition_id, due_date)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- Row Level Security — every row scoped to the caller's household(s).
-- ---------------------------------------------------------------------------
alter table households        enable row level security;
alter table household_users   enable row level security;
alter table members           enable row level security;
alter table categories        enable row level security;
alter table task_definitions  enable row level security;
alter table task_occurrences  enable row level security;

-- Households the current auth user belongs to.
create or replace function current_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from household_users where auth_user_id = auth.uid();
$$;

-- household_users: a user can see/manage only their own membership rows.
create policy household_users_self on household_users
  for all
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- households: visible if the user is linked to it.
create policy households_member_select on households
  for select using (id in (select current_household_ids()));
create policy households_member_write on households
  for update using (id in (select current_household_ids()))
  with check (id in (select current_household_ids()));

-- The remaining tables share the same household-scoped policy shape.
create policy members_rw on members
  for all using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy categories_rw on categories
  for all using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy task_definitions_rw on task_definitions
  for all using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy task_occurrences_rw on task_occurrences
  for all using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));
