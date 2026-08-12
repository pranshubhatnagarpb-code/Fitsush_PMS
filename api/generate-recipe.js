// Recipe generator using OpenAI - converted from Supabase Edge Function
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { dishName, servings, additionalInstructions } = req.body;

    if (!dishName || typeof dishName !== 'string' || dishName.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide a dish name.' });
    }

    const servingsNum = Number(servings);
    const servingsCount = Number.isFinite(servingsNum) && servingsNum > 0 && servingsNum <= 50
      ? Math.round(servingsNum)
      : undefined;

    const extraInstructions = typeof additionalInstructions === 'string'
      ? additionalInstructions.trim().slice(0, 500)
      : '';

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
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
    "Step 1: Detailed instruction",
    "Step 2: Detailed instruction"
  ],
  "nutritionTips": "2-3 sentences about nutritional benefits",
  "variations": ["Alternative ingredient 1", "Alternative ingredient 2"],
  "servingSuggestions": "How to serve the dish"
}

Guidelines:
- Use authentic Indian cooking techniques
- Provide specific quantities and measurements
- Include traditional spices and ingredients
- Make it practical for home cooking
- Include regional variations if applicable
- Focus on nutrition and health benefits
- Treat every item in "MANDATORY REQUIREMENTS" as a hard constraint, not a suggestion. Before writing your final answer, re-check the ingredients list and every instruction step against each requirement one by one.
- If a serving count is required, scale every ingredient quantity by exact arithmetic to that count (e.g. halve all quantities for 2 servings if the natural recipe is for 4), and set "servings" to state that exact number.
- If an ingredient is required to be excluded (e.g. "without cream", "no onion-garlic"), that ingredient must not appear anywhere — not in "ingredients", not in "instructions", not in "nutritionTips". Replace it with a suitable substitute or omit the step entirely.
- If a calorie or nutrition target is required, adjust portions/ingredients so "calories" reflects that target.`;

    let userPrompt = `Recipe request: ${dishName.trim()}`;
    const requirements = [];
    if (servingsCount) {
      requirements.push(`Servings: exactly ${servingsCount} serving${servingsCount === 1 ? '' : 's'} — scale all ingredient quantities to this count precisely.`);
    }
    if (extraInstructions) {
      requirements.push(extraInstructions);
    }
    if (requirements.length > 0) {
      userPrompt += `\n\nMANDATORY REQUIREMENTS (all must be satisfied exactly, no exceptions):\n${requirements.map((r) => `- ${r}`).join('\n')}\n\nDouble-check your ingredients and instructions against each requirement above before responding.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });
    
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let recipe;
    try {
      // Try to parse as JSON directly first
      recipe = JSON.parse(content.trim());
    } catch (parseError) {
      // If that fails, try to extract JSON from code blocks
      try {
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        recipe = JSON.parse(jsonString.trim());
      } catch (secondParseError) {
        console.error("Failed to parse AI response:", content);
        throw new Error("Failed to parse recipe from AI response");
      }
    }

    // Validate the response structure
    if (!recipe || typeof recipe !== 'object') {
      throw new Error("Invalid AI response format");
    }

    // Ensure required fields are present
    if (!recipe.dishName || !recipe.ingredients || !recipe.instructions) {
      throw new Error("Recipe missing required fields");
    }
    
    res.status(200).json({ recipe });
  } catch (error) {
    console.error("Error generating recipe:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    if (errorMessage.includes("OpenAI API key")) {
      res.status(500).json({ error: "API configuration error. Please contact support." });
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      res.status(429).json({ error: "API rate limit exceeded. Please try again later." });
    } else {
      res.status(500).json({ error: errorMessage });
    }
  }
}
