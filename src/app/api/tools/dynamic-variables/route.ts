import { NextResponse } from "next/server";
import { requireBearer } from "@/lib/server/security";

export async function POST(req: Request) {
  if (!requireBearer(req, process.env.TOOLS_BEARER_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.businessId) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Example: echo back some variables; plug into CRM as needed
  return NextResponse.json({
    variables: {
      customer_name: body.contact?.name ?? null,
      is_vip: false,
      open_balance: 0,
    },
  });
}


