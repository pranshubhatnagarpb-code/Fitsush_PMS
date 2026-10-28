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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Last 10 digits, so "7200223456", "+917200223456" and "917200223456" compare equal.
const phoneKey = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);

// Every auth user (listUsers is paged).
async function listAllUsers(admin: any) {
  const users: any[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data?.users ?? []));
    if ((data?.users?.length ?? 0) < 1000) return users;
  }
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
        return json({
          error: `Failed to update this client's login to ${[email, phone].filter(Boolean).join(" / ")}: ${updErr.message}. ` +
            `Another portal login probably already uses that email or phone.`,
        }, 400);
      }
      // Re-activate link
      await admin
        .from("client_portal_users")
        .update({ is_active: true })
        .eq("id", existingLink!.id);
    } else {
      // Reuse an existing auth user with this email or phone, unless it's
      // already the login of a different client: one login can only belong
      // to one client (client_portal_users.user_id is unique), and reusing it
      // would also reset that other client's password.
      const users = await listAllUsers(admin);
      const match = users.find(
        (u) => (email && u.email?.toLowerCase() === email) || (phone && phoneKey(u.phone) === phoneKey(phone)),
      );
      let foundUserId: string | null = match?.id ?? null;

      if (match) {
        const { data: otherLink } = await admin
          .from("client_portal_users")
          .select("client_id, clients(name)")
          .eq("user_id", match.id)
          .maybeSingle();
        if (otherLink && otherLink.client_id !== client_id) {
          const otherName = (otherLink as any).clients?.name ?? "another client";
          const clash = email && match.email?.toLowerCase() === email ? `Email ${email}` : `Phone ${phone}`;
          return json({
            error:
              `${clash} is already the portal login of ${otherName}. ` +
              `If that's not ${otherName}'s own email/phone, fix it on ${otherName}'s profile and enable portal access ` +
              `for ${otherName} again (that moves their login to the new details), then try again here. ` +
              `Otherwise give this client a different email or phone.`,
          }, 409);
        }
      }

      if (foundUserId) {
        const updates: any = { password };
        if (email) updates.email = email;
        if (phone) updates.phone = phone;
        const { error: updErr } = await admin.auth.admin.updateUserById(foundUserId, updates);
        if (updErr) return json({ error: `Failed to update auth user: ${updErr.message}` }, 400);
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
          return json({ error: `Failed to create auth user: ${createErr?.message ?? "unknown"}` }, 400);
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
