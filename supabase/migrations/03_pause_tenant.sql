-- Pause controls on the tenant (business) level
alter table public.businesses
  add column if not exists paused boolean not null default false,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_reason text,
  add column if not exists paused_until timestamptz;

-- Helper: is this business currently paused?
create or replace function public.is_business_paused(p_business_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select
       case
         when b.paused_until is not null and b.paused_until < now() then false
         else b.paused
       end
     from public.businesses b
     where b.id = p_business_id),
    false
  );
$$;

-- Enforce pause in RLS for tenant-scoped tables we have in this project

-- Agents: readable if in the same business AND business not paused
drop policy if exists "read agents in business" on public.agents;
create policy "read agents in business"
on public.agents
for select
using (
  agents.business_id in (select public.current_business_ids())
  and not public.is_business_paused(agents.business_id)
);

-- Phone numbers: readable if in the same business AND business not paused
drop policy if exists "read phone numbers in business" on public.phone_numbers;
create policy "read phone numbers in business"
on public.phone_numbers
for select
using (
  phone_numbers.business_id in (select public.current_business_ids())
  and not public.is_business_paused(phone_numbers.business_id)
);

-- Keep reading own business row regardless of pause so UI can render paused banner
drop policy if exists "read own businesses" on public.businesses;
create policy "read own businesses" on public.businesses
for select
using (exists (
  select 1 from public.memberships m
  where m.business_id = businesses.id and m.user_id = auth.uid()
));

-- Admin helper to flip pause on/off (to be called with service role)
create or replace function public.admin_set_business_pause(
  p_business_id uuid,
  p_paused boolean,
  p_reason text default null,
  p_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.businesses
  set paused = p_paused,
      paused_reason = p_reason,
      paused_until = p_until,
      paused_at = case when p_paused then now() else paused_at end
  where id = p_business_id;
end;
$$;


