"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

function AnalyticsContent() {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [repeatCallers, setRepeatCallers] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load analytics");
        const json = await res.json();
        setSeries(json.series ?? []);
        setReasons(json.reasons ?? []);
        setRepeatCallers(json.repeatCallers ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const chartData = useMemo(() => {
    return (series ?? []).map((r: any) => ({
      date: r.d,
      total: r.total_calls ?? 0,
      completed: r.completed ?? 0,
      missed: r.missed ?? 0,
      failed: r.failed ?? 0,
      answerRate:
        ((r.completed ?? 0) + (r.missed ?? 0) + (r.failed ?? 0)) === 0
          ? 0
          : (r.completed ?? 0) /
            ((r.completed ?? 0) + (r.missed ?? 0) + (r.failed ?? 0)),
    }));
  }, [series]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">
          View detailed insights and performance metrics.
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Volume by Day (30d)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} dot={false} name="Total" />
                  <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} dot={false} name="Completed" />
                  <Line type="monotone" dataKey="missed" stroke="#f59e0b" strokeWidth={2} dot={false} name="Missed" />
                  <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} name="Failed" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Answer Rate by Day (30d)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round((v as number) * 100)}%`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => `${Math.round(v * 100)}%`} />
                  <Line type="monotone" dataKey="answerRate" stroke="#10b981" strokeWidth={2} dot={false} name="Answer Rate" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Disconnection Reasons (30d)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reasons.map((r: any) => ({ reason: r.reason ?? "unknown", count: r.cnt }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="reason" tick={{ fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Repeat Callers (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : repeatCallers.length === 0 ? (
              <p className="text-muted-foreground">No repeat callers in this window.</p>
            ) : (
              <div className="space-y-2">
                {repeatCallers.map((row: any) => (
                  <div key={row.from_number} className="flex items-center justify-between text-sm">
                    <div className="font-medium">{row.from_number}</div>
                    <div className="text-muted-foreground">{row.calls} calls</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <AnalyticsContent />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
