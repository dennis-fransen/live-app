-- Life App — 0003 onboarding
-- ensure_household(): idempotently provisions a household for the current auth
-- user (the shared login) with members, categories, and a few example tasks so
-- the app is populated on first sign-in. Returns the household id.

create or replace function ensure_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hh          uuid;
  cat_water   uuid;
  cat_kitchen uuid;
  cat_home    uuid;
  cat_school  uuid;
  cat_social  uuid;
  m_p1        uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Already provisioned? Return the existing household.
  select household_id into hh from household_users where auth_user_id = auth.uid() limit 1;
  if hh is not null then
    return hh;
  end if;

  insert into households (name) values ('Our Household') returning id into hh;
  insert into household_users (household_id, auth_user_id) values (hh, auth.uid());

  -- Members (rename these in Manage). Two adults, two kids.
  insert into members (household_id, name, color, is_child, sort_order) values
    (hh, 'Parent 1', '#2563eb', false, 0) returning id into m_p1;
  insert into members (household_id, name, color, is_child, sort_order) values
    (hh, 'Parent 2', '#db2777', false, 1),
    (hh, 'Kid 1',    '#16a34a', true,  2),
    (hh, 'Kid 2',    '#f59e0b', true,  3);

  -- Categories.
  insert into categories (household_id, name, color, icon, sort_order) values
    (hh, 'Water & filters', '#0ea5e9', 'droplet',   0) returning id into cat_water;
  insert into categories (household_id, name, color, icon, sort_order) values
    (hh, 'Kitchen',         '#f97316', 'utensils',  1) returning id into cat_kitchen;
  insert into categories (household_id, name, color, icon, sort_order) values
    (hh, 'Home maintenance','#6366f1', 'wrench',     2) returning id into cat_home;
  insert into categories (household_id, name, color, icon, sort_order) values
    (hh, 'School',          '#8b5cf6', 'book',       3) returning id into cat_school;
  insert into categories (household_id, name, color, icon, sort_order) values
    (hh, 'Social',          '#ec4899', 'users',      4) returning id into cat_social;
  insert into categories (household_id, name, color, icon, sort_order) values
    (hh, 'Health',          '#ef4444', 'heart',      5),
    (hh, 'Other',           '#64748b', 'dot',        6);

  -- Example task definitions (the spawn trigger creates their occurrences).
  insert into task_definitions
    (household_id, title, category_id, kind, scope, recurrence_type, interval_count, interval_unit)
  values
    (hh, 'Change water filter',           cat_water,   'task', 'group', 'on_completion', 2, 'month'),
    (hh, 'Check softener salt',           cat_water,   'task', 'group', 'on_completion', 2, 'week'),
    (hh, 'Clean fridge water dispenser',  cat_kitchen, 'task', 'group', 'on_completion', 1, 'month');

  -- A fixed weekly chore: bin day every Tuesday (0=Sun .. 6=Sat).
  insert into task_definitions
    (household_id, title, category_id, kind, scope, recurrence_type, fixed_rule)
  values
    (hh, 'Bin day', cat_home, 'task', 'group', 'fixed', '{"weekdays":[2]}'::jsonb);

  return hh;
end;
$$;

-- Allow the app (authenticated role) to call the RPCs.
grant execute on function ensure_household()                       to authenticated;
grant execute on function complete_occurrence(uuid, uuid)          to authenticated;
grant execute on function skip_occurrence(uuid, uuid)              to authenticated;
grant execute on function reopen_occurrence(uuid)                  to authenticated;
grant execute on function materialize_fixed_occurrences(int)       to authenticated, service_role;
