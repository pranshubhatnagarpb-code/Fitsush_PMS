import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dishName, servings, additionalInstructions, includeNutrition } = await req.json();

    if (!dishName || typeof dishName !== "string" || dishName.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Please provide a dish name." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const wantsNutrition = includeNutrition !== false;

    const systemPrompt = `You are an expert Indian chef and nutritionist. When given a dish name, provide a detailed recipe in JSON format.

Your response must be a valid JSON object with exactly this structure:
{
  "dishName": "Full dish name",
  "description": "1-2 sentence description of the dish",
  "prepTime": "e.g. 15 mins",
  "cookTime": "e.g. 30 mins",
  "servings": "e.g. 4 servings",
  "difficulty": "Easy / Medium / Hard",
  "calories": "Approximate calories per serving",
  "ingredients": [
    { "item": "Ingredient name", "quantity": "Amount with unit" }
  ],
  "instructions": [
    "Step 1 description",
    "Step 2 description"
  ],
  "nutritionTips": "1-2 sentences of general nutrition/health guidance about this dish (not the macro breakdown).",
  "variations": ["A healthier or alternative version of this dish", "Another variation"],
  "servingSuggestions": "1-2 sentences on what to pair/serve this dish with."${wantsNutrition ? `,
  "nutritionInfo": {
    "calories": "Approximate calories per serving, e.g. 320 kcal",
    "protein": "e.g. 12g",
    "carbs": "e.g. 45g",
    "fat": "e.g. 8g",
    "fiber": "e.g. 3g"
  }` : ""}
}

Focus on:
- Authentic Indian recipes when the dish is Indian, otherwise provide the authentic recipe for that cuisine
- Exact quantities and measurements, scaled to the requested number of servings
- Clear step-by-step instructions
- Practical tips for best results${wantsNutrition ? `
- Accurate per-serving nutrition estimates (calories, protein, carbs, fat, fiber) based on the actual ingredients and quantities used` : `
- Do NOT include a "nutritionInfo" field in the response at all — nutrition breakdown was not requested for this recipe`}
- Follow any additional instructions from the nutritionist exactly (dietary restrictions, calorie targets, ingredient exclusions, etc.)`;

    const userPromptParts = [`Give me a detailed recipe for: ${dishName.trim()}`];
    if (servings) userPromptParts.push(`Scale the recipe for ${servings} serving(s).`);
    if (additionalInstructions && String(additionalInstructions).trim()) {
      userPromptParts.push(`Additional instructions: ${String(additionalInstructions).trim()}`);
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPromptParts.join("\n") },
      ],
      temperature: 0.7,
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let recipe;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      recipe = JSON.parse(jsonString.trim());
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse recipe from AI response");
    }

    return new Response(
      JSON.stringify({ recipe }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating recipe:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
