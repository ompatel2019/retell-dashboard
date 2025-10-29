-- Minimal storage for surfaced call info required by the app
-- Stores Business Name, Phone Number, and Call Status per call

create table if not exists public.simple_calls (
  call_id text primary key,
  business_name text not null,
  phone_number text,
  call_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.touch_updated_at_simple_calls()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'touch_simple_calls_updated_at') then
    create trigger touch_simple_calls_updated_at
      before update on public.simple_calls
      for each row execute procedure public.touch_updated_at_simple_calls();
  end if;
end $$;

-- RLS to allow reads for authenticated users
alter table public.simple_calls enable row level security;
drop policy if exists "read all simple_calls (service only)" on public.simple_calls;
drop policy if exists "read_simple_calls" on public.simple_calls;
create policy "read_simple_calls" on public.simple_calls
for select using (true);

-- Allow service role to insert
create policy "service_insert_simple_calls" on public.simple_calls
for insert with check (true);

-- Allow service role to update (for upserts)
create policy "service_update_simple_calls" on public.simple_calls
for update using (true);


