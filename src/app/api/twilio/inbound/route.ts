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

    // Find the most recent call involving this phone number
    const { data: call } = await supabase
      .from("calls")
      .select("id,business_id,from_number,to_number,started_at")
      .or(`from_number.eq.${from},to_number.eq.${from}`)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log("[inbound] resolved call", call ?? null);

    if (!call) {
      // No call to associate with; reply 200 OK with empty TwiML to satisfy Twilio
      console.warn("[inbound] no matching call found for from:", from);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 200, headers: { "Content-Type": "text/xml" } }
      );
    }

    // Try to read latest call_events for this call to append inbound array
    const { data: latestEvent } = await supabase
      .from("call_events")
      .select("id,inbound")
      .eq("call_id", call.id)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log("[inbound] latest call_event", latestEvent ?? null);

    const entry = {
      from,
      to,
      body,
      at: new Date().toISOString(),
      provider,
    };

    if (latestEvent) {
      // Append to existing inbound array in JS and update
      const inbound = Array.isArray(latestEvent.inbound)
        ? [...latestEvent.inbound, entry]
        : [entry];
      console.log("[inbound] updating existing call_event with inbound count", inbound.length);
      const { error: updateErr } = await supabase
        .from("call_events")
        .update({ inbound })
        .eq("id", latestEvent.id);
      if (updateErr) {
        console.error("[inbound] error updating call_event", updateErr);
      } else {
        console.log("[inbound] call_event updated", latestEvent.id);
      }
    } else {
      // Create a fresh call_event row with inbound initialized
      console.log("[inbound] creating new call_event with first inbound entry");
      const { error: insertErr } = await supabase.from("call_events").insert({
        call_id: call.id,
        business_id: call.business_id,
        type: "inbound_sms_log",
        data: { note: "created by /api/twilio/inbound" },
        inbound: [entry],
      });
      if (insertErr) {
        console.error("[inbound] error inserting call_event", insertErr);
      } else {
        console.log("[inbound] new call_event inserted for call", call.id);
      }
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
