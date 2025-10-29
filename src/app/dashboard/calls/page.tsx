"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [phonesWithOutbound, setPhonesWithOutbound] = useState<Set<string>>(
    new Set()
  );
  const [phonesWithReplies, setPhonesWithReplies] = useState<Set<string>>(
    new Set()
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<
    Array<{
      message: string;
      timestamp: string;
      type: "outbound" | "inbound";
    }>
  >([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);

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
          // simple client-side search (business, phone, or status)
          const filtered = q.trim()
            ? mapped.filter((m) => {
                const ql = q.toLowerCase();
                const business = String(m.business || "").toLowerCase();
                const phone = String(m.phone || "").toLowerCase();
                const rawStatus = String(m.status || "").toLowerCase();
                const friendly = (() => {
                  if (rawStatus === "voicemail_reached") return "voicemail";
                  if (rawStatus === "agent_hungup") return "agent hungup";
                  if (
                    rawStatus.includes("no_answer") ||
                    rawStatus.includes("did_not_pickup") ||
                    rawStatus.includes("dial_no_answer")
                  )
                    return "did not pickup";
                  return rawStatus.replace(/_/g, " ");
                })();
                return (
                  business.includes(ql) ||
                  phone.includes(ql) ||
                  rawStatus.includes(ql) ||
                  friendly.includes(ql)
                );
              })
            : mapped;
          setCalls(filtered);

          // compute phones with outbound and inbound interactions
          const phones = Array.from(
            new Set(
              filtered.map((c) => c.phone).filter((p): p is string => !!p)
            )
          );
          if (phones.length > 0) {
            // Get phones with outbound messages (array not empty)
            const { data: outboundData } = await supabase
              .from("interactions")
              .select("phone")
              .in("phone", phones)
              .neq("outbound", "[]");
            const outboundSet = new Set<string>();
            (outboundData || []).forEach((i: { phone?: string | null }) => {
              if (i.phone) outboundSet.add(String(i.phone));
            });
            setPhonesWithOutbound(outboundSet);

            // Get phones with inbound messages (replies) - check recent_reply
            const { data: inboundData } = await supabase
              .from("interactions")
              .select("phone")
              .in("phone", phones)
              .not("recent_reply", "is", null);
            const inboundSet = new Set<string>();
            (inboundData || []).forEach((i: { phone?: string | null }) => {
              if (i.phone) inboundSet.add(String(i.phone));
            });
            setPhonesWithReplies(inboundSet);
          } else {
            setPhonesWithOutbound(new Set());
            setPhonesWithReplies(new Set());
          }
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCalls();

    // Set up real-time subscription for calls
    const callsChannel = supabase
      .channel("calls-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        () => {
          fetchCalls();
        }
      )
      .subscribe();

    // Set up real-time subscription for interactions to update message status
    const interactionsChannel = supabase
      .channel("interactions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interactions" },
        () => {
          // Refresh interactions data when interactions change
          fetchCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(interactionsChannel);
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
            ? mapped.filter((m) => {
                const ql = q.toLowerCase();
                const business = String(m.business || "").toLowerCase();
                const phone = String(m.phone || "").toLowerCase();
                const rawStatus = String(m.status || "").toLowerCase();
                const friendly = (() => {
                  if (rawStatus === "voicemail_reached") return "voicemail";
                  if (rawStatus === "agent_hungup") return "agent hungup";
                  if (
                    rawStatus.includes("no_answer") ||
                    rawStatus.includes("did_not_pickup") ||
                    rawStatus.includes("dial_no_answer")
                  )
                    return "did not pickup";
                  return rawStatus.replace(/_/g, " ");
                })();
                return (
                  business.includes(ql) ||
                  phone.includes(ql) ||
                  rawStatus.includes(ql) ||
                  friendly.includes(ql)
                );
              })
            : mapped;
          setCalls(filtered);

          const phones = Array.from(
            new Set(
              filtered.map((c) => c.phone).filter((p): p is string => !!p)
            )
          );
          if (phones.length > 0) {
            // Get phones with outbound messages (array not empty)
            const { data: outboundData } = await supabase
              .from("interactions")
              .select("phone")
              .in("phone", phones)
              .neq("outbound", "[]");
            const outboundSet = new Set<string>();
            (outboundData || []).forEach((i: { phone?: string | null }) => {
              if (i.phone) outboundSet.add(String(i.phone));
            });
            setPhonesWithOutbound(outboundSet);

            // Get phones with inbound messages (replies) - check recent_reply
            const { data: inboundData } = await supabase
              .from("interactions")
              .select("phone")
              .in("phone", phones)
              .not("recent_reply", "is", null);
            const inboundSet = new Set<string>();
            (inboundData || []).forEach((i: { phone?: string | null }) => {
              if (i.phone) inboundSet.add(String(i.phone));
            });
            setPhonesWithReplies(inboundSet);
          } else {
            setPhonesWithOutbound(new Set());
            setPhonesWithReplies(new Set());
          }
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

  // Fetch interactions when modal opens
  useEffect(() => {
    if (!modalOpen || !selectedPhone) {
      setInteractions([]);
      return;
    }

    async function fetchInteractions() {
      setLoadingInteractions(true);
      try {
        const { data, error } = await supabase
          .from("interactions")
          .select("outbound,inbound")
          .eq("phone", selectedPhone)
          .maybeSingle();

        if (error) {
          console.error("Error fetching interactions:", error);
          setInteractions([]);
        } else if (data) {
          // Combine outbound and inbound messages, sorted by timestamp
          const messages: Array<{
            message: string;
            timestamp: string;
            type: "outbound" | "inbound";
          }> = [];

          const outbound =
            (data.outbound as Array<{ message: string; timestamp: string }>) ||
            [];
          const inbound =
            (data.inbound as Array<{ message: string; timestamp: string }>) ||
            [];

          outbound.forEach((msg) => {
            messages.push({ ...msg, type: "outbound" });
          });

          inbound.forEach((msg) => {
            messages.push({ ...msg, type: "inbound" });
          });

          // Sort by timestamp
          messages.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          setInteractions(messages);
        } else {
          setInteractions([]);
        }
      } catch (error) {
        console.error("Error:", error);
        setInteractions([]);
      } finally {
        setLoadingInteractions(false);
      }
    }

    fetchInteractions();

    // Subscribe to changes
    const channel = supabase
      .channel(`interactions-${selectedPhone}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "interactions",
          filter: `phone=eq.${selectedPhone}`,
        },
        () => fetchInteractions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [modalOpen, selectedPhone, supabase]);

  // removed old badge helper to keep component lean

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Outreach</h2>
        <p className="text-muted-foreground">
          View recent calls and SMS outreach.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 rounded-lg">
          <input
            placeholder="Search business, number, or status..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-80 px-3 py-2 rounded-md bg-background border"
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
            <div className="grid grid-cols-7 bg-muted h-11 items-center">
              <div className="px-3 font-medium">Business</div>
              <div className="px-3 font-medium">Phone</div>
              <div className="px-3 font-medium">Call Outcome</div>
              <div className="px-3 font-medium">Time</div>
              <div className="px-3 font-medium">Date</div>
              <div className="px-3 font-medium">Status</div>
              <div className="px-3 font-medium">Actions</div>
            </div>

            {/* Data Rows */}
            {calls.map((call) => {
              const showSmsButton =
                call.status === "voicemail_reached" ||
                call.status === "dial_no_answer";
              const friendlyStatus = (() => {
                const s = String(call.status || "").toLowerCase();
                if (s === "voicemail_reached") return "Voicemail";
                if (s === "agent_hungup") return "Agent Hungup";
                if (
                  s.includes("no_answer") ||
                  s.includes("did_not_pickup") ||
                  s.includes("dial_no_answer")
                )
                  return "Did Not Pickup";
                return s
                  ? s
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                  : "-";
              })();
              const timeAest = (() => {
                const d = call.date ? new Date(call.date) : null;
                return d
                  ? d.toLocaleTimeString("en-AU", {
                      timeZone: "Australia/Sydney",
                      hour12: true,
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-";
              })();
              return (
                <div
                  key={call.call_id}
                  className="grid grid-cols-7 h-12 border-b bg-card items-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    if (call.phone) {
                      setSelectedPhone(call.phone);
                      setModalOpen(true);
                    }
                  }}
                >
                  <div className="px-3 truncate max-w-[260px]">
                    {call.business}
                  </div>
                  <div className="px-3 truncate max-w-[200px]">
                    {call.phone ?? "N/A"}
                  </div>
                  <div className="px-3">{friendlyStatus}</div>
                  <div className="px-3">{timeAest}</div>
                  <div className="px-3">{formatDate(call.date)}</div>
                  <div className="px-3">
                    {call.phone && phonesWithReplies.has(call.phone) ? (
                      <Badge className="bg-green-500 hover:bg-green-600 text-white rounded-full border-transparent">
                        Replied
                      </Badge>
                    ) : call.phone && phonesWithOutbound.has(call.phone) ? (
                      <Badge className="bg-orange-500 hover:bg-orange-600 text-white rounded-full border-transparent">
                        Messaged
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </div>
                  <div className="px-3" onClick={(e) => e.stopPropagation()}>
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
                            // Refresh outbound phones to update "Sent" indicator
                            setPhonesWithOutbound(
                              (prev) => new Set([...prev, call.phone!])
                            );
                            // Refresh modal if it's open for this phone
                            if (modalOpen && selectedPhone === call.phone) {
                              const { data } = await supabase
                                .from("interactions")
                                .select("outbound,inbound")
                                .eq("phone", call.phone)
                                .maybeSingle();
                              if (data) {
                                const messages: Array<{
                                  message: string;
                                  timestamp: string;
                                  type: "outbound" | "inbound";
                                }> = [];
                                const outbound =
                                  (data.outbound as Array<{
                                    message: string;
                                    timestamp: string;
                                  }>) || [];
                                const inbound =
                                  (data.inbound as Array<{
                                    message: string;
                                    timestamp: string;
                                  }>) || [];
                                outbound.forEach((msg) =>
                                  messages.push({ ...msg, type: "outbound" })
                                );
                                inbound.forEach((msg) =>
                                  messages.push({ ...msg, type: "inbound" })
                                );
                                messages.sort(
                                  (a, b) =>
                                    new Date(a.timestamp).getTime() -
                                    new Date(b.timestamp).getTime()
                                );
                                setInteractions(messages);
                              }
                            }
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

      {/* Interactions Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Messages {selectedPhone ? `- ${selectedPhone}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 mt-4">
            {loadingInteractions ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : interactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-4">💬</div>
                <p className="text-muted-foreground text-lg">
                  No interaction has happened
                </p>
              </div>
            ) : (
              interactions.map((interaction, index) => {
                if (interaction.type === "outbound") {
                  return (
                    <div
                      key={`outbound-${index}`}
                      className="flex justify-end items-start gap-2"
                    >
                      <div className="max-w-[70%] bg-primary text-primary-foreground rounded-lg px-4 py-2">
                        <p className="text-sm">{interaction.message}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(interaction.timestamp).toLocaleString(
                            "en-AU",
                            {
                              timeZone: "Australia/Sydney",
                              hour12: true,
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  );
                }
                if (interaction.type === "inbound") {
                  return (
                    <div
                      key={`inbound-${index}`}
                      className="flex justify-start items-start gap-2"
                    >
                      <div className="max-w-[70%] bg-muted rounded-lg px-4 py-2">
                        <p className="text-sm">{interaction.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(interaction.timestamp).toLocaleString(
                            "en-AU",
                            {
                              timeZone: "Australia/Sydney",
                              hour12: true,
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CallsPage() {
  return (
    <DashboardLayout>
      <CallsContent />
    </DashboardLayout>
  );
}
