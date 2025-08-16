-- 05c_analytics_rpcs.sql
-- RPCs for dynamic analytics queries (date-ranged)

create or replace function public.reasons_breakdown(
  p_business_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table(reason text, cnt int)
language sql
stable
as $$
  select
    coalesce(c.disconnection_reason, 'unknown') as reason,
    count(*)::int as cnt
  from public.calls c
  where c.business_id = p_business_id
    and c.started_at >= p_start and c.started_at < p_end
  group by 1
  order by cnt desc;
$$;

create or replace function public.repeat_callers(
  p_business_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_limit int default 20
)
returns table(from_number text, calls int, last_call timestamptz)
language sql
stable
as $$
  select
    c.from_number,
    count(*)::int as calls,
    max(c.started_at) as last_call
  from public.calls c
  where c.business_id = p_business_id
    and c.started_at >= p_start and c.started_at < p_end
    and c.from_number is not null
  group by c.from_number
  order by calls desc, last_call desc
  limit p_limit;
$$;


