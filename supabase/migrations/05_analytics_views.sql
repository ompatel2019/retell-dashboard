-- 05_analytics_views.sql
-- Views to power analytics for calls

/* --------------------- DAILY CALL METRICS --------------------- */
create or replace view public.v_call_metrics_daily as
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

/* --------------------- MATERIALIZED (OPTIONAL) --------------------- */
-- Uncomment if you want to use a materialized view for faster reads
-- create materialized view if not exists public.mv_call_metrics_daily as
-- select * from public.v_call_metrics_daily;
-- create index if not exists mv_call_metrics_daily_biz_d_idx
--   on public.mv_call_metrics_daily (business_id, d);
-- To refresh:
-- refresh materialized view concurrently public.mv_call_metrics_daily;


