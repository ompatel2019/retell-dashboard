/*
  Simple script to set up test business data for development
  Run this after setting up your Supabase environment variables
*/

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars");
  console.error("Make sure you have a .env.local file with these variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupTestData() {
  try {
    console.log("Setting up test business data...");
    
    // First, let's check if the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("❌ User not authenticated. Please sign in first.");
      console.error("Go to /login and sign in, then run this script again.");
      return;
    }
    
    console.log(`✅ User authenticated: ${user.email}`);
    
    // Check if user already has business data
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (existingMembership) {
      console.log("✅ User already has business data");
      return;
    }
    
    // Create a test business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({ 
        name: 'Test Business',
        timezone: 'Australia/Sydney'
      })
      .select('id, name')
      .single();
    
    if (businessError) {
      console.error("❌ Failed to create business:", businessError);
      return;
    }
    
    console.log(`✅ Created business: ${business.name} (${business.id})`);
    
    // Create membership
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({
        user_id: user.id,
        business_id: business.id,
        role: 'owner'
      });
    
    if (membershipError) {
      console.error("❌ Failed to create membership:", membershipError);
      return;
    }
    
    console.log("✅ Created membership");
    
    // Create a test agent
    const { error: agentError } = await supabase
      .from('agents')
      .insert({
        business_id: business.id,
        retell_agent_id: 'test-agent-123',
        display_name: 'Test AI Agent'
      });
    
    if (agentError) {
      console.error("❌ Failed to create agent:", agentError);
    } else {
      console.log("✅ Created test agent");
    }
    
    // Create a test phone number
    const { error: phoneError } = await supabase
      .from('phone_numbers')
      .insert({
        business_id: business.id,
        e164: '+61412345678'
      });
    
    if (phoneError) {
      console.error("❌ Failed to create phone number:", phoneError);
    } else {
      console.log("✅ Created test phone number");
    }
    
    console.log("\n🎉 Test data setup complete!");
    console.log("You can now refresh your dashboard and see the business data.");
    
  } catch (error) {
    console.error("❌ Setup failed:", error);
  }
}

setupTestData();
