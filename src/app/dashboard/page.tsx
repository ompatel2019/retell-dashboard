"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
  selectedPeriod?: KPIData;
}

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
  const [periodLoading, setPeriodLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("7d");
  const [kpis, setKpis] = useState<KPIs | null>(null);

  const [recent, setRecent] = useState<RecentCall[]>([]);

  useEffect(() => {
    // Disable analytics fetching entirely
    setKpis(null);
    setRecent([]);
    setLoading(false);
  }, []);

  // Disable analytics period fetching entirely
  useEffect(() => {
    setPeriodLoading(false);
  }, [selectedPeriod, loading]);

  const fmtDur = (s?: number) => {
    if (!s || s <= 0) return "--";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // Helper function to get KPIs for selected period
  const getKpisForPeriod = () => {
    if (!kpis) return null;

    // Use the selectedPeriod data from the API
    if (kpis.selectedPeriod) {
      return kpis.selectedPeriod;
    }

    // Fallback to period-specific data
    switch (selectedPeriod) {
      case "Today":
        return kpis.today;
      case "24h":
        return kpis.today;
      case "7d":
        return kpis.last7d;
      case "14d":
        return kpis.last7d; // Will be updated when API supports 14d
      case "30d":
        return kpis.last30d;
      case "All time":
        return kpis.last30d; // Will be updated when API supports all time
      default:
        return kpis.last7d;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to your Retell dashboard. This is the main overview page.
        </p>
      </div>

      <div className="flex justify-start">
        <div className="flex space-x-1 bg-muted rounded-lg p-1">
          {["Today", "24h", "7d", "14d", "30d", "All time"].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                selectedPeriod === period
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">
                Total Calls ({selectedPeriod})
              </h3>
            </div>
            <div className="text-2xl font-bold">
              {loading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : periodLoading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : (
                getKpisForPeriod()?.total ?? 0
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">
                Avg Duration ({selectedPeriod})
              </h3>
            </div>
            <div className="text-2xl font-bold">
              {loading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : periodLoading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : (
                fmtDur(getKpisForPeriod()?.avgDuration)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">
                Unique Callers ({selectedPeriod})
              </h3>
            </div>
            <div className="text-2xl font-bold">
              {loading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : periodLoading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : (
                getKpisForPeriod()?.firstTimeCallers ?? 0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-muted-foreground">No recent calls.</p>
            ) : (
              <>
                <div className="grid grid-cols-7 items-center text-sm px-3 h-12 bg-muted font-medium border-b">
                  <div className="col-span-2">Call ID</div>
                  <div>Direction</div>
                  <div>From Number</div>
                  <div>Status</div>
                  <div className="text-right">Duration</div>
                  <div className="text-right">Date</div>
                </div>
                <div className="divide-y border rounded">
                  {recent.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-7 items-center text-sm px-3 h-12"
                    >
                      <div className="col-span-2 font-mono truncate pr-2">
                        {c.id}
                      </div>
                      <div>{c.direction ?? "-"}</div>
                      <div className="truncate">{c.from_number ?? "N/A"}</div>
                      <div className="capitalize">{c.status ?? "-"}</div>
                      <div className="text-right">
                        {fmtDur(c.duration_seconds ?? undefined)}
                      </div>
                      <div className="text-right text-muted-foreground">
                        {c.started_at
                          ? new Date(c.started_at).toLocaleDateString()
                          : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="mt-3">
              <Link href="/dashboard/calls">
                <Button variant="outline" size="sm">
                  View all calls
                </Button>
              </Link>
            </div>
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
