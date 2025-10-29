-- 13_interactions_table.sql
-- Create interactions table to track SMS sent/received per phone number

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  outbound text, -- SMS we sent to them
  inbound text, -- SMS they sent to us
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for finding interactions by phone
create index interactions_phone_idx on public.interactions (phone);
create index interactions_created_idx on public.interactions (created_at desc);

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

-- Remove inbound column from calls table
alter table if exists public.calls drop column if exists inbound;

