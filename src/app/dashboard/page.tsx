"use client";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type SimpleCall = {
  id: string;
  business_name: string;
  phone: string;
  status: string | null;
  date: string;
};

function DashboardContent() {
  const [loading, setLoading] = useState(true);
  const [totalOutbound, setTotalOutbound] = useState<number>(0);
  const [totalSmsSent, setTotalSmsSent] = useState<number>(0);
  const [totalReplies, setTotalReplies] = useState<number>(0);
  const [replyRate, setReplyRate] = useState<string>("0%");
  const [recent, setRecent] = useState<SimpleCall[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const { count } = await supabase
          .from("calls")
          .select("id", { count: "exact", head: true });
        setTotalOutbound(count ?? 0);

        const { data } = await supabase
          .from("calls")
          .select("id,business_name,phone,status,date")
          .order("date", { ascending: false })
          .limit(10);
        setRecent((data as SimpleCall[] | null) ?? []);

        // Interactions metrics
        // Count phones with outbound messages (array not empty)
        const sentRes = await supabase
          .from("interactions")
          .select("phone")
          .neq("outbound", "[]");
        
        // Count phones with inbound messages (recent_reply is not null)
        const repliesRes = await supabase
          .from("interactions")
          .select("phone")
          .not("recent_reply", "is", null);

        const sent = sentRes.data?.length ?? 0;
        // Count distinct phone numbers (one per number, regardless of reply count)
        const uniquePhonesWithReplies = new Set(
          (repliesRes.data ?? []).map((r) => r.phone)
        );
        const replies = uniquePhonesWithReplies.size;
        setTotalSmsSent(sent);
        setTotalReplies(replies);
        setReplyRate(
          sent > 0 ? `${Math.round((replies / sent) * 100)}%` : "0%"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
    const channel = supabase
      .channel("calls-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        () => load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString() : "-";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to your Retell dashboard. This is the main overview page.
        </p>
      </div>

      {/* Period selector removed */}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">
                Total Outbound Calls
              </h3>
            </div>
            <div className="text-2xl font-bold">
              {loading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : (
                totalOutbound
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">
                Total SMS&apos;s Sent
              </h3>
            </div>
            <div className="text-2xl font-bold">
              {loading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : (
                totalSmsSent
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Replies</h3>
            </div>
            <div className="text-2xl font-bold">
              {loading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : (
                totalReplies
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">Reply Rate</h3>
            </div>
            <div className="text-2xl font-bold">
              {loading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : (
                replyRate
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
                <div className="grid grid-cols-5 items-center text-sm px-3 h-12 bg-muted font-medium border-b">
                  <div className="col-span-2">Business</div>
                  <div>Phone</div>
                  <div>Status</div>
                  <div className="text-right">Date</div>
                </div>
                <div className="divide-y border rounded">
                  {recent.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-5 items-center text-sm px-3 h-12"
                    >
                      <div className="col-span-2 truncate pr-2">
                        {c.business_name}
                      </div>
                      <div className="truncate">{c.phone}</div>
                      <div className="capitalize">{c.status ?? "-"}</div>
                      <div className="text-right text-muted-foreground">
                        {formatDate(c.date)}
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
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}
