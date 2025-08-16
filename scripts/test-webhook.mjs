/*
  Test script for the Retell webhook endpoint
  Run this to test if your webhook is working correctly
*/

import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://localhost:3000/api/retell/webhook";
const BUSINESS_ID = process.env.TEST_BUSINESS_ID;

if (!BUSINESS_ID) {
  console.error("❌ Please set TEST_BUSINESS_ID in your .env.local file");
  console.error("You can get this from your Supabase dashboard or run the setup-test-data script first");
  process.exit(1);
}

console.log(`🚀 Testing webhook at: ${WEBHOOK_URL}`);
console.log(`📊 Using business ID: ${BUSINESS_ID}`);
console.log("");

// Test call started event
async function testCallStarted() {
  console.log("📞 Testing call_started event...");
  
  const payload = {
    event: "call_started",
    call: {
      call_id: `test_call_${Date.now()}`,
      from_number: "+61411111111",
      to_number: "+61288888888",
      start_timestamp: Date.now(),
      metadata: { business_id: BUSINESS_ID }
    }
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok && result.ok) {
      console.log("✅ call_started: Success");
      return payload.call.call_id;
    } else {
      console.log("❌ call_started: Failed", result);
      return null;
    }
  } catch (error) {
    console.log("❌ call_started: Error", error.message);
    return null;
  }
}

// Test call analyzed event
async function testCallAnalyzed(callId) {
  if (!callId) return;
  
  console.log("🔍 Testing call_analyzed event...");
  
  const payload = {
    event: "call_analyzed",
    call: {
      call_id: callId,
      transcript: "Customer asked about Thursday availability for 2pm appointment.",
      call_analysis: {
        summary: "Requested booking for Thursday 2pm",
        intent: "booking",
        entities: { date: "Thursday", time: "2pm", action: "booking" }
      },
      metadata: { business_id: BUSINESS_ID }
    }
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok && result.ok) {
      console.log("✅ call_analyzed: Success");
    } else {
      console.log("❌ call_analyzed: Failed", result);
    }
  } catch (error) {
    console.log("❌ call_analyzed: Error", error.message);
  }
}

// Test call ended event
async function testCallEnded(callId) {
  if (!callId) return;
  
  console.log("📴 Testing call_ended event...");
  
  const payload = {
    event: "call_ended",
    call: {
      call_id: callId,
      end_timestamp: Date.now(),
      disconnection_reason: "completed",
      metadata: { business_id: BUSINESS_ID }
    }
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok && result.ok) {
      console.log("✅ call_ended: Success");
    } else {
      console.log("❌ call_ended: Failed", result);
    }
  } catch (error) {
    console.log("❌ call_ended: Error", error.message);
  }
}

// Run all tests
async function runTests() {
  console.log("🧪 Starting webhook tests...\n");
  
  const callId = await testCallStarted();
  await testCallAnalyzed(callId);
  await testCallEnded(callId);
  
  console.log("\n🎉 Test complete! Check your Supabase dashboard to see the call data.");
  console.log("You can also visit http://localhost:3000/dashboard/calls to see it in your UI.");
}

runTests();
