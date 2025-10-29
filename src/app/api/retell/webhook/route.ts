// app/api/retell/webhook/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export const runtime = "nodejs";
const FIXED_RETELL_AGENT_ID = "agent_90d4bdc93e4bda3f47145a540c" as const;

// ---- Types from Retell (loose on purpose; providers vary) ----
type RetellCall = {
  id?: string;
  call_id?: string;
  agent_id?: string;
  from?: string;
  from_number?: string;
  to?: string;
  to_number?: string;
  direction?: string; // inbound | outbound
  start_timestamp?: number; // ms epoch
  end_timestamp?: number; // ms epoch
  started_at?: string | number;
  ended_at?: string | number;
  disconnection_reason?: string;

  transcript?: string;
  transcript_object?: unknown; // array-ish
  transcript_with_tool_calls?: unknown; // array-ish

  summary?: string;
  call_analysis?: { summary?: string } | null;

  audio_url?: string;
  recording_url?: string;

  retell_llm_dynamic_variables?: Record<string, unknown>;
  dynamic_variables?: Record<string, unknown>;
  metadata?: Record<string, unknown> & { business_id?: string };
};

type TranscriptSeg = { role: "agent" | "user"; text: string; ts?: number };

// ---- Helpers ----
function toDate(val?: string | number | null): Date | null {
  if (val == null) return null;
  try {
    return typeof val === "number" ? new Date(val) : new Date(val);
  } catch {
    return null;
  }
}

function normalizeDirection(d?: string | null): "inbound" | "outbound" | null {
  const v = (d ?? "").toLowerCase().trim();
  if (v.startsWith("in")) return "inbound";
  if (v.startsWith("out")) return "outbound";
  return null;
}

function mapStatus(
  endedAt: Date | null,
  reason: string | null
): "in_progress" | "completed" | "missed" | "failed" {
  if (!endedAt) return "in_progress";
  const r = (reason ?? "").toLowerCase();
  if (
    r.includes("no_answer") ||
    r.includes("busy") ||
    r.includes("dial_no_answer")
  )
    return "missed";
  if (r.includes("error") || r.includes("fail")) return "failed";
  return "completed";
}

// Accepts transcript_object or transcript_with_tool_calls and returns a normalized JSON array
function toTranscriptJson(raw: unknown): TranscriptSeg[] | null {
  if (!Array.isArray(raw)) return null;
  const out: TranscriptSeg[] = [];
  for (const seg of raw as Array<Record<string, unknown>>) {
    if (!seg) continue;
    const speaker = String(seg["speaker"] ?? seg["role"] ?? "").toLowerCase();
    const role: "agent" | "user" = speaker.includes("agent") ? "agent" : "user";
    const text = String(seg["text"] ?? seg["content"] ?? "").trim();
    if (!text) continue;
    let ts: number | undefined;
    const startMs = seg["start_ms"];
    const offsetMs = seg["offset_ms"];
    const startTime = seg["start_time"];
    if (typeof startMs === "number") ts = startMs / 1000;
    else if (typeof offsetMs === "number") ts = offsetMs / 1000;
    else if (typeof startTime === "number") ts = startTime;
    out.push({ role, text, ts });
  }
  return out.length ? out : null;
}

export async function GET() {
  console.log("Webhook GET received:", new Date().toISOString());
  return NextResponse.json({ message: "Webhook endpoint is working" });
}

export async function POST(req: Request) {
  console.log("Webhook POST received:", req.url);

  const supabase = createServiceRoleClient();

  try {
    const body = await req.json();
    const event: string = body?.event ?? "call_event";
    const call: RetellCall = body?.call ?? {};

    // ---- Identify call and basic fields ----
    const callId = call.call_id ?? call.id;
    if (!callId) {
      console.error("retell webhook: missing call id", body);
      return NextResponse.json({ ok: true });
    }

    const agentId = call.agent_id ?? FIXED_RETELL_AGENT_ID;
    const fromNum = call.from_number ?? call.from ?? null;
    const toNum = call.to_number ?? call.to ?? null;

    const started_at = toDate(call.start_timestamp ?? call.started_at) ?? null;
    const ended_at = toDate(call.end_timestamp ?? call.ended_at) ?? null;

    const duration_seconds =
      started_at && ended_at
        ? Math.max(0, Math.round((+ended_at - +started_at) / 1000))
        : null;

    // ---- Resolve business id and name from fixed agent mapping ----
    let { data: agentRow, error: agentErr } = await supabase
      .from("agents")
      .select("business_id")
      .eq("retell_agent_id", FIXED_RETELL_AGENT_ID)
      .maybeSingle();
    if (!agentRow) {
      // Auto-create mapping to the first business if none exists yet
      const { data: firstBiz, error: bizListErr } = await supabase
        .from("businesses")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (bizListErr || !firstBiz) {
        console.error("agent lookup failed and no business found", {
          agentErr,
          bizListErr,
          callId,
          event,
        });
        return NextResponse.json({ ok: true });
      }
      const { error: insertAgentErr } = await supabase.from("agents").upsert(
        {
          business_id: firstBiz.id,
          retell_agent_id: FIXED_RETELL_AGENT_ID,
          display_name: "Retell Agent",
        },
        { onConflict: "retell_agent_id" }
      );
      if (insertAgentErr) {
        console.error("failed to create agent mapping", {
          insertAgentErr,
          callId,
          event,
        });
        return NextResponse.json({ ok: true });
      }
      // Re-query after upsert
      const requery = await supabase
        .from("agents")
        .select("business_id")
        .eq("retell_agent_id", FIXED_RETELL_AGENT_ID)
        .maybeSingle();
      agentRow = requery.data ?? null;
      agentErr = requery.error ?? null;
      if (!agentRow) {
        console.error("agent mapping still missing after upsert", {
          agentErr,
          callId,
          event,
        });
        return NextResponse.json({ ok: true });
      }
    }
    const bizId = agentRow.business_id as string;
    const { data: bizRow } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", bizId)
      .maybeSingle();
    const businessName = bizRow?.name ?? "Unknown";

    // ---- Normalize values ----
    const direction = normalizeDirection(call.direction);
    let status =
      event === "call_started" || event === "call_ended"
        ? mapStatus(ended_at, call.disconnection_reason ?? null)
        : undefined;
    if (event === "call_analyzed" && !status) {
      status = mapStatus(ended_at, call.disconnection_reason ?? null);
      if (!status) status = "completed";
    }

    // ---- Transcript (flat + structured) ----
    const rawTranscript =
      call.transcript_object ?? call.transcript_with_tool_calls ?? null;
    const segments = toTranscriptJson(rawTranscript);

    // ---- Summary (post-call analysis may arrive later) ----
    const summary = call.call_analysis?.summary ?? call.summary ?? null;

    // ---- Audio URL (provider-field name varies) ----
    const recordingUrl = call.recording_url ?? call.audio_url ?? null;

    // ---- Build an upsert payload without nuking existing values ----
    const payload: Record<string, unknown> = {
      id: callId,
      business_id: bizId,
    };

    if (agentId) payload.agent_id = agentId;
    if (fromNum) payload.from_number = fromNum;
    if (toNum) payload.to_number = toNum;
    if (direction) payload.direction = direction;

    if (started_at) payload.started_at = started_at;
    if (ended_at) payload.ended_at = ended_at;
    if (typeof duration_seconds === "number")
      payload.duration_seconds = duration_seconds;

    if (call.disconnection_reason)
      payload.disconnection_reason = call.disconnection_reason;

    // Only set status from started/ended; do NOT overwrite on call_analyzed
    if (status) payload.status = status;

    if (
      typeof call.transcript === "string" &&
      call.transcript.trim().length > 0
    ) {
      payload.transcript = call.transcript;
    }
    if (segments) payload.transcript_json = segments;

    if (summary) payload.summary = summary;

    if (recordingUrl) payload.audio_url = recordingUrl;

    const dyn =
      call.dynamic_variables ?? call.retell_llm_dynamic_variables ?? {};
    if (dyn && Object.keys(dyn).length > 0) payload.dynamic_variables = dyn;

    // ---- Upsert call FIRST (prevents FK race for events) ----
    const { error: upsertErr } = await supabase
      .from("calls")
      .upsert(payload, { onConflict: "id" });

    if (upsertErr) {
      console.error("calls upsert error", upsertErr, { callId, event });
      return NextResponse.json({ ok: true });
    }

    // ---- Also upsert a minimal record for the UI (Business Name | Phone Number | Call Status) ----
    const customerNumber =
      direction === "outbound" ? toNum ?? fromNum : fromNum ?? toNum;
    const minimal = {
      call_id: String(callId),
      business_name: String(businessName),
      phone_number: customerNumber ?? null,
      call_status: status ?? null,
    };
    const { error: simpleErr } = await supabase
      .from("simple_calls")
      .upsert(minimal, { onConflict: "call_id" });
    if (simpleErr)
      console.warn("simple_calls upsert warn", simpleErr, { callId, event });

    // ---- Always log an event row (deferrable FK) ----
    const { error: evtErr } = await supabase.from("call_events").insert({
      call_id: callId,
      business_id: bizId,
      type: event,
      data: body,
      occurred_at: new Date(),
    });
    if (evtErr)
      console.warn("call_events insert warn", evtErr, { callId, event });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("retell webhook error", err);
    console.error("Webhook request details:", {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
    });
    // Return 2xx so provider doesn't retry-spam; your logs will capture details
    return NextResponse.json({ ok: true });
  }
}
