"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface KPIData {
  total: number;
  answerRate: number;
  avgDuration: number;
  firstTimeCallers?: number;
}

interface KPIs {
  today: KPIData;
  last7d: KPIData;
  last30d: KPIData;
}

interface DirectionRow { direction: string; cnt: number }
interface RecentCall {
  id: string;
  started_at: string | null;
  from_number: string | null;
  to_number: string | null;
  direction: string | null;
  status: string | null;
  duration_seconds: number | null;
}

function DashboardContent() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [directions, setDirections] = useState<DirectionRow[]>([]);
  const [totals30, setTotals30] = useState<{ total: number; completed: number; missed: number; failed: number } | null>(null);
  const [recent, setRecent] = useState<RecentCall[]>([]);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load analytics");
        const json = await res.json();
        setKpis(json.kpis);
        setDirections(json.directions ?? []);
        setTotals30(json.totals30 ?? null);

        // mini-CRM: 5 most recent calls
        const callsRes = await fetch("/api/analytics?recent=1", { cache: "no-store" });
        if (callsRes.ok) {
          try {
            const client = await (await import("@/lib/supabase/client")).createClient();
            const { data } = await client
              .from("calls")
              .select("id, started_at, from_number, to_number, direction, status, duration_seconds")
              .order("started_at", { ascending: false })
              .limit(5);
            setRecent((data as unknown as RecentCall[]) ?? []);
          } catch {}
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const fmtPct = (n?: number) =>
    typeof n === "number" ? `${Math.round(n * 100)}%` : "-";
  const fmtDur = (s?: number) => {
    if (!s || s <= 0) return "--";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const directionData = useMemo(
    () => directions.map(d => ({ name: d.direction, value: d.cnt })),
    [directions]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to your Retell dashboard. This is the main overview page.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Total Calls (7d)</h3>
            </div>
            <div className="text-2xl font-bold">{loading ? "--" : kpis?.last7d?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Answer Rate (7d)</h3>
            </div>
            <div className="text-2xl font-bold">{loading ? "--" : fmtPct(kpis?.last7d?.answerRate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Avg Duration (7d)</h3>
            </div>
            <div className="text-2xl font-bold">{loading ? "--" : fmtDur(kpis?.last7d?.avgDuration)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">First-time Callers (7d)</h3>
            </div>
            <div className="text-2xl font-bold">{loading ? "--" : kpis?.last7d?.firstTimeCallers ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By Direction (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {directionData.length === 0 ? (
              <p className="text-muted-foreground">No data.</p>
            ) : (
              <div className="flex gap-4 text-sm">
                {directionData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="capitalize">{d.name}: <span className="font-medium">{d.value}</span></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-muted-foreground">No recent calls.</p>
            ) : (
              <div className="divide-y border rounded">
                {recent.map((c) => (
                  <div key={c.id} className="grid grid-cols-6 items-center text-sm px-3 h-12">
                    <div className="col-span-2 font-mono truncate pr-2">{c.id}</div>
                    <div>{c.direction ?? "-"}</div>
                    <div className="truncate">{c.from_number ?? "N/A"}</div>
                    <div className="capitalize">{c.status ?? "-"}</div>
                    <div className="text-right">{fmtDur(c.duration_seconds ?? undefined)}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Link href="/dashboard/calls"><Button variant="outline" size="sm">View all calls</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {!totals30 ? (
              <p className="text-muted-foreground">No data.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><div>Total</div><div className="font-medium">{totals30.total}</div></div>
                <div className="flex items-center justify-between"><div>Completed</div><div className="font-medium">{totals30.completed}</div></div>
                <div className="flex items-center justify-between"><div>Missed</div><div className="font-medium">{totals30.missed}</div></div>
                <div className="flex items-center justify-between"><div>Failed</div><div className="font-medium">{totals30.failed}</div></div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Today vs Last 7d vs 30d</CardTitle>
          </CardHeader>
          <CardContent>
            {!kpis ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="rounded border p-3">
                  <div className="text-muted-foreground mb-1">Today</div>
                  <div>Total: <span className="font-medium">{kpis.today.total}</span></div>
                  <div>Answer rate: <span className="font-medium">{fmtPct(kpis.today.answerRate)}</span></div>
                  <div>Avg duration: <span className="font-medium">{fmtDur(kpis.today.avgDuration)}</span></div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-muted-foreground mb-1">Last 7 days</div>
                  <div>Total: <span className="font-medium">{kpis.last7d.total}</span></div>
                  <div>Answer rate: <span className="font-medium">{fmtPct(kpis.last7d.answerRate)}</span></div>
                  <div>Avg duration: <span className="font-medium">{fmtDur(kpis.last7d.avgDuration)}</span></div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-muted-foreground mb-1">Last 30 days</div>
                  <div>Total: <span className="font-medium">{kpis.last30d.total}</span></div>
                  <div>Answer rate: <span className="font-medium">{fmtPct(kpis.last30d.answerRate)}</span></div>
                  <div>Avg duration: <span className="font-medium">{fmtDur(kpis.last30d.avgDuration)}</span></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <DashboardContent />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
