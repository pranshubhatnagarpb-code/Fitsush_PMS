// Diet template importer — calls the Supabase edge function `import-diet-template`
// which uses OpenAI server-side to turn an old, client-specific diet chart PDF/image
// into a reusable Diet Chart Template shape (see useDietChartTemplates.ts).
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { TemplateDay, TemplateSupplement } from '@/hooks/useDietChartTemplates';

// supabase-js's FunctionsHttpError.message is just "Edge Function returned a
// non-2xx status code" — the actual { error: "..." } body our function sends
// back is only reachable via error.context, the raw Response. Without this,
// every failure (bad file, missing secret, OpenAI down) looks identical to
// the user.
async function describeFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error as string;
    } catch {
      // context wasn't JSON — fall through to the generic message below.
    }
  }
  return error instanceof Error ? error.message : 'Import request failed';
}

export interface ImportedTemplate {
  name: string;
  category: string;
  description: string;
  instructions: string;
  days: TemplateDay[];
  supplements: TemplateSupplement[];
  warnings: string[];
}

export const importTemplateFromFile = async (file: File): Promise<ImportedTemplate> => {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    throw new Error(`Unsupported file type: ${file.name}. Please upload a PDF or image file.`);
  }

  const formData = new FormData();
  formData.append('file', file);

  const { data, error } = await supabase.functions.invoke('import-diet-template', {
    body: formData,
  });

  if (error) throw new Error(await describeFunctionError(error));
  if (!data) throw new Error('Empty response from import service.');
  if ((data as any).error) throw new Error((data as any).error);

  return {
    name: (data as any).name ?? '',
    category: (data as any).category ?? 'General Wellness',
    description: (data as any).description ?? '',
    instructions: (data as any).instructions ?? '',
    days: Array.isArray((data as any).days) ? (data as any).days : [],
    supplements: Array.isArray((data as any).supplements) ? (data as any).supplements : [],
    warnings: Array.isArray((data as any).warnings) ? (data as any).warnings : [],
  };
};
