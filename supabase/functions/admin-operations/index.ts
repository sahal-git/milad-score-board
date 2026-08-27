import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Create a Supabase client with the Auth context of the logged in user to check their role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Verify user is super_admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');
    
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (profile?.role !== 'super_admin') {
      throw new Error('Forbidden: Super Admin only');
    }

    // Now use service role for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, payload } = body;

    if (action === 'create_institution') {
      const { name, code, public_slug, admin_username, admin_password } = payload;
      
      // 1. Create Institution
      const { data: inst, error: instError } = await adminClient
        .from('institutions')
        .insert([{ name, code, public_slug, status: 'active' }])
        .select()
        .single();
      if (instError) throw instError;

      // 2. Create Auth User
      const email = `${admin_username}@milaadfest.local`;
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: email,
        password: admin_password,
        email_confirm: true,
      });
      if (authError) {
        // rollback inst
        await adminClient.from('institutions').delete().eq('id', inst.id);
        throw authError;
      }

      // 3. Create Profile
      const { error: profileError } = await adminClient
        .from('profiles')
        .insert([{
          id: authUser.user.id,
          institution_id: inst.id,
          username: admin_username,
          role: 'institution_admin'
        }]);
      if (profileError) {
        await adminClient.auth.admin.deleteUser(authUser.user.id);
        await adminClient.from('institutions').delete().eq('id', inst.id);
        throw profileError;
      }

      // 4. Default Score Settings
      await adminClient.from('score_settings').insert([{ institution_id: inst.id }]);

      return new Response(JSON.stringify({ success: true, institution: inst }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'suspend_institution') {
      const { id } = payload;
      const { error } = await adminClient
        .from('institutions')
        .update({ status: 'suspended' })
        .eq('id', id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'activate_institution') {
      const { id } = payload;
      const { error } = await adminClient
        .from('institutions')
        .update({ status: 'active' })
        .eq('id', id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete_institution') {
      const { id } = payload;
      // Get associated admins and delete them first
      const { data: admins } = await adminClient.from('profiles').select('id').eq('institution_id', id);
      if (admins) {
        for (const a of admins) {
          await adminClient.auth.admin.deleteUser(a.id);
        }
      }
      const { error } = await adminClient.from('institutions').delete().eq('id', id);
      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset_password') {
       const { institution_id, new_password } = payload;
       const { data: profile } = await adminClient.from('profiles').select('id').eq('institution_id', institution_id).single();
       if (!profile) throw new Error('Admin not found for this institution');
       
       const { error } = await adminClient.auth.admin.updateUserById(profile.id, {
         password: new_password
       });
       if (error) throw error;
       
       return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
