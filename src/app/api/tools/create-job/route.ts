import { NextResponse } from "next/server";
import { requireBearer } from "@/lib/server/security";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

export async function POST(req: Request) {
  if (!requireBearer(req, process.env.TOOLS_BEARER_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.businessId || !body?.contact?.phone || !body?.service) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const client = createServiceRoleClient();

  // Upsert contact by phone within business
  const { data: contact, error: cErr } = await client
    .from("contacts")
    .upsert(
      {
        business_id: body.businessId,
        phone: body.contact.phone,
        name: body.contact.name ?? null,
        email: body.contact.email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,phone" }
    )
    .select("id")
    .single();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  // Log event if associated with a live call
  if (body.callId) {
    await client.from("call_events").insert({
      call_id: body.callId,
      business_id: body.businessId,
      type: "job_created",
      data: { service: body.service, notes: body.notes ?? null, contact_id: contact.id },
    });
  }

  return NextResponse.json({ ok: true, contactId: contact.id });
}


