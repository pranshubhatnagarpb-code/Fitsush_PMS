import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import type { PlanKyc, RecipeEdits } from '@/lib/dietPlanHtml';

const OPTIONAL_PLAN_COLUMNS = ['kyc', 'recipe_edits', 'supplements'] as const;
const OPTIONAL_PLAN_COLUMN_LABELS: Record<string, string> = {
  kyc: 'the Client Details (KYC)', recipe_edits: 'the recipe edits', supplements: 'the supplements',
};

const hasRecipeEdits = (e?: RecipeEdits) =>
  !!e && (Object.keys(e.edited ?? {}).length > 0 || (e.removed?.length ?? 0) > 0 || (e.added?.length ?? 0) > 0);

export interface DayMealInput {
  label: string;
  text: string | null;
  option_id: string | null;
}

interface DayPlanInput {
  day_label: string;
  // Every meal time of the day in chart order (incl. ones added by staff).
  meals: DayMealInput[];
  breakfast_option_id: string | null;
  lunch_option_id: string | null;
  snacks_option_id: string | null;
  dinner_option_id: string | null;
  // What the meal reads as: a diet_options name, a meal_recipes name, or free text.
  breakfast_text: string | null;
  lunch_text: string | null;
  snacks_text: string | null;
  dinner_text: string | null;
  total_calories: number;
  notes: string;
  sort_order: number;
}

interface CreateDietPlanInput {
  client_id: string;
  plan_name: string;
  instructions: string;
  supplements?: Array<{ time: string; supplement: string; notes: string }>;
  recipe_edits?: RecipeEdits;
  kyc?: PlanKyc;
  days: DayPlanInput[];
}

export const useCreateDietPlan = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateDietPlanInput) => {
      const row: Record<string, unknown> = {
        client_id: input.client_id,
        plan_name: input.plan_name,
        instructions: input.instructions,
        // Optional columns are only sent when used, each added by its own SQL file:
        // supplements (_db/diet-plans-supplements-column.sql),
        // recipe_edits (_db/diet-plans-recipe-edits-column.sql), kyc (_db/diet-plans-kyc-column.sql).
        ...(input.supplements?.length ? { supplements: input.supplements as unknown as Json } : {}),
        ...(hasRecipeEdits(input.recipe_edits) ? { recipe_edits: input.recipe_edits as unknown as Json } : {}),
        ...(input.kyc ? { kyc: input.kyc as unknown as Json } : {}),
        status: 'active',
      };
      const insertPlan = () => supabase.from('diet_plans').insert(row as any).select().single();

      // If one of those columns hasn't been added to the database yet, save the
      // plan without it rather than failing, and say what was left out.
      let { data: plan, error: planError } = await insertPlan();
      const skipped: string[] = [];
      for (let tries = 0; planError && tries < OPTIONAL_PLAN_COLUMNS.length; tries++) {
        const missing = OPTIONAL_PLAN_COLUMNS.find((c) => c in row && planError!.message?.includes(`'${c}'`));
        if (!missing) break;
        delete row[missing];
        skipped.push(missing);
        ({ data: plan, error: planError } = await insertPlan());
      }

      if (planError) throw planError;
      if (skipped.length) {
        toast.warning(`Plan saved without ${skipped.map((c) => OPTIONAL_PLAN_COLUMN_LABELS[c]).join(' and ')}`, {
          description: `The database is missing diet_plans.${skipped.join(', diet_plans.')}. Run ${skipped.map((c) => `_db/diet-plans-${c.replace('_', '-')}-column.sql`).join(' and ')} in the Supabase SQL editor.`,
          duration: 12000,
        });
      }

      const dayEntries = input.days.map((day, index) => ({
        diet_plan_id: plan.id,
        day_label: day.day_label,
        meals: day.meals as unknown as Json,
        breakfast_option_id: day.breakfast_option_id || null,
        lunch_option_id: day.lunch_option_id || null,
        snacks_option_id: day.snacks_option_id || null,
        dinner_option_id: day.dinner_option_id || null,
        breakfast_text: day.breakfast_text,
        lunch_text: day.lunch_text,
        snacks_text: day.snacks_text,
        dinner_text: day.dinner_text,
        total_calories: day.total_calories,
        notes: day.notes,
        sort_order: index,
      }));

      const { error: daysError } = await supabase
        .from('diet_plan_days')
        .insert(dayEntries);
      
      if (daysError) throw daysError;

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diet_plans'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-diet-data'] });
      toast.success('Diet plan created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create diet plan', { description: error.message });
    },
  });
};

export const useSavedDietPlans = () => {
  return useQuery({
    queryKey: ['diet_plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_plans')
        .select(`
          *,
          clients (id, name, email, phone, date_of_birth, age, gender, height, weight, skin_type, hair_type, goal, diet_preference, health_conditions, notes),
          diet_plan_days (
            *,
            breakfast_option:diet_options!diet_plan_days_breakfast_option_id_fkey (id, name, calories),
            lunch_option:diet_options!diet_plan_days_lunch_option_id_fkey (id, name, calories),
            snacks_option:diet_options!diet_plan_days_snacks_option_id_fkey (id, name, calories),
            dinner_option:diet_options!diet_plan_days_dinner_option_id_fkey (id, name, calories)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useDeleteDietPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      // Delete days first
      const { error: daysError } = await supabase
        .from('diet_plan_days')
        .delete()
        .eq('diet_plan_id', planId);
      if (daysError) throw daysError;

      const { error } = await supabase
        .from('diet_plans')
        .delete()
        .eq('id', planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diet_plans'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-diet-data'] });
      toast.success('Diet plan deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete plan', { description: error.message });
    },
  });
};
