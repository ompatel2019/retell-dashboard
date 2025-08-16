/*
  Usage:
    SUPABASE_URL=... \
    SUPABASE_SERVICE_ROLE_KEY=... \
    SEED_EMAIL=owner@example.com \
    SEED_PASSWORD=ChooseAStrongPassword1! \
    SEED_BUSINESS_NAME="Acme Plumbing" \
    SEED_RETELL_AGENT_ID=retell-agent-1234 \
    SEED_PHONE_E164=+61412345678 \
    node scripts/seed.mjs

  Notes:
    - Requires the SQL in supabase/01_schema.sql and 02_policies.sql to be applied first.
    - If SEED_EMAIL does not exist and SEED_PASSWORD is provided, the user will be created.
*/

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD; // optional if user exists
const businessName = process.env.SEED_BUSINESS_NAME || "Example Business";
const retellAgentId = process.env.SEED_RETELL_AGENT_ID || null;
const phoneE164 = process.env.SEED_PHONE_E164 || null;

if (!email) {
  console.error("SEED_EMAIL is required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function assertOk(result, label) {
  if (result.error) {
    console.error(`${label} failed:`, result.error);
    process.exit(1);
  }
  return result.data;
}

async function ensureUser(emailArg, passwordArg) {
  const userRes = await supabase.auth.admin.getUserByEmail(emailArg);
  if (userRes.data?.user) return userRes.data.user;
  if (!passwordArg) {
    console.error(
      `User ${emailArg} not found and SEED_PASSWORD not provided to create it.`
    );
    process.exit(1);
  }
  const createRes = await supabase.auth.admin.createUser({
    email: emailArg,
    password: passwordArg,
    email_confirm: true,
  });
  return assertOk(createRes, "Create user").user;
}

async function run() {
  const user = await ensureUser(email, password);

  // Create business
  const businessInsert = await supabase
    .from("businesses")
    .insert({ name: businessName })
    .select("id")
    .single();

  const business = assertOk(businessInsert, "Insert business");

  // Create membership
  const membershipUpsert = await supabase
    .from("memberships")
    .upsert({ user_id: user.id, business_id: business.id, role: "owner" }, {
      onConflict: "user_id,business_id",
      ignoreDuplicates: true,
    });
  assertOk(membershipUpsert, "Upsert membership");

  // Optional agent
  if (retellAgentId) {
    const agentUpsert = await supabase
      .from("agents")
      .upsert(
        {
          business_id: business.id,
          retell_agent_id: retellAgentId,
          display_name: "Receptionist AI",
        },
        { onConflict: "retell_agent_id", ignoreDuplicates: true }
      );
    assertOk(agentUpsert, "Upsert agent");
  }

  // Optional phone number
  if (phoneE164) {
    const phoneUpsert = await supabase
      .from("phone_numbers")
      .upsert(
        { business_id: business.id, e164: phoneE164 },
        { onConflict: "e164", ignoreDuplicates: true }
      );
    assertOk(phoneUpsert, "Upsert phone number");
  }

  console.log("Seed complete:");
  console.log({
    user_id: user.id,
    email: user.email,
    business_id: business.id,
    business_name: businessName,
    retell_agent_id: retellAgentId,
    phone_e164: phoneE164,
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});


