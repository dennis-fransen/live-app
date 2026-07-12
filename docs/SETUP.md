# Life App — Setup & Deploy

V1 is a Next.js (App Router) app on top of Supabase. This gets you from clone
to a running, installable app.

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and the **anon
   public** key.

## 2. Run the database migrations

Apply the SQL in `supabase/migrations/` in order. Two options:

**Option A — SQL editor (quickest):** paste and run each file in order in the
Supabase SQL editor:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_functions.sql`
3. `supabase/migrations/0003_onboarding.sql`

**Option B — Supabase CLI:**

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Then run the one-time post-setup (Realtime + nightly cron):

- `supabase/setup_realtime_and_cron.sql`

> The cron block needs the **pg_cron** extension (Database → Extensions). If you
> skip cron, fixed-schedule items (e.g. "Bin day") are still generated for the
> first 60 days at creation time — you'd just re-run
> `select materialize_fixed_occurrences();` periodically, or add cron later.

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

1. Import the repo in Vercel.
2. Set the env vars `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. Add the Vercel URL to Supabase's auth redirect allow-list (step 3).

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
