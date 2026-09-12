// Progress Summary Insights Edge Function
//
// IMPORTANT — MANUAL SETUP REQUIRED:
// Uses the same OPENAI_API_KEY secret as the other AI edge functions in this
// project (extract-blood-report / generate-diet-plan / generate-recipe /
// import-diet-template).
//
// Accepts a plain JSON body — NOT a file upload — containing already-computed
// body-measurement trend numbers for one client (see progressSummary.ts /
// progressSummaryPdf.ts in both PMS and the PWA, which call this). Returns a
// short, warm, plain-language narrative summarizing that client's progress
// since they started, for a monthly downloadable PDF report.
//
// This function NEVER sees raw measurement rows or medical history — only
// the pre-computed first/latest/change numbers per metric — and it is
// instructed to comment ONLY on those numbers (no medical advice, no
// invented data), so a caller can safely pass this to both the PMS
// (staff-facing) and PWA (client-facing) report generators.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    narrative: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["narrative", "warnings"],
};

const SYSTEM_PROMPT = `You are a supportive nutrition coach's assistant. You will
receive a JSON summary of ONE client's body-measurement trends, already
computed (first value, latest value, change, % change, and whether that
change counts as an improvement toward their goal) for whichever metrics they
have data for, plus how long they've been tracked and how many entries they
logged.

Write a short "narrative" (2-4 short sentences, one paragraph, no headings or
bullet points, no markdown) summarizing their progress in plain, warm,
encouraging language suitable to show directly to the client in a monthly
progress report.

CRITICAL RULES:
- Use ONLY the numbers given. Never invent a metric, value, or date that
  isn't in the input.
- Do not give medical advice, diagnose anything, or recommend supplements,
  medications, or specific diets. You may give one general, safe
  encouragement (e.g. "keep up the consistent tracking", "small steady
  changes add up") but nothing prescriptive.
- If a metric moved the "wrong" way (improved: false), acknowledge it gently
  and factually — do not guilt-trip, do not catastrophize, and do not
  speculate about the cause.
- If there is only one data point (no real trend yet), say so plainly and
  encourage continued tracking instead of describing a trend that doesn't
  exist.
- Mention at most 2-3 of the most notable metrics by name (biggest
  improvements or the one thing worth flagging) rather than listing every
  metric — this is a paragraph, not a table (the numeric table is shown
  separately in the report).
- Add a short string to "warnings" for anything ambiguous in the input you
  had to soften or skip.

Return strictly the JSON matching the provided schema.`;

async function callOpenAI(
  messages: Array<Record<string, unknown>>,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "progress_insights",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("OpenAI error:", res.status, errText);
    let detail = "";
    try {
      const parsed = JSON.parse(errText);
      detail = parsed?.error?.message || parsed?.error?.type || "";
    } catch {
      // errText wasn't JSON — ignore, we'll just report the status.
    }
    throw new Error(
      `OpenAI request failed: ${res.status}${detail ? ` — ${detail}` : ""}`,
    );
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("OpenAI response was not valid JSON");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "OPENAI_API_KEY is not configured. Set it in Supabase → Edge Functions → Secrets.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "Expected a JSON body." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(body) },
    ];

    const result = await callOpenAI(messages, OPENAI_API_KEY);

    return new Response(
      JSON.stringify({
        narrative: typeof result.narrative === "string" ? result.narrative : "",
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("generate-progress-insights error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
