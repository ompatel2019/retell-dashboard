"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CallRow = {
  id: string;
  business_id: string;
  from_number: string | null;
  to_number: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string | null;
  summary: string | null;
  transcript: string | null;
  transcript_json: Record<string, unknown> | unknown[] | null;
  audio_url: string | null;
  disconnection_reason: string | null;
  dynamic_variables?: Record<string, unknown> | null;
};

// Safe helpers for nested unknown JSON
function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringAtPath(obj: unknown, path: string[]): string | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (!isRecordLike(current)) return undefined;
    current = current[key];
  }
  return typeof current === "string" ? current : undefined;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString();
}

function formatTimecode(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `[${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}]`;
}

function normalizeTranscriptItems(
  transcriptJson: Record<string, unknown> | unknown[] | null
): Array<{ speaker: string; text: string; seconds: number }> {
  if (!transcriptJson) return [];
  // Helpers to safely access unknown shapes
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
  const getString = (o: Record<string, unknown>, k: string) =>
    typeof o[k] === "string" ? (o[k] as string) : undefined;
  const getNumber = (o: Record<string, unknown>, k: string) =>
    typeof o[k] === "number" ? (o[k] as number) : undefined;
  const getArray = (o: Record<string, unknown>, k: string) =>
    Array.isArray(o[k]) ? (o[k] as unknown[]) : undefined;

  const items: Array<{ speaker: string; text: string; seconds: number }> = [];
  const pushItem = (
    speaker: string,
    text: string,
    seconds: number | null | undefined
  ) => {
    const s = typeof seconds === "number" && seconds >= 0 ? seconds : 0;
    items.push({ speaker, text, seconds: s });
  };

  if (isArray(transcriptJson)) {
    for (const node of transcriptJson) {
      if (!isRecord(node)) continue;
      const speaker =
        getString(node, "role") ?? getString(node, "speaker") ?? "unknown";
      const text =
        getString(node, "text") ??
        getString(node, "content") ??
        getString(node, "message") ??
        "";
      const seconds = (() => {
        const s =
          getNumber(node, "start") ??
          getNumber(node, "timestamp") ??
          getNumber(node, "time");
        return typeof s === "number" ? Math.round(s) : 0;
      })();
      if (text) pushItem(speaker, text, seconds);
      const toolCalls = getArray(node, "tool_calls") ?? [];
      for (const t of toolCalls) {
        if (isRecord(t)) {
          const name = getString(t, "name");
          const args = isRecord(t["arguments"]) ? t["arguments"] : undefined;
          const tText = name
            ? `${name}(${JSON.stringify(args ?? {})})`
            : JSON.stringify(t);
          pushItem("tool", tText, seconds);
        }
      }
    }
  } else if (isRecord(transcriptJson) && isArray(transcriptJson.segments)) {
    for (const seg of transcriptJson.segments) {
      if (!isRecord(seg)) continue;
      const speaker =
        getString(seg, "speaker") ?? getString(seg, "role") ?? "unknown";
      const text = getString(seg, "text") ?? getString(seg, "content") ?? "";
      const seconds = (() => {
        const s = getNumber(seg, "start");
        return typeof s === "number" ? Math.round(s) : 0;
      })();
      if (text) pushItem(speaker, text, seconds);
    }
  }

  return items;
}

function CallDetailInner() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();
  const [call, setCall] = useState<CallRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryText, setSummaryText] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!params?.id) return;
      try {
        // Fetch call data
        const { data: callData, error: callError } = await supabase
          .from("calls")
          .select(
            "id, business_id, from_number, to_number, started_at, ended_at, duration_seconds, status, summary, transcript, transcript_json, audio_url, disconnection_reason, dynamic_variables"
          )
          .eq("id", params.id)
          .maybeSingle();

        if (callError) throw callError;
        setCall(callData as CallRow);
        setSummaryText((callData as CallRow | null)?.summary ?? null);

        // Fetch call analysis data from call_events
        if (callData) {
          const { data: analysisData, error: analysisError } = await supabase
            .from("call_events")
            .select("data")
            .eq("call_id", params.id)
            .eq("type", "call_analyzed")
            .eq("business_id", callData.business_id)
            .order("occurred_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!analysisError && analysisData && analysisData.data) {
            const raw = analysisData.data as Record<string, unknown>;
            console.log("Call analysis data:", raw);
            // Common shapes observed from providers/tests
            const nestedSummary =
              getStringAtPath(raw, ["call", "call_analysis", "call_summary"]) ??
              getStringAtPath(raw, ["call", "call_analysis", "summary"]) ??
              getStringAtPath(raw, ["call_analysis", "call_summary"]) ??
              getStringAtPath(raw, ["call_summary"]) ??
              getStringAtPath(raw, ["summary"]) ??
              null;
            if (
              nestedSummary &&
              typeof nestedSummary === "string" &&
              nestedSummary.trim().length > 0
            ) {
              setSummaryText(nestedSummary);
            }
          } else {
            console.log("No analysis data found or error:", analysisError);
          }
        }
      } catch (e) {
        console.error("Error loading call data:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params?.id, supabase]);

  const transcriptItems = useMemo(
    () => normalizeTranscriptItems(call?.transcript_json ?? null),
    [call?.transcript_json]
  );

  if (loading) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <p className="text-muted-foreground">Loading call...</p>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <p className="text-muted-foreground">Call not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/calls">
          <button className="inline-flex items-center justify-center h-8 w-8 rounded-md text-sm font-medium border border-input bg-background shadow-xs hover:underline hover:cursor-pointer transition-all duration-200">
            <ChevronLeft className="size-4" />
          </button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Call {call.id.slice(-8)}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <div className="text-muted-foreground">From</div>
            <div className="font-medium">{call.from_number ?? "N/A"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">To</div>
            <div className="font-medium">{call.to_number ?? "N/A"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Started</div>
            <div className="font-medium">{formatDate(call.started_at)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Duration</div>
            <div className="font-medium">
              {formatDuration(call.duration_seconds)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">End Reason</div>
            <div className="font-medium">
              {call.disconnection_reason ?? "unknown"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Status</div>
            <div className="font-medium">{call.status ?? "unknown"}</div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="caller">Caller Information</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>AI Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryText && summaryText.trim().length > 0 ? (
                <p className="whitespace-pre-wrap text-sm">{summaryText}</p>
              ) : (
                <p className="text-muted-foreground">
                  No call summary available from analysis.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              {transcriptItems.length === 0 ? (
                <p className="text-muted-foreground">
                  No structured transcript available.
                </p>
              ) : (
                <div className="space-y-3">
                  {transcriptItems.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        msg.speaker === "agent"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg border p-3 text-sm ${
                          msg.speaker === "agent" ? "bg-secondary" : "bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                          <span className="uppercase tracking-wide text-xs">
                            {msg.speaker}
                          </span>
                          <span className="text-xs">
                            {formatTimecode(msg.seconds)}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audio">
          <Card>
            <CardHeader>
              <CardTitle>Recording</CardTitle>
            </CardHeader>
            <CardContent>
              {call.audio_url ? (
                <audio controls src={call.audio_url} className="w-full" />
              ) : (
                <p className="text-muted-foreground">
                  No audio recording available.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="caller">
          <Card>
            <CardHeader>
              <CardTitle>Caller Information</CardTitle>
            </CardHeader>
            <CardContent>
              {call.dynamic_variables &&
              Object.keys(call.dynamic_variables).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {Object.entries(call.dynamic_variables).map(([key, val]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="text-muted-foreground">{key}</div>
                      <div className="font-medium break-all">
                        {typeof val === "string" ? val : JSON.stringify(val)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No caller info captured.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CallDetailPage() {
  return (
    <BusinessProviderWrapper>
      <DashboardLayout>
        <CallDetailInner />
      </DashboardLayout>
    </BusinessProviderWrapper>
  );
}
