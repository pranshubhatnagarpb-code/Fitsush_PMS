// Blood report parser — calls the Supabase edge function `extract-blood-report`
// which uses OpenAI Vision API server-side to extract real values from the uploaded report.
//
// The edge function handles one file at a time. For multiple files, we call it once
// per file and merge results — first non-null value for each marker wins.
// Missing values come back as null and are NEVER substituted with defaults.
import { supabase } from '@/integrations/supabase/client';
import { BLOOD_MARKERS, BloodMarkerKey } from './bloodMarkers';

export type ExtractedValues = Partial<Record<BloodMarkerKey, number>>;

export interface ExtractedMarker {
  value: number | null;
  unit: string | null;
  reference_range: string | null;
  status: 'low' | 'normal' | 'high' | null;
}

export interface ExtractionResult {
  values: ExtractedValues;
  markers: Partial<Record<BloodMarkerKey, ExtractedMarker>>;
  reportDate: string | null;
  labName: string | null;
  notes: string | null;
  warnings: string[];
}

const emptyResult = (warnings: string[]): ExtractionResult => ({
  values: {},
  markers: {},
  reportDate: null,
  labName: null,
  notes: null,
  warnings,
});

async function extractSingleFile(file: File): Promise<ExtractionResult> {
  const formData = new FormData();
  formData.append('file', file);

  const { data, error } = await supabase.functions.invoke('extract-blood-report', {
    body: formData,
  });

  if (error) throw new Error(error.message || 'Extraction request failed');
  if (!data) return emptyResult(['Empty response from extraction service.']);
  if ((data as any).error) throw new Error((data as any).error);

  const markersRaw = ((data as any).markers || {}) as Record<string, ExtractedMarker>;
  const values: ExtractedValues = {};
  const markers: Partial<Record<BloodMarkerKey, ExtractedMarker>> = {};

  for (const m of BLOOD_MARKERS) {
    const entry = markersRaw[m.key];
    if (!entry) continue;
    markers[m.key] = entry;
    if (typeof entry.value === 'number' && Number.isFinite(entry.value)) {
      values[m.key] = entry.value;
    }
  }

  return {
    values,
    markers,
    reportDate: (data as any).reportDate ?? null,
    labName: (data as any).labName ?? null,
    notes: (data as any).notes ?? null,
    warnings: Array.isArray((data as any).warnings) ? (data as any).warnings : [],
  };
}

export const extractFromFile = async (file: File): Promise<ExtractionResult> => {
  return extractFromFiles([file]);
};

export const extractFromFiles = async (files: File[]): Promise<ExtractionResult> => {
  for (const file of files) {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      return emptyResult([`Unsupported file type: ${file.name}. Please upload PDF or image files only.`]);
    }
  }

  // Call the edge function once per file and merge — first non-null value for each marker wins.
  const merged: ExtractionResult = emptyResult([]);
  for (const file of files) {
    const result = await extractSingleFile(file);
    merged.warnings.push(...result.warnings);
    if (!merged.reportDate && result.reportDate) merged.reportDate = result.reportDate;
    if (!merged.labName && result.labName) merged.labName = result.labName;
    if (!merged.notes && result.notes) merged.notes = result.notes;
    for (const key of Object.keys(result.values) as BloodMarkerKey[]) {
      if (merged.values[key] == null) {
        merged.values[key] = result.values[key];
        if (result.markers[key]) merged.markers[key] = result.markers[key];
      }
    }
  }

  if (Object.keys(merged.values).length === 0 && merged.warnings.length === 0) {
    merged.warnings.push('No biomarker values were detected. Please review and enter them manually.');
  }

  return merged;
};
