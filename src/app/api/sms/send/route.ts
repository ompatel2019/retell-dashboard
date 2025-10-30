import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import twilio from "twilio";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.phoneNumber) {
    return NextResponse.json(
      { error: "phoneNumber is required" },
      { status: 400 }
    );
  }

  const twilioSid = process.env.TWILIO_SID;
  const twilioToken = process.env.TWILIO_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioSid || !twilioToken || !twilioPhoneNumber) {
    return NextResponse.json(
      { error: "Twilio configuration missing" },
      { status: 500 }
    );
  }

  try {
    const client = twilio(twilioSid, twilioToken);
    const messageBody =
      "hi, i tried calling but no one answered. this could've been a $1,000 customer but thankfully it's not. however, i built something that takes missed calls for you so you don't actually miss $1,000 customers. reply with a 'yes' and we'll personally call you - for a free trial :)";

    const message = await client.messages.create({
      body: messageBody,
      from: twilioPhoneNumber,
      to: body.phoneNumber,
    });

    // Store in interactions table - upsert and append to outbound array
    const serviceSupabase = createServiceRoleClient();
    const timestamp = new Date().toISOString();
    const newOutboundEntry = { message: messageBody, timestamp };

    // Get existing row or create new one
    const { data: existing } = await serviceSupabase
      .from("interactions")
      .select("outbound, inbound")
      .eq("phone", body.phoneNumber)
      .maybeSingle();

    const existingOutbound =
      (existing?.outbound as Array<{ message: string; timestamp: string }>) ||
      [];
    const updatedOutbound = [...existingOutbound, newOutboundEntry];

    await serviceSupabase.from("interactions").upsert(
      {
        phone: body.phoneNumber,
        outbound: updatedOutbound,
        inbound: existing?.inbound || [],
      },
      { onConflict: "phone" }
    );

    return NextResponse.json({
      ok: true,
      messageSid: message.sid,
    });
  } catch (error) {
    console.error("Twilio error:", error);
    return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 });
  }
}
