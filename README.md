# RunInspire — Running Workout Inspiration App

## Supabase Setup

Run these SQL scripts in the **Supabase Dashboard → SQL Editor** (in order):

1. `supabase/schema.sql` — Creates tables, enums, triggers, and RLS policies
2. `supabase/seed.sql` — Inserts 5 example workouts

## Environment Variables

For local development, copy `.env.local.example` to `.env.local` and fill in values.

For Vercel deployment, set these in the Vercel Dashboard → Project Settings → Environment Variables:
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Supabase Auth Setup

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `https://your-vercel-domain.vercel.app`
- **Redirect URLs:** `https://your-vercel-domain.vercel.app/**`

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)
