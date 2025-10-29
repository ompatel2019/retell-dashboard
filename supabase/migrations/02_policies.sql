-- Enable RLS on core tables
alter table public.businesses enable row level security;
alter table public.agents enable row level security;
alter table public.phone_numbers enable row level security;

-- Businesses: a user can read their own business (1:1 relationship)
drop policy if exists "read own businesses" on public.businesses;
create policy "read own businesses" on public.businesses
for select
using (user_id = auth.uid());

-- Agents: readable if in the same business as the user
drop policy if exists "read agents in business" on public.agents;
create policy "read agents in business" on public.agents
for select
using (agents.business_id = (select public.current_business_id()));

-- Phone numbers: readable if in the same business as the user
drop policy if exists "read phone numbers in business" on public.phone_numbers;
create policy "read phone numbers in business" on public.phone_numbers
for select
using (phone_numbers.business_id = (select public.current_business_id()));

-- Example: your analytics tables (calls, call_events, bookings) should have business_id and the same pattern
-- Uncomment and adapt if those tables exist already
-- alter table public.calls enable row level security;
-- drop policy if exists "read calls in business" on public.calls;
-- create policy "read calls in business" on public.calls
-- for select using (calls.business_id in (select public.current_business_ids()));


