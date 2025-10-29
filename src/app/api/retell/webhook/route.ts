// app/api/retell/webhook/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export const runtime = "nodejs";

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

// no transcript parsing needed for simple storage

export async function GET() {
  console.log("Webhook GET received:", new Date().toISOString());
  return NextResponse.json({ message: "Webhook endpoint is working" });
}

export async function POST(req: Request) {
  console.log("Webhook POST received:", req.url);

  try {
    const supabase = createServiceRoleClient();
    const body = await req.json();
    const event: string = body?.event ?? "call_event";
    const call: RetellCall = body?.call ?? {};

    // ---- Identify call and basic fields ----
    const callId = call.call_id ?? call.id;
    if (!callId) {
      console.error("retell webhook: missing call id", body);
      return NextResponse.json({ ok: true });
    }

    // fixed agent id kept for potential auditing, not needed for storage
    const fromNum = call.from_number ?? call.from ?? null;
    const toNum = call.to_number ?? call.to ?? null;

    const ended_at = toDate(call.end_timestamp ?? call.ended_at) ?? null;

    // ---- One-account mode: business name comes from webhook payload only ----
    const businessName =
      (call.dynamic_variables?.business_name as string) ??
      (call.metadata?.business_name as string) ??
      (call.dynamic_variables?.business as string) ??
      (call.metadata?.business as string) ??
      (call.dynamic_variables?.company_name as string) ??
      (call.metadata?.company_name as string) ??
      "Unknown";

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

    // no transcript/summary/audio needed for simple storage

    // ---- Skip heavy storage; just store the minimal fields required ----

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

    // ---- Done ----

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
