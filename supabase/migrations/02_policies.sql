-- Enable RLS on core tables
alter table public.businesses enable row level security;
alter table public.memberships enable row level security;
alter table public.agents enable row level security;
alter table public.phone_numbers enable row level security;

-- Memberships: a user can see their own membership rows
drop policy if exists "read own memberships" on public.memberships;
create policy "read own memberships" on public.memberships
for select
using (user_id = auth.uid());

-- Businesses: a user can read businesses they belong to
drop policy if exists "read own businesses" on public.businesses;
create policy "read own businesses" on public.businesses
for select
using (exists (
  select 1 from public.memberships m
  where m.business_id = businesses.id and m.user_id = auth.uid()
));

-- Agents: readable if in the same business
drop policy if exists "read agents in business" on public.agents;
create policy "read agents in business" on public.agents
for select
using (agents.business_id in (select public.current_business_ids()));

-- Phone numbers: readable if in the same business
drop policy if exists "read phone numbers in business" on public.phone_numbers;
create policy "read phone numbers in business" on public.phone_numbers
for select
using (phone_numbers.business_id in (select public.current_business_ids()));

-- Example: your analytics tables (calls, call_events, bookings) should have business_id and the same pattern
-- Uncomment and adapt if those tables exist already
-- alter table public.calls enable row level security;
-- drop policy if exists "read calls in business" on public.calls;
-- create policy "read calls in business" on public.calls
-- for select using (calls.business_id in (select public.current_business_ids()));


