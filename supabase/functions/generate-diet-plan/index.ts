import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Practice-specific functional nutrition strategy per condition, sourced from the
// clinic's internal reference doc (ANALYSIS - 2.xlsx). Matched against a client's
// health_conditions and injected into the prompt so the AI follows this practice's
// own playbook instead of generic knowledge, when a condition is present.
const CONDITION_LIBRARY: { name: string; keywords: string[]; guidance: string }[] = [
  {
    name: "Osteoarthritis",
    keywords: ["osteoarthritis", "arthritis", "joint pain"],
    guidance:
      "Glucosamine + chondroitin sulfate can delay OA knee progression. Curcumin (turmeric) 200-1000mg/day standardized to 95% curcuminoids reduces inflammation and arthritis pain — but avoid high-dose curcumin/ginger supplements in clients on blood-thinning medication (e.g. warfarin), as it can counteract the medication. Boswellia 300-400mg three times daily (60% boswellic acids) helps. Ginger (100-225mg capsule, or a few tbsp fresh grated ginger in meals) relieves symptoms. Bone broth is a good general food source.",
  },
  {
    name: "Osteoporosis",
    keywords: ["osteoporosis", "bone density", "bone loss"],
    guidance:
      "Optimize Vitamin D (serum 20-50 ng/mL), Vitamin K2 (200-500mcg/day) and alpha lipoic acid (300-600mg/day). Increase omega-3s and coconut oil (MCTs). Adequate protein is essential for bone and collagen — don't restrict it. Berberine 250-300mg may lower osteoclast activity and boost osteoblast activity. Horsetail (tea/capsule/tincture) provides silicon, needed for bone health.",
  },
  {
    name: "Tendonitis",
    keywords: ["tendonitis", "tendinitis"],
    guidance:
      "Assess and increase protein status (tissue/ligament strength). Vitamin C, at least 90mg/day, supports collagen production — deficiency weakens tendons/ligaments. Vitamin E reduces inflammation and may help tendonitis.",
  },
  {
    name: "Alzheimer's disease / cognitive decline",
    keywords: ["alzheimer", "dementia", "memory loss", "cognitive decline"],
    guidance:
      "Adequate protein, antioxidants (vitamin C & E), folate/B-vitamins (control homocysteine, linked to brain atrophy), omega-3 DHA/EPA (fish), a Mediterranean-style diet with coconut oil, curcumin (protects from oxidative stress, improves memory, reduces inflammation), phosphatidylserine, acetyl-L-carnitine and bacopa all support cognitive function. Optimize sleep (clears amyloid-beta) and reduce stress (linked to poor memory and inflammation).",
  },
  {
    name: "Migraines",
    keywords: ["migraine", "headache"],
    guidance:
      "Omega-3 may reduce migraine duration. Magnesium citrate, CoQ10, L-carnitine and cinnamon are beneficial. Riboflavin improves energy metabolism and reduces frequency. Vitamin D (1,000-4,000 IU/day) reduces attack frequency. Folate and melatonin are also beneficial.",
  },
  {
    name: "Food cravings",
    keywords: ["food craving", "sugar craving", "cravings"],
    guidance:
      "B vitamins support brain health and stress management. Healthy fats and quality protein curb hunger and cravings — low protein causes blood sugar swings that trigger cravings. Zinc supports neurotransmitter function. Low iron causes fatigue-driven energy cravings. Magnesium helps with stress/anxiety-driven cravings.",
  },
  {
    name: "Childhood obesity",
    keywords: ["childhood obesity", "child obesity"],
    guidance:
      "Focus on whole, real, unprocessed foods; reduce/eliminate added sugar (average intake is often >5 tsp/day). Reduce inflammatory foods (pasteurised dairy, gluten, soy, vegetable/seed oils). Include omega-3s and anti-inflammatory herbs/spices. Diet matters more than exercise alone, though activity should still be encouraged. Plan and pre-prep meals to reduce derailment.",
  },
  {
    name: "Autism spectrum",
    keywords: ["autism", "asd"],
    guidance:
      "Trial a gluten-free, casein/dairy-free diet — gluten/casein components can cross the blood-brain barrier and affect neurological function; removing casein often shows significant improvement. Ensure vitamins A & D, omega-3s, magnesium, zinc, selenium, iron, B6, B12, folate, thiamine and biotin (watch the zinc:copper ratio isn't imbalanced). Methylated B12 with methyl-folate supports optimal methylation pathways.",
  },
  {
    name: "ADHD",
    keywords: ["adhd", "attention deficit"],
    guidance:
      "Trial an elimination diet — gluten/dairy/food sensitivities can increase inflammation and intestinal permeability, aggravating deficiencies in magnesium, zinc, selenium, tyrosine and fatty acids. Ensure adequate tryptophan and vitamin B6 (needed to convert tryptophan into serotonin). Address oxidative stress/glutathione status.",
  },
  {
    name: "Epilepsy",
    keywords: ["epilepsy", "seizure"],
    guidance: "A ketogenic diet is the primary nutrition strategy considered for epilepsy.",
  },
  {
    name: "Poor immunity",
    keywords: ["low immunity", "poor immunity", "weak immunity", "frequent infections"],
    guidance:
      "Ensure vitamin C, vitamin D, zinc, selenium, iron, protein and glutamine. Diets high in ultra-processed food and refined sugar, and low in fruit/vegetables, disturb healthy gut flora and weaken immunity. Include probiotic foods (kefir, fermented vegetables, sauerkraut, kombucha, kimchi, live-culture yogurt) and prebiotic foods (garlic, onion, leeks, asparagus, artichoke, dandelion greens, banana, seaweed).",
  },
  {
    name: "Thyroid disorders",
    keywords: ["thyroid", "hypothyroid", "hyperthyroid", "hashimoto"],
    guidance:
      "Eliminate trigger foods causing sensitivities/inflammation — dairy, soy, gluten, corn. Use homemade bone broth to heal gut imbalances. Seaweed (iodine) supports thyroid hormone production. Fermented foods (yogurt, kefir, kombucha, kimchi) help — but avoid probiotic supplements if SIBO is present. Lemon balm tea can help with infections. Limit goitrogenic foods (broccoli, cabbage, kale, Brussels sprouts, collard greens) if the client seems sensitive to them. High-oxalate foods can bind T3, and lectins can trigger/attract immune activity to the thyroid — limit if sensitive. Avoid fluoride and chlorinated water; prefer organic foods. Spirulina/Chlorella can help in hyperthyroidism; ashwagandha, lemon balm and valerian tea are supportive herbs.",
  },
  {
    name: "Leptin resistance",
    keywords: ["leptin resistance", "leptin"],
    guidance:
      "Follow an anti-inflammatory diet with a balanced omega-6:omega-3 ratio. Time-restricted eating, calorie restriction or fasting can improve leptin sensitivity — but eating late (after 8pm) is linked to worse leptin resistance, more hunger and weight gain. A diverse, plant-focused, high-fiber diet supports gut bacteria balance. Gymnema, cinnamon and berberine can help. Maintain a consistent sleep schedule, regular physical activity, and manage chronic stress.",
  },
  {
    name: "Diabetes / insulin resistance",
    keywords: ["diabetes", "diabetic", "blood sugar", "insulin resistance"],
    guidance:
      "Reducing dietary carbohydrate significantly improves HbA1c, triglycerides and cholesterol, and can lower medication needs — target roughly 20-30% of calories from protein. Resistant starch can be valuable. Gluten may contribute to progression of type 2 diabetes; reducing/removing it may improve beta-cell function and glucose tolerance. Key nutrients: vitamin D, magnesium, B12, B9 (folate), chromium, alpha lipoic acid and berberine.",
  },
  {
    name: "Adrenal hypofunction / adrenal fatigue",
    keywords: ["adrenal fatigue", "adrenal hypofunction", "adrenal insufficiency"],
    guidance:
      "Include healthy fats daily (avocado, wild-caught fish, coconut oil, grass-fed ghee/butter). Watch the zinc:copper ratio. Grass-fed organ meats (e.g. liver) are nutrient-dense. Include magnesium-rich foods; low folate is linked to neurotransmitter impairment; address gut bacterial imbalances (linked to brain function). Supportive: ashwagandha, Siberian ginseng/rhodiola/cordyceps, magnolia, theanine, phosphatidylserine, holy basil.",
  },
  {
    name: "Sleep disorders / obstructive sleep apnea",
    keywords: ["sleep apnea", "sleep disorder", "insomnia"],
    guidance:
      "If allergic rhinitis or GERD is a root cause, a 3-4 week elimination diet trial can help. Include vitamin D, N-acetyl cysteine and magnesium. Valerian, lavender, melatonin, meditation, yoga and acupuncture support therapy.",
  },
  {
    name: "Dyslipidemia / high cholesterol",
    keywords: ["cholesterol", "dyslipidemia", "high triglycerides"],
    guidance:
      "Remove seed/vegetable oils from cooking; use organic cold-pressed coconut oil, butter or ghee instead, and eliminate all hydrogenated fat. Alcohol raises triglycerides, contributes to fatty liver and worsens sugar imbalances — reduce/avoid it. Stabilize blood sugar with protein, healthy fat and healthy carbs together; never eat carbs alone, and avoid processed sugar. Aim for 30-40g fiber/day. Eat anti-inflammatory foods like cold-water fish and seaweed; correct nutrient deficiencies. Excess liquid-sugar calories are a major driver of obesity, diabetes and heart disease.",
  },
  {
    name: "Hypertension",
    keywords: ["hypertension", "high blood pressure", "bp"],
    guidance:
      "Sodium needs to be balanced against potassium intake — the salt added in processed foods (not home-added salt) is the bigger issue; prefer unrefined/mineral-rich salt over stripped 'iodized' table salt. Nutrient deficiencies linked to hypertension: biotin, vitamin D, vitamin C, B1, choline, magnesium, CoQ10 and potassium; also consider chronic inflammation, elevated blood sugar/metabolic syndrome, hormonal imbalance (e.g. low estrogen), hypothyroidism and mercury toxicity as root causes. Potassium-rich foods: bananas, avocado, sweet potato, halibut, beet greens, spinach. Cocoa/dark chocolate and hibiscus tea can help lower blood pressure; vitamin K2 helps direct calcium to bone rather than blood vessels.",
  },
  {
    name: "Asthma / allergic & skin conditions",
    keywords: ["asthma", "allergy", "allergies", "eczema", "hives", "skin allergy"],
    guidance:
      "Food intolerances (especially gluten and dairy) are common in asthma; high-histamine foods (citrus, strawberries, banana, pineapple, eggplant, avocado, tomato, olives, beans, dairy, processed/cured meats) can worsen symptoms via increased gut permeability — but avoid a very-low-histamine diet long-term. Address gut dysbiosis; correct nutrient insufficiencies (curcumin, glutathione, vitamin D, zinc, selenium) to reduce inflammation and build tolerance. Manage excess adrenaline/cortisol (mast-cell/barrier-damaging) via mind-body self-care. Supportive herbs/foods: thyme, oregano, turmeric + black pepper, astragalus, elderberry, ginger, garlic, bone broth. Topical/skin support: aloe, calendula, rose water, neem, black seed oil, tea tree oil.",
  },
  {
    name: "NAFLD / fatty liver",
    keywords: ["nafld", "fatty liver", "liver"],
    guidance:
      "Dietary fat is not directly converted to liver fat — reducing fructose is the most effective way to lower de novo lipogenesis. Eating the right fats increases metabolism and fat-burning and decreases hunger; MCTs (coconut oil or standalone MCT oil) are preferred. Low choline causes fat accumulation in the liver — choline becomes phosphatidylcholine, used to package and export VLDL from the liver. Sulfur-rich foods (garlic, onion) and cruciferous/leafy greens (kale, collards, cabbage, arugula, watercress) support liver detox. Supportive: milk thistle, dandelion root, hibiscus tea, turmeric + black pepper, rooibos, ginger, thyme, oregano, alpha lipoic acid, N-acetyl-cysteine, B vitamins, magnesium and sunflower lecithin.",
  },
  {
    name: "Liver cirrhosis & complications",
    keywords: ["cirrhosis", "liver disease"],
    guidance:
      "Existing cirrhotic damage can't be reversed, but further damage can be limited. Saturated fats (butter/ghee, beef tallow, MCT oil) protect against alcohol-induced fatty liver disease, whereas polyunsaturated seed/corn oils promote it.",
  },
  {
    name: "Gallstones (cholelithiasis)",
    keywords: ["gallstone", "gall stone", "cholelithiasis"],
    guidance:
      "Most gallstones (80%) are cholesterol stones; also seen are black pigment stones (linked to haemolytic disorders) and brown pigment stones (linked to bacterial/helminthic biliary infection). Support solubility/excretion of cholesterol and bile with lecithin/phosphatidylcholine, choline, methionine and glycine. Soluble fiber (psyllium, pectin) increases bile salt solubility and excretion. Vitamin C & E stimulate bile production; omega-3s help control blood lipids.",
  },
  {
    name: "Gastric / peptic ulcers",
    keywords: ["ulcer", "peptic ulcer", "gastric ulcer"],
    guidance:
      "Focus on: regulating gastric acidity, protecting/repairing gut mucosa, controlling inflammatory prostaglandins, addressing H. pylori and other gut pathogens, eliminating food allergens/sensitivities, supporting gut immunity/dysbiosis, and managing stress. Bland, milk-heavy diets don't actually help healing, though genuine trigger foods should still be avoided if symptomatic. Supportive: slippery elm (1-2 tsp in water or as porridge, 3-4x/day with food), glutamine and bone meal powder (mucosal repair), zinc carnosine (mucosal repair), B-complex (immune support, inhibits H. pylori growth), and probiotics (restore healthy flora, reduce inflammation, assist H. pylori eradication, offset antibiotic side effects).",
  },
  {
    name: "Irritable Bowel Syndrome (IBS)",
    keywords: ["ibs", "irritable bowel"],
    guidance:
      "Start by investigating digestion — low stomach acid, poor pancreatic enzyme secretion, or insufficient bile lead to improperly broken-down food fermenting/putrefying in the gut, causing bloating, gas, discomfort and irregular stools. Damaged intestinal lining (from food reactions, gut infections, stress, dysbiosis) lets undigested food interact with the immune system. Eliminate the most common food allergens (dairy, gluten, yeast, eggs, corn, soy, peanuts) for 12 weeks.",
  },
];

function getFunctionalNutritionContext(healthConditions: string[]): string {
  if (!healthConditions || healthConditions.length === 0) return "";
  const matched: string[] = [];
  const seen = new Set<string>();
  for (const condition of healthConditions) {
    for (const entry of CONDITION_LIBRARY) {
      if (seen.has(entry.name)) continue;
      const isMatch = entry.keywords.some((kw) => {
        const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        return re.test(condition);
      });
      if (isMatch) {
        seen.add(entry.name);
        matched.push(`- ${entry.name}: ${entry.guidance}`);
      }
    }
  }
  if (matched.length === 0) return "";
  return `\n\n**Practice's Functional Nutrition Reference (apply where relevant to this client's conditions):**\n${matched.slice(0, 6).join("\n")}`;
}

interface ClientDetails {
  name: string;
  goal: 'weight_loss' | 'weight_gain' | 'maintain';
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  skinType: string;
  hairType: string;
  healthConditions: string[];
  dietPreference: 'vegetarian' | 'non-vegetarian' | 'both';
}

const getDayGroupings = (numberOfDays: number, startDate: string) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const start = new Date(startDate);
  const dayGroups: Array<{ dayName: string; date: string; fullDate: string }> = [];
  
  for (let i = 0; i < numberOfDays; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + i);
    const dayName = days[currentDate.getDay()];
    const dateStr = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    dayGroups.push({
      dayName,
      date: dateStr,
      fullDate: currentDate.toISOString().split('T')[0]
    });
  }
  
  // Pair days for common diet plans
  const pairedGroups: Array<{ label: string; dates: string; days: typeof dayGroups }> = [];
  const used = new Set<number>();
  
  for (let i = 0; i < dayGroups.length; i++) {
    if (used.has(i)) continue;
    
    const current = dayGroups[i];
    let pair: typeof dayGroups[0] | null = null;
    
    for (let j = i + 1; j < dayGroups.length; j++) {
      if (used.has(j)) continue;
      
      const nextDay = dayGroups[j];
      if ((current.dayName === 'Monday' && nextDay.dayName === 'Thursday') ||
          (current.dayName === 'Tuesday' && nextDay.dayName === 'Friday') ||
          (current.dayName === 'Wednesday' && nextDay.dayName === 'Saturday') ||
          (current.dayName === 'Thursday' && nextDay.dayName === 'Monday') ||
          (current.dayName === 'Friday' && nextDay.dayName === 'Tuesday') ||
          (current.dayName === 'Saturday' && nextDay.dayName === 'Wednesday')) {
        pair = nextDay;
        used.add(j);
        break;
      }
    }
    
    if (pair) {
      pairedGroups.push({
        label: `${current.dayName} & ${pair.dayName}`,
        dates: `${current.date} & ${pair.date}`,
        days: [current, pair]
      });
    } else {
      pairedGroups.push({
        label: current.dayName,
        dates: current.date,
        days: [current]
      });
    }
    used.add(i);
  }
  
  return pairedGroups;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientDetails, customPrompt, numberOfDays = 7, startDate, includeNutrition }: { clientDetails: ClientDetails; customPrompt?: string; numberOfDays?: number; startDate?: string; includeNutrition?: boolean } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const goalText = {
      weight_loss: "weight loss / fat loss",
      weight_gain: "weight gain / muscle building",
      maintain: "weight maintenance"
    }[clientDetails.goal];

    const wantsNutrition = includeNutrition === true;
    const nutritionMealField = wantsNutrition
      ? `, "nutrition": { "calories": "e.g. 220 kcal", "protein": "e.g. 10g", "carbs": "e.g. 30g", "fat": "e.g. 6g" }`
      : "";
    const nutritionDayGroupField = wantsNutrition
      ? `,
      "dailyTotals": { "calories": "sum of all meals, e.g. 1450 kcal", "protein": "e.g. 78g", "carbs": "e.g. 165g", "fat": "e.g. 42g" }`
      : "";

    const effectiveStartDate = startDate || new Date().toISOString().split('T')[0];
    const dayGroups = getDayGroupings(numberOfDays, effectiveStartDate);
    const groupDescriptions = dayGroups.map((g, i) => `- Group ${i + 1}: ${g.label} (${g.dates})`).join('\n');
    const groupJsonExamples = dayGroups.map((g, i) => {
      return `    {
      "label": "${g.label}",
      "dates": "${g.dates}",
      "editable": true,
      "meals": [
        { "period": "Upon waking up", "time": "7:00 AM", "foodPlan": "Specific food with quantities", "alternative": "Alternative option with quantities", "notes": "Preparation notes"${nutritionMealField} },
        { "period": "Mid Morning", "time": "9:00 AM", "foodPlan": "...", "alternative": "...", "notes": "..."${nutritionMealField} },
        { "period": "Breakfast", "time": "10:30 AM", "foodPlan": "...", "alternative": "...", "notes": "..."${nutritionMealField} },
        { "period": "Lunch", "time": "1:00 PM", "foodPlan": "...", "alternative": "...", "notes": "..."${nutritionMealField} },
        { "period": "Evening Snack", "time": "5:00 PM", "foodPlan": "...", "alternative": "...", "notes": "..."${nutritionMealField} },
        { "period": "Dinner", "time": "7:30 PM", "foodPlan": "...", "alternative": "...", "notes": "..."${nutritionMealField} },
        { "period": "Bedtime", "time": "9:30 PM", "foodPlan": "...", "alternative": "...", "notes": ""${nutritionMealField} }
      ]${nutritionDayGroupField}
    }`;
    }).join(',\n');

    const systemPrompt = `You are an expert Indian nutritionist and dietitian specializing in holistic nutrition. Create a detailed, time-based food plan with authentic Indian meals.

CRITICAL STRUCTURE: The plan must be organized with these day-groups:
${groupDescriptions}

Each day-group should have DIFFERENT meals from the others to provide variety. Do NOT use "OR" options - give ONE specific meal per period per day-group. For EVERY meal period, also provide ONE alternative option that the client can swap in if they don't like the primary option.

Your response must be a valid JSON object with exactly this structure:
{
  "planName": "Food Plan for [Client Name]",
  "introMessage": "A personalized 2-3 sentence message about the food plan.",
  "affirmations": ["3 positive health affirmations"],
  "startDate": "${effectiveStartDate}",
  "editable": true,
  "dayGroups": [
${groupJsonExamples}
  ],
  "servingSize": "1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml",
  "oilGuidelines": {
    "cooking": {
      "groupA": ["oil names - 2 tsp each"],
      "groupB": ["oil names - 1-2 tsp each"]
    },
    "raw": ["oils for topping/salads - 1 tsp each"],
    "deepFrying": ["high smoke point oils for occasional use"],
    "note": "All oils must be unrefined/cold pressed. Total should not exceed 4-5 tsp a day."
  },
  "importantNotes": ["List of 3-5 important dietary notes"],
  "disclaimer": "Standard nutrition coaching disclaimer",
  "skinCareTips": "Tips based on skin type",
  "hairCareTips": "Tips based on hair type",
  "healthNotes": "Notes for health conditions",
  "weeklyGroceryList": [
    { "category": "Vegetables", "items": ["Spinach - 500g", "Tomatoes - 1kg", "Onions - 1kg"] },
    { "category": "Fruits", "items": ["Banana - 6 pcs", "Apple - 4 pcs"] },
    { "category": "Grains & Pulses", "items": ["Brown rice - 1kg", "Moong dal - 500g"] },
    { "category": "Dairy", "items": ["Curd - 1kg", "Paneer - 200g"] },
    { "category": "Spices & Condiments", "items": ["Haldi powder", "Jeera"] },
    { "category": "Others", "items": ["Jaggery - 200g", "Honey - 1 bottle"] }
  ]
}

Focus on:
- Authentic Indian cuisine with variety (North & South Indian)
- Practical, easily available ingredients with exact quantities
- Include traditional superfoods (haldi, methi, amla, moringa, ashwagandha etc.)
- ONE specific meal per period (no OR options) with ONE alternative option for each meal
- The alternative should be a completely different dish (not a variation) that serves the same nutritional purpose
- Different meals across day-groups for variety
- Detailed preparation notes
- Post-meal instructions (like Vajrasan, walking)
- Proper hydration guidance
- Keep the plan concise enough to fit in 2 pages when printed
- Weekly grocery list with items easily available in Indian markets (local sabzi mandi, kirana stores)
- Categorize grocery items (Vegetables, Fruits, Grains & Pulses, Dairy, Spices & Condiments, Others)
- Include approximate quantities needed for the week${wantsNutrition ? `

NUTRITIONAL VALUES: For every meal (including its "foodPlan" and "alternative" options together), estimate the "nutrition" object (calories, protein, carbs, fat) based on the actual foods and quantities given — not generic placeholders. For every day-group, also add a "dailyTotals" object summing all its meals for that day. Keep estimates realistic and internally consistent (dailyTotals should roughly equal the sum of that day-group's meal-level nutrition).` : ''}${getFunctionalNutritionContext(clientDetails.healthConditions)}`;

    const groupLabels = dayGroups.map(g => g.label).join(', ');

    const userPrompt = `Create a personalized detailed food plan for:

**Client Profile:**
- Name: ${clientDetails.name}
- Goal: ${goalText}
- Height: ${clientDetails.height} cm
- Weight: ${clientDetails.weight} kg
- Age: ${clientDetails.age} years
- Gender: ${clientDetails.gender}
- Diet Preference: ${clientDetails.dietPreference}

**Skin & Hair:**
- Skin Type: ${clientDetails.skinType}
- Hair Type: ${clientDetails.hairType}

**Health Conditions/Concerns:**
${clientDetails.healthConditions.length > 0 ? clientDetails.healthConditions.join(', ') : 'None specified'}
${customPrompt ? `\n**Additional Instructions from Nutritionist:**\n${customPrompt}` : ''}

Create a comprehensive food plan covering ${numberOfDays} days starting from ${effectiveStartDate} with day-groups (${groupLabels}), each having unique meals. Include oil guidelines and important dietary notes.`;

    const fetchResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt + "\nReturn only valid JSON." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    const openaiData = await fetchResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let dietPlan;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      dietPlan = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse diet plan from AI response");
    }

    return new Response(
      JSON.stringify({ dietPlan }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating diet plan:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
