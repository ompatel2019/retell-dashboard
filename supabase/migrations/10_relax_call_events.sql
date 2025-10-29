-- Relax constraints so we can store webhook payloads without business linkage
do $$ begin
  -- Drop FK to calls if it exists
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'call_events_call_id_fkey'
      and table_name = 'call_events'
  ) then
    alter table public.call_events drop constraint call_events_call_id_fkey;
  end if;
end $$;

-- Make business_id nullable
alter table public.call_events alter column business_id drop not null;

-- Drop old RLS policies and create a simple read policy for authenticated users
drop policy if exists "read call_events in business" on public.call_events;
drop policy if exists "read calls in business" on public.call_events;

-- Allow any authenticated user to read call_events
create policy "allow_read_call_events" on public.call_events
for select using (true);

-- Allow service role to insert call_events
create policy "service_insert_call_events" on public.call_events
for insert with check (true);

-- Allow service role to update call_events
create policy "service_update_call_events" on public.call_events
for update using (true);


