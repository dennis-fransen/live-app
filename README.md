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

**Planning.** This repository currently contains the V1 specification and
roadmap only — no application code yet. See:

- [`docs/SPEC.md`](docs/SPEC.md) — V1 functional spec, domain model, architecture
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased plan from V1 through greenhouse
- [`docs/schema.draft.sql`](docs/schema.draft.sql) — concrete draft Postgres schema

## Stack (planned)

- **Next.js** (App Router) deployed on **Vercel**
- **Supabase** — Postgres, Auth (magic link), Row Level Security, Realtime, `pg_cron`
- **Tailwind CSS + shadcn/ui** for a touch-friendly, tablet-first UI
- **PWA** (installable, offline-tolerant) for the mounted household screen
