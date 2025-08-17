-- 07_perf_analytics.sql
-- Performance improvements for analytics queries

/* ---------------- MATERIALIZED DAILY METRICS --------------- */
-- Pre-aggregate daily metrics for faster reads on charts/KPIs
create materialized view if not exists public.mv_call_metrics_daily as
select
  c.business_id,
  date_trunc('day', coalesce(c.started_at, c.created_at))::date as d,
  count(*) as total_calls,
  count(*) filter (where c.status = 'completed') as completed,
  count(*) filter (where c.status = 'missed') as missed,
  count(*) filter (where c.status = 'failed') as failed,
  round(avg(c.duration_seconds)) as avg_duration_sec
from public.calls c
group by 1,2;

create index if not exists mv_call_metrics_daily_biz_d_idx
  on public.mv_call_metrics_daily (business_id, d);

/* --------------------- HELPFUL INDEXES --------------------- */
-- Speeds up first_time_callers() and repeat_callers()
create index if not exists calls_business_started_from_idx
  on public.calls (business_id, started_at desc, from_number);


