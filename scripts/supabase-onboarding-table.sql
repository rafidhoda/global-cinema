-- Run this in Supabase SQL Editor to create the table for onboarding visitor data.
-- Table: onboarding_visitors

create table if not exists public.onboarding_visitors (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  native_language text not null,
  created_at timestamptz not null default now()
);

-- Optional: enable RLS and allow service role to insert (API uses service role key)
alter table public.onboarding_visitors enable row level security;

-- Policy: service role can do anything (default when using service_role key)
-- If you use anon key from client instead, add: create policy "Allow insert" on public.onboarding_visitors for insert with (true);
