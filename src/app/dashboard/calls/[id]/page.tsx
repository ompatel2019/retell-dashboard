"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { BusinessProviderWrapper } from "@/components/providers/BusinessProviderWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CallRow = {
  id: string;
  business_id: string;
  from_number: string | null;
  to_number: string | null;
  direction?: string | null;
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

function getBooleanAtPath(obj: unknown, path: string[]): boolean | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (!isRecordLike(current)) return undefined;
    current = current[key];
  }
  return typeof current === "boolean" ? current : undefined;
}

function getRecordAtPath(
  obj: unknown,
  path: string[]
): Record<string, unknown> | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (!isRecordLike(current)) return undefined;
    current = current[key];
  }
  return isRecordLike(current)
    ? (current as Record<string, unknown>)
    : undefined;
}

// Recursively search an object graph for the first object value at a given key
function findRecordByKeyDeep(
  obj: unknown,
  keyName: string
): Record<string, unknown> | undefined {
  if (!isRecordLike(obj)) return undefined;
  for (const [k, v] of Object.entries(obj)) {
    if (k === keyName && isRecordLike(v)) return v as Record<string, unknown>;
    const nested = findRecordByKeyDeep(v, keyName);
    if (nested) return nested;
  }
  return undefined;
}

function toDisplayableKey(rawKey: string): string {
  return rawKey.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
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
  const [analysisInfo, setAnalysisInfo] = useState<{
    in_voicemail?: boolean;
    user_sentiment?: string;
    call_successful?: boolean;
    custom_analysis_data?: Record<string, unknown> | null;
  } | null>(null);
  const [events, setEvents] = useState<
    Array<{
      type: string;
      occurred_at: string;
      data: Record<string, unknown> | null;
    }>
  >();
  const [callerInfo, setCallerInfo] = useState<Record<string, unknown> | null>(
    null
  );

  useEffect(() => {
    async function load() {
      if (!params?.id) return;
      try {
        // Fetch call data
        const { data: callData, error: callError } = await supabase
          .from("calls")
          .select(
            "id, business_id, from_number, to_number, direction, started_at, ended_at, duration_seconds, status, summary, transcript, transcript_json, audio_url, disconnection_reason, dynamic_variables"
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

            const analysisRoot =
              getRecordAtPath(raw, ["call", "call_analysis"]) ??
              getRecordAtPath(raw, ["call_analysis"]);
            if (analysisRoot) {
              setAnalysisInfo({
                in_voicemail: getBooleanAtPath(analysisRoot, ["in_voicemail"]),
                user_sentiment: getStringAtPath(analysisRoot, [
                  "user_sentiment",
                ]),
                call_successful: getBooleanAtPath(analysisRoot, [
                  "call_successful",
                ]),
                custom_analysis_data:
                  getRecordAtPath(analysisRoot, ["custom_analysis_data"]) ??
                  null,
              });
            }
          } else {
            console.log("No analysis data found or error:", analysisError);
          }

          // Fetch full event timeline
          const { data: evts } = await supabase
            .from("call_events")
            .select("type, occurred_at, data")
            .eq("call_id", params.id)
            .eq("business_id", callData.business_id)
            .order("occurred_at", { ascending: true })
            .limit(100);
          setEvents(
            (evts ?? []).map(
              (e: { type: unknown; occurred_at: unknown; data: unknown }) => ({
                type: String(e.type ?? ""),
                occurred_at: String(e.occurred_at ?? ""),
                data:
                  (typeof e.data === "object" &&
                  e.data !== null &&
                  !Array.isArray(e.data)
                    ? (e.data as Record<string, unknown>)
                    : null) ?? null,
              })
            )
          );

          // Extract dynamic variables from the latest call_ended event
          const timeline = (evts ?? []) as Array<{
            type?: string;
            occurred_at?: string;
            data?: unknown;
          }>;
          const endedEvents = timeline
            .filter((e) => String(e.type ?? "") === "call_ended")
            .sort(
              (a, b) =>
                new Date(String(a.occurred_at ?? 0)).getTime() -
                new Date(String(b.occurred_at ?? 0)).getTime()
            );
          const latestEnded = endedEvents[endedEvents.length - 1];
          if (latestEnded && latestEnded.data) {
            // Common locations: root or under call
            const root = isRecordLike(latestEnded.data)
              ? (latestEnded.data as Record<string, unknown>)
              : {};
            const fromRoot = findRecordByKeyDeep(
              root,
              "collected_dynamic_variables"
            );
            const dynamicFromCall = getRecordAtPath(root, [
              "call",
              "dynamic_variables",
            ]);
            const chosen = fromRoot ?? dynamicFromCall ?? null;
            if (chosen && Object.keys(chosen).length > 0) {
              setCallerInfo(chosen);
            }
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
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 flex items-center justify-center">
        <Spinner size="lg" className="text-muted-foreground" />
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
            <div className="text-muted-foreground">Direction</div>
            <div className="font-medium">{call.direction ?? "unknown"}</div>
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
          <TabsTrigger value="caller-info">Caller Information</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="space-y-4">
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

            {analysisInfo && (
              <Card>
                <CardHeader>
                  <CardTitle>Call Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {typeof analysisInfo.call_successful === "boolean" && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-muted-foreground">
                          Call Successful
                        </div>
                        <div className="font-medium">
                          {analysisInfo.call_successful ? "Yes" : "No"}
                        </div>
                      </div>
                    )}
                    {analysisInfo.user_sentiment && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-muted-foreground">
                          User Sentiment
                        </div>
                        <div className="font-medium">
                          {analysisInfo.user_sentiment}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="caller-info">
          <Card>
            <CardHeader>
              <CardTitle>Caller Information</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Prefer callerInfo (from call_ended event). Fallback to call.dynamic_variables
                const sourceVars: Record<string, unknown> | null =
                  callerInfo ?? call.dynamic_variables ?? null;
                if (!sourceVars || Object.keys(sourceVars).length === 0) {
                  return (
                    <p className="text-muted-foreground text-sm">
                      No caller information captured.
                    </p>
                  );
                }

                const hiddenKeys = new Set([
                  "previous_node",
                  "current_node",
                  "previousNode",
                  "currentNode",
                ]);

                const entries = Object.entries(sourceVars)
                  .filter(([key]) => !hiddenKeys.has(key))
                  .filter(([, value]) =>
                    ["string", "number", "boolean"].includes(typeof value)
                  ) as Array<[string, string | number | boolean]>;

                if (entries.length === 0) {
                  return (
                    <p className="text-muted-foreground text-sm">
                      No important caller fields to display.
                    </p>
                  );
                }

                return (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {entries.map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between"
                      >
                        <div className="text-muted-foreground">
                          {toDisplayableKey(key)}
                        </div>
                        <div className="font-medium truncate max-w-[60%] text-right">
                          {String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Event Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {!events || events.length === 0 ? (
                <p className="text-muted-foreground">No events found.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {events.map((e, i) => (
                    <div
                      key={`${e.type}-${i}`}
                      className="flex items-center justify-between"
                    >
                      <div className="capitalize">
                        {e.type.replaceAll("_", " ")}
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(e.occurred_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
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
                <p className="text-muted-foreground">No audio recording available.</p>
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
