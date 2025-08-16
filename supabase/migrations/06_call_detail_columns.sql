-- 06_call_detail_columns.sql
-- Extend calls table to support rich call detail rendering

alter table public.calls
  add column if not exists transcript_json jsonb,
  add column if not exists audio_url text;

-- Optional: small index to speed up json access if needed later
-- create index if not exists calls_transcript_json_gin on public.calls using gin (transcript_json);


