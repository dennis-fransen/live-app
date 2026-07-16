# Life App — Roadmap

Phased plan. Each phase is shippable on its own. The V1 data model
([SPEC.md](SPEC.md), [`supabase/migrations/`](../supabase/migrations/)) is
designed so later phases are additive, not rewrites.

---

## Phase 1 — V1: Tasks & Events (the foundation)

**Goal:** the household's recurring + one-off tasks live in one place, persistent
until done, re-queuing correctly, on a tablet-first PWA.

- Household + members + tap-to-pick "who am I"
- Categories (seeded, editable)
- Task definitions: kind (task/event), scope (personal/group), optional
  assignment
- Three recurrence types: `none`, `on_completion`, `fixed`
- Occurrence lifecycle: open → done/skipped; derived overdue
- Atomic `complete_occurrence` RPC (respawns `on_completion`)
- Nightly `pg_cron` materialization of `fixed` occurrences
- Views: Today (Group, tablet default), Upcoming, All/by-category, My tasks,
  Manage
- Supabase Realtime so the mounted tablet updates live
- Installable PWA (manifest + service worker), tablet-optimized layout
- RLS scoping everything to the household

**Definition of done:** we can add "change water filter every 2 months", "check
salt every 2 weeks", "playdate Friday", "school closed" — complete them from a
phone — and watch the tablet update and the recurring ones re-queue from the
completion date.

---

## Phase 2 — Reminders, presence & polish

- **Push notifications** (Web Push via the PWA): morning digest on the tablet,
  overdue nudges, assigned-task reminders
- **Optional individual accounts** — upgrade a member from tap-to-pick to a real
  login for their phone, enabling private personal tasks (member table already
  supports this)
- Snooze / reschedule an occurrence
- Sub-tasks / simple checklists inside a task
- Photos/attachments on tasks (e.g. photo of the filter model to buy)
- Full offline write queue for the PWA if V1's optimistic approach proves thin

---

## Phase 3 — Grocery list

- Shared, realtime grocery list (the tablet is perfect for "add milk" on the way
  past)
- Aisle/category grouping, check-off, clear-completed
- **Staples**: items that auto-re-add on a cadence (ties into the same
  recurrence engine)
- Optional link from a task → shopping (e.g. completing "check salt" can add
  "softener salt" to the list)

---

## Phase 4 — Greenhouse / food production

The big one. Turns the app into a growing companion.

- **Grows**: a crop planted in a place/season (e.g. "Tomatoes — greenhouse bed 2
  — 2027")
- **Seeding & transplant schedule**: when to sow, when to pot on, when to plant
  out — surfaced as tasks in the same engine
- **Expected harvest windows**: "ready to harvest soon" surfaced on the tablet
- **Grow journal / notes**: per-grow observations so we learn year over year
  ("this variety bolted in the heat — start earlier next time")
- Season-over-season comparison: carry notes forward when planning next year

---

## Phase 5 — Inventory & insights

- **Consumable inventory** — answers "do we have salt / filters in stock?"
  driven by completion history + simple on-hand counts
- **Maintenance history & cost** — spend on filters/salt/consumables over time
- **Household insights** — who does what, cadence adherence, upcoming load

---

## Guiding principles

- **One recurrence engine.** Staples (Phase 3) and seeding schedules (Phase 4)
  reuse the Phase 1 definition/occurrence model rather than inventing new ones.
- **History is a feature.** Every completion is recorded from V1, because the
  interesting later features (inventory, grow learnings, cost) are all built on
  it.
- **Tablet-first, phone-capable.** Every phase must feel right on the mounted
  screen and on a phone.
- **Additive schema.** New phases add tables/columns; they don't rewrite Phase 1.
