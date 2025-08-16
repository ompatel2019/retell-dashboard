import { NextResponse } from "next/server";
import { requireBearer } from "@/lib/server/security";

export async function POST(req: Request) {
  if (!requireBearer(req, process.env.TOOLS_BEARER_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.businessId || !body?.contact?.phone) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Stub: pretend we sent SMS/email
  const message = body.channel === "email" ? "Email sent" : "SMS sent";

  return NextResponse.json({ ok: true, message });
}


