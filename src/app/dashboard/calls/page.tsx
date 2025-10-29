"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type CallRow = {
  id: string;
  business_name: string;
  phone: string;
  status: string | null;
  date: string;
  inbound: unknown[];
};

function CallsContent() {
  const [calls, setCalls] = useState<
    {
      call_id: string;
      business: string;
      phone: string | null;
      status: string | null;
      date: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const [q, setQ] = useState("");

  useEffect(() => {
    async function fetchCalls() {
      try {
        const query = supabase
          .from("calls")
          .select("id,business_name,phone,status,date")
          .order("date", { ascending: false })
          .limit(100);
        // Client-side filter applied after fetch
        const { data, error } = await query;

        if (error) {
          console.error("Error fetching calls:", error);
        } else {
          const rows = (data as CallRow[] | null) ?? [];
          const mapped = rows.map((r) => ({
            call_id: r.id,
            business: r.business_name,
            phone: r.phone ?? null,
            status: r.status,
            date: r.date,
          }));
          // simple client-side search
          const filtered = q.trim()
            ? mapped.filter(
                (m) =>
                  String(m.business || "")
                    .toLowerCase()
                    .includes(q.toLowerCase()) ||
                  String(m.phone || "")
                    .toLowerCase()
                    .includes(q.toLowerCase())
              )
            : mapped;
          setCalls(filtered);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCalls();

    // Set up real-time subscription
    const channel = supabase
      .channel("calls-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        () => {
          fetchCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, q]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const query = supabase
          .from("calls")
          .select("id,business_name,phone,status,date")
          .order("date", { ascending: false })
          .limit(100);
        // filtering done client-side
        const { data, error } = await query;
        if (!error) {
          const rows = (data as CallRow[] | null) ?? [];
          const mapped = rows.map((r) => ({
            call_id: r.id,
            business: r.business_name,
            phone: r.phone ?? null,
            status: r.status,
            date: r.date,
          }));
          const filtered = q.trim()
            ? mapped.filter(
                (m) =>
                  String(m.business || "")
                    .toLowerCase()
                    .includes(q.toLowerCase()) ||
                  String(m.phone || "")
                    .toLowerCase()
                    .includes(q.toLowerCase())
              )
            : mapped;
          setCalls(filtered);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, supabase]);

  const resetFilters = () => setQ("");

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    return d.toLocaleDateString();
  }

  // removed old badge helper to keep component lean

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Calls</h2>
        <p className="text-muted-foreground">
          View your call history and recordings from Retell.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 rounded-lg">
          <input
            placeholder="Search business or number..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64 px-3 py-2 rounded-md bg-background border"
          />
          <button
            onClick={resetFilters}
            className="px-3 py-2 border rounded-md"
          >
            Reset
          </button>
        </div>

        {loading ? (
          <div className="bg-card rounded-lg p-6 flex items-center justify-center">
            <Spinner size="lg" className="text-muted-foreground" />
          </div>
        ) : calls.length === 0 ? (
          <div className="bg-card rounded-lg p-6">
            <p className="text-muted-foreground">
              {q
                ? "No calls match your current filters. Try adjusting your search criteria."
                : "No calls found. Make a call to your Retell number to see data here."}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded overflow-hidden text-sm">
            {/* Header Row */}
            <div className="grid grid-cols-5 bg-muted h-11 items-center">
              <div className="px-3 font-medium">Business</div>
              <div className="px-3 font-medium">Phone</div>
              <div className="px-3 font-medium">Status</div>
              <div className="px-3 font-medium">Date</div>
              <div className="px-3 font-medium">Actions</div>
            </div>

            {/* Data Rows */}
            {calls.map((call) => {
              const showSmsButton =
                call.status === "voicemail_reached" ||
                call.status === "dial_no_answer";
              return (
                <div
                  key={call.call_id}
                  className="grid grid-cols-5 h-12 border-b bg-card items-center"
                >
                  <div className="px-3 truncate max-w-[260px]">
                    {call.business}
                  </div>
                  <div className="px-3 truncate max-w-[200px]">
                    {call.phone ?? "N/A"}
                  </div>
                  <div className="px-3 capitalize">{call.status ?? "-"}</div>
                  <div className="px-3">{formatDate(call.date)}</div>
                  <div className="px-3">
                    {showSmsButton && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!call.phone) return;
                          try {
                            const res = await fetch("/api/sms/send", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ phoneNumber: call.phone }),
                            });
                            if (!res.ok) {
                              throw new Error("failed");
                            }
                            toast.success("SMS sent");
                          } catch {
                            toast.error("Failed to send SMS");
                          }
                        }}
                      >
                        Send SMS
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CallsPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <CallsContent />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
