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
      "hi, i tried calling but no one answered. this could've been a $1,000 customer but thankfully it's not. however, i build something that captures missed calls so you don't ACTUALLY miss $1,000 customers. reply with a YES and we'll personally call you - for a free trial 😊";

    const message = await client.messages.create({
      body: messageBody,
      from: twilioPhoneNumber,
      to: body.phoneNumber,
    });

    // Store in interactions table
    const serviceSupabase = createServiceRoleClient();
    await serviceSupabase.from("interactions").insert({
      phone: body.phoneNumber,
      outbound: messageBody,
      inbound: null,
    });

    return NextResponse.json({
      ok: true,
      messageSid: message.sid,
    });
  } catch (error) {
    console.error("Twilio error:", error);
    return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 });
  }
}
