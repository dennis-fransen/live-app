# Life App — Setup & Deploy

V1 is a Next.js (App Router) app on top of Supabase. This gets you from clone
to a running, installable app.

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and the **anon
   public** key.

## 2. Run the database migrations

All schema, functions, seeding, Realtime, and the nightly cron live in
`supabase/migrations/` (`0001`–`0004`) and are applied by `supabase db push`.

**Recommended — automated via GitHub Actions (no manual SQL):**

The repo ships `.github/workflows/supabase-migrations.yml`. It runs
`supabase db push` on GitHub's runners whenever migrations change on `main`
(and on-demand via the Actions tab). Add three repository secrets under
**Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD` | your project's database password |
| `SUPABASE_PROJECT_REF` | Project Settings → General (the project ref) |

Push to `main` (or click **Run workflow**) and the migrations deploy
themselves. Because this runs on GitHub — not the Claude cloud environment — the
direct Postgres connection `db push` needs works without any proxy/egress
tweaks.

**Alternatives:**

- **Supabase's native GitHub integration** (dashboard → Integrations → GitHub)
  reads the same `supabase/migrations/` and applies them on merge, with preview
  branches per PR. Cleanest, but Branching requires the Pro plan and bills
  preview branches.
- **CLI, by hand:** `supabase link --project-ref YOUR_REF && supabase db push`.
- **SQL editor:** paste `0001`→`0004` in order.

> `0004` enables Realtime and schedules the nightly fixed-occurrence cron. It is
> fully guarded, so it is a safe no-op where **pg_cron** or the realtime
> publication is unavailable. Even without cron, fixed-schedule items (e.g.
> "Bin day") are generated 60 days ahead at creation time.

## 3. Configure auth (magic link)

- **Authentication → Providers → Email**: keep **Email** enabled (magic link
  works out of the box).
- **Authentication → URL Configuration**: add your site URL (e.g.
  `http://localhost:3000` and your Vercel URL) to the redirect allow-list.

## 4. Run locally

```bash
cp .env.example .env.local   # fill in the two NEXT_PUBLIC_SUPABASE_* values
npm install
npm run dev
```

Open http://localhost:3000, sign in with your email magic link. On first
sign-in the app auto-provisions your household with four placeholder members,
a set of categories, and a few example tasks. Rename the members under
**Manage**.

## 5. Deploy to Vercel

**Recommended — Vercel's GitHub integration (auto-deploy on push):**

1. Import the repo in Vercel (Add New → Project).
2. Set env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. Every push to `main` then redeploys automatically.
4. Add the resulting Vercel URL to Supabase's auth redirect allow-list (step 3).

Combined with the migrations workflow above, the whole pipeline is
**push to `main` → migrations apply + app redeploys**, with no manual SQL and no
deploy tokens living in any session.

**Alternative — scripted deploy:** `scripts/deploy-vercel.sh` does the same via
the Vercel CLI (needs `VERCEL_TOKEN` + the two Supabase values in the env).
Handy for one-off or CI deploys outside the GitHub integration.

## 6. Install as a PWA on the wall tablet

Open the deployed URL on the tablet's browser and choose **Add to Home
Screen / Install**. It launches standalone and defaults to the **Today** view.

> Icon note: `public/icons/icon.svg` is used for the manifest. iOS/Android
> home-screen icons look best as PNGs — drop `icon-192.png` and `icon-512.png`
> into `public/icons/` and add them to `public/manifest.webmanifest` when you
> want to polish the installed look.

## How auth + data isolation work

- One **shared household login** (a single Supabase auth user) is fine for V1.
  `ensure_household()` links that user to a household on first sign-in.
- **Row Level Security** scopes every row to the caller's household via the
  `household_users` mapping, so the anon key is safe to ship to the browser.
- **Tap-to-pick** ("who am I") is a client-side choice stored per device; it
  attributes completions and filters the personal view — it is not a login.
- Upgrading to per-member logins later is additive: add more `household_users`
  rows. No schema rewrite.
