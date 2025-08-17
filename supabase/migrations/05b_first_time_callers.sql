-- 05b_first_time_callers.sql
-- Helper RPC to compute first-time callers in a window per business

create or replace function public.first_time_callers(
  p_business_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns integer
language sql
stable
as $$
select count(distinct from_number)::int
from public.calls c
where c.business_id = p_business_id
  and c.started_at >= p_start and c.started_at < p_end
  and c.from_number is not null;
$$;


