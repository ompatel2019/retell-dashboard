// src/lib/supabase/auth-client.ts
import { createBrowserClient } from "@supabase/ssr";

export async function getClientUser() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
