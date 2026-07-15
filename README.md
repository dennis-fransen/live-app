# Life App

A shared "life operating system" for our family of 4 — starting with the
recurring and one-off tasks that keep a household running (change the water
filter every 2 months, check the softener salt, clean the fridge water line),
plus the calendar-ish things that shape a day (playdate Friday, school closed).

Tasks are **persistent until completed**. Recurring tasks re-queue themselves
based on the model that fits them — a task done late simply shifts its next
occurrence, so the schedule tracks reality instead of nagging you about a date
that already slipped.

It runs on the web and installs as a **PWA** on a wall-mounted tablet in a
central spot in the house, where it defaults to "what does the household need
to do today."

## Status

**V1 in progress.** The tasks-and-events foundation is built: schema +
recurrence engine, magic-link auth with auto-provisioned households, the
tablet-first views (Today / Upcoming / All / Manage) with realtime, and PWA
setup.

- [`docs/SPEC.md`](docs/SPEC.md) — V1 functional spec, domain model, architecture
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased plan from V1 through greenhouse
- [`docs/SETUP.md`](docs/SETUP.md) — **clone → running app** setup & deploy guide

## Quick start

```bash
cp .env.example .env.local          # add your Supabase URL + anon key
npm install
npm run dev                         # http://localhost:3000
```

You also need to apply the SQL in `supabase/migrations/` to your Supabase
project — see [`docs/SETUP.md`](docs/SETUP.md) for the full walkthrough.

## Stack

- **Next.js 15** (App Router) deployed on **Vercel**
- **Supabase** — Postgres, Auth (magic link), Row Level Security, Realtime, `pg_cron`
- **Tailwind CSS v4** for a touch-friendly, tablet-first UI
- **PWA** (installable) for the mounted household screen

## How it fits together

```
src/app/              Routes: /today /upcoming /all /manage /login + auth callback
src/components/        TaskBoard (realtime), TaskCard, tap-to-pick, forms
src/lib/               Supabase clients (server/browser), types, date + board helpers
supabase/migrations/   0001 schema · 0002 recurrence engine · 0003 onboarding
supabase/              setup_realtime_and_cron.sql (run once)
```

The recurrence engine lives in the database (`complete_occurrence` /
`skip_occurrence` RPCs + fixed-schedule materialization), so completion and
re-queue are atomic regardless of which device acts.
