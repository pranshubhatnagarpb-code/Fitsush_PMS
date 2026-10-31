import { supabase } from '@/integrations/supabase/client';
import {
  buildPlanHtml,
  aiRecipeCandidates,
  matchAiRecipeNames,
  manualRecipeKeys,
  matchAffiliateProducts,
  type RecipeRow,
  type AffiliateProduct,
  type AffiliateProductRow,
} from '@/lib/dietPlanHtml';
import { dietPlanHtmlToPdfBlob } from '@/lib/dietPlanPdfFile';

// Layout lives in dietPlanHtml.ts (shared byte-for-byte with the client PWA);
// this file only loads the data it needs and prints / renders it.
export { dayMealText, dayMeals, planMealColumns, dayMealOptionsFor, countPlanDays, planSupplements, buildPlanHtml, applyRecipeEdits, type RecipeEdits, type RecipeRow } from '@/lib/dietPlanHtml';

const RECIPE_COLUMNS = 'Meal_name, Ingredients, Instructions, Remarks';

// Supabase caps responses at 1000 rows per request, so page through the table.
async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const all: T[] = [];
  const batchSize = 1000;
  for (let from = 0; ; from += batchSize) {
    const { data, error } = await (supabase.from(table as any) as any)
      .select(columns)
      .range(from, from + batchSize - 1);
    if (error || !data) return all;
    all.push(...(data as T[]));
    if (data.length < batchSize) return all;
  }
}

// AI plans: match on names only (small download), then fetch the full recipes that matched.
export async function fetchRecipesForAIPlan(aiData: any): Promise<RecipeRow[]> {
  const candidates = aiRecipeCandidates(aiData);
  if (candidates.length === 0) return [];
  const names = await fetchAllRows<{ Meal_name: string }>('meal_recipes', 'Meal_name');
  const matched = matchAiRecipeNames(candidates, names.map((r) => r.Meal_name));
  if (matched.length === 0) return [];
  const { data } = await supabase.from('meal_recipes').select(RECIPE_COLUMNS).in('Meal_name', matched);
  const byName = new Map(((data ?? []) as RecipeRow[]).map((r) => [r.Meal_name, r]));
  return matched.flatMap((n) => (byName.has(n) ? [byName.get(n)!] : []));
}

// Manual plans: recipes whose name exactly matches a meal in the plan.
async function fetchRecipesForManualPlan(days: any[]): Promise<RecipeRow[]> {
  const keys = manualRecipeKeys(days);
  if (keys.length === 0) return [];
  const { data, error } = await supabase.from('meal_recipes').select(RECIPE_COLUMNS).in('meal_name_normalized', keys);
  return error || !data ? [] : (data as RecipeRow[]);
}

export async function fetchAffiliateProductsForPlan(aiData: any): Promise<AffiliateProduct[]> {
  const products = await fetchAllRows<AffiliateProductRow>('affiliate_products', 'product_name, link, product_name_normalized');
  return matchAffiliateProducts(aiData, products);
}

async function loadLogoDataUrl(): Promise<string> {
  try {
    const res = await fetch('/fitsush-logo.webp');
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return ''; }
}

// Recipes matched to a plan's meals, before the plan's recipe edits are applied
// (buildPlanHtml applies those). Used by the planners' recipe editors.
export async function loadMatchedRecipes(plan: any): Promise<RecipeRow[]> {
  return plan.is_ai_generated && plan.ai_plan_data
    ? fetchRecipesForAIPlan(plan.ai_plan_data)
    : fetchRecipesForManualPlan(plan.diet_plan_days);
}

// Full chart HTML for a plan (needs plan.clients, and plan.diet_plan_days for manual plans).
export async function loadPlanHtml(plan: any): Promise<string> {
  const isAI = plan.is_ai_generated && plan.ai_plan_data;
  const [recipes, affiliateProducts, logoDataUrl] = await Promise.all([
    loadMatchedRecipes(plan),
    isAI ? fetchAffiliateProductsForPlan(plan.ai_plan_data) : Promise.resolve([]),
    loadLogoDataUrl(),
  ]);
  return buildPlanHtml(plan, { recipes, affiliateProducts, logoDataUrl });
}

// Opens the plan in a new tab for browser print / Save as PDF.
export async function openDietPlanForPrint(plan: any): Promise<void> {
  const html = await loadPlanHtml(plan);
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

// PDF file for the client app (made on Publish). Rendering lives in the shared
// dietPlanPdfFile.ts, so the client's own "Download PDF" makes the same file.
export async function generateDietPlanPdfBlob(plan: any): Promise<Blob | null> {
  return dietPlanHtmlToPdfBlob(await loadPlanHtml(plan));
}
