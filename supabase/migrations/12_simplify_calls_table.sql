-- 12_simplify_calls_table.sql
-- Simplify calls table to store: business_name, phone, status, date, inbound
-- Phone number is unique per business (no duplicates)

-- Ensure call_id is nullable in call_events (for inbound SMS without call match)
alter table if exists public.call_events alter column call_id drop not null;

-- Drop existing constraints and indexes that we no longer need
drop index if exists public.calls_to_number_idx;
drop index if exists public.calls_business_started_idx;
drop index if exists public.calls_business_started_from_idx;
drop index if exists public.ix_calls_business_started_at;
drop index if exists public.calls_business_created_idx;
drop index if exists public.calls_agent_idx;

-- Drop the existing calls table (backup first if needed!)
-- We'll recreate it simpler
drop table if exists public.calls cascade;

-- Create simplified calls table
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  business_name text not null,
  phone text not null,
  status text,
  date timestamptz not null default now(),
  inbound jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Unique constraint: one row per business + phone combination
  constraint calls_business_phone_unique unique (business_id, phone)
);

-- Indexes for common queries
create index calls_business_phone_idx on public.calls (business_id, phone);
create index calls_business_date_idx on public.calls (business_id, date desc);
create index calls_phone_idx on public.calls (phone);

-- Trigger for updated_at
create trigger touch_calls_updated_at
  before update on public.calls
  for each row
  execute procedure public.touch_updated_at();

-- RLS policies (reuse existing patterns)
alter table public.calls enable row level security;

drop policy if exists "read calls in business" on public.calls;
create policy "read calls in business" on public.calls
for select using (
  calls.business_id = (select public.current_business_id())
  and not public.is_business_paused(calls.business_id)
);

