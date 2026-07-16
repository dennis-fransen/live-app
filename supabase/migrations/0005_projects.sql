-- Life App — 0005 projects
-- House-improvement projects: an ordered, drag-re-orderable priority list, each
-- with a base cost, a room tag, and an itemized parts / shopping list. Follows
-- the same household-scoped RLS convention as the rest of the schema.

-- ---------------------------------------------------------------------------
-- Projects (the durable "thing we want to do to the house")
-- ---------------------------------------------------------------------------
create table projects (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  title         text not null,
  description   text,
  room          text,                              -- free-text area tag (Guestroom…)
  base_cost     numeric(12,2) not null default 0,  -- labor/delivery/misc, on top of parts
  sort_order    int not null default 0,            -- manual priority (drag to reorder)
  is_done       boolean not null default false,    -- finished => archived out of the list
  created_at    timestamptz not null default now()
);

create index projects_household_idx on projects (household_id, is_done, sort_order);

-- ---------------------------------------------------------------------------
-- Parts — a thing to buy for a project. Line total = quantity * unit_price;
-- the project total is base_cost + sum(line totals). is_bought doubles the list
-- as a shopping list ("what's left to buy").
-- ---------------------------------------------------------------------------
create table project_parts (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  store         text,
  url           text,
  unit_price    numeric(12,2) not null default 0,
  quantity      int not null default 1 check (quantity > 0),
  is_bought     boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index project_parts_project_idx on project_parts (project_id, sort_order);

-- ---------------------------------------------------------------------------
-- Row Level Security — every row scoped to the caller's household(s).
-- ---------------------------------------------------------------------------
alter table projects      enable row level security;
alter table project_parts enable row level security;

create policy projects_rw on projects
  for all using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy project_parts_rw on project_parts
  for all using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

-- ---------------------------------------------------------------------------
-- Realtime — keep the mounted tablet in sync when a project is edited on a
-- phone. Guarded so it stays a safe no-op where the publication is unavailable
-- (plain Postgres in CI), matching 0004.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'projects'
    ) then
      execute 'alter publication supabase_realtime add table public.projects';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'project_parts'
    ) then
      execute 'alter publication supabase_realtime add table public.project_parts';
    end if;
  end if;
end $$;
