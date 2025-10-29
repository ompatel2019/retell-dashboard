-- 11_add_inbound_to_call_events.sql
-- Adds an `inbound` jsonb column to call_events to accumulate inbound SMS entries

alter table if exists public.call_events
  add column if not exists inbound jsonb default '[]'::jsonb;

-- No RLS changes needed; existing select policies apply


