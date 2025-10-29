-- 08_caller_profiles.sql
-- Caller profiles and aggregation helpers

create extension if not exists pgcrypto;

/* ----------------------- CALLER PROFILES ----------------------- */
create table if not exists public.caller_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  phone text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  total_calls integer not null default 0,
  last_call_id text references public.calls(id) on delete set null,
  last_summary text,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint caller_profiles_business_phone_unique unique (business_id, phone)
);

create index if not exists caller_profiles_business_last_seen_idx
  on public.caller_profiles (business_id, last_seen desc);

/* ----------------------- TRIGGERS ----------------------- */
-- Reuse generic touch function if present
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'touch_caller_profiles_updated_at') then
    create trigger touch_caller_profiles_updated_at
      before update on public.caller_profiles
      for each row execute procedure public.touch_updated_at();
  end if;
end $$;

/* -------------------- REFRESH FUNCTION -------------------- */
-- Recompute a caller profile from calls table
create or replace function public.refresh_caller_profile(p_business_id uuid, p_phone text)
returns void
language plpgsql
as $$
declare
  v_first timestamptz;
  v_last timestamptz;
  v_total integer;
  v_last_call_id text;
  v_last_summary text;
begin
  select
    min(coalesce(started_at, created_at)) as first_seen,
    max(coalesce(started_at, created_at)) as last_seen,
    count(*)::int as total_calls,
    (select c2.id from public.calls c2
       where c2.business_id = p_business_id and c2.from_number = p_phone
       order by coalesce(c2.started_at, c2.created_at) desc nulls last
       limit 1) as last_call_id_tmp,
    (select c3.summary from public.calls c3
       where c3.business_id = p_business_id and c3.from_number = p_phone
       order by coalesce(c3.started_at, c3.created_at) desc nulls last
       limit 1) as last_summary_tmp
  into v_first, v_last, v_total, v_last_call_id, v_last_summary
  from public.calls c
  where c.business_id = p_business_id and c.from_number = p_phone;

  -- If there are no calls, ensure a stub row exists with zero totals
  if v_total is null then
    insert into public.caller_profiles (business_id, phone, total_calls)
    values (p_business_id, p_phone, 0)
    on conflict (business_id, phone) do nothing;
    return;
  end if;

  insert into public.caller_profiles as cp (
    business_id, phone, first_seen, last_seen, total_calls, last_call_id, last_summary
  )
  values (p_business_id, p_phone, v_first, v_last, v_total, v_last_call_id, v_last_summary)
  on conflict (business_id, phone)
  do update set
    first_seen = least(excluded.first_seen, cp.first_seen),
    last_seen = greatest(excluded.last_seen, cp.last_seen),
    total_calls = v_total,
    last_call_id = v_last_call_id,
    last_summary = v_last_summary;
end$$;

/* --------------------- CALLS TRIGGER --------------------- */
create or replace function public.on_calls_change_refresh_caller()
returns trigger
language plpgsql
as $$
begin
  -- Handle inserts/updates where from_number is present
  if (tg_op = 'INSERT') then
    if new.from_number is not null then
      perform public.refresh_caller_profile(new.business_id, new.from_number);
    end if;
  elsif (tg_op = 'UPDATE') then
    if new.from_number is not null then
      perform public.refresh_caller_profile(new.business_id, new.from_number);
    end if;
    if old.from_number is distinct from new.from_number and old.from_number is not null then
      perform public.refresh_caller_profile(new.business_id, old.from_number);
    end if;
  end if;
  return null;
end$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'calls_refresh_caller_profile') then
    create trigger calls_refresh_caller_profile
      after insert or update on public.calls
      for each row execute procedure public.on_calls_change_refresh_caller();
  end if;
end $$;

/* ------------------------- RLS -------------------------- */
alter table public.caller_profiles enable row level security;

drop policy if exists "read caller_profiles in business" on public.caller_profiles;
create policy "read caller_profiles in business" on public.caller_profiles
for select using (
  caller_profiles.business_id = (select public.current_business_id())
  and not public.is_business_paused(caller_profiles.business_id)
);


