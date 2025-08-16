"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

function DashboardContent() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<{ today: any; last7d: any; last30d: any } | null>(null);
  const [series, setSeries] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load analytics");
        const json = await res.json();
        setKpis(json.kpis);
        setSeries(json.series);
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
