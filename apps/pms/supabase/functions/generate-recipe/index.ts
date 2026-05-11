import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/openai@4.28.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dishName } = await req.json();

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
  "tips": ["Helpful cooking tip 1", "Tip 2"],
  "nutritionInfo": {
    "protein": "e.g. 12g",
    "carbs": "e.g. 45g",
    "fat": "e.g. 8g",
    "fiber": "e.g. 3g"
  }
}

Focus on:
- Authentic Indian recipes when the dish is Indian, otherwise provide the authentic recipe for that cuisine
- Exact quantities and measurements
- Clear step-by-step instructions
- Practical tips for best results
- Accurate nutrition estimates`;

    const openai = createClient({ apiKey: OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Give me a detailed recipe for: ${dishName.trim()}` },
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
