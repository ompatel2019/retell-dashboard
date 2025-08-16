import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Example API returning tenant-scoped analytics via RLS
export async function GET() {
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

  // Date windows: today, last 7d, last 30d
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = new Date();

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // 1) Daily metrics for last 30 days
  const { data: daily, error: dailyErr } = await supabase
    .from("v_call_metrics_daily")
    .select("d, total_calls, completed, missed, failed, avg_duration_sec")
    .eq("business_id", biz.id)
    .gte("d", thirtyDaysAgo.toISOString().slice(0, 10))
    .order("d", { ascending: true });

  if (dailyErr) {
    return NextResponse.json({ error: dailyErr.message }, { status: 500 });
  }

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

  // First-time callers in last 7 and 30 days
  const { data: firstTime7, error: ft7Err } = await supabase.rpc("first_time_callers", {
    p_business_id: biz.id,
    p_start: sevenDaysAgo.toISOString(),
    p_end: now.toISOString(),
  });
  const { data: firstTime30, error: ft30Err } = await supabase.rpc("first_time_callers", {
    p_business_id: biz.id,
    p_start: thirtyDaysAgo.toISOString(),
    p_end: now.toISOString(),
  });

  // If RPC not present, fallback to zero
  const ft7 = ft7Err || typeof firstTime7 !== "number" ? 0 : firstTime7;
  const ft30 = ft30Err || typeof firstTime30 !== "number" ? 0 : firstTime30;

  const kpis7 = sumWindow(sevenDaysAgo, now);
  const kpis30 = sumWindow(thirtyDaysAgo, now);
  const kpisToday = sumWindow(todayStart, now);

  // Disconnection reasons (last 30d)
  const { data: reasons } = await supabase.rpc(
    "reasons_breakdown",
    {
      p_business_id: biz.id,
      p_start: thirtyDaysAgo.toISOString(),
      p_end: now.toISOString(),
    }
  );

  // Top repeat callers (last 30d)
  const { data: repeatCallers, error: repeatErr } = await supabase.rpc(
    "repeat_callers",
    {
      p_business_id: biz.id,
      p_start: thirtyDaysAgo.toISOString(),
      p_end: now.toISOString(),
      p_limit: 20,
    }
  );

  // Directions breakdown (last 30d)
  const { data: directions } = await supabase
    .from("calls")
    .select("direction")
    .eq("business_id", biz.id)
    .gte("started_at", thirtyDaysAgo.toISOString())
    .lt("started_at", now.toISOString());

  const directionCounts = (directions ?? []).reduce((acc: Record<string, number>, row: { direction: string | null }) => {
    const key = (row.direction ?? "unknown").toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Totals for status distribution in last 30d from daily rows
  const totals30 = (daily ?? []).reduce(
    (acc, r: { total_calls?: number; completed?: number; missed?: number; failed?: number }) => {
      acc.total += r.total_calls ?? 0;
      acc.completed += r.completed ?? 0;
      acc.missed += r.missed ?? 0;
      acc.failed += r.failed ?? 0;
      return acc;
    },
    { total: 0, completed: 0, missed: 0, failed: 0 }
  );

  return NextResponse.json({
    kpis: {
      today: { total: kpisToday.total, answerRate: kpisToday.answerRate, avgDuration: kpisToday.avgDuration },
      last7d: { total: kpis7.total, answerRate: kpis7.answerRate, avgDuration: kpis7.avgDuration, firstTimeCallers: ft7 },
      last30d: { total: kpis30.total, answerRate: kpis30.answerRate, avgDuration: kpis30.avgDuration, firstTimeCallers: ft30 },
    },
    series: daily ?? [],
    reasons: reasons ?? [],
    repeatCallers: repeatErr ? [] : repeatCallers ?? [],
    directions: Object.entries(directionCounts).map(([direction, cnt]) => ({ direction, cnt })),
    totals30,
  });
}


