import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

function normalizePhoneNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  // Twilio sends E.164. Keep as-is; fallback: strip spaces and dashes.
  return input.replace(/\s|-/g, "");
}

export async function POST(req: Request) {
  try {
    console.log("[inbound] request received", {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
    });
    const formData = await req.formData();
    console.log("[inbound] raw formData entries", Array.from(formData.entries()));
    const from = normalizePhoneNumber(formData.get("From")?.toString());
    const to = normalizePhoneNumber(formData.get("To")?.toString());
    const body = formData.get("Body")?.toString() ?? null;
    const provider = Object.fromEntries(formData.entries());
    console.log("[inbound] parsed fields", { from, to, body });

    if (!from) {
      console.warn("[inbound] missing 'From' field");
      return NextResponse.json({ error: "missing From" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Find call by phone number in simplified calls table
    const { data: call } = await supabase
      .from("calls")
      .select("id,phone,inbound")
      .eq("phone", from)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log("[inbound] resolved call by phone", call ?? null);

    if (!call) {
      // No call found for this phone number; still store in call_events for auditing
      console.warn("[inbound] no matching call found for phone:", from);
      
      // Still store the inbound SMS in call_events for reference
      const entry = {
        from,
        to,
        body,
        at: new Date().toISOString(),
        provider,
      };

      const { error: insertErr } = await supabase.from("call_events").insert({
        call_id: null,
        type: "inbound_sms_no_call_match",
        data: { note: "SMS received but no matching call found", phone: from },
        inbound: [entry],
      });
      
      if (insertErr) {
        console.error("[inbound] error inserting orphaned inbound SMS", insertErr);
      } else {
        console.log("[inbound] stored orphaned inbound SMS in call_events");
      }

      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 200, headers: { "Content-Type": "text/xml" } }
      );
    }

    // Append to inbound array in calls table
    const entry = {
      from,
      to,
      body,
      at: new Date().toISOString(),
      provider,
    };

    const inbound = Array.isArray(call.inbound)
      ? [...call.inbound, entry]
      : [entry];

    console.log("[inbound] updating calls table with inbound count", inbound.length);
    const { error: updateErr } = await supabase
      .from("calls")
      .update({ inbound })
      .eq("id", call.id);

    if (updateErr) {
      console.error("[inbound] error updating calls table", updateErr);
    } else {
      console.log("[inbound] calls table updated with new inbound SMS", call.id);
    }

    // Also store in call_events for full audit trail
    const { error: evtErr } = await supabase.from("call_events").insert({
      call_id: null,
      type: "inbound_sms",
      data: { note: "inbound SMS appended to calls table", phone: from },
      inbound: [entry],
    });
    
    if (evtErr) {
      console.error("[inbound] error inserting call_event (non-fatal)", evtErr);
    } else {
      console.log("[inbound] also stored in call_events for audit");
    }

    console.log("[inbound] responding with empty TwiML");
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  } catch (err) {
    console.error("[inbound] unexpected error in inbound webhook:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
