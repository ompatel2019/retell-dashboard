// app/api/retell/webhook/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export const runtime = "nodejs";

type RetellCall = {
  id?: string;                 // some payloads use id
  call_id?: string;            // some payloads use call_id
  agent_id?: string;
  from?: string;               // some payloads use from
  from_number?: string;        // your curl used from_number
  to?: string;
  to_number?: string;
  direction?: string;          // 'inbound' | 'outbound' (sometimes undefined)
  start_timestamp?: number;    // ms epoch in some payloads
  end_timestamp?: number;      // ms epoch
  started_at?: string | number; // alt shape
  ended_at?: string | number;   // alt shape
  disconnection_reason?: string;
  transcript?: string;
  summary?: string;
  call_analysis?: { summary?: string };
  retell_llm_dynamic_variables?: Record<string, unknown>;
  dynamic_variables?: Record<string, unknown>; // alt key
  metadata?: Record<string, unknown> & { business_id?: string };
};

export async function POST(req: Request) {
  const supabase = createServiceRoleClient();

  try {
    const body = await req.json();
    const event: string = body?.event ?? "call_event";
    const call: RetellCall = body?.call ?? {};

    // 1) Handle field name variations safely
    const callId = call.call_id ?? call.id;
    if (!callId) {
      console.error("Webhook: missing call id", body);
      return NextResponse.json({ ok: true }); // don't trigger retries
    }

    const agentId = call.agent_id ?? null;

    const fromNum =
      call.from_number ?? call.from ?? null;
    const toNum =
      call.to_number ?? call.to ?? null;

    // timestamps: accept ms epoch or ISO strings
    const started_at = call.start_timestamp
      ? new Date(call.start_timestamp)
      : call.started_at
      ? new Date(call.started_at)
      : null;

    const ended_at = call.end_timestamp
      ? new Date(call.end_timestamp)
      : call.ended_at
      ? new Date(call.ended_at)
      : null;

    const duration_seconds =
      started_at && ended_at
        ? Math.max(0, Math.round((+ended_at - +started_at) / 1000))
        : null;

    // 2) Resolve business_id in the DB (uses your function from step 1)
    const { data: bizId, error: bizErr } = await supabase.rpc(
      "resolve_business_id",
      {
        agent_retell_id: agentId,
        to_e164: toNum,
        metadata: call.metadata ?? {},
        dynamic_variables:
          call.dynamic_variables ?? call.retell_llm_dynamic_variables ?? {},
        dev_fallback:
          process.env.NODE_ENV !== "production"
            ? (process.env.TEST_BUSINESS_ID as string) // uuid string
            : null,
      }
    );

    if (bizErr || !bizId) {
      console.error("resolve_business_id failed", { bizErr, body });
      // Optionally: insert into a dead_letters table for review
      return NextResponse.json({ ok: true });
    }

    // 3) Normalize values to match your CHECK constraints
    const normalizedDirection = (() => {
      const d = (call.direction ?? "").toLowerCase().trim();
      if (d.startsWith("in")) return "inbound";
      if (d.startsWith("out")) return "outbound";
      return null;
    })();

    const normalizedStatus = (() => {
      // Map into: in_progress | completed | missed | failed
      if (!ended_at) return "in_progress";
      // If ended, decide completed/missed/failed by reason if you want
      const r = (call.disconnection_reason ?? "").toLowerCase();
      if (r.includes("no_answer") || r.includes("missed")) return "missed";
      if (r.includes("error") || r.includes("fail")) return "failed";
      return "completed";
    })();

    const dynamic_vars =
      call.dynamic_variables ?? call.retell_llm_dynamic_variables ?? {};

    const summary =
      call.call_analysis?.summary ?? call.summary ?? null;

    // 4) Upsert the call FIRST (prevents FK race with call_events)
    const { error: upsertErr } = await supabase.from("calls").upsert(
      {
        id: callId,
        business_id: bizId,
        agent_id: agentId,
        from_number: fromNum,
        to_number: toNum,
        direction: normalizedDirection,
        started_at,
        ended_at,
        duration_seconds,
        disconnection_reason: call.disconnection_reason ?? null,
        status: normalizedStatus,
        summary,
        transcript: call.transcript ?? null,
        dynamic_variables: dynamic_vars,
        // updated_at is handled by your trigger now
      },
      { onConflict: "id" }
    );

    if (upsertErr) {
      console.error("calls upsert error", upsertErr, { body });
      return NextResponse.json({ ok: true });
    }

    // 5) Insert an event record
    const { error: evtErr } = await supabase.from("call_events").insert({
      call_id: callId,
      business_id: bizId,
      type: event, // e.g., 'call_started' | 'call_ended' | etc
      data: body,
      // occurred_at default is now(); keep explicit if you prefer:
      occurred_at: new Date(),
    });

    if (evtErr) {
      console.warn("call_events insert warn", evtErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error", err);
    // Return 200 so Retell doesn’t spam retries; you have logs
    return NextResponse.json({ ok: true });
  }
}
