// Blood marker definitions: labels, units, reference ranges.
// Reference ranges are general adult guidelines used only for low/normal/high flagging in the UI.

export type BloodMarkerKey =
  | 'fasting_blood_sugar'
  | 'insulin_fasting'
  | 'total_cholesterol'
  | 'triglycerides'
  | 'vitamin_b12'
  | 'homocysteine'
  | 'ggt'
  | 'urea'
  | 'tsh'
  | 'cortisol'
  | 'postprandial_blood_sugar'
  | 'insulin_post_prandial'
  | 'ldl'
  | 'hemoglobin'
  | 'vitamin_d'
  | 'sgot'
  | 'alp'
  | 'creatinine'
  | 't3'
  | 'fsh'
  | 'lh'
  | 'estrogen'
  | 'progesterone'
  | 'prolactin'
  | 'hba1c'
  | 'homo_ir'
  | 'hdl'
  | 'ferritin'
  | 'esr'
  | 'sgpt'
  | 'bilirubin'
  | 'uric_acid'
  | 't4'
  | 'testosterone'
  | 'vldl'
  | 'iron'
  | 'calcium';

export interface BloodMarkerDef {
  key: BloodMarkerKey;
  label: string;
  unit: string;
  // null on either side = open-ended
  refLow: number | null;
  refHigh: number | null;
  // Aliases used when extracting from raw text
  aliases: string[];
  group: 'Sugar' | 'Insulin' | 'Lipids' | 'Vitamins' | 'Inflammation' | 'Kidney' | 'Thyroid' | 'Hormones' | 'LFT' | 'CBC' | 'Minerals';
}

export const BLOOD_MARKERS: BloodMarkerDef[] = [
  // Sugar
  { key: 'fasting_blood_sugar', label: 'Fasting Sugar', unit: 'mg/dL', refLow: 70, refHigh: 100, group: 'Sugar', aliases: ['fasting blood sugar', 'fasting glucose', 'fbs', 'glucose fasting', 'fasting sugar'] },
  // Insulin
  { key: 'insulin_fasting', label: 'Insulin(F)', unit: 'µIU/mL', refLow: 2, refHigh: 25, group: 'Insulin', aliases: ['insulin fasting', 'fasting insulin', 'insulin f', 'f insulin', 'insulin f'] },
  // Lipids
  { key: 'total_cholesterol', label: 'Cholesterol', unit: 'mg/dL', refLow: null, refHigh: 200, group: 'Lipids', aliases: ['total cholesterol', 'cholesterol total', 'cholesterol'] },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', refLow: null, refHigh: 150, group: 'Lipids', aliases: ['triglycerides', 'tg'] },
  // Vitamins
  { key: 'vitamin_b12', label: 'B12', unit: 'pg/mL', refLow: 200, refHigh: 900, group: 'Vitamins', aliases: ['vitamin b12', 'b12', 'cobalamin', 'vit b12'] },
  { key: 'homocysteine', label: 'Homocysteine', unit: 'µmol/L', refLow: null, refHigh: 15, group: 'Inflammation', aliases: ['homocysteine', 'hcy'] },
  // Inflammation/Liver
  { key: 'ggt', label: 'GGT', unit: 'U/L', refLow: null, refHigh: 50, group: 'Inflammation', aliases: ['ggt', 'gamma glutamyl transferase', 'gamma gt'] },
  // Kidney
  { key: 'urea', label: 'Urea', unit: 'mg/dL', refLow: 15, refHigh: 45, group: 'Kidney', aliases: ['urea', 'blood urea', 'bun'] },
  // Thyroid
  { key: 'tsh', label: 'TSH', unit: 'µIU/mL', refLow: 0.4, refHigh: 4.5, group: 'Thyroid', aliases: ['tsh', 'thyroid stimulating hormone'] },
  // Hormones
  { key: 'cortisol', label: 'Cortisol', unit: 'µg/dL', refLow: 5, refHigh: 25, group: 'Hormones', aliases: ['cortisol', 'serum cortisol'] },
  { key: 'postprandial_blood_sugar', label: 'PP Sugar', unit: 'mg/dL', refLow: null, refHigh: 140, group: 'Sugar', aliases: ['postprandial', 'pp blood sugar', 'ppbs', 'glucose pp', 'post prandial', 'pp sugar'] },
  { key: 'insulin_post_prandial', label: 'Insulin(PP)', unit: 'µIU/mL', refLow: null, refHigh: 60, group: 'Insulin', aliases: ['insulin post prandial', 'post prandial insulin', 'insulin pp', 'pp insulin'] },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL', refLow: null, refHigh: 100, group: 'Lipids', aliases: ['ldl', 'ldl cholesterol', 'low density'] },
  { key: 'hemoglobin', label: 'Hb', unit: 'g/dL', refLow: 12, refHigh: 17, group: 'CBC', aliases: ['hemoglobin', 'haemoglobin', 'hb', 'hgb'] },
  { key: 'vitamin_d', label: 'Vitamin D', unit: 'ng/mL', refLow: 30, refHigh: 100, group: 'Vitamins', aliases: ['vitamin d', '25-oh vitamin d', '25 hydroxy', 'vit d', '25(oh)d'] },
  // LFT
  { key: 'sgot', label: 'SGOT', unit: 'U/L', refLow: null, refHigh: 40, group: 'LFT', aliases: ['sgot', 'ast', 'aspartate aminotransferase'] },
  { key: 'alp', label: 'ALP', unit: 'U/L', refLow: 20, refHigh: 140, group: 'LFT', aliases: ['alp', 'alkaline phosphatase'] },
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', refLow: 0.6, refHigh: 1.3, group: 'Kidney', aliases: ['creatinine', 'serum creatinine'] },
  // Thyroid
  { key: 't3', label: 'T3', unit: 'ng/mL', refLow: 0.8, refHigh: 2.0, group: 'Thyroid', aliases: ['t3', 'triiodothyronine'] },
  // Hormones
  { key: 'fsh', label: 'FSH', unit: 'mIU/mL', refLow: null, refHigh: null, group: 'Hormones', aliases: ['fsh', 'follicle stimulating hormone'] },
  { key: 'lh', label: 'LH', unit: 'mIU/mL', refLow: null, refHigh: null, group: 'Hormones', aliases: ['lh', 'luteinizing hormone'] },
  { key: 'estrogen', label: 'Estrogen', unit: 'pg/mL', refLow: null, refHigh: null, group: 'Hormones', aliases: ['estrogen', 'estradiol'] },
  { key: 'progesterone', label: 'Progesterone', unit: 'ng/mL', refLow: null, refHigh: null, group: 'Hormones', aliases: ['progesterone'] },
  { key: 'prolactin', label: 'Prolactin', unit: 'ng/mL', refLow: null, refHigh: 25, group: 'Hormones', aliases: ['prolactin', 'prl'] },
  // Sugar
  { key: 'hba1c', label: 'HbA1c', unit: '%', refLow: null, refHigh: 5.7, group: 'Sugar', aliases: ['hba1c', 'hb a1c', 'glycated hemoglobin', 'glycosylated hemoglobin', 'a1c'] },
  { key: 'homo_ir', label: 'HOMA-IR', unit: '', refLow: null, refHigh: 2.5, group: 'Insulin', aliases: ['homo ir', 'homair', 'insulin resistance', 'homa ir'] },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL', refLow: 40, refHigh: null, group: 'Lipids', aliases: ['hdl', 'hdl cholesterol', 'high density'] },
  { key: 'ferritin', label: 'Ferritin', unit: 'ng/mL', refLow: 30, refHigh: 400, group: 'Minerals', aliases: ['ferritin'] },
  { key: 'esr', label: 'ESR', unit: 'mm/hr', refLow: null, refHigh: 20, group: 'Inflammation', aliases: ['esr', 'erythrocyte sedimentation rate', 'sedimentation rate'] },
  // LFT
  { key: 'sgpt', label: 'SGPT', unit: 'U/L', refLow: null, refHigh: 40, group: 'LFT', aliases: ['sgpt', 'alt', 'alanine aminotransferase'] },
  { key: 'bilirubin', label: 'Bilirubin', unit: 'mg/dL', refLow: 0.1, refHigh: 1.2, group: 'LFT', aliases: ['bilirubin', 'total bilirubin'] },
  { key: 'uric_acid', label: 'Uric Acid', unit: 'mg/dL', refLow: 3.4, refHigh: 7.0, group: 'Kidney', aliases: ['uric acid'] },
  // Thyroid
  { key: 't4', label: 'T4', unit: 'µg/dL', refLow: 5, refHigh: 12, group: 'Thyroid', aliases: ['t4', 'thyroxine'] },
  // Hormones
  { key: 'testosterone', label: 'Testosterone', unit: 'ng/dL', refLow: null, refHigh: null, group: 'Hormones', aliases: ['testosterone', 'serum testosterone'] },
  // Other
  { key: 'vldl', label: 'VLDL', unit: 'mg/dL', refLow: null, refHigh: 30, group: 'Lipids', aliases: ['vldl', 'very low density'] },
  { key: 'iron', label: 'Iron', unit: 'µg/dL', refLow: 60, refHigh: 170, group: 'Minerals', aliases: ['iron', 'serum iron'] },
  { key: 'calcium', label: 'Calcium', unit: 'mg/dL', refLow: 8.6, refHigh: 10.3, group: 'Minerals', aliases: ['calcium', 'serum calcium'] },
];

export const BLOOD_MARKER_MAP: Record<BloodMarkerKey, BloodMarkerDef> =
  BLOOD_MARKERS.reduce((acc, m) => { acc[m.key] = m; return acc; }, {} as Record<BloodMarkerKey, BloodMarkerDef>);

export type MarkerStatus = 'low' | 'normal' | 'high' | 'unknown';

export const getMarkerStatus = (key: BloodMarkerKey, value: number | null | undefined): MarkerStatus => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown';
  const def = BLOOD_MARKER_MAP[key];
  if (!def) return 'unknown';
  if (def.refLow !== null && value < def.refLow) return 'low';
  if (def.refHigh !== null && value > def.refHigh) return 'high';
  return 'normal';
};

export const STATUS_BADGE_CLASS: Record<MarkerStatus, string> = {
  low: 'bg-warning/15 text-warning border-warning/30',
  normal: 'bg-success/15 text-success border-success/30',
  high: 'bg-destructive/15 text-destructive border-destructive/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};
