-- Enable required extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- Businesses: one row per company/tenant
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Australia/Sydney',
  created_at timestamptz not null default now()
);

-- Memberships: supports 1:many users per business in the future
create table if not exists public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);

-- Agents: Retell agents mapped to a business
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  retell_agent_id text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

-- Phone numbers: E.164 numbers mapped to a business
create table if not exists public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  e164 text not null unique,
  created_at timestamptz not null default now()
);

-- Helper functions to resolve current user's business scope
create or replace function public.current_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.business_id
  from public.memberships m
  where m.user_id = auth.uid();
$$;

-- Optional: when you know there's exactly one business per user, this returns one id
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from public.memberships
  where user_id = auth.uid()
  order by created_at asc
  limit 1;
$$;


