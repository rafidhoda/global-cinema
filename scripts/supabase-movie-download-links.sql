-- Run in Supabase SQL Editor. Stores Wormhole (or other) download links per movie slug.
-- Table: movie_download_links

create table if not exists public.movie_download_links (
  slug text primary key,
  wormhole_url text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.movie_download_links enable row level security;

-- Allow public read (app needs to show links); service role can do anything for API.
create policy "Allow public read" on public.movie_download_links for select using (true);
