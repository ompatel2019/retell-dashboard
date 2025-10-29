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
    console.log("[inbound] parsed fields", { from, to, body });

    if (!from) {
      console.warn("[inbound] missing 'From' field");
      return NextResponse.json({ error: "missing From" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Store inbound SMS in interactions table - upsert and append to inbound array
    console.log("[inbound] storing inbound SMS in interactions table");
    const timestamp = new Date().toISOString();
    const newInboundEntry = { message: body, timestamp };
    
    // Get existing row or create new one
    const { data: existing } = await supabase
      .from("interactions")
      .select("outbound, inbound")
      .eq("phone", from)
      .maybeSingle();
    
    const existingInbound = (existing?.inbound as Array<{message: string, timestamp: string}>) || [];
    const updatedInbound = [...existingInbound, newInboundEntry];
    
    const { error: upsertErr } = await supabase.from("interactions").upsert(
      {
        phone: from,
        outbound: existing?.outbound || [],
        inbound: updatedInbound,
        recent_reply: body, // Store last message as recent_reply
      },
      { onConflict: "phone" }
    );

    if (upsertErr) {
      console.error("[inbound] error upserting into interactions", upsertErr);
    } else {
      console.log("[inbound] stored inbound SMS in interactions for phone:", from);
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
