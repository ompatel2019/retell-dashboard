import { NextResponse } from "next/server";
import { requireBearer } from "@/lib/server/security";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export async function POST(req: Request) {
  if (!requireBearer(req, process.env.TOOLS_BEARER_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.businessId || !body?.contactId || !body?.start || !body?.end) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const client = createServiceRoleClient();
  const { data, error } = await client
    .from("bookings")
    .insert({
      business_id: body.businessId,
      contact_id: body.contactId,
      start_at: body.start,
      end_at: body.end,
      location: body.location ?? null,
      source: "retell_tool",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await client.from("call_events").insert({
    call_id: body.callId ?? null,
    business_id: body.businessId,
    type: "booking_created",
    data: { booking_id: data.id, contact_id: body.contactId },
  });

  return NextResponse.json({ ok: true, bookingId: data.id });
}


