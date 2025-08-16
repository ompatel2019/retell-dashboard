// src/lib/user/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface Business {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
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
  display_name: string;
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

export async function getCurrentUserBusiness(user: User): Promise<BusinessData | null> {
  const supabase = createClient();
  
  try {
    // Get the user's business membership
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        *,
        business:businesses(*)
      `)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !memberships) {
      console.error('Error fetching membership:', membershipError);
      return null;
    }

    const business = memberships.business as Business;
    const membership = {
      user_id: memberships.user_id,
      business_id: memberships.business_id,
      role: memberships.role,
      created_at: memberships.created_at
    } as Membership;

    // Get agents for this business
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .eq('business_id', business.id);

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
    }

    // Get phone numbers for this business
    const { data: phoneNumbers, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('business_id', business.id);

    if (phoneError) {
      console.error('Error fetching phone numbers:', phoneError);
    }

    return {
      business,
      membership,
      agents: agents || [],
      phoneNumbers: phoneNumbers || []
    };
  } catch (error) {
    console.error('Error fetching business data:', error);
    return null;
  }
}

export async function getCurrentUserBusinessId(user: User): Promise<string | null> {
  const supabase = createClient();
  
  try {
    const { data, error } = await supabase
      .from('memberships')
      .select('business_id')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return null;
    }

    return data.business_id;
  } catch (error) {
    console.error('Error fetching business ID:', error);
    return null;
  }
}
