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
  // Validate user object
  if (!user || !user.id) {
    console.error('Invalid user object:', user);
    throw new Error('Invalid user object');
  }
  
  const supabase = createClient();
  
  // Validate that the client is properly configured
  if (!supabase) {
    console.error('Supabase client is not properly initialized');
    throw new Error('Database client not available');
  }
  
  try {
    // Debug: Log user information
    console.log('Fetching business data for user:', {
      id: user.id,
      email: user.email,
      aud: user.aud
    });
    
    // Test database connection first
    console.log('Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('businesses')
      .select('count')
      .limit(1);
    
    console.log('Database connection test:', { testData, testError });
    
    // Test if we can access the memberships table
    console.log('Testing memberships table access...');
    const { data: membershipsTest, error: membershipsTestError } = await supabase
      .from('memberships')
      .select('count')
      .limit(1);
    
    console.log('Memberships table access test:', { membershipsTest, membershipsTestError });
    
    // Test if we can access the businesses table
    console.log('Testing businesses table access...');
    const { data: businessesTest, error: businessesTestError } = await supabase
      .from('businesses')
      .select('count')
      .limit(1);
    
    console.log('Businesses table access test:', { businessesTest, businessesTestError });
    
    // Check if user is authenticated in the current session
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
    console.log('Current authenticated user:', { currentUser, authError });
    
    // Check if the current user matches the passed user
    if (currentUser?.id !== user.id) {
      console.warn('User ID mismatch:', { passed: user.id, current: currentUser?.id });
    }
    
    // Test if we can access user-specific data
    console.log('Testing user-specific data access...');
    const { data: userTest, error: userTestError } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('user_id', currentUser?.id || user.id)
      .limit(1);
    
    console.log('User-specific data test:', { userTest, userTestError });
    
    // Test if RLS is working by trying to access data we shouldn't have access to
    console.log('Testing RLS policies...');
    const { data: rlsTest, error: rlsTestError } = await supabase
      .from('memberships')
      .select('user_id')
      .neq('user_id', currentUser?.id || user.id)
      .limit(1);
    
    console.log('RLS policy test (should be empty):', { rlsTest, rlsTestError });
    
    // Get the user's business membership
    console.log('Executing membership query...');
    console.log('Query details:', {
      table: 'memberships',
      user_id: user.id,
      select: '*, business:businesses(*)'
    });
    
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        *,
        business:businesses(*)
      `)
      .eq('user_id', user.id)
      .single();
    
    console.log('Membership query result:', { memberships, membershipError });

    if (membershipError) {
      console.error('Error fetching membership:', membershipError);
      if (membershipError.code === 'PGRST116') {
        // No rows returned - user has no business membership
        console.log('User has no business membership - this is expected for new users');
        console.log('User needs to run the setup script or have business data created');
        return null;
      }
      // Log more details about the error for debugging
      console.error('Membership error details:', {
        code: membershipError.code,
        message: membershipError.message,
        details: membershipError.details,
        hint: membershipError.hint
      });
      throw new Error(`Failed to fetch membership: ${membershipError.message}`);
    }

    if (!memberships) {
      console.log('No membership data found for user');
      console.log('💡 To fix this, run: node scripts/setup-test-data.mjs');
      return null;
    }

    const business = memberships.business as Business;
    if (!business) {
      console.error('Business data is missing from membership');
      console.log('💡 This suggests a data integrity issue. Run: node scripts/setup-test-data.mjs');
      return null;
    }

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
    // Log more details about the error for debugging
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      console.error('Error object details:', {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack,
        code: errorObj.code,
        details: errorObj.details
      });
    }
    if (error instanceof Error) {
      throw new Error(`Failed to fetch business data: ${error.message}`);
    }
    throw new Error('Failed to fetch business data: Unknown error');
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
