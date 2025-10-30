"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type CallRecord = {
  call_id: string;
  business: string;
  phone: string | null;
  status: string | null;
  date: string;
};

function CallsContent() {
  const [rawCalls, setRawCalls] = useState<CallRecord[]>([]);
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
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [outcomeFilter, setOutcomeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sendingSmsToMultiple, setSendingSmsToMultiple] = useState(false);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("calls")
        .select("id,business_name,phone,status,date")
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching calls:", error);
        setRawCalls([]);
        setPhonesWithOutbound(new Set());
        setPhonesWithReplies(new Set());
        return;
      }

      const rows = (data as CallRow[] | null) ?? [];
      const mapped = rows.map((r) => ({
        call_id: r.id,
        business: r.business_name,
        phone: r.phone ?? null,
        status: r.status,
        date: r.date,
      }));

      setRawCalls(mapped);

      const phones = Array.from(
        new Set(mapped.map((c) => c.phone).filter((p): p is string => !!p))
      );

      if (phones.length === 0) {
        setPhonesWithOutbound(new Set());
        setPhonesWithReplies(new Set());
        return;
      }

      const [
        { data: outboundData, error: outboundError },
        { data: inboundData, error: inboundError },
      ] = await Promise.all([
        supabase
          .from("interactions")
          .select("phone")
          .in("phone", phones)
          .neq("outbound", "[]"),
        supabase
          .from("interactions")
          .select("phone")
          .in("phone", phones)
          .not("recent_reply", "is", null),
      ]);

      const outboundSet = new Set<string>();
      if (!outboundError) {
        (outboundData || []).forEach((i: { phone?: string | null }) => {
          if (i.phone) outboundSet.add(String(i.phone));
        });
      }

      const inboundSet = new Set<string>();
      if (!inboundError) {
        (inboundData || []).forEach((i: { phone?: string | null }) => {
          if (i.phone) inboundSet.add(String(i.phone));
        });
      }

      setPhonesWithOutbound(outboundSet);
      setPhonesWithReplies(inboundSet);
    } catch (error) {
      console.error("Error fetching calls:", error);
      setRawCalls([]);
      setPhonesWithOutbound(new Set());
      setPhonesWithReplies(new Set());
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCalls();

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

    const interactionsChannel = supabase
      .channel("interactions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interactions" },
        () => {
          fetchCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(interactionsChannel);
    };
  }, [fetchCalls, supabase]);

  const filteredCalls = useMemo(() => {
    const searchTerm = q.trim().toLowerCase();

    return rawCalls.filter((call) => {
      if (searchTerm) {
        const business = String(call.business || "").toLowerCase();
        const phone = String(call.phone || "").toLowerCase();
        const rawStatus = String(call.status || "").toLowerCase();
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
        const matches =
          business.includes(searchTerm) ||
          phone.includes(searchTerm) ||
          rawStatus.includes(searchTerm) ||
          friendly.includes(searchTerm);
        if (!matches) return false;
      }

      if (outcomeFilter.length > 0) {
        if (!call.status || !outcomeFilter.includes(call.status)) {
          return false;
        }
      }

      if (statusFilter) {
        const phoneHasReply = call.phone
          ? phonesWithReplies.has(call.phone)
          : false;
        const phoneHasOutbound = call.phone
          ? phonesWithOutbound.has(call.phone)
          : false;
        if (statusFilter === "replied" && !phoneHasReply) return false;
        if (statusFilter === "messaged" && !phoneHasOutbound) return false;
        if (statusFilter === "none" && (phoneHasReply || phoneHasOutbound)) {
          return false;
        }
      }

      return true;
    });
  }, [
    rawCalls,
    q,
    outcomeFilter,
    statusFilter,
    phonesWithReplies,
    phonesWithOutbound,
  ]);

  useEffect(() => {
    setSelectedRows((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(filteredCalls.map((c) => c.call_id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [filteredCalls]);

  const resetFilters = () => {
    setQ("");
    setOutcomeFilter([]);
    setStatusFilter(null);
    setSelectedRows(new Set());
  };

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    return d.toLocaleDateString();
  }

  // Get unique call outcomes from current calls
  const uniqueOutcomes = useMemo(
    () =>
      Array.from(
        new Set(rawCalls.map((c) => c.status).filter((s): s is string => !!s))
      ).sort(),
    [rawCalls]
  );

  const hasActiveFilters = Boolean(
    q.trim() || outcomeFilter.length > 0 || statusFilter
  );
  const allRowsSelected =
    filteredCalls.length > 0 &&
    filteredCalls.every((c) => selectedRows.has(c.call_id));

  // Format outcome for display
  const formatOutcome = (status: string) => {
    if (status === "voicemail_reached") return "Voicemail";
    if (status === "agent_hungup") return "Agent Hungup";
    if (
      status.includes("no_answer") ||
      status.includes("did_not_pickup") ||
      status.includes("dial_no_answer")
    )
      return "Did Not Pickup";
    return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const outcomeButtonLabel = (() => {
    if (outcomeFilter.length === 0) return "All Outcomes";
    if (outcomeFilter.length === 1) return formatOutcome(outcomeFilter[0]);
    if (outcomeFilter.length === 2) {
      return `${formatOutcome(outcomeFilter[0])} + ${formatOutcome(
        outcomeFilter[1]
      )}`;
    }
    return `${formatOutcome(outcomeFilter[0])} + ${
      outcomeFilter.length - 1
    } more`;
  })();

  // Bulk SMS action
  const handleBulkSMS = async () => {
    if (selectedRows.size === 0) {
      toast.error("No rows selected");
      return;
    }

    setSendingSmsToMultiple(true);
    let successCount = 0;
    let failCount = 0;

    const callsById = new Map(rawCalls.map((c) => [c.call_id, c]));

    for (const callId of selectedRows) {
      const call = callsById.get(callId);
      if (!call?.phone) continue;
      const phone = call.phone;

      try {
        const res = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: phone }),
        });
        if (!res.ok) {
          failCount++;
          continue;
        }
        successCount++;
        setPhonesWithOutbound((prev) => new Set([...prev, phone]));
      } catch {
        failCount++;
      }
    }

    setSendingSmsToMultiple(false);
    setSelectedRows(new Set());
    if (successCount > 0) {
      toast.success(
        `SMS sent to ${successCount} contact${successCount !== 1 ? "s" : ""}`
      );
    }
    if (failCount > 0) {
      toast.error(
        `Failed to send SMS to ${failCount} contact${
          failCount !== 1 ? "s" : ""
        }`
      );
    }
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Outreach</h2>
        <p className="text-muted-foreground">
          View recent calls and SMS outreach.
        </p>
      </div>

      <div className="space-y-4">
        {/* Search and Filter Bar */}
        <div className="space-y-4 rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="w-full sm:w-64 md:w-72">
                <Input
                  placeholder="Search business, number, or status..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-10 shadow-inner"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-full justify-between rounded-full bg-background/80 px-3 font-medium sm:w-56"
                  >
                    <span className="truncate text-left text-sm">
                      {outcomeButtonLabel}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {outcomeFilter.length > 0
                        ? `${outcomeFilter.length}`
                        : "All"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-60">
                  <DropdownMenuLabel>Select call outcomes</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {uniqueOutcomes.map((outcome) => (
                    <DropdownMenuCheckboxItem
                      key={outcome}
                      checked={outcomeFilter.includes(outcome)}
                      onCheckedChange={(checked) => {
                        setOutcomeFilter((prev) => {
                          const shouldAdd = checked === true;
                          if (shouldAdd) {
                            if (prev.includes(outcome)) return prev;
                            return [...prev, outcome];
                          }
                          return prev.filter((status) => status !== outcome);
                        });
                      }}
                    >
                      {formatOutcome(outcome)}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={outcomeFilter.length === 0}
                    onSelect={(event) => {
                      event.preventDefault();
                      setOutcomeFilter([]);
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Clear selection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Select
                value={statusFilter ?? "all"}
                onValueChange={(value) =>
                  setStatusFilter(value === "all" ? null : value)
                }
              >
                <SelectTrigger className="h-10 w-full sm:w-44 bg-background/80">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="messaged">Messaged</SelectItem>
                  <SelectItem value="none">No Interaction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="self-start rounded-full px-4 py-1 text-xs uppercase tracking-wide text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedRows.size > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm shadow-sm">
            <span className="text-sm font-medium">
              {selectedRows.size} row{selectedRows.size !== 1 ? "s" : ""}{" "}
              selected
            </span>
            <Button
              onClick={handleBulkSMS}
              disabled={sendingSmsToMultiple}
              size="sm"
              className="rounded-full px-4"
            >
              {sendingSmsToMultiple ? "Sending..." : "Send SMS to Selected"}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="bg-card rounded-lg p-6 flex items-center justify-center">
            <Spinner size="lg" className="text-muted-foreground" />
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="bg-card rounded-lg p-6">
            <p className="text-muted-foreground">
              {q || outcomeFilter.length > 0 || statusFilter
                ? "No calls match your current filters. Try adjusting your search criteria."
                : "No calls found. Make a call to your Retell number to see data here."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card text-sm shadow-sm">
            {/* Header Row */}
            <div className="grid grid-cols-8 h-12 items-center bg-muted/60 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div className="px-3">
                <input
                  type="checkbox"
                  checked={allRowsSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRows(
                        new Set(filteredCalls.map((c) => c.call_id))
                      );
                    } else {
                      setSelectedRows(new Set());
                    }
                  }}
                  className="size-4 cursor-pointer accent-primary"
                />
              </div>
              <div className="px-3">Business</div>
              <div className="px-3">Phone</div>
              <div className="px-3">Call Outcome</div>
              <div className="px-3">Time</div>
              <div className="px-3">Date</div>
              <div className="px-3">Status</div>
              <div className="px-3">Actions</div>
            </div>

            {/* Data Rows */}
            {filteredCalls.map((call) => {
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
              const isSelected = selectedRows.has(call.call_id);
              const openModal = () => {
                if (!call.phone) return;
                setSelectedPhone(call.phone);
                setModalOpen(true);
              };
              return (
                <div
                  key={call.call_id}
                  onClick={openModal}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openModal();
                    }
                  }}
                  className={`group grid grid-cols-8 items-center border-b border-border/40 px-2 py-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 lg:px-3 even:bg-muted/20 ${
                    isSelected
                      ? "border-primary/40 bg-primary/10 shadow-sm"
                      : "bg-card hover:bg-muted/40"
                  }`}
                  role={call.phone ? "button" : undefined}
                  tabIndex={call.phone ? 0 : -1}
                >
                  <div className="px-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const newSet = new Set(selectedRows);
                        if (e.target.checked) {
                          newSet.add(call.call_id);
                        } else {
                          newSet.delete(call.call_id);
                        }
                        setSelectedRows(newSet);
                      }}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="px-3 font-medium truncate max-w-[260px]">
                    {call.business}
                  </div>
                  <div className="px-3 font-mono text-sm truncate max-w-[200px]">
                    {call.phone ?? "N/A"}
                  </div>
                  <div className="px-3">
                    {friendlyStatus !== "-" ? (
                      <Badge
                        variant="secondary"
                        className="capitalize text-xs font-medium"
                      >
                        {friendlyStatus}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </div>
                  <div className="px-3">{timeAest}</div>
                  <div className="px-3">{formatDate(call.date)}</div>
                  <div className="px-3">
                    {call.phone && phonesWithReplies.has(call.phone) ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-transparent">
                        Replied
                      </Badge>
                    ) : call.phone && phonesWithOutbound.has(call.phone) ? (
                      <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-transparent">
                        Messaged
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </div>
                  <div className="px-3" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!call.phone}
                      className="rounded-full px-3"
                      onClick={async () => {
                        if (!call.phone) return;
                        const phone = call.phone;
                        try {
                          const res = await fetch("/api/sms/send", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ phoneNumber: phone }),
                          });
                          if (!res.ok) {
                            throw new Error("failed");
                          }
                          toast.success("SMS sent");
                          // Refresh outbound phones to update "Sent" indicator
                          setPhonesWithOutbound(
                            (prev) => new Set([...prev, phone])
                          );
                          // Refresh modal if it's open for this phone
                          if (modalOpen && selectedPhone === phone) {
                            const { data } = await supabase
                              .from("interactions")
                              .select("outbound,inbound")
                              .eq("phone", phone)
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
                  </div>
                </div>
              );
            })}
            {/* End of table */}
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
