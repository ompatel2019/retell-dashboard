import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Example API returning tenant-scoped analytics via RLS
export async function GET() {
  const supabase = await createClient();

  // Example: if you have a materialized function for KPIs, call it here.
  // Fallback example selects counts from calls table if it exists.
  // Replace with your own selects or RPC.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // This will be scoped by RLS (business_id in current_business_ids())
  const { data, error } = await supabase
    .from("calls")
    .select("id, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recentCalls: data });
}


