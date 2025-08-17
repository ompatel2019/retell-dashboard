import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Example API returning tenant-scoped analytics via RLS
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || undefined; // undefined means analytics page (no KPIs-only mode)
  const wantRecent = searchParams.get('recent') === '1';

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine business context (first business by created_at)
  const { data: biz, error: bizError } = await supabase
    .from("businesses")
    .select("id, paused")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (bizError || !biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }
  if (biz.paused) {
    return NextResponse.json({ error: "Account paused" }, { status: 403 });
  }

  // Date windows
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = new Date();

  const computePeriodStart = (p: string | undefined) => {
    const base = new Date(now);
    switch (p) {
      case 'today': {
        base.setHours(0, 0, 0, 0);
        return base;
      }
      case '24h': {
        base.setHours(base.getHours() - 24);
        return base;
      }
      case '7d': {
        base.setDate(base.getDate() - 7);
        return base;
      }
      case '14d': {
        base.setDate(base.getDate() - 14);
        return base;
      }
      case '30d': {
        base.setDate(base.getDate() - 30);
        return base;
      }
      case 'all':
        return new Date(0);
      default: {
        // default 7d if period mode is requested without a recognized value
        base.setDate(base.getDate() - 7);
        return base;
      }
    }
  };

  const periodStart = period ? computePeriodStart(period) : undefined;
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Helper to load recent calls (optional)
  const recentPromise = wantRecent
    ? supabase
        .from("calls")
        .select(
          "id, started_at, from_number, to_number, direction, status, duration_seconds"
        )
        .eq("business_id", biz.id)
        .order("started_at", { ascending: false })
        .limit(5)
    : Promise.resolve({ data: undefined, error: null } as const);

  // If this request is specifically for KPI/period data, we can skip other heavy computations.
  // If there is no period param (analytics page), we compute series + reasons + repeat callers.

  // 1) Daily metrics for last 30 days (used for charts and KPI aggregations)
  // Prefer MV if present, fallback to view
  const dailyMv = await supabase
    .from("mv_call_metrics_daily")
    .select("d, total_calls, completed, missed, failed, avg_duration_sec")
    .eq("business_id", biz.id)
    .gte("d", thirtyDaysAgo.toISOString().slice(0, 10))
    .order("d", { ascending: true });
  const dailyPromise = dailyMv.error
    ? supabase
        .from("v_call_metrics_daily")
        .select("d, total_calls, completed, missed, failed, avg_duration_sec")
        .eq("business_id", biz.id)
        .gte("d", thirtyDaysAgo.toISOString().slice(0, 10))
        .order("d", { ascending: true })
    : Promise.resolve(dailyMv);

  // 2) Reasons + Repeat callers (only needed when no explicit KPI period is requested)
  const reasonsPromise = !period
    ? supabase
        .from("calls")
        .select("disconnection_reason")
        .eq("business_id", biz.id)
        .gte("started_at", thirtyDaysAgo.toISOString())
        .lt("started_at", now.toISOString())
        .not("disconnection_reason", "is", null)
    : Promise.resolve({ data: undefined, error: null } as const);

  const repeatPromise = !period
    ? supabase
        .from("calls")
        .select("from_number, started_at")
        .eq("business_id", biz.id)
        .gte("started_at", thirtyDaysAgo.toISOString())
        .lt("started_at", now.toISOString())
        .not("from_number", "is", null)
        .order("started_at", { ascending: false })
    : Promise.resolve({ data: undefined, error: null } as const);

  const [{ data: daily, error: dailyErr }, { data: reasons }, { data: repeatCallers, error: repeatErr }, { data: recent }] = await Promise.all([
    dailyPromise,
    reasonsPromise,
    repeatPromise,
    recentPromise,
  ]);

  if (dailyErr) {
    return NextResponse.json({ error: dailyErr.message }, { status: 500 });
  }

  // Debug logging
  console.log("Analytics debug:", {
    businessId: biz.id,
    dailyCount: daily?.length ?? 0,
    reasonsCount: reasons?.length ?? 0,
    repeatCallersCount: repeatCallers?.length ?? 0,
    reasonsError: reasons ? null : "No reasons data",
    repeatError: repeatErr?.message ?? null
  });

  // Accumulate windows from daily rows
  const sumWindow = (startDate: Date, endDate: Date) => {
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);
    const inRange = (d: string) => d >= startStr && d <= endStr;

    const rows = (daily ?? []).filter((r) => inRange(r.d as unknown as string));
    const totals = rows.reduce(
      (acc, r) => {
        acc.total += r.total_calls ?? 0;
        acc.completed += r.completed ?? 0;
        acc.missed += r.missed ?? 0;
        acc.failed += r.failed ?? 0;
        if (typeof r.avg_duration_sec === "number") acc.avgDurations.push(r.avg_duration_sec);
        return acc;
      },
      { total: 0, completed: 0, missed: 0, failed: 0, avgDurations: [] as number[] }
    );
    const denom = totals.completed + totals.missed + totals.failed;
    const answerRate = denom === 0 ? 0 : totals.completed / denom;
    const avgDuration = totals.avgDurations.length
      ? Math.round(totals.avgDurations.reduce((a, b) => a + b, 0) / totals.avgDurations.length)
      : 0;
    return { ...totals, answerRate, avgDuration };
  };

  // First-time callers only needed when period/KPIs requested
  let ftPeriod = 0;
  let ft7 = 0;
  let ft30 = 0;
  if (period) {
    const [ftPeriodRes, ft7Res, ft30Res] = await Promise.all([
      supabase.rpc("first_time_callers", {
        p_business_id: biz.id,
        p_start: periodStart!.toISOString(),
        p_end: now.toISOString(),
      }),
      supabase.rpc("first_time_callers", {
        p_business_id: biz.id,
        p_start: sevenDaysAgo.toISOString(),
        p_end: now.toISOString(),
      }),
      supabase.rpc("first_time_callers", {
        p_business_id: biz.id,
        p_start: thirtyDaysAgo.toISOString(),
        p_end: now.toISOString(),
      }),
    ]);
    ftPeriod = (ftPeriodRes.error || typeof ftPeriodRes.data !== "number") ? 0 : (ftPeriodRes.data as number);
    ft7 = (ft7Res.error || typeof ft7Res.data !== "number") ? 0 : (ft7Res.data as number);
    ft30 = (ft30Res.error || typeof ft30Res.data !== "number") ? 0 : (ft30Res.data as number);
  }

  const kpis7 = sumWindow(sevenDaysAgo, now);
  const kpis30 = sumWindow(thirtyDaysAgo, now);
  const kpisToday = sumWindow(todayStart, now);
  
  // Calculate metrics for selected period
  let kpisPeriod: { total: number; completed: number; missed: number; failed: number; answerRate: number; avgDuration: number } | undefined;
  if (period === 'today') {
    // For today, query the calls table directly to get real-time data
    const { data: todayCalls, error: todayErr } = await supabase
      .from("calls")
      .select("status, duration_seconds")
      .eq("business_id", biz.id)
      .gte("started_at", todayStart.toISOString())
      .lt("started_at", now.toISOString());
    
    if (todayErr) {
      console.error("Error fetching today's calls:", todayErr);
      kpisPeriod = { total: 0, completed: 0, missed: 0, failed: 0, answerRate: 0, avgDuration: 0 };
    } else {
      const total = todayCalls?.length || 0;
      const completed = todayCalls?.filter(c => c.status === 'completed').length || 0;
      const missed = todayCalls?.filter(c => c.status === 'missed').length || 0;
      const failed = todayCalls?.filter(c => c.status === 'failed').length || 0;
      const durations = todayCalls?.map(c => c.duration_seconds).filter(d => d && d > 0) || [];
      const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      const denom = completed + missed + failed;
      const answerRate = denom === 0 ? 0 : completed / denom;
      
      kpisPeriod = { total, completed, missed, failed, answerRate, avgDuration };
    }
  } else if (period) {
    kpisPeriod = sumWindow(periodStart!, now);
  }

  // no-op

  const responsePayload: Record<string, unknown> = {};

  // When period is requested, return KPIs; otherwise, return analytics datasets
  if (period) {
    responsePayload.kpis = {
      today: { total: kpisToday.total, answerRate: kpisToday.answerRate, avgDuration: kpisToday.avgDuration },
      last7d: { total: kpis7.total, answerRate: kpis7.answerRate, avgDuration: kpis7.avgDuration, firstTimeCallers: ft7 },
      last30d: { total: kpis30.total, answerRate: kpis30.answerRate, avgDuration: kpis30.avgDuration, firstTimeCallers: ft30 },
      selectedPeriod: { total: (kpisPeriod?.total ?? 0), answerRate: (kpisPeriod?.answerRate ?? 0), avgDuration: (kpisPeriod?.avgDuration ?? 0), firstTimeCallers: ftPeriod },
    };
  } else {
    responsePayload.series = daily ?? [];
    
    // Process disconnection reasons from raw call data
    if (reasons && Array.isArray(reasons)) {
      const reasonCounts: Record<string, number> = {};
      reasons.forEach(call => {
        const reason = call.disconnection_reason || 'unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
      responsePayload.reasons = Object.entries(reasonCounts)
        .map(([reason, cnt]) => ({ reason, cnt }))
        .sort((a, b) => b.cnt - a.cnt);
    } else {
      responsePayload.reasons = [];
    }
    
    // Process repeat callers from raw call data
    if (repeatCallers && Array.isArray(repeatCallers)) {
      const callerCounts: Record<string, { calls: number; last_call: string }> = {};
      repeatCallers.forEach(call => {
        const number = call.from_number;
        if (!callerCounts[number]) {
          callerCounts[number] = { calls: 0, last_call: call.started_at };
        }
        callerCounts[number].calls += 1;
        if (call.started_at > callerCounts[number].last_call) {
          callerCounts[number].last_call = call.started_at;
        }
      });
      responsePayload.repeatCallers = Object.entries(callerCounts)
        .map(([from_number, data]) => ({ from_number, ...data }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 20);
    } else {
      responsePayload.repeatCallers = [];
    }
  }

  if (wantRecent) {
    responsePayload.recent = recent ?? [];
  }

  responsePayload.period = period ?? null;

  return new NextResponse(JSON.stringify(responsePayload), {
    headers: {
      // Cache at the edge for 30s; allow stale for 5m to smooth load
      "Cache-Control": "s-maxage=30, stale-while-revalidate=300",
      "Content-Type": "application/json",
    },
  });
}


