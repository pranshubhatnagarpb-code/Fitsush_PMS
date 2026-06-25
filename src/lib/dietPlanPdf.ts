import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Recipe matching helpers (mirrors AIDietPlanGenerator logic)
// ---------------------------------------------------------------------------

function normalizeMealName(s: string): string {
  return (s || '').replace(/['"]/g, '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function toWordSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter(w => w.length >= 2));
}

async function fetchRecipesForAIPlan(
  aiData: any,
): Promise<Array<{ Meal_name: string; Ingredients: string; Instructions: string; Remarks: string }>> {
  const raw: string[] = [];
  ((aiData.dayGroups ?? []) as any[]).forEach((dg: any) => {
    ((dg.meals ?? []) as any[]).forEach((m: any) => {
      [m.foodPlan, m.alternative].forEach((text: string) => {
        if (!text) return;
        text.split(/\n|,|;|\/|\+|\bor\b|\band\b|\bwith\b/i).forEach((piece: string) => {
          const cleaned = piece
            .replace(/\(.*?\)/g, '')
            .replace(/\d+\s*(g|ml|gm|kg|tsp|tbsp|cup|cups|pcs|piece|pieces|bowl|glass)\b/gi, '')
            .trim();
          if (cleaned.length >= 3) raw.push(cleaned);
        });
      });
    });
  });

  const seen = new Set<string>();
  const candidates: string[] = [];
  raw.forEach(r => {
    const n = normalizeMealName(r);
    if (n && !seen.has(n)) { seen.add(n); candidates.push(n); }
  });

  if (candidates.length === 0) return [];

  // Paginate because Supabase caps responses at 1000 rows per request
  type RecipeRow = { Meal_name: string; Ingredients: string; Instructions: string; Remarks: string };
  const allData: RecipeRow[] = [];
  const batchSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('meal_recipes')
      .select('Meal_name, Ingredients, Instructions, Remarks')
      .range(from, from + batchSize - 1);
    if (error || !data || data.length === 0) break;
    allData.push(...(data as RecipeRow[]));
    if (data.length < batchSize) break;
    from += batchSize;
  }
  if (allData.length === 0) return [];

  const matched = new Set<string>();
  const out: RecipeRow[] = [];
  candidates.forEach(candidate => {
    const candidateWords = toWordSet(candidate);
    const match = allData.find(r => {
      const recipeWords = toWordSet(normalizeMealName(r.Meal_name));
      if (recipeWords.size === 0) return false;
      return [...recipeWords].every(w => candidateWords.has(w)) ||
             [...candidateWords].every(w => recipeWords.has(w));
    });
    if (match && !matched.has(match.Meal_name)) {
      matched.add(match.Meal_name);
      out.push({
        Meal_name: match.Meal_name,
        Ingredients: match.Ingredients || '',
        Instructions: match.Instructions || '',
        Remarks: match.Remarks || '',
      });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Affiliate product matching — based on weekly grocery list
// ---------------------------------------------------------------------------

function normalizeProductName(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
}

export async function fetchAffiliateProductsForPlan(
  aiData: any,
): Promise<Array<{ product_name: string; link: string }>> {
  const groceryNorms = new Set<string>();
  ((aiData.weeklyGroceryList ?? []) as any[]).forEach((cat: any) => {
    ((cat.items ?? []) as string[]).forEach((item) => {
      const cleaned = item
        .replace(/\(.*?\)/g, '')
        .replace(/\d+\s*(g|ml|gm|kg|l|tsp|tbsp|cup|cups|pcs|piece|pieces|jar|jars|bottle|bottles|pack|packs|sachet|sachets|bowl|glass)\b/gi, '')
        .trim();
      const n = normalizeProductName(cleaned);
      if (n.length >= 2) groceryNorms.add(n);
    });
  });

  if (groceryNorms.size === 0) return [];

  type ProductRow = { product_name: string; link: string; product_name_normalized: string };
  const allData: ProductRow[] = [];
  const batchSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('affiliate_products')
      .select('product_name, link, product_name_normalized')
      .range(from, from + batchSize - 1);
    if (error || !data || data.length === 0) break;
    allData.push(...(data as ProductRow[]));
    if (data.length < batchSize) break;
    from += batchSize;
  }
  if (allData.length === 0) return [];

  const matched: Array<{ product_name: string; link: string }> = [];
  const seen = new Set<string>();
  allData.forEach((p) => {
    const pn = p.product_name_normalized;
    const isMatch = [...groceryNorms].some(
      (g) => g === pn || g.includes(pn) || pn.includes(g)
    );
    if (isMatch && !seen.has(pn)) {
      seen.add(pn);
      matched.push({ product_name: p.product_name, link: p.link });
    }
  });
  return matched;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateAge(dateOfBirth: string): number | string {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function escapeHtml(str: string): string {
  return str.replace(/\n/g, '<br/>');
}

// ---------------------------------------------------------------------------
// HTML builder — shared by both download and auto-publish PDF flows
// ---------------------------------------------------------------------------

export function buildDietPlanHtml(
  plan: any,
  recipes: Array<{ Meal_name: string; Ingredients: string; Instructions: string; Remarks: string }> = [],
  affiliateProducts: Array<{ product_name: string; link: string }> = [],
): string {
  const isAI = plan.is_ai_generated && plan.ai_plan_data;
  const clientDetails = {
    name: plan.clients?.name || 'Client',
    age: plan.clients?.date_of_birth ? calculateAge(plan.clients.date_of_birth) : '--',
    gender: plan.clients?.gender || 'Not specified',
    height: plan.clients?.height || '--',
    weight: plan.clients?.weight || '--',
    skinType: plan.clients?.skin_type || 'Not specified',
    hairType: plan.clients?.hair_type || 'Not specified',
    goal: plan.clients?.goal || 'Not specified',
    dietPreference: plan.clients?.diet_preference || 'Not specified',
    healthConditions: (plan.clients?.health_conditions as string[]) || [],
    notes: plan.clients?.notes || '',
  };

  if (isAI) {
    const aiData = plan.ai_plan_data as any;

    return `<!DOCTYPE html>
<html>
<head>
  <title>${aiData.planName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px 35px; color: #334155; font-size: 11px; line-height: 1.4; }
    .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #00a896; padding-bottom: 15px; }
    .header h1 { color: #00a896; font-size: 20px; margin-bottom: 5px; }
    .header p { color: #64748b; font-size: 12px; }
    .week-badge { display: inline-block; background: #00a896; color: white; padding: 3px 8px; border-radius: 12px; font-size: 10px; margin-left: 10px; }
    .client-details { background: #f0fdff; border: 1px solid #b3e5e0; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
    .client-details h3 { color: #0d7477; font-size: 14px; margin-bottom: 10px; }
    .client-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .client-details-grid span { font-weight: bold; color: #475569; }
    .health-conditions { margin-top: 10px; }
    .health-conditions h4 { font-size: 10px; margin-bottom: 5px; color: #475569; }
    .condition-badge { display: inline-block; background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 10px; font-size: 9px; margin-right: 4px; margin-bottom: 4px; }
    .client-notes { margin-top: 10px; }
    .client-notes h4 { font-size: 10px; margin-bottom: 5px; color: #475569; }
    .intro { background: #f0fdff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #00a896; }
    .intro p { margin: 0; font-style: italic; }
    .section-title { color: #00a896; font-size: 16px; font-weight: bold; margin: 25px 0 15px 0; border-bottom: 1px solid #b3e5e0; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
    th { background: #00a896; color: white; padding: 8px; text-align: left; font-weight: bold; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) { background: #f8fafc; }
    .affirmations { background: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #00a896; }
    .affirmations h3 { color: #00a896; font-size: 14px; margin-bottom: 10px; }
    .affirmations ul { margin-left: 20px; }
    .affirmations li { margin-bottom: 5px; }
    .important-notes { background: #fefce8; border: 1px solid #fde047; border-radius: 5px; padding: 15px; margin-bottom: 20px; }
    .important-notes h4 { color: #a16207; font-size: 12px; margin-bottom: 10px; }
    .important-notes ul { margin-left: 15px; }
    .important-notes li { margin-bottom: 5px; font-size: 10px; }
    .tips-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
    .tip-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 10px; }
    .tip-card h4 { font-size: 11px; margin-bottom: 5px; color: #334155; }
    .tip-card p { font-size: 9px; margin: 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #64748b; }
    @media print { body { padding: 15px; } .header { margin-bottom: 15px; } .section-title { margin: 20px 0 10px 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${aiData.planName}</h1>
    <p>Personalized Diet Plan for ${clientDetails.name}
      <span class="week-badge">Week ${plan.week_number || '--'}</span>
    </p>
  </div>

  <div class="client-details">
    <h3>📋 Client Details</h3>
    <div class="client-details-grid">
      <div><span>Name:</span> ${clientDetails.name}</div>
      <div><span>Age:</span> ${clientDetails.age} years</div>
      <div><span>Gender:</span> ${clientDetails.gender}</div>
      <div><span>Height/Weight:</span> ${clientDetails.height}cm / ${clientDetails.weight}kg</div>
      <div><span>Skin Type:</span> ${clientDetails.skinType}</div>
      <div><span>Hair Type:</span> ${clientDetails.hairType}</div>
      <div><span>Goal:</span> ${clientDetails.goal}</div>
      <div><span>Diet Preference:</span> ${clientDetails.dietPreference}</div>
    </div>
    ${clientDetails.healthConditions.length > 0 ? `
    <div class="health-conditions">
      <h4>Health Conditions:</h4>
      ${clientDetails.healthConditions.map((c: string) => `<span class="condition-badge">${c}</span>`).join('')}
    </div>` : ''}
    ${clientDetails.notes ? `
    <div class="client-notes">
      <h4>Notes:</h4>
      <p>${clientDetails.notes}</p>
    </div>` : ''}
  </div>

  <div class="intro">
    <p>${escapeHtml(aiData.introMessage || '')}</p>
  </div>

  ${(aiData.affirmations?.length ?? 0) > 0 ? `
  <div class="affirmations">
    <h3>Positive Affirmations for ${clientDetails.name}:</h3>
    <ul>
      ${(aiData.affirmations as string[]).map((a) => `<li>${a}</li>`).join('')}
    </ul>
  </div>` : ''}

  ${(aiData.dayGroups ?? []).map((group: any) => `
    <h3 class="section-title">📅 ${group.label}${group.dates ? ` <span style="font-size:12px;color:#666;font-weight:normal;">(${group.dates})</span>` : ''}</h3>
    <table>
      <thead>
        <tr>
          <th style="width:13%;">Period</th>
          <th style="width:8%;">Time</th>
          <th style="width:32%;">Food Plan</th>
          <th style="width:28%;">Alternative</th>
          <th style="width:14%;">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${(group.meals ?? []).map((meal: any) => `
          <tr>
            <td>${meal.period || '-'}</td>
            <td>${meal.time || '-'}</td>
            <td>${meal.foodPlan || '-'}</td>
            <td>${meal.alternative || '-'}</td>
            <td>${meal.notes || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `).join('')}

  <h3 class="section-title">Additional Guidelines</h3>

  <div class="important-notes" style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:15px;margin-bottom:20px;">
    <strong>Serving Size:</strong> ${aiData.servingSize || '1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml'}
  </div>

  ${aiData.oilGuidelines ? `
  <div>
    <h4 style="font-size:11px;color:#333;margin-bottom:6px;">Use of Oils:</h4>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px;">
      <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px;">
        <h4 style="font-size:10px;margin-bottom:5px;">Cooking - Group A</h4>
        <ul style="list-style:none;padding:0;margin:0;font-size:9px;">${((aiData.oilGuidelines.cooking?.groupA ?? []) as string[]).map((o) => `<li>- ${o}</li>`).join('')}</ul>
      </div>
      <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px;">
        <h4 style="font-size:10px;margin-bottom:5px;">Cooking - Group B</h4>
        <ul style="list-style:none;padding:0;margin:0;font-size:9px;">${((aiData.oilGuidelines.cooking?.groupB ?? []) as string[]).map((o) => `<li>- ${o}</li>`).join('')}</ul>
      </div>
      <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px;">
        <h4 style="font-size:10px;margin-bottom:5px;">Raw/Topping</h4>
        <ul style="list-style:none;padding:0;margin:0;font-size:9px;">${((aiData.oilGuidelines.raw ?? []) as string[]).map((o) => `<li>- ${o}</li>`).join('')}</ul>
      </div>
      <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px;">
        <h4 style="font-size:10px;margin-bottom:5px;">Deep Frying</h4>
        <ul style="list-style:none;padding:0;margin:0;font-size:9px;">${((aiData.oilGuidelines.deepFrying ?? []) as string[]).map((o) => `<li>- ${o}</li>`).join('')}</ul>
      </div>
    </div>
    <p style="font-size:9px;color:#666;font-style:italic;margin:0;">${aiData.oilGuidelines.note || ''}</p>
  </div>` : ''}

  ${(aiData.importantNotes?.length ?? 0) > 0 ? `
  <div class="important-notes">
    <h4>⚠️ Important Notes:</h4>
    <ul>
      ${(aiData.importantNotes as string[]).map((n) => `<li>${n}</li>`).join('')}
    </ul>
  </div>` : ''}

  <div class="tips-grid">
    ${aiData.skinCareTips ? `<div class="tip-card"><h4>🌸 Skin Care Tips</h4><p>${aiData.skinCareTips}</p></div>` : ''}
    ${aiData.hairCareTips ? `<div class="tip-card"><h4>💇 Hair Care Tips</h4><p>${aiData.hairCareTips}</p></div>` : ''}
    ${aiData.healthNotes ? `<div class="tip-card"><h4>🏥 Health Notes</h4><p>${aiData.healthNotes}</p></div>` : ''}
    <div class="tip-card"><h4>💊 Recommended Supplements</h4><p>${aiData.supplements || 'No supplements specified'}</p></div>
  </div>

  ${(aiData.weeklyGroceryList?.length ?? 0) > 0 ? `
  <div class="important-notes" style="background:#f0f7ff;border:1px solid #b3d1ff;border-radius:8px;padding:15px;margin-bottom:20px;">
    <h4 style="color:#1a5fb4;font-size:14px;margin-bottom:10px;">🛍️ Weekly Grocery List</h4>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      ${(aiData.weeklyGroceryList as any[]).map((cat) => `
        <div style="background:white;border:1px solid #dee2e6;border-radius:5px;padding:10px;">
          <h4 style="font-size:11px;margin-bottom:5px;color:#1a5fb4;">${cat.category}</h4>
          <ul style="margin:0;padding-left:15px;font-size:9px;">
            ${(cat.items as string[]).map((item) => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  </div>` : ''}

  ${aiData.disclaimer ? `
  <div class="important-notes">
    <p><strong>Disclaimer:</strong> ${aiData.disclaimer}</p>
  </div>` : ''}

  ${recipes.length > 0 ? `
  <div style="page-break-before: always; margin-top: 24px;">
    <h2 style="color: #5a7a32; font-size: 18px; border-bottom: 2px solid #5a7a32; padding-bottom: 6px; margin-bottom: 14px;">Recipes for mentioned meals</h2>
    ${recipes.map(r => `
      <div style="margin-bottom: 16px; page-break-inside: avoid;">
        <h3 style="color: #1a5fb4; font-size: 13px; margin-bottom: 6px;">${r.Meal_name}</h3>
        ${r.Ingredients ? `<div style="font-size: 11px; line-height: 1.5; color: #333; margin-bottom: 6px;"><strong>Ingredients:</strong><br/><span style="white-space: pre-wrap;">${r.Ingredients}</span></div>` : ''}
        <div style="font-size: 11px; line-height: 1.5; color: #333; margin-bottom: 6px;"><strong>Instructions:</strong><br/><span style="white-space: pre-wrap;">${r.Instructions}</span></div>
        ${r.Remarks ? `<div style="font-size: 11px; line-height: 1.5; color: #555;"><strong>Remarks:</strong><br/><span style="white-space: pre-wrap;">${r.Remarks}</span></div>` : ''}
      </div>
    `).join('')}
  </div>` : ''}

  ${affiliateProducts.length > 0 ? `
  <div style="margin-top: 24px; page-break-inside: avoid;">
    <h2 style="color: #b45309; font-size: 16px; border-bottom: 2px solid #f59e0b; padding-bottom: 6px; margin-bottom: 12px;">🛒 Shop Recommended Products</h2>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr>
          <th style="background:#f59e0b;color:white;padding:7px 10px;text-align:left;width:40%;">Product</th>
          <th style="background:#f59e0b;color:white;padding:7px 10px;text-align:left;">Buy Link</th>
        </tr>
      </thead>
      <tbody>
        ${affiliateProducts.map((p, i) => `
          <tr style="background:${i % 2 === 0 ? '#fffbeb' : '#ffffff'};">
            <td style="padding:7px 10px;border-bottom:1px solid #fde68a;font-weight:500;">${p.product_name}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #fde68a;">
              <a href="${p.link}" style="color:#b45309;text-decoration:underline;word-break:break-all;">${p.link}</a>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    <p>© ${new Date().getFullYear()} Dr. Malika Kabra Rathi - Personalized Nutrition Plan</p>
  </div>
</body>
</html>`;
  }

  // Structured plan (diet_plan_days)
  const days = ((plan.diet_plan_days ?? []) as any[]).sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  return `<!DOCTYPE html>
<html>
<head>
  <title>${plan.plan_name || 'Diet Plan'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; padding: 25px 35px; color: #334155; font-size: 11px; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #00a896; padding-bottom: 15px; }
    .header h1 { color: #00a896; font-size: 18px; }
    .header p { color: #64748b; font-size: 12px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
    th { background: #00a896; color: white; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { text-align: center; margin-top: 25px; font-size: 9px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${plan.plan_name || 'Diet Plan'}</h1>
    <p>Client: ${clientDetails.name}</p>
    ${plan.instructions ? `<p style="margin-top:6px;font-style:italic;">${plan.instructions}</p>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>Day</th><th>Breakfast</th><th>Lunch</th><th>Snacks</th><th>Dinner</th><th>Calories</th>
      </tr>
    </thead>
    <tbody>
      ${days.map((d: any) => `
        <tr>
          <td>${d.day_label}</td>
          <td>${d.breakfast_option?.name || '-'}</td>
          <td>${d.lunch_option?.name || '-'}</td>
          <td>${d.snacks_option?.name || '-'}</td>
          <td>${d.dinner_option?.name || '-'}</td>
          <td>${d.total_calories || 0} kcal</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">© ${new Date().getFullYear()} Dr. Malika Kabra Rathi - Personalized Nutrition Plan</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Rich HTML builder — matches the AIDietPlanGenerator "Download PDF" format
// (green #5a7a32 theme, MKR logo, full client details grid)
// ---------------------------------------------------------------------------

function buildRichAIPlanHtml(
  aiData: any,
  client: any,
  planMeta: { planName: string; weekLabel: string; dateRange: string; duration: string },
  recipes: Array<{ Meal_name: string; Ingredients: string; Instructions: string; Remarks: string }>,
  affiliateProducts: Array<{ product_name: string; link: string }>,
  logoDataUrl: string,
): string {
  const esc = (s: string) => (s || '').replace(/\n/g, '<br/>');
  const escapePlain = (s: string) =>
    (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const healthConditions: string[] = Array.isArray(client?.health_conditions)
    ? client.health_conditions
    : client?.health_conditions
    ? [client.health_conditions]
    : [];

  const age = (() => {
    if (!client?.date_of_birth) return '--';
    const dob = new Date(client.date_of_birth);
    const today = new Date();
    let a = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
    return a;
  })();

  const dayGroupTables = ((aiData.dayGroups ?? []) as any[]).map((group: any) => `
    <h3 style="font-size:14px;color:#5a7a32;font-weight:700;margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid #d4e4bc;">
      ${group.label ?? ''}${group.dates ? ` <span style="font-size:12px;color:#666;font-weight:normal;">(${group.dates})</span>` : ''}
    </h3>
    <table>
      <thead><tr>
        <th style="width:13%">Period</th><th style="width:8%">Time</th>
        <th style="width:34%">Food Plan</th><th style="width:30%">Alternative</th>
        <th style="width:15%">Notes</th>
      </tr></thead>
      <tbody>
        ${((group.meals ?? []) as any[]).map((m: any) => `
          <tr>
            <td>${m.period ?? '-'}</td><td>${m.time ?? '-'}</td>
            <td>${esc(m.foodPlan ?? '-')}</td>
            <td style="color:#666;font-style:italic">${esc(m.alternative ?? '-')}</td>
            <td>${esc(m.notes ?? '-')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`).join('');

  const recipesHtml = recipes.length === 0 ? '' : `
    <div style="page-break-before:always;margin-top:24px">
      <h2 style="color:#5a7a32;font-size:18px;border-bottom:2px solid #5a7a32;padding-bottom:6px;margin-bottom:14px">Recipes for mentioned meals</h2>
      ${recipes.map(r => `
        <div style="margin-bottom:16px;page-break-inside:avoid">
          <h3 style="color:#1a5fb4;font-size:13px;margin-bottom:6px">${escapePlain(r.Meal_name)}</h3>
          ${r.Ingredients ? `<div style="font-size:11px;line-height:1.5;color:#333;margin-bottom:6px"><strong>Ingredients:</strong><br/><span style="white-space:pre-wrap">${escapePlain(r.Ingredients)}</span></div>` : ''}
          <div style="font-size:11px;line-height:1.5;color:#333;margin-bottom:6px"><strong>Instructions:</strong><br/><span style="white-space:pre-wrap">${escapePlain(r.Instructions)}</span></div>
          ${r.Remarks ? `<div style="font-size:11px;line-height:1.5;color:#555"><strong>Remarks:</strong><br/><span style="white-space:pre-wrap">${escapePlain(r.Remarks)}</span></div>` : ''}
        </div>`).join('')}
    </div>`;

  const affiliateHtml = affiliateProducts.length === 0 ? '' : `
    <div style="margin-top:24px;page-break-inside:avoid">
      <h2 style="color:#b45309;font-size:16px;border-bottom:2px solid #f59e0b;padding-bottom:6px;margin-bottom:12px">🛒 Shop Recommended Products</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr>
          <th style="background:#f59e0b;color:white;padding:7px 10px;text-align:left;width:40%">Product</th>
          <th style="background:#f59e0b;color:white;padding:7px 10px;text-align:left">Buy Link</th>
        </tr></thead>
        <tbody>
          ${affiliateProducts.map((p, i) => `
            <tr style="background:${i % 2 === 0 ? '#fffbeb' : '#ffffff'}">
              <td style="padding:7px 10px;border-bottom:1px solid #fde68a;font-weight:500">${p.product_name}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #fde68a">
                <a href="${p.link}" style="color:#b45309;text-decoration:underline;word-break:break-all">${p.link}</a>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${planMeta.planName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;padding:25px 35px;color:#333;font-size:11px;line-height:1.4}
    .header{text-align:center;margin-bottom:25px;border-bottom:2px solid #5a7a32;padding-bottom:15px}
    .header img{width:80px;height:auto;margin-bottom:10px}
    .header h1{color:#5a7a32;font-size:20px;margin-bottom:5px}
    .header p{color:#666;font-size:12px}
    .week-badge{display:inline-block;background:#5a7a32;color:white;padding:3px 8px;border-radius:12px;font-size:10px;margin-left:10px}
    .client-details{background:#f0f7ff;border:1px solid #b3d1ff;border-radius:8px;padding:15px;margin-bottom:20px}
    .client-details h3{color:#1a5fb4;font-size:14px;margin-bottom:10px}
    .client-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:10px}
    .client-grid div{margin-bottom:5px}
    .client-grid span{font-weight:bold;color:#555}
    .condition-badge{display:inline-block;background:#e3f2fd;color:#1976d2;padding:2px 6px;border-radius:10px;font-size:9px;margin-right:4px;margin-bottom:4px}
    .intro{background:#f9f9f9;padding:15px;border-radius:8px;margin-bottom:20px;border-left:4px solid #5a7a32}
    .affirmations{background:#fef9e7;padding:15px;border-radius:8px;margin-bottom:20px;border-left:4px solid #f39c12}
    .affirmations h3{color:#f39c12;font-size:14px;margin-bottom:10px}
    .affirmations ul{margin-left:20px}
    .affirmations li{margin-bottom:5px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10px}
    th{background:#5a7a32;color:white;padding:8px;text-align:left;font-weight:bold}
    td{padding:8px;border-bottom:1px solid #ddd;vertical-align:top}
    tr:nth-child(even){background:#f9f9f9}
    .serving{background:#e8f5e8;padding:10px;border-radius:5px;margin-bottom:15px;font-size:10px}
    .oil-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px}
    .oil-card{background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px}
    .oil-card h4{font-size:11px;margin-bottom:5px;color:#495057}
    .oil-card ul{list-style:none;padding:0;margin:0}
    .oil-card li{font-size:9px;margin-bottom:2px}
    .notes-box{background:#fff3cd;border:1px solid #ffeaa7;border-radius:5px;padding:15px;margin-bottom:20px}
    .notes-box h4{color:#856404;font-size:12px;margin-bottom:10px}
    .notes-box ul{margin-left:15px}
    .notes-box li{margin-bottom:5px;font-size:10px}
    .grocery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
    .grocery-card{background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px}
    .grocery-card h4{font-size:11px;margin-bottom:5px;color:#495057}
    .grocery-card ul{list-style:none;padding:0;margin:0}
    .grocery-card li{font-size:9px;margin-bottom:2px}
    .tips-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
    .tip-card{background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px}
    .tip-card h4{font-size:11px;margin-bottom:5px;color:#495057}
    .tip-card p{font-size:9px;margin:0}
    .section-title{color:#5a7a32;font-size:16px;font-weight:bold;margin:25px 0 15px;border-bottom:1px solid #d4e4bc;padding-bottom:5px}
    .disclaimer{background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px;margin-top:20px;font-size:9px;font-style:italic;color:#6c757d}
    .footer{text-align:center;margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:9px;color:#999}
    @media print{body{padding:15px}}
  </style>
</head>
<body>
  <div class="header">
    ${logoDataUrl ? `<img src="${logoDataUrl}" alt="MKR Logo"/>` : ''}
    <h1>${aiData.planName ?? planMeta.planName}</h1>
    <p>Personalized Diet Plan for ${client?.name ?? 'Client'}
      <span class="week-badge">${planMeta.weekLabel}</span>
    </p>
  </div>

  <div class="client-details">
    <h3>📋 Client Details</h3>
    <div class="client-grid">
      <div><span>Name:</span> ${client?.name ?? '--'}</div>
      <div><span>Age:</span> ${age} years</div>
      <div><span>Gender:</span> ${client?.gender ?? 'Not specified'}</div>
      <div><span>Height/Weight:</span> ${client?.height ?? '--'}cm / ${client?.weight ?? '--'}kg</div>
      <div><span>Skin Type:</span> ${client?.skin_type ?? 'Not specified'}</div>
      <div><span>Hair Type:</span> ${client?.hair_type ?? 'Not specified'}</div>
      <div><span>Goal:</span> ${client?.goal ?? 'Not specified'}</div>
      <div><span>Diet Preference:</span> ${client?.diet_preference ?? 'Not specified'}</div>
      <div><span>Date:</span> ${planMeta.dateRange}</div>
      <div><span>Duration:</span> ${planMeta.duration} days</div>
    </div>
    ${healthConditions.length > 0 ? `
    <div style="margin-top:10px">
      <h4 style="font-size:10px;margin-bottom:5px;color:#555">Health Conditions:</h4>
      ${healthConditions.map((c: string) => `<span class="condition-badge">${c}</span>`).join('')}
    </div>` : ''}
    ${client?.notes ? `<div style="margin-top:10px;font-size:10px"><strong>Notes:</strong> ${client.notes}</div>` : ''}
  </div>

  ${aiData.introMessage ? `<div class="intro"><p>${esc(aiData.introMessage)}</p></div>` : ''}

  ${(aiData.affirmations?.length ?? 0) > 0 ? `
  <div class="affirmations">
    <h3>Positive Affirmations for ${client?.name ?? 'Client'}:</h3>
    <ul>${(aiData.affirmations as string[]).map(a => `<li>${a}</li>`).join('')}</ul>
  </div>` : ''}

  ${dayGroupTables}

  <h3 class="section-title">Additional Guidelines</h3>
  <div class="serving"><strong>Serving Size:</strong> ${aiData.servingSize ?? '1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml'}</div>

  ${aiData.oilGuidelines ? `
  <div>
    <h4 style="font-size:11px;color:#333;margin-bottom:6px">Use of Oils:</h4>
    <div class="oil-grid">
      <div class="oil-card"><h4>Cooking - Group A</h4><ul>${((aiData.oilGuidelines.cooking?.groupA ?? []) as string[]).map(o => `<li>- ${o}</li>`).join('')}</ul></div>
      <div class="oil-card"><h4>Cooking - Group B</h4><ul>${((aiData.oilGuidelines.cooking?.groupB ?? []) as string[]).map(o => `<li>- ${o}</li>`).join('')}</ul></div>
      <div class="oil-card"><h4>Raw/Topping</h4><ul>${((aiData.oilGuidelines.raw ?? []) as string[]).map(o => `<li>- ${o}</li>`).join('')}</ul></div>
      <div class="oil-card"><h4>Deep Frying</h4><ul>${((aiData.oilGuidelines.deepFrying ?? []) as string[]).map(o => `<li>- ${o}</li>`).join('')}</ul></div>
    </div>
    <p style="font-style:italic;font-size:9px;color:#6c757d;margin:0">${aiData.oilGuidelines.note ?? ''}</p>
  </div>` : ''}

  ${(aiData.importantNotes?.length ?? 0) > 0 ? `
  <div class="notes-box">
    <h4>⚠️ Important Notes:</h4>
    <ul style="padding-left:15px">${(aiData.importantNotes as string[]).map(n => `<li>${n}</li>`).join('')}</ul>
  </div>` : ''}

  ${(aiData.weeklyGroceryList?.length ?? 0) > 0 ? `
  <h3 class="section-title">🛒 Weekly Grocery List</h3>
  <div class="grocery-grid">
    ${(aiData.weeklyGroceryList as any[]).map((cat: any) => `
      <div class="grocery-card">
        <h4>${cat.category}</h4>
        <ul>${(cat.items as string[]).map(item => `<li>${item}</li>`).join('')}</ul>
      </div>`).join('')}
  </div>` : ''}

  <div class="tips-grid">
    ${aiData.skinCareTips ? `<div class="tip-card"><h4>✨ Skin Care Tips</h4><p>${aiData.skinCareTips}</p></div>` : ''}
    ${aiData.hairCareTips ? `<div class="tip-card"><h4>💇 Hair Care Tips</h4><p>${aiData.hairCareTips}</p></div>` : ''}
    ${aiData.healthNotes ? `<div class="tip-card"><h4>🏥 Health Notes</h4><p>${aiData.healthNotes}</p></div>` : ''}
    <div class="tip-card"><h4>💊 Recommended Supplements</h4><p>${aiData.supplements ?? 'No supplements specified'}</p></div>
  </div>

  ${aiData.disclaimer ? `<div class="disclaimer"><strong>Disclaimer:</strong> ${aiData.disclaimer}</div>` : ''}

  ${recipesHtml}
  ${affiliateHtml}

  <div class="footer">© ${new Date().getFullYear()} Dr. Malika Kabra Rathi. This nutrition plan is personalized and should be followed as advised.</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Opens the plan in a new tab for browser print / Save as PDF
// ---------------------------------------------------------------------------

export async function openDietPlanForPrint(plan: any): Promise<void> {
  const isAI = plan.is_ai_generated && plan.ai_plan_data;

  if (!isAI) {
    // Non-AI structured plan — use the simple table layout
    const html = buildDietPlanHtml(plan);
    if (!html) return;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    return;
  }

  // Fetch logo, recipes and affiliate products in parallel
  const [logoDataUrl, recipes, affiliateProducts] = await Promise.all([
    (async () => {
      try {
        const res = await fetch('/MKR Logo.webp');
        const blob = await res.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch { return ''; }
    })(),
    fetchRecipesForAIPlan(plan.ai_plan_data),
    fetchAffiliateProductsForPlan(plan.ai_plan_data),
  ]);

  // Compute date range from plan metadata
  const aiData = plan.ai_plan_data;
  const startDateStr = aiData.editableStartDate ?? plan.start_date ?? aiData.startDate ?? '';
  const dayCount = parseInt(aiData.editableDayCount ?? '7') || 7;
  let dateRange = 'Not specified';
  if (startDateStr) {
    try {
      const start = new Date(startDateStr);
      const end = new Date(start);
      end.setDate(start.getDate() + dayCount - 1);
      const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      dateRange = `${fmt(start)} to ${fmt(end)}`;
    } catch { /* leave as Not specified */ }
  }

  const client = plan.clients ?? {};
  const planMeta = {
    planName: aiData.planName ?? plan.plan_name ?? 'Diet Plan',
    weekLabel: plan.plan_name ?? aiData.planName ?? 'Diet Plan',
    dateRange,
    duration: String(dayCount),
  };

  const html = buildRichAIPlanHtml(aiData, client, planMeta, recipes, affiliateProducts, logoDataUrl);
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

// ---------------------------------------------------------------------------
// Renders the plan HTML off-screen, captures it with html2canvas, and
// returns a jsPDF Blob ready for Supabase storage upload.
// ---------------------------------------------------------------------------

export async function generateDietPlanPdfBlob(plan: any): Promise<Blob | null> {
  const html = buildDietPlanHtml(plan);
  if (!html) return null;

  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;background:white;z-index:-1;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      width: 794,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / pageW;
    const totalPdfH = canvas.height / ratio;

    let yOffset = 0;
    let firstPage = true;
    while (yOffset < totalPdfH) {
      if (!firstPage) pdf.addPage();
      firstPage = false;

      const sliceH = Math.min(pageH, totalPdfH - yOffset) * ratio;
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(
        canvas,
        0, yOffset * ratio,
        canvas.width, sliceH,
        0, 0,
        canvas.width, sliceH,
      );
      pdf.addImage(
        sliceCanvas.toDataURL('image/jpeg', 0.92),
        'JPEG',
        0, 0,
        pageW, sliceH / ratio,
      );
      yOffset += pageH;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}
