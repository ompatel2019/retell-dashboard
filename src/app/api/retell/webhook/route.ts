import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export const runtime = "nodejs";

// Retell webhook payload types
type RetellCall = {
  call_id: string;
  agent_id?: string;
  from_number?: string;
  to_number?: string;
  direction?: string;
  start_timestamp?: number; // ms
  end_timestamp?: number; // ms
  disconnection_reason?: string;
  transcript?: string;
  retell_llm_dynamic_variables?: Record<string, unknown>;
  call_analysis?: {
    summary?: string;
    intent?: string;
    entities?: Record<string, unknown>;
  };
  metadata?: { business_id?: string } & Record<string, unknown>;
};

export async function POST(req: Request) {
  try {
    const { event, call } = (await req.json()) as {
      event: string;
      call: RetellCall;
    };

    if (!call?.call_id) {
      return NextResponse.json(
        { ok: false, error: "Missing call_id" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Prefer explicit metadata.business_id, fallback = null (you can add mapping logic by number/agent if needed)
    const business_id = call.metadata?.business_id ?? null;

    const started_at = call.start_timestamp
      ? new Date(call.start_timestamp)
      : null;
    const ended_at = call.end_timestamp ? new Date(call.end_timestamp) : null;
    const duration_seconds =
      started_at && ended_at
        ? Math.max(0, Math.round((+ended_at - +started_at) / 1000))
        : null;

    // Upsert into calls table
    const { error: upsertError } = await supabase.from("calls").upsert(
      {
        id: call.call_id,
        business_id,
        agent_id: call.agent_id ?? null,
        from_number: call.from_number ?? null,
        to_number: call.to_number ?? null,
        direction: call.direction ?? null,
        started_at,
        ended_at,
        duration_seconds,
        disconnection_reason: call.disconnection_reason ?? null,
        status: ended_at ? "ended" : "active",
        summary: call.call_analysis?.summary ?? null,
        transcript: call.transcript ?? null,
        dynamic_variables: call.retell_llm_dynamic_variables ?? null,
        updated_at: new Date(),
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      console.error("Error upserting call:", upsertError);
      return NextResponse.json(
        { ok: false, error: "Database error" },
        { status: 500 }
      );
    }

    // Lightweight event trail (call_events)
    try {
      await supabase.from("call_events").insert({
        call_id: call.call_id,
        business_id,
        type: event,
        occurred_at: new Date(),
        data: call as unknown as Record<string, unknown>,
      });
    } catch (err) {
      console.warn("Failed to insert call_event:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
