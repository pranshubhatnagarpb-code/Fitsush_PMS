// Weekly Progress Reminder Edge Function
//
// IMPORTANT — MANUAL SETUP REQUIRED (see CLAUDE.md for the full checklist):
//   - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT — web-push signing
//     keys. Generate once with `npx web-push generate-vapid-keys`.
//   - CRON_SECRET — a random shared secret. This function is called by
//     pg_cron (see _db/push-subscriptions-and-reminder-cron.sql), which has
//     no Supabase user session to attach as a JWT, so it authenticates with
//     a bearer secret instead — same pattern as intake-to-client's
//     INTAKE_SECRET. Deploy this function with `--no-verify-jwt` so
//     Supabase's gateway doesn't reject the cron call for lacking a real JWT.
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — already set as project
//     secrets (used by other functions); this one reads/deletes
//     push_subscriptions rows directly via the REST API using the service
//     role key, bypassing RLS (there's no user session to scope to — this
//     runs for every subscribed client in one pass).
//
// Not called by any user-facing button — this only runs on the weekly cron
// schedule. It fans out one Web Push notification per stored subscription,
// asking the client to log their measurements in the PWA's Progress tab,
// and prunes subscriptions that the push service reports as gone (404/410 —
// e.g. the client uninstalled the PWA or cleared site data).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  client_id: string;
  clients: { is_active: boolean | null } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:clinic@fitsush.com";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "Missing required secrets (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  try {
    const restHeaders = {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    };

    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth,client_id,clients(is_active)`,
      { headers: restHeaders },
    );
    if (!listRes.ok) {
      throw new Error(`Failed to list push_subscriptions: ${listRes.status}`);
    }
    const subs = (await listRes.json()) as PushSubscriptionRow[];

    const payload = JSON.stringify({
      title: "Weekly check-in 📊",
      body: "Don't forget to log this week's measurements in your Progress tab.",
      url: "/progress",
    });

    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];

    await Promise.all(
      subs.map(async (row) => {
        // Skip paused/inactive clients — no point reminding someone whose
        // service has ended.
        if (row.clients && row.clients.is_active === false) return;

        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            payload,
          );
          sent++;
        } catch (err) {
          failed++;
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(row.id);
          } else {
            console.error("Push send failed for subscription", row.id, err);
          }
        }
      }),
    );

    if (staleIds.length > 0) {
      const idList = staleIds.map((id) => `"${id}"`).join(",");
      await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${idList})`, {
        method: "DELETE",
        headers: restHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        totalSubscriptions: subs.length,
        sent,
        failed,
        removedStale: staleIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-progress-reminders error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
