import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

// ---------------------------------------------------------------------------
// PDF file for the client app (made on Publish). Same HTML as the print view,
// rendered in an isolated iframe and cut into A4 pages at row/heading
// boundaries so table rows aren't split across pages.
// ---------------------------------------------------------------------------

const PAGE_WIDTH_PX = 794; // A4 at 96dpi
const PAGE_HEIGHT_PX = Math.round(PAGE_WIDTH_PX * (297 / 210));

export async function generateDietPlanPdfBlob(plan: any): Promise<Blob | null> {
  const html = await loadPlanHtml(plan);
  if (!html) return null;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;border:0;`;
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    await Promise.all(Array.from(doc.images).map((img) =>
      img.complete ? null : new Promise((resolve) => { img.onload = img.onerror = resolve; })));

    const body = doc.body;
    const totalHeight = body.scrollHeight;
    const topOf = (el: Element) => el.getBoundingClientRect().top;

    // Where a page may end: the top of any row/heading/block. Forced breaks: page-break-before.
    const breakpoints = Array.from(body.querySelectorAll('tr, h1, h2, h3, h4, p, li, .client-details, .intro, .day-notes, .notes-box, [style*="page-break-inside"]'))
      .map(topOf).filter((y) => y > 0).sort((a, b) => a - b);
    const forced = Array.from(body.querySelectorAll('[style*="page-break-before"]'))
      .map(topOf).filter((y) => y > 0).sort((a, b) => a - b);

    const scale = 2;
    const canvas = await html2canvas(body, {
      scale,
      useCORS: true,
      logging: false,
      width: PAGE_WIDTH_PX,
      windowWidth: PAGE_WIDTH_PX,
      height: totalHeight,
      windowHeight: totalHeight,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const mmPerPx = pageW / PAGE_WIDTH_PX;

    let start = 0;
    let firstPage = true;
    while (start < totalHeight - 1) {
      const ideal = start + PAGE_HEIGHT_PX;
      let end: number;
      const forcedBreak = forced.find((y) => y > start + 1 && y <= ideal);
      if (ideal >= totalHeight) end = totalHeight;
      else if (forcedBreak) end = forcedBreak;
      else {
        const candidates = breakpoints.filter((y) => y > start + PAGE_HEIGHT_PX * 0.5 && y <= ideal);
        end = candidates.length ? candidates[candidates.length - 1] : ideal;
      }
      if (end >= totalHeight - 1) end = totalHeight;

      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.round((end - start) * scale);
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, Math.round(start * scale), canvas.width, slice.height, 0, 0, canvas.width, slice.height);

      if (!firstPage) pdf.addPage();
      firstPage = false;
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, (end - start) * mmPerPx);
      start = end;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}
