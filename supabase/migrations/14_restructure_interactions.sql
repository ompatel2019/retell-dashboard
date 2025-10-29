-- 14_restructure_interactions.sql
-- Restructure interactions to have ONE row per phone number
-- Store outbound and inbound as JSONB arrays with timestamps
-- Add recent_reply column for the last inbound message

-- Drop existing table and recreate
drop table if exists public.interactions cascade;

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  outbound jsonb default '[]'::jsonb, -- Array of {message: string, timestamp: string}
  inbound jsonb default '[]'::jsonb, -- Array of {message: string, timestamp: string}
  recent_reply text, -- Last message received from this number
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for finding interactions by phone
create index interactions_phone_idx on public.interactions (phone);
create index interactions_created_idx on public.interactions (created_at desc);

-- Index for recent_reply queries
create index interactions_recent_reply_idx on public.interactions (recent_reply) 
  where recent_reply is not null;

-- Trigger for updated_at
create trigger touch_interactions_updated_at
  before update on public.interactions
  for each row
  execute procedure public.touch_updated_at();

-- RLS policies
alter table public.interactions enable row level security;

create policy "allow_read_interactions" on public.interactions
for select using (true);

create policy "service_insert_interactions" on public.interactions
for insert with check (true);

create policy "service_update_interactions" on public.interactions
for update using (true);

