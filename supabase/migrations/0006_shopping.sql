-- Life App — 0006 shopping list
-- A single running household shopping list of things we've run out of (milk,
-- butter, dishwasher salt…). Quick to add; items can be ticked off one by one
-- or the whole list marked bought at once (e.g. when copied to a paper list).
-- Household-scoped RLS, same shape as the rest of the schema.

create table shopping_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  note          text,                            -- optional "2L", "the blue one"
  is_bought     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index shopping_items_household_idx
  on shopping_items (household_id, is_bought, created_at);

alter table shopping_items enable row level security;

create policy shopping_items_rw on shopping_items
  for all using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

-- Realtime — keep the mounted tablet and phones in sync. Guarded so it stays a
-- safe no-op where the publication is unavailable (plain Postgres in CI).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'shopping_items'
     ) then
    execute 'alter publication supabase_realtime add table public.shopping_items';
  end if;
end $$;
