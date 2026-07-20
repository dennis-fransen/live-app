-- Life App — 0007 recipes
-- A household recipe box: the things we make again and again — sourdough, jam
-- from the berries, pickles, weeknight dinners. A recipe is a durable reference
-- (not a task): it carries a category, yield and times, an ordered ingredient
-- list, and ordered steps. Ingredients double as a shopping source — one tap
-- pushes them onto the shared shopping list. Follows the same household-scoped
-- RLS + guarded-realtime convention as projects (0005) and shopping (0006).

-- ---------------------------------------------------------------------------
-- Recipes (the durable "thing we make")
-- ---------------------------------------------------------------------------
create table recipes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  title         text not null,
  description   text,                              -- optional blurb / notes
  category      text,                              -- free-text tag: 'Bread', 'Jelly & preserves'…
  recipe_yield  text,                              -- free-text: "2 loaves", "6 jars"
  prep_minutes  int check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes  int check (cook_minutes is null or cook_minutes >= 0),
  source        text,                              -- URL or "Grandma's book p.42"
  is_favorite   boolean not null default false,
  is_archived   boolean not null default false,    -- retired => hidden from the box
  created_at    timestamptz not null default now()
);

create index recipes_household_idx on recipes (household_id, is_archived, category);

-- ---------------------------------------------------------------------------
-- Ingredients — an ordered line on a recipe. Amount is free text ("500 g",
-- "2 tbsp") deliberately, matching how project_parts keeps quantities simple.
-- ---------------------------------------------------------------------------
create table recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  recipe_id     uuid not null references recipes(id) on delete cascade,
  amount        text,                              -- "500 g", "2 tbsp" (optional)
  name          text not null,                     -- "flour", "sugar"
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index recipe_ingredients_recipe_idx on recipe_ingredients (recipe_id, sort_order);

-- ---------------------------------------------------------------------------
-- Steps — the ordered instructions. Kept as their own rows (not one text blob)
-- so the kitchen tablet can render a large-type, step-at-a-time cooking view.
-- ---------------------------------------------------------------------------
create table recipe_steps (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  recipe_id     uuid not null references recipes(id) on delete cascade,
  body          text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index recipe_steps_recipe_idx on recipe_steps (recipe_id, sort_order);

-- ---------------------------------------------------------------------------
-- Row Level Security — every row scoped to the caller's household(s).
-- ---------------------------------------------------------------------------
alter table recipes            enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps       enable row level security;

create policy recipes_rw on recipes
  for all using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy recipe_ingredients_rw on recipe_ingredients
  for all using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy recipe_steps_rw on recipe_steps
  for all using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

-- ---------------------------------------------------------------------------
-- Realtime — keep the mounted tablet in sync when a recipe is edited on a
-- phone. Guarded so it stays a safe no-op where the publication is unavailable
-- (plain Postgres in CI), matching 0005/0006.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'recipes'
    ) then
      execute 'alter publication supabase_realtime add table public.recipes';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'recipe_ingredients'
    ) then
      execute 'alter publication supabase_realtime add table public.recipe_ingredients';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'recipe_steps'
    ) then
      execute 'alter publication supabase_realtime add table public.recipe_steps';
    end if;
  end if;
end $$;
