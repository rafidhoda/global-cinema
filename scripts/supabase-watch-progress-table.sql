-- Run this in Supabase SQL Editor to create the table for movie watch progress (resume).
-- Table: watch_progress — one row per viewer per movie; position written every ~15s by the client.

create table if not exists public.watch_progress (
  id uuid primary key default gen_random_uuid(),
  viewer_id text not null,
  movie_slug text not null,
  position_seconds numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (viewer_id, movie_slug)
);

create index if not exists idx_watch_progress_lookup
  on public.watch_progress (viewer_id, movie_slug);

alter table public.watch_progress enable row level security;

-- Allow service role (API) to read and upsert; anon can be allowed if you use anon key from client
create policy "Service role full access"
  on public.watch_progress
  for all
  using (true)
  with check (true);
