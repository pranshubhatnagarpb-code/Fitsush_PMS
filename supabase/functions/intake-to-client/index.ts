import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-submission-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Identity {
  full_name: string;
  dob?: string | null;
  age?: number | null;
  city: string;
  // adult branches
  phone?: string | null;
  email?: string | null;
  // child branch
  guardian_name?: string;
  guardian_relationship?: string;
  guardian_phone?: string;
  guardian_email?: string | null;
}

interface RequestBody {
  submission_id: string;
  branch: "female" | "male" | "child";
  identity: Identity;
  payload: {
    required?: { chiefComplaints?: string[] };
    [key: string]: unknown;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const INTAKE_SECRET = Deno.env.get("INTAKE_SECRET");

    // 1. Validate bearer token
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!INTAKE_SECRET || token !== INTAKE_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as RequestBody;
    const { submission_id, branch, identity, payload } = body;

    if (!submission_id || !identity?.full_name) {
      return json({ error: "submission_id and identity.full_name are required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2. Idempotency: if this submission was already processed, return the stored lead id
    const { data: existingSub } = await admin
      .from("intake_submissions")
      .select("pms_lead_id")
      .eq("id", submission_id)
      .maybeSingle();

    if (existingSub?.pms_lead_id) {
      return json({ pms_lead_id: existingSub.pms_lead_id, action: "duplicate_merged" });
    }

    // 3. Resolve contact details — child submissions use guardian contact
    const phone =
      branch === "child"
        ? (identity.guardian_phone ?? null)
        : (identity.phone ?? null);
    const email =
      branch === "child"
        ? (identity.guardian_email ?? null)
        : (identity.email ?? null);

    const normalizedPhone = phone?.replace(/\s+/g, "") ?? null;
    const normalizedEmail = email?.trim().toLowerCase() ?? null;

    // 4. Deduplicate: find existing client by phone or email
    let existingClientId: string | null = null;

    if (normalizedPhone || normalizedEmail) {
      let clientQuery = admin.from("clients").select("id");
      if (normalizedPhone && normalizedEmail) {
        clientQuery = clientQuery.or(
          `phone.eq.${normalizedPhone},email.eq.${normalizedEmail}`
        );
      } else if (normalizedPhone) {
        clientQuery = clientQuery.eq("phone", normalizedPhone);
      } else {
        clientQuery = clientQuery.eq("email", normalizedEmail!);
      }
      const { data: match } = await clientQuery.limit(1).maybeSingle();
      if (match) existingClientId = match.id;
    }

    let pmsLeadId: string;
    let action: "created" | "updated" | "duplicate_merged";

    if (existingClientId) {
      // Update existing client with latest details
      const updates: Record<string, unknown> = { name: identity.full_name };
      if (normalizedEmail) updates.email = normalizedEmail;
      if (normalizedPhone) updates.phone = normalizedPhone;
      if (identity.dob) updates.date_of_birth = identity.dob;

      const { error: upErr } = await admin
        .from("clients")
        .update(updates)
        .eq("id", existingClientId);

      if (upErr) return json({ error: `Failed to update client: ${upErr.message}` }, 500);

      pmsLeadId = existingClientId;
      action = "updated";
    } else {
      // Create new client
      const clientCode = `CL-${Date.now().toString(36).toUpperCase()}`;
      const newClient: Record<string, unknown> = {
        name: identity.full_name,
        client_code: clientCode,
        date_of_birth: identity.dob ?? null,
        portal_access_enabled: false,
      };
      if (normalizedEmail) newClient.email = normalizedEmail;
      if (normalizedPhone) newClient.phone = normalizedPhone;

      // Store chief complaints as initial health conditions
      const complaints = payload?.required?.chiefComplaints;
      if (Array.isArray(complaints) && complaints.length > 0) {
        newClient.health_conditions = complaints;
      }

      const { data: created, error: createErr } = await admin
        .from("clients")
        .insert(newClient)
        .select("id")
        .single();

      if (createErr || !created) {
        return json(
          { error: `Failed to create client: ${createErr?.message ?? "unknown"}` },
          500
        );
      }

      pmsLeadId = created.id;
      action = "created";
    }

    return json({ pms_lead_id: pmsLeadId, action });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("intake-to-client error", msg);
    return json({ error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
