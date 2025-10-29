// src/lib/user/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Business {
  id: string;
  user_id: string;
  name: string;
  timezone: string;
  paused: boolean;
  paused_at: string | null;
  paused_reason: string | null;
  paused_until: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  business_id: string;
  retell_agent_id: string;
  display_name: string | null;
  created_at: string;
}

export interface PhoneNumber {
  id: string;
  business_id: string;
  e164: string;
  created_at: string;
}

export interface BusinessData {
  business: Business;
  agents: Agent[];
  phoneNumbers: PhoneNumber[];
}

/**
 * Returns the current user's Business + Agents + Phone Numbers.
 * - If the user has no business, returns null (caller can show onboarding).
 * - Rely on RLS to scope results to this user.
 */
export async function getCurrentUserBusiness(user: User): Promise<BusinessData | null> {
  if (!user?.id) throw new Error("Invalid user");

  const supabase = createClient();

  // 1) Fetch business for this user (1:1 relationship)
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,user_id,name,timezone,paused,paused_at,paused_reason,paused_until,created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (businessError) {
    throw new Error(`Failed to fetch business: ${businessError.message ?? "Unknown error"}`);
  }

  if (!business) {
    // No business for this user yet
    return null;
  }

  // 2) Fetch agents for this business
  const { data: agents = [], error: agentsError } = await supabase
    .from("agents")
    .select("id,business_id,retell_agent_id,display_name,created_at")
    .eq("business_id", business.id);

  if (agentsError) {
    throw new Error(`Failed to fetch agents: ${agentsError.message ?? "Unknown error"}`);
  }

  // 3) Fetch phone numbers for this business
  const { data: phoneNumbers = [], error: phoneError } = await supabase
    .from("phone_numbers")
    .select("id,business_id,e164,created_at")
    .eq("business_id", business.id);

  if (phoneError) {
    throw new Error(`Failed to fetch phone numbers: ${phoneError.message ?? "Unknown error"}`);
  }

  return { business, agents, phoneNumbers } as BusinessData;
}

/**
 * Returns the current user's business_id or null if none.
 */
export async function getCurrentUserBusinessId(user: User): Promise<string | null> {
  if (!user?.id) return null;
  const supabase = createClient();

  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}
