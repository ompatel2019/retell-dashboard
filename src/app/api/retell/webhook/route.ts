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
  console.log("=== WEBHOOK POST RECEIVED ===");
  console.log("URL:", req.url);
  console.log("Timestamp:", new Date().toISOString());

  try {
    const supabase = createServiceRoleClient();
    const body = await req.json();

    console.log("=== FULL WEBHOOK BODY ===");
    console.log(JSON.stringify(body, null, 2));

    const event: string = body?.event ?? "call_event";
    const call: RetellCall = body?.call ?? {};

    console.log("=== PARSED VALUES ===");
    console.log("Event:", event);
    console.log("Call object keys:", Object.keys(call));

    // ---- Identify call and basic fields ----
    const callId = call.call_id ?? call.id;
    if (!callId) {
      console.error("retell webhook: missing call id", body);
      return NextResponse.json({ ok: true });
    }

    console.log("Call ID:", callId);

    // fixed agent id kept for potential auditing, not needed for storage
    const fromNum = call.from_number ?? call.from ?? null;
    const toNum = call.to_number ?? call.to ?? null;

    console.log("From number:", fromNum);
    console.log("To number:", toNum);
    console.log("Direction raw:", call.direction);

    const ended_at = toDate(call.end_timestamp ?? call.ended_at) ?? null;
    console.log("Ended at:", ended_at);
    console.log("Disconnection reason:", call.disconnection_reason);

    // ---- ONLY process call_analyzed events for calls table ----
    if (event !== "call_analyzed") {
      console.log("⚠ Skipping non-call_analyzed event:", event);
      return NextResponse.json({ ok: true });
    }

    // ---- Extract business name from retell_llm_dynamic_variables FIRST ----
    console.log("=== EXTRACTING BUSINESS NAME ===");
    console.log(
      "retell_llm_dynamic_variables:",
      JSON.stringify(call.retell_llm_dynamic_variables, null, 2)
    );
    console.log(
      "dynamic_variables:",
      JSON.stringify(call.dynamic_variables, null, 2)
    );
    console.log("metadata:", JSON.stringify(call.metadata, null, 2));

    const businessName =
      (call.retell_llm_dynamic_variables?.business_name as string) ??
      (call.dynamic_variables?.business_name as string) ??
      (call.metadata?.business_name as string) ??
      (call.retell_llm_dynamic_variables?.business as string) ??
      (call.dynamic_variables?.business as string) ??
      (call.metadata?.business as string) ??
      (call.retell_llm_dynamic_variables?.company_name as string) ??
      (call.dynamic_variables?.company_name as string) ??
      (call.metadata?.company_name as string) ??
      "Unknown";

    console.log("Extracted business name:", businessName);

    // ---- Normalize values ----
    const direction = normalizeDirection(call.direction);
    console.log("Normalized direction:", direction);

    const status = mapStatus(ended_at, call.disconnection_reason ?? null);
    console.log("Call status:", status);

    // ---- Store full payload in call_events ----
    const { error: evtErr } = await supabase.from("call_events").insert({
      call_id: callId,
      type: "call_analyzed",
      data: body,
      occurred_at: new Date(),
    });
    if (evtErr) {
      console.error("call_events insert ERROR:", evtErr);
    } else {
      console.log("✓ Stored call_analyzed in call_events");
    }

    // ---- Extract and upsert into simplified calls table ----
    const customerNumber =
      direction === "outbound" ? toNum ?? fromNum : fromNum ?? toNum;

    if (!customerNumber) {
      console.log(
        "⚠ No customer number extracted, skipping calls table upsert"
      );
    } else {
      console.log("Customer number (selected):", customerNumber);

      const callStatus = call.disconnection_reason ?? status ?? null;
      const callDate =
        toDate(call.start_timestamp ?? call.started_at) ?? new Date();

      // Check if this phone number already exists (i.e., called again)
      const { data: existingCall } = await supabase
        .from("calls")
        .select("id")
        .eq("phone", customerNumber)
        .maybeSingle();

      // If number was called again, clear all previous interactions
      // (new call = fresh start, no prior messages)
      if (existingCall) {
        console.log(
          "⚠ Phone number called AGAIN - clearing previous interactions"
        );
        const { error: deleteInteractionsErr } = await supabase
          .from("interactions")
          .delete()
          .eq("phone", customerNumber);

        if (deleteInteractionsErr) {
          console.error("Error clearing interactions:", deleteInteractionsErr);
        } else {
          console.log("✓ Cleared previous interactions for", customerNumber);
        }
      }

      console.log("=== UPSERTING TO CALLS TABLE ===");
      console.log({
        business_name: businessName,
        phone: customerNumber,
        status: callStatus,
        date: callDate.toISOString(),
      });

      // Upsert by phone number (unique constraint: phone)
      // If same number calls again, UPDATE date and status
      const { error: callsErr } = await supabase.from("calls").upsert(
        {
          business_name: businessName,
          phone: customerNumber,
          status: callStatus,
          date: callDate.toISOString(),
        },
        {
          onConflict: "phone",
          ignoreDuplicates: false,
        }
      );

      if (callsErr) {
        console.error("calls upsert ERROR:", callsErr);
      } else {
        console.log("✓ Successfully upserted to calls table");
      }
    }

    // ---- Done ----
    console.log("=== WEBHOOK PROCESSING COMPLETE ===\n");

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
