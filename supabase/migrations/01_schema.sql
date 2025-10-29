-- Enable required extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- Businesses: one row per user (1:1 relationship)
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  timezone text not null default 'Australia/Sydney',
  paused boolean not null default false,
  paused_at timestamptz,
  paused_reason text,
  paused_until timestamptz,
  created_at timestamptz not null default now()
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
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.businesses
  where user_id = auth.uid();
$$;


