// Diet Chart Template Import Edge Function
//
// IMPORTANT — MANUAL SETUP REQUIRED:
// Uses the same OPENAI_API_KEY secret as extract-blood-report / generate-diet-plan.
// In the Supabase dashboard: Project Settings → Edge Functions → Secrets, add:
//   OPENAI_API_KEY = sk-...your OpenAI API key...
//
// Accepts a multipart/form-data upload with a single "file" field (PDF or image)
// containing an OLD-FORMAT diet chart that was created for one specific client
// (e.g. a PDF with a "Client Details" table, a meal-by-time table, and a
// "For Supplements" section). Extracts it into a REUSABLE diet chart template
// shape — the same shape PMS's Diet Chart Templates page already uses
// (template_data: day/meal rows, plus a supplements schedule) — so staff can
// review it and save it as a new template without retyping it by hand.
//
// The model is explicitly told to leave the original client's identity and
// personal numbers (name, exact weight/height/age, deficiencies, medical
// history) out of the generated name/description, since the whole point is a
// reusable template, not a copy of one client's record.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CATEGORIES = [
  "Weight Loss",
  "PCOD/PCOS",
  "Diabetes",
  "Thyroid",
  "Muscle Gain",
  "General Wellness",
  "Pregnancy",
  "Post Surgery",
] as const;

const MEAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    time: { type: "string" },
    meal: { type: "string" },
    alternatives: { type: "string" },
    notes: { type: "string" },
  },
  required: ["time", "meal", "alternatives", "notes"],
};

const DAY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    day: { type: "string" },
    meals: { type: "array", items: MEAL_SCHEMA },
  },
  required: ["day", "meals"],
};

const SUPPLEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    time: { type: "string" },
    supplement: { type: "string" },
    notes: { type: "string" },
  },
  required: ["time", "supplement", "notes"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    category: { type: "string", enum: [...CATEGORIES] },
    description: { type: "string" },
    instructions: { type: "string" },
    days: { type: "array", items: DAY_SCHEMA },
    supplements: { type: "array", items: SUPPLEMENT_SCHEMA },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "name",
    "category",
    "description",
    "instructions",
    "days",
    "supplements",
    "warnings",
  ],
};

const SYSTEM_PROMPT = `You are a nutrition diet-chart digitization assistant.

You will receive an OLD diet chart PDF/image that was originally created for ONE
specific client. Your job is to turn it into a REUSABLE TEMPLATE that a dietitian
can assign to any future client with a similar goal — NOT a copy of that one
client's personal record.

CRITICAL RULES:
- Do NOT put the original client's name, or their exact personal numbers
  (weight, height, age, BMI, BMR, deficiencies, medical history, IBW) into
  "name" or "description". Those numbers belong to one person and would be
  wrong for anyone else this template gets assigned to.
- Instead, infer a short, generic, reusable template name from the apparent
  goal/condition (e.g. "PCOS Fat Loss - Paneer & Almond Flour Plan",
  "Diabetes Friendly - High Fiber Plan"). "description" should be one sentence
  describing who this suits (goal, dietary style), still without naming the
  original client or their private numbers.
- "category" must be exactly one of: ${CATEGORIES.join(", ")}. Pick the closest
  match to the client's stated goal/condition; default to "General Wellness"
  if nothing else fits.
- "days": the chart usually lists ONE daily schedule that repeats every day —
  in that case return a SINGLE day object with day="Everyday". Only return
  multiple day objects if the chart explicitly gives different meals for
  different named weekdays.
- Each row in the chart's meal-time table becomes one entry in that day's
  "meals" array, in the same time order as the chart:
  - "time": the time exactly as printed (e.g. "9:45am").
  - When a row lists several options separated by "Or"/"OR", put the FIRST
    option in "meal" and join the REMAINING options into "alternatives"
    separated by " | " (do not repeat the word "Or"). If there is only one
    option, put it in "meal" and leave "alternatives" as an empty string.
  - "notes": anything else tied to that specific row only (e.g. an "Amount of
    oil" column value like "1 teaspoon coconut oil/butter/ghee"). Empty
    string if none.
- "instructions": combine the chart's general guidance that applies to the
  whole plan — daily calorie/macro target if given, "Mandatory" items (water
  intake, workout frequency, sleep), "Not allowed" foods, and any other
  standing notes NOT tied to one specific meal row — into one readable block
  of text (use line breaks between points). Do not include this in "notes".
- "supplements": extract every line from a "For Supplements" (or similarly
  named) section. One entry per line:
  - "time": the time exactly as printed (e.g. "9:30am").
  - "supplement": the supplement name(s) and dosage exactly as written (e.g.
    "Myo Inositol : D Chiro Inositol 40:1 + Berberine 500mg").
  - "notes": any parenthetical caveat or duration (e.g. "for one more month",
    "once a month"). Empty string if none.
  - If there is no supplements section at all, return an empty array.
- Add a short string to "warnings" for anything you could not parse cleanly
  or had to guess at.
- Never invent meals, times, or supplements that are not in the source
  document.

Return strictly the JSON matching the provided schema.`;

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import(
      "https://esm.sh/unpdf@0.12.1"
    );
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (text || "").trim();
  } catch (err) {
    console.warn("PDF text extraction failed:", err);
    return "";
  }
}

async function callOpenAI(
  payloadMessages: Array<Record<string, unknown>>,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0,
      messages: payloadMessages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "diet_template_import",
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const emptyResult = (warnings: string[]) => ({
  name: "",
  category: "General Wellness",
  description: "",
  instructions: "",
  days: [],
  supplements: [],
  warnings,
});

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

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "No file uploaded under 'file' field." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");

    let messages: Array<Record<string, unknown>>;

    if (isPdf) {
      const text = await extractPdfText(bytes);
      if (text && text.length > 80) {
        messages = [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Turn the following old diet chart into a reusable template. Remember: no client-identifying details in name/description.\n\n---\n${text}\n---`,
          },
        ];
      } else {
        return new Response(
          JSON.stringify(
            emptyResult([
              "This PDF appears to be scanned and contains no extractable text. Please export the pages as images (JPG/PNG) and upload those instead, or upload a text-based PDF.",
            ]),
          ),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } else if (isImage) {
      const base64 = bytesToBase64(bytes);
      const mime = file.type || "image/jpeg";
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Turn this old diet chart image into a reusable template. Remember: no client-identifying details in name/description.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ];
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported file type. Upload PDF or image." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = await callOpenAI(messages, OPENAI_API_KEY);

    return new Response(
      JSON.stringify({
        name: typeof result.name === "string" ? result.name : "",
        category:
          typeof result.category === "string" &&
          (CATEGORIES as readonly string[]).includes(result.category)
            ? result.category
            : "General Wellness",
        description:
          typeof result.description === "string" ? result.description : "",
        instructions:
          typeof result.instructions === "string" ? result.instructions : "",
        days: Array.isArray(result.days) ? result.days : [],
        supplements: Array.isArray(result.supplements)
          ? result.supplements
          : [],
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("import-diet-template error:", err);
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
