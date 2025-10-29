import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

function normalizePhoneNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  // Twilio sends E.164. Keep as-is; fallback: strip spaces and dashes.
  return input.replace(/\s|-/g, "");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const from = normalizePhoneNumber(formData.get("From")?.toString());
    const to = normalizePhoneNumber(formData.get("To")?.toString());
    const body = formData.get("Body")?.toString() ?? null;
    const provider = Object.fromEntries(formData.entries());

    if (!from) {
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

    if (!call) {
      // No call to associate with; reply 200 OK with empty TwiML to satisfy Twilio
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
      await supabase
        .from("call_events")
        .update({ inbound })
        .eq("id", latestEvent.id);
    } else {
      // Create a fresh call_event row with inbound initialized
      await supabase.from("call_events").insert({
        call_id: call.id,
        business_id: call.business_id,
        type: "inbound_sms_log",
        data: { note: "created by /api/twilio/inbound" },
        inbound: [entry],
      });
    }

    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  } catch (err) {
    console.error("Unexpected error in inbound webhook:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}


