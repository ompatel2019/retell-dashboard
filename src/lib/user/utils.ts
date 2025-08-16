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
  name: string;
  timezone: string;
  created_at: string;
  paused: boolean;
  paused_at: string | null;
  paused_reason: string | null;
  paused_until: string | null;
}
    
export interface Membership {
  user_id: string;
  business_id: string;
  role: string;
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
  membership: Membership;
  agents: Agent[];
  phoneNumbers: PhoneNumber[];
}

/**
 * Returns the current user's Business + Membership + Agents + Phone Numbers.
 * - If the user has no membership, returns null (caller can show onboarding).
 * - Rely on RLS to scope results to this user.
 */
export async function getCurrentUserBusiness(user: User): Promise<BusinessData | null> {
  if (!user?.id) throw new Error("Invalid user");

  const supabase = createClient();

  // 1) Fetch membership with joined business (zero or one)
  const { data: membershipRow, error: membershipError } = await supabase
    .from("memberships")
    .select(
      `
      user_id,
      business_id,
      role,
      created_at,
      business:businesses(
        id,
        name,
        timezone,
        created_at,
        paused,
        paused_at,
        paused_reason,
        paused_until
      )
    `
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    // Surface a concise, actionable error
    throw new Error(`Failed to fetch membership: ${membershipError.message ?? "Unknown error"}`);
  }

  if (!membershipRow || !membershipRow.business) {
    // No membership for this user yet
    return null;
  }

  const business = membershipRow.business as unknown as Business;
  const membership: Membership = {
    user_id: membershipRow.user_id,
    business_id: membershipRow.business_id,
    role: membershipRow.role,
    created_at: membershipRow.created_at,
  };

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

  return { business, membership, agents, phoneNumbers } as BusinessData;
}

/**
 * Returns the current user's business_id or null if none.
 */
export async function getCurrentUserBusinessId(user: User): Promise<string | null> {
  if (!user?.id) return null;
  const supabase = createClient();

  const { data, error } = await supabase
    .from("memberships")
    .select("business_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return null;
  return data?.business_id ?? null;
}
