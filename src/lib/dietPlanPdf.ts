import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

export function buildDietPlanHtml(plan: any): string {
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
// Opens the plan in a new tab for browser print / Save as PDF
// ---------------------------------------------------------------------------

export function openDietPlanForPrint(plan: any): void {
  const html = buildDietPlanHtml(plan);
  if (!html) return;
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.print();
  }
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
