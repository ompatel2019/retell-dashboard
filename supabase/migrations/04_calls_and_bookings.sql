-- 04_calls_and_bookings.sql
-- Core operational tables for contacts, calls, call events, and bookings

-- EXTENSIONS (safe if already enabled)
create extension if not exists pgcrypto; -- for gen_random_uuid()

/* ----------------------- CONTACTS ----------------------- */
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contacts_business_phone_key
  on public.contacts (business_id, phone);

create index if not exists contacts_business_created_idx
  on public.contacts (business_id, created_at desc);

/* ------------------------- CALLS ------------------------ */
-- NOTE: id is the Retell call_id (text), so we can upsert by id from the webhook.
create table if not exists public.calls (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_id text,
  from_number text,
  to_number text,
  direction text, -- 'inbound' | 'outbound' (free text for now)
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  disconnection_reason text,
  status text, -- 'active' | 'ended' | 'error' (free text ok at MVP)
  summary text,
  transcript text,
  dynamic_variables jsonb,
  tool_call_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- lightweight data sanity
  check (duration_seconds is null or duration_seconds >= 0)
);

create index if not exists calls_business_created_idx
  on public.calls (business_id, created_at desc);

create index if not exists calls_business_started_idx
  on public.calls (business_id, started_at desc);

create index if not exists calls_to_number_idx
  on public.calls (to_number);

create index if not exists calls_agent_idx
  on public.calls (agent_id);

/* ---------------------- CALL EVENTS --------------------- */
create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  call_id text not null references public.calls(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null, -- 'call_started' | 'call_ended' | 'call_analyzed' | ...
  occurred_at timestamptz not null default now(),
  data jsonb
);

create index if not exists call_events_call_idx
  on public.call_events (call_id, occurred_at desc);

/* ----------------------- BOOKINGS ----------------------- */
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text,
  status text not null default 'confirmed', -- 'confirmed' | 'tentative' | 'canceled'
  source text, -- 'retell_tool' | 'manual' | 'crm'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_at > start_at)
);

create index if not exists bookings_business_start_idx
  on public.bookings (business_id, start_at desc);

/* ----------------------- TRIGGERS ----------------------- */
-- Auto-update updated_at on change
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'touch_contacts_updated_at') then
    create trigger touch_contacts_updated_at
      before update on public.contacts
      for each row execute procedure public.touch_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'touch_calls_updated_at') then
    create trigger touch_calls_updated_at
      before update on public.calls
      for each row execute procedure public.touch_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'touch_bookings_updated_at') then
    create trigger touch_bookings_updated_at
      before update on public.bookings
      for each row execute procedure public.touch_updated_at();
  end if;
end $$;

/* ------------------------- RLS -------------------------- */
alter table public.contacts     enable row level security;
alter table public.calls        enable row level security;
alter table public.call_events  enable row level security;
alter table public.bookings     enable row level security;

-- Assumes helper functions exist from previous migrations:
--   public.current_business_ids() -> setof uuid
--   public.is_business_paused(uuid) -> boolean

drop policy if exists "read contacts in business" on public.contacts;
create policy "read contacts in business" on public.contacts
for select using (
  contacts.business_id in (select public.current_business_ids())
  and not public.is_business_paused(contacts.business_id)
);

drop policy if exists "read calls in business" on public.calls;
create policy "read calls in business" on public.calls
for select using (
  calls.business_id in (select public.current_business_ids())
  and not public.is_business_paused(calls.business_id)
);

drop policy if exists "read call_events in business" on public.call_events;
create policy "read call_events in business" on public.call_events
for select using (
  call_events.business_id in (select public.current_business_ids())
  and not public.is_business_paused(call_events.business_id)
);

drop policy if exists "read bookings in business" on public.bookings;
create policy "read bookings in business" on public.bookings
for select using (
  bookings.business_id in (select public.current_business_ids())
  and not public.is_business_paused(bookings.business_id)
);

-- Writes are done via service-role in your API routes, so no anon insert/update policies needed.
