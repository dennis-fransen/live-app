# Life App — V1 Specification

> Status: draft for review. Owner: Dennis. Last updated: 2026-07-12.

## 1. Goal

A shared household app that holds our recurring and one-off tasks, keeps them
alive until they're actually done, and re-queues recurring ones intelligently
based on when they were completed. Tablet-first (a mounted screen shows "what
does the household need to do today") but fully usable from any phone or laptop
on the web.

V1 is deliberately scoped to **tasks + events**. Grocery lists and the
greenhouse/food-production module are explicitly later phases (see
[ROADMAP.md](ROADMAP.md)), but the data model below is designed so they slot in
without a rewrite.

## 2. Core concepts

### 2.1 Household & members

- There is **one household** (family of 4). The schema carries a `household_id`
  everywhere so multi-household is possible later, but V1 assumes a single one.
- A **member** is a person in the household (name, avatar/color, optional
  "is_child" flag). Members are *not* auth accounts in V1. **All four family
  members (both parents and both kids) exist as members from day one** and
  appear in the tap-to-pick.
- **Auth is one shared login** (Supabase magic link to a household email).
  Anyone using the app is acting "as the household."
- On the tablet, an **active member** is chosen by tapping an avatar
  ("who am I"). This selection is a lightweight client-side choice — it decides
  who gets credited for a completion and which "personal" tasks are shown. It is
  not a login and requires no password.

> Rationale: a mounted kitchen tablet needs zero-friction attribution. Real
> per-person accounts (for teens with phones, private data) are a Phase 2 option
> — see roadmap. The member table exists now so upgrading later is additive.

### 2.2 Scope: Personal vs Group

Every task/event is one of:

- **Group** — belongs to the whole household. Anyone can do it.
- **Personal** — owned by one member (e.g. a kid's football practice, a
  parent's errand).

**Both scopes are visible on the tablet's shared "Today" list.** Personal items
render with their owner's avatar/color so the household can see, at a glance,
that a kid has football practice or a parent has an appointment today. Scope
therefore drives *ownership and attribution* and the per-member "My tasks"
filter — not visibility. (Truly private personal items are a Phase 2 concern,
arriving with optional individual logins.)

The tablet's **default screen is the "Today" list**, so everyone can walk up and
see what's happening and what needs doing that day.

### 2.3 Assignment (optional)

Independently of scope, a task may be **assigned** to a specific member, or left
**unassigned ("anyone")**. Assignment drives per-person filtering and, later,
notifications. A Group task can still be assigned (e.g. "trash — Dad's job");
an unassigned Group task is up-for-grabs.

### 2.4 Item kind: Task vs Event

- **Task** — a chore you complete. "Change water filter", "Check softener salt".
- **Event** — a time-anchored happening. "School closed", "Playdate with kid
  from school", "Football practice". Events can be one-off or recurring.

**Both are completable** — ticking an item is how the household sees what's
already been handled (someone confirming "yes, the kid was dropped at football"
or "school-closed day acknowledged"). Kind is mainly a semantic/presentation
distinction (events read more like calendar happenings, tasks like chores); the
same recurrence and completion machinery serves both. A definition may carry an
optional `completable` flag so a purely informational event (e.g. a public
holiday) can opt out of the checkbox, but the default is completable.

## 3. Recurrence model (the heart of V1)

We use a **definition → occurrence** model:

- A **task definition** is the durable rule ("change the water filter every 2
  months"). It never itself appears on a to-do list.
- An **occurrence** is a concrete instance that shows up on a list, gets
  completed, carries per-instance notes, and records who did it and when.

This gives us full history for free (when did we last change the filter?), which
directly powers later phases (maintenance history, consumable tracking, grow
journals).

There are **three recurrence types**:

### 3.1 `none` — one-off

The definition spawns exactly one occurrence. Completing it (or, for an event,
its date passing) ends it. Nothing respawns.
_Examples: "Playdate Friday", "School closed July 20", "Fix the gate latch"._

### 3.2 `on_completion` — completion-anchored

**Exactly one open occurrence exists at a time.** When it is completed on date
`C`, the next occurrence is created with `due_date = C + interval`.

> Worked example (your spec): a **weekly** task whose occurrence was due Monday
> but is **completed Wednesday** → the next occurrence is due **Wednesday the
> following week**. The schedule follows reality, not the calendar.

_Examples: water filter every 2 months, check softener salt every 2 weeks,
clean fridge water dispenser monthly._

Interval is expressed as `(interval_count, interval_unit)` where unit ∈
{day, week, month}. Month math clamps to end-of-month (e.g. Jan 31 + 1 month →
Feb 28/29).

### 3.3 `fixed` — calendar-anchored

Occurrences are pre-scheduled from a calendar rule **regardless of completion**.
Completing Tuesday's occurrence does not move next Tuesday's. Missed occurrences
remain visible (overdue) or auto-skip based on a per-definition setting.
_Examples: "Bin day every Tuesday", "School closed" on a set of specific dates._

Fixed rules in V1 are intentionally small: a weekly day-of-week set (e.g. every
Mon/Thu) and/or an explicit list of dates. (Full RRULE is a later nicety.)

### 3.4 Lifecycle & states

An occurrence's `status` is one of:

- `open` — needs doing. **Persistent**: it stays `open` until completed/skipped,
  which is what "tasks are persistent until completed" means.
- `done` — completed (records `completed_at`, `completed_by`).
- `skipped` — explicitly dismissed (e.g. "we're travelling, skip this one").
  For `on_completion` tasks, skipping still anchors the next occurrence from the
  skip date so the cadence doesn't stall.

**Overdue** is derived, not a stored state: an occurrence is overdue when
`status = open AND due_date < today` (household timezone). Overdue items sort to
the top and are visually flagged.

### 3.5 Where the logic runs

- **`on_completion` respawn** happens atomically at completion time via a
  Postgres RPC (`complete_occurrence`) that marks the current one done and
  inserts the next in one transaction. No drift, no double-spawn.
- **`fixed` occurrences** are materialized ahead of time by a nightly
  `pg_cron` job that ensures every fixed definition has occurrences generated
  through a rolling horizon (default 60 days). This keeps "overdue" and
  "upcoming" correct without on-read generation.

## 4. Timezone handling

- The household has a stored **timezone** — `Europe/Oslo`.
- `due_date` is a **date** (not a timestamp) — daily/weekly cadence must not
  drift across DST or UTC boundaries. The Monday→Wednesday example is pure date
  math.
- `completed_at` is a `timestamptz` (UTC). "Today" and all recurrence math are
  evaluated in the household timezone.

## 5. Views (UI)

Tablet-first, large touch targets, high-contrast, glanceable.

1. **Today (default)** — everything due today + overdue: group tasks, today's
   events, and each member's personal items (shown with the owner's avatar so
   parents can see a kid has football, etc.). One tap to complete; completion
   uses the active member (tap-to-pick) for attribution. This is the tablet's
   home screen.
2. **Upcoming** — next 7 days grouped by day (tasks + events).
3. **All / by category** — the full open backlog, filterable by category.
4. **My tasks (Personal)** — filtered to the active member: their personal tasks
   + tasks assigned to them.
5. **Manage** — create/edit/pause/archive task definitions; manage members and
   categories.

**Realtime:** the tablet subscribes to Supabase Realtime so that when someone
completes a task on their phone, the mounted screen updates within a second —
no refresh.

## 6. Categories

Seeded, household-editable. Starter set: *Home maintenance, Kitchen,
Water & filters, School, Social, Health, Other.* Each has a color/icon for the
glanceable UI.

## 7. Out of scope for V1 (explicitly)

- Push notifications / reminders (Phase 2 — tablet is the ambient reminder).
- Individual per-member logins & private data (Phase 2 option).
- Sub-tasks / checklists, attachments/photos, snooze.
- Grocery list (Phase 3).
- Greenhouse / food-production module (Phase 4).
- Consumable inventory ("do we have salt?") (Phase 5) — though the completion
  history V1 records is the foundation for it.

## 8. Non-functional

- **Performance:** lists render from a single indexed query; horizon-bounded so
  data stays small for years.
- **Reliability:** completion is a single atomic RPC; no client-side
  double-spawn possible.
- **Offline tolerance (PWA):** app shell caches; a completion made offline
  queues and syncs. (V1 target: read-through cache + optimistic complete; full
  offline write queue can be Phase 2 if it proves fiddly.)
- **Security:** Supabase RLS scopes every row to the household; the shared login
  only ever sees its own household.

## 9. Key data model (summary)

Full DDL in [`supabase/migrations/`](../supabase/migrations/) (`0001_schema.sql`
+ `0002_functions.sql`). Tables:

- `households` — id, name, timezone.
- `members` — id, household_id, name, color, is_child.
- `categories` — id, household_id, name, color, icon.
- `task_definitions` — the durable rule: title, notes, category, `kind`
  (task|event), `scope` (personal|group), `owner_member_id` (for personal),
  `default_assignee_id`, `recurrence_type` (none|on_completion|fixed),
  `interval_count`, `interval_unit`, `fixed_rule` (jsonb), `is_active`.
- `task_occurrences` — instance: definition_id, `due_date`, `status`,
  `assignee_id`, `completed_at`, `completed_by`, `notes`.

RPCs: `complete_occurrence(occurrence_id, member_id)`,
`skip_occurrence(occurrence_id)`, `materialize_fixed_occurrences()` (cron).

## 10. Resolved decisions

Settled with Dennis (2026-07-12):

1. **Events are completable.** Ticking is how the household sees what's been
   handled. An optional `completable=false` flag exists for purely informational
   items, but the default is completable.
2. **Personal items are visible on the tablet's Today list**, rendered with the
   owner's avatar — so parents can see e.g. a kid's football practice. Scope
   drives ownership/attribution and the "My tasks" filter, not visibility.
3. **Overdue occurrences stay visible** until done (no auto-skip in V1;
   per-definition auto-skip remains a later option).
4. **Household timezone: `Europe/Oslo`.**
5. **All four members (both parents + both kids) exist from day one** and appear
   in the tap-to-pick.
