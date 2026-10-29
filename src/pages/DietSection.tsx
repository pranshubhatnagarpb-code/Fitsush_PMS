import { useMemo, useRef, useState } from 'react';
import { useDietChartTemplates, type TemplateSupplement } from '@/hooks/useDietChartTemplates';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, ChevronRight, Download, Mail, Plus, Trash2, ClipboardList, FilePlus, ArrowUp, ArrowDown, X, Pencil } from 'lucide-react';
import { useDietOptions } from '@/hooks/useDietOptions';
import { useActiveClients } from '@/hooks/useClients';
import { useCreateDietPlan, useUpdateDietPlan } from '@/hooks/useDietPlans';
import { toast } from 'sonner';
import { AIDietPlanGenerator } from '@/components/diet/AIDietPlanGenerator';
import SavedDietPlans from '@/components/diet/SavedDietPlans';
import { MealPicker, MealValue, emptyMeal } from '@/components/diet/MealPicker';
import { openDietPlanForPrint, type RecipeEdits } from '@/lib/dietPlanPdf';
import { PlanRecipesEditor } from '@/components/diet/PlanRecipesEditor';
import { PlanKycEditor } from '@/components/diet/PlanKycEditor';
import type { PlanKyc } from '@/lib/dietPlanHtml';

type StandardMealKey = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
const STANDARD_MEAL_KEYS: StandardMealKey[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

// A row of the diet chart, shared by every day. The four defaults keep `key`,
// which filters diet_options by meal_type and fills the legacy
// diet_plan_days.<key>_option_id / <key>_text columns; added ones have no key.
interface MealTime {
  id: string;
  label: string;
  key?: StandardMealKey;
}

interface DayPlan {
  id: string;
  days: string[]; // weekdays this card's meals apply to
  meals: Record<string, MealValue[]>; // keyed by MealTime.id; [0] is the main meal, the rest are extra options
  instructions: string;
}

const defaultMealTimes = (): MealTime[] =>
  STANDARD_MEAL_KEYS.map((key) => ({ id: key, label: key[0].toUpperCase() + key.slice(1), key }));

const newDayPlan = (id: string, selectedDays: string[] = ['Monday']): DayPlan => ({ id, days: selectedDays, meals: {}, instructions: '' });

const optionsOf = (plan: DayPlan, mealTimeId: string): MealValue[] =>
  plan.meals[mealTimeId]?.length ? plan.meals[mealTimeId] : [emptyMeal];
const mealOf = (plan: DayPlan, mealTimeId: string): MealValue => optionsOf(plan, mealTimeId)[0];
const filledTexts = (plan: DayPlan, mealTimeId: string) =>
  optionsOf(plan, mealTimeId).map((o) => o.text.trim()).filter(Boolean);

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// "Monday – Friday", "Monday, Wednesday, Friday", "Monday – Wednesday, Saturday", or "Every day".
// Runs of 3+ consecutive days collapse into a range.
const formatDays = (selected: string[]): string => {
  const idx = WEEKDAYS.map((d, i) => (selected.includes(d) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === WEEKDAYS.length) return 'Every day';
  const parts: string[] = [];
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    if (j - i >= 2) parts.push(`${WEEKDAYS[idx[i]]} – ${WEEKDAYS[idx[j]]}`);
    else for (let k = i; k <= j; k++) parts.push(WEEKDAYS[idx[k]]);
    i = j + 1;
  }
  return parts.join(', ');
};

// Back from a saved day_label to weekdays: "Every day", "Monday – Friday",
// "Monday, Wednesday", "Monday & Thursday", or older "Monday - Week 1".
const parseDays = (label: string | null): string[] => {
  if (!label) return [];
  if (/every\s*day|daily/i.test(label)) return [...WEEKDAYS];
  const found = new Set<number>();
  label.split(/,|&|\band\b/i).forEach((part) => {
    const idx = WEEKDAYS.map((d, i) => (new RegExp(`\\b${d}\\b`, 'i').test(part) ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 2 && /[–-]/.test(part)) {
      const [a, b] = [Math.min(...idx), Math.max(...idx)];
      for (let i = a; i <= b; i++) found.add(i);
    } else idx.forEach((i) => found.add(i));
  });
  return WEEKDAYS.filter((_, i) => found.has(i));
};

// A saved manual plan → the planner's meal times and day cards.
const planToForm = (plan: any): { mealTimes: MealTime[]; dayPlans: DayPlan[] } => {
  const days = [...(plan.diet_plan_days ?? [])].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
  // Rows saved before diet_plan_days.meals existed only have the four columns.
  const rawMeals = (d: any): any[] =>
    Array.isArray(d.meals) && d.meals.length
      ? d.meals
      : STANDARD_MEAL_KEYS.map((k) => ({
          label: k[0].toUpperCase() + k.slice(1),
          text: d[`${k}_text`] || d[`${k}_option`]?.name || null,
          option_id: d[`${k}_option_id`] ?? null,
        }));

  const mealTimes: MealTime[] = [];
  days.forEach((d) => rawMeals(d).forEach((m) => {
    const label = String(m?.label ?? '').trim();
    if (!label || mealTimes.some((mt) => mt.label.toLowerCase() === label.toLowerCase())) return;
    const key = STANDARD_MEAL_KEYS.find((k) => k === label.toLowerCase() && !mealTimes.some((mt) => mt.key === k));
    mealTimes.push({ id: key ?? `custom-${mealTimes.length}`, label, key });
  }));

  const dayPlans = days.map((d, i): DayPlan => {
    const meals: Record<string, MealValue[]> = {};
    rawMeals(d).forEach((m) => {
      const mt = mealTimes.find((t) => t.label.toLowerCase() === String(m?.label ?? '').trim().toLowerCase());
      if (!mt) return;
      const texts: string[] = Array.isArray(m.options) && m.options.length ? m.options.map(String) : m.text ? [String(m.text)] : [];
      // `recipes` isn't tied to an option: match by name first, then hand out the rest in order.
      const recipes: string[] = Array.isArray(m.recipes) ? [...m.recipes] : [];
      const values = texts.map((text, oi): MealValue => {
        const ri = recipes.findIndex((r) => r.toLowerCase() === text.trim().toLowerCase());
        return { text, optionId: oi === 0 ? m.option_id ?? null : null, recipe: ri >= 0 ? recipes.splice(ri, 1)[0] : null };
      });
      values.forEach((v) => { if (!v.recipe && recipes.length) v.recipe = recipes.shift()!; });
      if (values.length) meals[mt.id] = values;
    });
    return { id: `loaded-${i}`, days: parseDays(d.day_label), meals, instructions: d.notes ?? '' };
  });

  return {
    mealTimes: mealTimes.length ? mealTimes : defaultMealTimes(),
    dayPlans: dayPlans.length ? dayPlans : [newDayPlan('1')],
  };
};

const DietSection = () => {
  const [selectedClient, setSelectedClient] = useState('');
  const [planName, setPlanName] = useState('');
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [supplements, setSupplements] = useState<TemplateSupplement[]>([]);
  const { data: templates = [] } = useDietChartTemplates();
  // Suggestions for the supplement box: everything already used in diet chart templates.
  const supplementSuggestions = useMemo(
    () => [...new Set(templates.flatMap((t) => (t.supplements ?? []).map((s) => s.supplement.trim())).filter(Boolean))].sort(),
    [templates],
  );

  const updateSupplement = (index: number, field: keyof TemplateSupplement, value: string) =>
    setSupplements(supplements.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  const filledSupplements = () =>
    supplements
      .map((s) => ({ time: s.time.trim(), supplement: s.supplement.trim(), notes: s.notes.trim() }))
      .filter((s) => s.supplement);
  const [mealTimes, setMealTimes] = useState<MealTime[]>(defaultMealTimes);
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([newDayPlan('1')]);
  const [recipeEdits, setRecipeEdits] = useState<RecipeEdits>({});
  const [kyc, setKyc] = useState<PlanKyc>();
  const [tab, setTab] = useState('create');
  // Set while a saved plan is open via Saved Plans → Edit; saving then overwrites it.
  const [editingPlan, setEditingPlan] = useState<{ id: string; name: string } | null>(null);
  const plannerRef = useRef<HTMLDivElement>(null);

  const { data: dietOptions = [], isLoading: optionsLoading } = useDietOptions();
  const { data: clients = [], isLoading: clientsLoading } = useActiveClients();
  const createDietPlan = useCreateDietPlan();
  const updateDietPlan = useUpdateDietPlan();

  // Default meal times list their own meal_type; added meal times can use any option.
  const optionsFor = (mt: MealTime) =>
    mt.key ? dietOptions.filter((opt) => opt.meal_type === mt.key) : dietOptions;

  const addMealTime = () => {
    setMealTimes((prev) => [...prev, { id: `custom-${Date.now()}`, label: '' }]);
  };

  const renameMealTime = (id: string, label: string) => {
    setMealTimes((prev) => prev.map((mt) => (mt.id === id ? { ...mt, label } : mt)));
  };

  const moveMealTime = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= mealTimes.length) return;
    const next = [...mealTimes];
    [next[index], next[target]] = [next[target], next[index]];
    setMealTimes(next);
  };

  const removeMealTime = (mt: MealTime) => {
    if (mealTimes.length <= 1) return;
    const inUse = dayPlans.some((plan) => filledTexts(plan, mt.id).length > 0);
    if (inUse && !confirm(`Remove "${mt.label || 'this meal time'}"? Meals entered for it on every day will be removed too.`)) return;
    setMealTimes(mealTimes.filter((m) => m.id !== mt.id));
    setDayPlans((prev) => prev.map((plan) => {
      const { [mt.id]: _removed, ...rest } = plan.meals;
      return { ...plan, meals: rest };
    }));
  };

  const addDayPlan = () => {
    // Start the new card on the first weekday no other card covers yet.
    setDayPlans((prev) => {
      const used = new Set(prev.flatMap((p) => p.days));
      const next = WEEKDAYS.find((d) => !used.has(d));
      return [...prev, newDayPlan(Date.now().toString(), next ? [next] : [])];
    });
  };

  const removeDayPlan = (id: string) => {
    setDayPlans((prev) => (prev.length > 1 ? prev.filter((plan) => plan.id !== id) : prev));
  };

  const updateDayPlan = <K extends keyof DayPlan>(id: string, field: K, value: DayPlan[K]) => {
    setDayPlans((prev) => prev.map((plan) => (plan.id === id ? { ...plan, [field]: value } : plan)));
  };

  const setOptions = (planId: string, mealTimeId: string, fn: (opts: MealValue[]) => MealValue[]) => {
    setDayPlans((prev) => prev.map((plan) =>
      plan.id === planId ? { ...plan, meals: { ...plan.meals, [mealTimeId]: fn(optionsOf(plan, mealTimeId)) } } : plan
    ));
  };

  const updateMeal = (planId: string, mealTimeId: string, optionIdx: number, value: MealValue) =>
    setOptions(planId, mealTimeId, (opts) => opts.map((o, i) => (i === optionIdx ? value : o)));

  const addMealOption = (planId: string, mealTimeId: string) =>
    setOptions(planId, mealTimeId, (opts) => [...opts, emptyMeal]);

  const removeMealOption = (planId: string, mealTimeId: string, optionIdx: number) =>
    setOptions(planId, mealTimeId, (opts) => opts.filter((_, i) => i !== optionIdx));

  // Only meals picked from diet_options carry calories; recipes and typed meals count as 0.
  const calculateTotalCalories = (plan: DayPlan): number =>
    mealTimes.reduce((total, mt) => {
      const meal = dietOptions.find((opt) => opt.id === mealOf(plan, mt.id).optionId);
      return total + (meal?.calories ?? 0);
    }, 0);

  const toggleDay = (planId: string, day: string) => {
    setDayPlans((prev) => prev.map((plan) =>
      plan.id === planId
        ? { ...plan, days: plan.days.includes(day) ? plan.days.filter((d) => d !== day) : [...plan.days, day] }
        : plan
    ));
  };

  const validatePlan = () => {
    if (!selectedClient || !planName.trim()) {
      toast.error('Please select client and enter plan name');
      return false;
    }
    const noDays = dayPlans.findIndex((plan) => plan.days.length === 0);
    if (noDays !== -1) {
      toast.error(`Select at least one day for Day ${noDays + 1}`);
      return false;
    }
    const labels = mealTimes.map((mt) => mt.label.trim().toLowerCase());
    if (labels.some((l) => !l)) {
      toast.error('Give every meal time a name (or remove the empty one)');
      return false;
    }
    if (new Set(labels).size !== labels.length) {
      toast.error('Two meal times have the same name');
      return false;
    }
    if (!dayPlans.some((plan) => mealTimes.some((mt) => filledTexts(plan, mt.id).length > 0))) {
      toast.error('Add at least one meal before saving');
      return false;
    }
    return true;
  };

  const buildDays = () =>
    dayPlans.map((plan, index) => {
      const legacy = (key: StandardMealKey) => {
        const mt = mealTimes.find((m) => m.key === key);
        return (mt && optionsOf(plan, mt.id).find((o) => o.text.trim())) || emptyMeal;
      };
      const [breakfast, lunch, snacks, dinner] = STANDARD_MEAL_KEYS.map(legacy);
      return {
        day_label: formatDays(plan.days),
        meals: mealTimes.map((mt) => {
          const filled = optionsOf(plan, mt.id).filter((o) => o.text.trim());
          return {
            label: mt.label.trim(),
            text: filled[0]?.text.trim() || null,
            option_id: filled[0]?.optionId ?? null,
            // All main-meal options in order; each prints as its own row.
            ...(filled.length > 1 ? { options: filled.map((o) => o.text.trim()) } : {}),
            // Recipes the options were picked from — still printed if the meal was reworded.
            ...(filled.some((o) => o.recipe) ? { recipes: [...new Set(filled.flatMap((o) => (o.recipe ? [o.recipe] : [])))] } : {}),
          };
        }),
        breakfast_option_id: breakfast.optionId,
        lunch_option_id: lunch.optionId,
        snacks_option_id: snacks.optionId,
        dinner_option_id: dinner.optionId,
        breakfast_text: breakfast.text.trim() || null,
        lunch_text: lunch.text.trim() || null,
        snacks_text: snacks.text.trim() || null,
        dinner_text: dinner.text.trim() || null,
        total_calories: calculateTotalCalories(plan),
        notes: plan.instructions,
        sort_order: index,
      };
    });

  const resetForm = () => {
    // Meal times are kept, so the next plan can reuse the same chart rows
    setPlanName('');
    setGeneralInstructions('');
    setSupplements([]);
    setRecipeEdits({});
    setKyc(undefined); // re-filled from the client's latest data
    setDayPlans([newDayPlan('1')]);
    setEditingPlan(null);
  };

  const savePlan = async () => {
    if (!validatePlan()) return;

    const input = {
      client_id: selectedClient,
      plan_name: planName.trim(),
      instructions: generalInstructions,
      supplements: filledSupplements(),
      recipe_edits: recipeEdits,
      kyc,
      days: buildDays(),
    };

    if (editingPlan) {
      await updateDietPlan.mutateAsync({ id: editingPlan.id, ...input });
      resetForm();
      setTab('saved');
      return;
    }

    await createDietPlan.mutateAsync(input);
    resetForm();
  };

  // Saved Plans → Edit / Edit & Reuse on a manual plan: load it into the planner.
  const openSavedPlan = (plan: any, mode: 'edit' | 'reuse') => {
    const form = planToForm(plan);
    setSelectedClient(plan.client_id ?? '');
    setPlanName(plan.plan_name ?? '');
    setGeneralInstructions(plan.instructions ?? '');
    setSupplements(Array.isArray(plan.supplements) ? plan.supplements.map((s: any) => ({ time: s.time ?? '', supplement: s.supplement ?? '', notes: s.notes ?? '' })) : []);
    setRecipeEdits(plan.recipe_edits ?? {});
    // clientId stops the KYC card from re-filling over the saved values.
    setKyc(plan.kyc ? { ...plan.kyc, clientId: plan.client_id } : undefined);
    setMealTimes(form.mealTimes);
    setDayPlans(form.dayPlans);
    setEditingPlan(mode === 'edit' ? { id: plan.id, name: plan.plan_name } : null);
    setTab('create');
    setTimeout(() => plannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    toast.success(mode === 'edit' ? `Editing "${plan.plan_name}"` : `Loaded "${plan.plan_name}" — saving creates a new plan`);
  };

  // Same layout as Saved Plans' download (and the PDF the client gets on publish).
  const generatePDF = async () => {
    if (!validatePlan()) return;
    await openDietPlanForPrint({
      plan_name: planName.trim(),
      instructions: generalInstructions,
      supplements: filledSupplements(),
      recipe_edits: recipeEdits,
      kyc,
      is_ai_generated: false,
      clients: clients.find((c) => c.id === selectedClient),
      diet_plan_days: buildDays(),
    });
  };

  const sendEmail = () => {
    if (!selectedClient || !planName) {
      toast.error('Please select client and enter plan name');
      return;
    }

    const client = clients.find(c => c.id === selectedClient);
    const clientEmail = client?.email || '';
    const subject = encodeURIComponent(`Nutrition Plan: ${planName} - Fitsush`);
    const body = encodeURIComponent(`Dear ${client?.name || 'Client'},\n\nPlease find attached your personalized nutrition plan: ${planName}\n\nBest regards,\nFitsush Team`);
    
    window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`);
    toast.success('Email client opened!');
  };

  if (optionsLoading || clientsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Diet Section</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Diet Section</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <FilePlus className="h-4 w-4" /> Create Plan
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Saved Plans
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <div className="flex justify-end gap-2 mb-6">
            <Button variant="outline" onClick={generatePDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={sendEmail}>
              <Mail className="h-4 w-4 mr-2" />
              Email PDF
            </Button>
            <Button onClick={savePlan} disabled={createDietPlan.isPending || updateDietPlan.isPending} className="gradient-primary text-primary-foreground">
              {createDietPlan.isPending || updateDietPlan.isPending ? 'Saving...' : editingPlan ? 'Save Changes' : 'Save Plan'}
            </Button>
          </div>

          {/* AI Diet Plan Generator */}
          <AIDietPlanGenerator clients={clients} />

          <div ref={plannerRef} className="scroll-mt-4" />
          {editingPlan && (
            <Card className="p-4 mb-4 border-primary bg-primary/5 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Editing saved plan <strong>{editingPlan.name}</strong>. Save Changes updates this plan; no new plan is created.
              </p>
              <Button variant="outline" size="sm" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" /> Cancel edit
              </Button>
            </Card>
          )}

          {/* Client & Plan Info */}
          <Card className="p-6 mb-6 shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="client">Select Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {clients.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">No clients yet. Add clients in Clients section first.</div>
                    ) : (
                      clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="planName">Plan Name</Label>
                <Input
                  id="planName"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g., Weight Loss Plan - January"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructions">General Instructions</Label>
                <Input
                  id="instructions"
                  value={generalInstructions}
                  onChange={(e) => setGeneralInstructions(e.target.value)}
                  placeholder="e.g., Drink 8 glasses of water daily"
                />
              </div>
            </div>
          </Card>

          <PlanKycEditor client={clients.find((c) => c.id === selectedClient)} kyc={kyc} onChange={setKyc} />

          {/* Meal Times */}
          <Card className="p-6 mb-6 shadow-card">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h3 className="font-semibold text-foreground">Meal Times</h3>
              <Button variant="outline" size="sm" onClick={addMealTime}>
                <Plus className="h-4 w-4 mr-1" /> Add Meal Time
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              These are the rows of the chart, used for every day. Rename them, add your own (e.g. Early Morning, Mid-Morning, Bedtime), or reorder them.
            </p>
            <div className="space-y-2">
              {mealTimes.map((mt, i) => (
                <div key={mt.id} className="flex items-center gap-2">
                  <Input
                    value={mt.label}
                    onChange={(e) => renameMealTime(mt.id, e.target.value)}
                    placeholder="e.g., Early Morning (6:30 AM)"
                    className="max-w-md"
                    autoFocus={!mt.key && !mt.label}
                  />
                  <Button variant="ghost" size="icon" onClick={() => moveMealTime(i, -1)} disabled={i === 0} title="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => moveMealTime(i, 1)} disabled={i === mealTimes.length - 1} title="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMealTime(mt)}
                    disabled={mealTimes.length <= 1}
                    title="Remove meal time"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {/* Day Plans */}
          <div className="space-y-4">
            {dayPlans.map((plan, index) => (
              <Card key={plan.id} className="p-6 shadow-card animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">
                    Day {index + 1}
                    {plan.days.length > 0 && <span className="ml-2 font-normal text-muted-foreground">· {formatDays(plan.days)}</span>}
                  </h3>
                  {dayPlans.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDayPlan(plan.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label>Days</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setDayPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, days: p.days.length === WEEKDAYS.length ? [] : [...WEEKDAYS] } : p)))}
                    >
                      {plan.days.length === WEEKDAYS.length ? 'Clear' : 'Select all'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => {
                      const selected = plan.days.includes(day);
                      return (
                        <Button
                          key={day}
                          type="button"
                          size="sm"
                          variant={selected ? 'default' : 'outline'}
                          aria-pressed={selected}
                          onClick={() => toggleDay(plan.id, day)}
                          className={selected ? 'gradient-primary text-primary-foreground' : ''}
                        >
                          {day.slice(0, 3)}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {mealTimes.map((mt) => {
                    const opts = optionsOf(plan, mt.id);
                    return (
                      <div key={mt.id} className="space-y-2">
                        <Label>{mt.label.trim() || <span className="text-muted-foreground italic">Unnamed meal time</span>}</Label>
                        {opts.map((opt, oi) => (
                          <div key={oi} className="space-y-1">
                            {opts.length > 1 && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-primary">Option {oi + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => removeMealOption(plan.id, mt.id, oi)}
                                  className="text-muted-foreground hover:text-destructive"
                                  title="Remove this option"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                            <MealPicker
                              value={opt}
                              onChange={(val) => updateMeal(plan.id, mt.id, oi, val)}
                              options={optionsFor(mt)}
                              placeholder={`Select or type ${mt.label.trim().toLowerCase() || 'meal'}`}
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addMealOption(plan.id, mt.id)}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add option
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <div className="space-y-2">
                    <Label>Instructions</Label>
                    <Textarea
                      value={plan.instructions}
                      onChange={(e) => updateDayPlan(plan.id, 'instructions', e.target.value)}
                      placeholder="Add any special instructions for this day..."
                      rows={2}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Button onClick={addDayPlan} className="mt-4 gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Day
          </Button>

          {/* Supplements */}
          <Card className="p-6 mt-6 shadow-card">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h3 className="font-semibold text-foreground">Supplements</h3>
              <Button variant="outline" size="sm" onClick={() => setSupplements([...supplements, { time: '', supplement: '', notes: '' }])}>
                <Plus className="h-4 w-4 mr-1" /> Add Supplement
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Printed as a Supplements table on the diet chart. Type any supplement, or pick one used in your templates.
            </p>
            {supplements.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No supplements added.</p>
            ) : (
              <div className="space-y-2">
                <div className="hidden md:grid grid-cols-[1fr_2fr_2fr_auto] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Time</span><span>Supplement & dosage</span><span>Notes</span><span className="w-9" />
                </div>
                {supplements.map((sup, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_2fr_auto] gap-2">
                    <Input value={sup.time} onChange={(e) => updateSupplement(i, 'time', e.target.value)} placeholder="e.g., After breakfast" />
                    <Input
                      value={sup.supplement}
                      onChange={(e) => updateSupplement(i, 'supplement', e.target.value)}
                      placeholder="e.g., Vitamin D3 60K — 1 capsule"
                      list="supplement-suggestions"
                    />
                    <Input value={sup.notes} onChange={(e) => updateSupplement(i, 'notes', e.target.value)} placeholder="e.g., Once a week, with milk" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSupplements(supplements.filter((_, j) => j !== i))}
                      title="Remove supplement"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <datalist id="supplement-suggestions">
                  {supplementSuggestions.map((name) => <option key={name} value={name} />)}
                </datalist>
              </div>
            )}
          </Card>

          <PlanRecipesEditor plan={{ is_ai_generated: false, diet_plan_days: buildDays() }} edits={recipeEdits} onChange={setRecipeEdits} />
        </TabsContent>

        <TabsContent value="saved">
          <SavedDietPlans onOpenManualPlan={openSavedPlan} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default DietSection;
