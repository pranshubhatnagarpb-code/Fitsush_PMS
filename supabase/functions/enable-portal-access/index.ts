import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  client_id: string;
  password: string;
  email?: string | null;
  phone?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is an authenticated staff user (not a portal client)
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    const { client_id, password } = body;
    let { email, phone } = body;

    if (!client_id || !password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "client_id and a password (min 6 chars) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Load client
    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select("id, email, phone, name")
      .eq("id", client_id)
      .single();
    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    email = (email ?? client.email ?? "").trim().toLowerCase() || null;
    phone = (phone ?? client.phone ?? "").trim() || null;

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: "Client has neither email nor phone. Add one first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check existing portal link
    const { data: existingLink } = await admin
      .from("client_portal_users")
      .select("id, user_id")
      .eq("client_id", client_id)
      .maybeSingle();

    let authUserId: string | null = existingLink?.user_id ?? null;

    if (authUserId) {
      // Update existing user's password (and sync email/phone)
      const updates: any = { password };
      if (email) updates.email = email;
      if (phone) updates.phone = phone;
      const { error: updErr } = await admin.auth.admin.updateUserById(authUserId, updates);
      if (updErr) {
        return new Response(JSON.stringify({ error: `Failed to update auth user: ${updErr.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Re-activate link
      await admin
        .from("client_portal_users")
        .update({ is_active: true })
        .eq("id", existingLink!.id);
    } else {
      // Try to find any existing auth user with same email
      let foundUserId: string | null = null;
      if (email) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const match = list?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );
        if (match) foundUserId = match.id;
      }

      if (foundUserId) {
        const updates: any = { password };
        if (phone) updates.phone = phone;
        await admin.auth.admin.updateUserById(foundUserId, updates);
        authUserId = foundUserId;
      } else {
        // Create a new auth user
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: email ?? undefined,
          phone: phone ?? undefined,
          password,
          email_confirm: true,
          phone_confirm: !!phone,
          user_metadata: { client_id, name: client.name, role: "portal_client" },
        });
        if (createErr || !created.user) {
          return new Response(
            JSON.stringify({ error: `Failed to create auth user: ${createErr?.message ?? "unknown"}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        authUserId = created.user.id;
      }

      // Insert portal link row
      const { error: linkErr } = await admin
        .from("client_portal_users")
        .insert({ client_id, user_id: authUserId, is_active: true });
      if (linkErr) {
        return new Response(JSON.stringify({ error: `Failed to link portal user: ${linkErr.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Flip portal_access_enabled flag on client
    await admin
      .from("clients")
      .update({ portal_access_enabled: true })
      .eq("id", client_id);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authUserId,
        login: { email, phone },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("enable-portal-access error", e);
    return new Response(JSON.stringify({ error: e.message ?? "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
