// src/lib/supabase/auth-server.ts
import { createClient } from "./server";

export async function getServerUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
