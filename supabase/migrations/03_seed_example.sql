-- Example seed: creates a business and links an existing user by email
-- Replace values and run with the service role or via SQL editor.

do $$
declare
  v_user_id uuid;
  v_business_id uuid := gen_random_uuid();
  v_email text := 'owner@example.com'; -- TODO: change
  v_business_name text := 'Acme Plumbing'; -- TODO: change
  v_agent_id text := 'retell-agent-1234'; -- TODO: change
  v_phone text := '+61412345678'; -- TODO: change
begin
  -- Try to find existing user
  select id into v_user_id from auth.users where email = v_email;
  
  -- If user doesn't exist, create one (this requires service role privileges)
  if v_user_id is null then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      (select id from auth.instances limit 1),
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      v_email,
      crypt('password123', gen_salt('bf')), -- Default password, change this
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    ) returning id into v_user_id;
  end if;

  insert into public.businesses (id, name) values (v_business_id, v_business_name);

  insert into public.memberships (user_id, business_id, role)
  values (v_user_id, v_business_id, 'owner')
  on conflict (user_id, business_id) do nothing;

  insert into public.agents (business_id, retell_agent_id, display_name)
  values (v_business_id, v_agent_id, 'Receptionist AI')
  on conflict (retell_agent_id) do nothing;

  insert into public.phone_numbers (business_id, e164)
  values (v_business_id, v_phone)
  on conflict (e164) do nothing;
end $$;


