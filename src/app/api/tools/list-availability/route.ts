import { NextResponse } from "next/server";
import { requireBearer } from "@/lib/server/security";

export async function POST(req: Request) {
  if (!requireBearer(req, process.env.TOOLS_BEARER_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.businessId || !body?.window?.start || !body?.window?.end) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Stub: generate a few 90-min slots between start/end
  const start = new Date(body.window.start);
  const end = new Date(body.window.end);
  const slots: Array<{ start: string; end: string }> = [];
  const cursor = new Date(start);
  while (cursor < end && slots.length < 6) {
    const s = new Date(cursor);
    const e = new Date(cursor.getTime() + 90 * 60 * 1000);
    slots.push({ start: s.toISOString(), end: e.toISOString() });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(1, 0, 0, 0);
  }

  return NextResponse.json({ slots });
}


