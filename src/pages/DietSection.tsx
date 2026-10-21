import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, ChevronRight, Download, Mail, Plus, Trash2, ClipboardList, FilePlus, ArrowUp, ArrowDown } from 'lucide-react';
import { useDietOptions } from '@/hooks/useDietOptions';
import { useActiveClients } from '@/hooks/useClients';
import { useCreateDietPlan } from '@/hooks/useDietPlans';
import { toast } from 'sonner';
import { AIDietPlanGenerator } from '@/components/diet/AIDietPlanGenerator';
import SavedDietPlans from '@/components/diet/SavedDietPlans';
import { MealPicker, MealValue, emptyMeal } from '@/components/diet/MealPicker';
import { openDietPlanForPrint } from '@/lib/dietPlanPdf';

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
  day: string;
  week: string;
  meals: Record<string, MealValue>; // keyed by MealTime.id
  instructions: string;
}

const defaultMealTimes = (): MealTime[] =>
  STANDARD_MEAL_KEYS.map((key) => ({ id: key, label: key[0].toUpperCase() + key.slice(1), key }));

const newDayPlan = (id: string): DayPlan => ({ id, day: 'Monday', week: 'Week 1', meals: {}, instructions: '' });

const mealOf = (plan: DayPlan, mealTimeId: string): MealValue => plan.meals[mealTimeId] ?? emptyMeal;

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

const DietSection = () => {
  const [selectedClient, setSelectedClient] = useState('');
  const [planName, setPlanName] = useState('');
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [mealTimes, setMealTimes] = useState<MealTime[]>(defaultMealTimes);
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([newDayPlan('1')]);

  const { data: dietOptions = [], isLoading: optionsLoading } = useDietOptions();
  const { data: clients = [], isLoading: clientsLoading } = useActiveClients();
  const createDietPlan = useCreateDietPlan();

  // Default meal times list their own meal_type; added meal times can use any option.
  const optionsFor = (mt: MealTime) =>
    mt.key ? dietOptions.filter((opt) => opt.meal_type === mt.key) : dietOptions;

  const addMealTime = () => {
    setMealTimes([...mealTimes, { id: `custom-${Date.now()}`, label: '' }]);
  };

  const renameMealTime = (id: string, label: string) => {
    setMealTimes(mealTimes.map((mt) => (mt.id === id ? { ...mt, label } : mt)));
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
    const inUse = dayPlans.some((plan) => mealOf(plan, mt.id).text.trim());
    if (inUse && !confirm(`Remove "${mt.label || 'this meal time'}"? Meals entered for it on every day will be removed too.`)) return;
    setMealTimes(mealTimes.filter((m) => m.id !== mt.id));
    setDayPlans(dayPlans.map((plan) => {
      const { [mt.id]: _removed, ...rest } = plan.meals;
      return { ...plan, meals: rest };
    }));
  };

  const addDayPlan = () => {
    setDayPlans([...dayPlans, newDayPlan(Date.now().toString())]);
  };

  const removeDayPlan = (id: string) => {
    if (dayPlans.length > 1) {
      setDayPlans(dayPlans.filter((plan) => plan.id !== id));
    }
  };

  const updateDayPlan = <K extends keyof DayPlan>(id: string, field: K, value: DayPlan[K]) => {
    setDayPlans(
      dayPlans.map((plan) =>
        plan.id === id ? { ...plan, [field]: value } : plan
      )
    );
  };

  const updateMeal = (planId: string, mealTimeId: string, value: MealValue) => {
    setDayPlans(dayPlans.map((plan) =>
      plan.id === planId ? { ...plan, meals: { ...plan.meals, [mealTimeId]: value } } : plan
    ));
  };

  // Only meals picked from diet_options carry calories; recipes and typed meals count as 0.
  const calculateTotalCalories = (plan: DayPlan): number =>
    mealTimes.reduce((total, mt) => {
      const meal = dietOptions.find((opt) => opt.id === mealOf(plan, mt.id).optionId);
      return total + (meal?.calories ?? 0);
    }, 0);

  const validatePlan = () => {
    if (!selectedClient || !planName.trim()) {
      toast.error('Please select client and enter plan name');
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
    if (!dayPlans.some((plan) => mealTimes.some((mt) => mealOf(plan, mt.id).text.trim()))) {
      toast.error('Add at least one meal before saving');
      return false;
    }
    return true;
  };

  const buildDays = () =>
    dayPlans.map((plan, index) => {
      const legacy = (key: StandardMealKey) => {
        const mt = mealTimes.find((m) => m.key === key);
        return mt ? mealOf(plan, mt.id) : emptyMeal;
      };
      const [breakfast, lunch, snacks, dinner] = STANDARD_MEAL_KEYS.map(legacy);
      return {
        day_label: `${plan.day} - ${plan.week}`,
        meals: mealTimes.map((mt) => ({
          label: mt.label.trim(),
          text: mealOf(plan, mt.id).text.trim() || null,
          option_id: mealOf(plan, mt.id).optionId,
        })),
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

  const savePlan = async () => {
    if (!validatePlan()) return;

    const days = buildDays();

    await createDietPlan.mutateAsync({
      client_id: selectedClient,
      plan_name: planName.trim(),
      instructions: generalInstructions,
      days,
    });

    // Reset form (meal times are kept, so the next plan can reuse the same chart rows)
    setPlanName('');
    setGeneralInstructions('');
    setDayPlans([newDayPlan('1')]);
  };

  // Same layout as Saved Plans' download (and the PDF the client gets on publish).
  const generatePDF = async () => {
    if (!validatePlan()) return;
    await openDietPlanForPrint({
      plan_name: planName.trim(),
      instructions: generalInstructions,
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

      <Tabs defaultValue="create" className="space-y-6">
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
            <Button onClick={savePlan} disabled={createDietPlan.isPending} className="gradient-primary text-primary-foreground">
              {createDietPlan.isPending ? 'Saving...' : 'Save Plan'}
            </Button>
          </div>

          {/* AI Diet Plan Generator */}
          <AIDietPlanGenerator clients={clients} />

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
                  <h3 className="font-semibold text-foreground">Day {index + 1}</h3>
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>Day</Label>
                    <Select value={plan.day} onValueChange={(val) => updateDayPlan(plan.id, 'day', val)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={day} value={day}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Week</Label>
                    <Select value={plan.week} onValueChange={(val) => updateDayPlan(plan.id, 'week', val)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {weeks.map((week) => (
                          <SelectItem key={week} value={week}>{week}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {mealTimes.map((mt) => (
                    <div key={mt.id} className="space-y-2">
                      <Label>{mt.label.trim() || <span className="text-muted-foreground italic">Unnamed meal time</span>}</Label>
                      <MealPicker
                        value={mealOf(plan, mt.id)}
                        onChange={(val) => updateMeal(plan.id, mt.id, val)}
                        options={optionsFor(mt)}
                        placeholder={`Select or type ${mt.label.trim().toLowerCase() || 'meal'}`}
                      />
                    </div>
                  ))}
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
        </TabsContent>

        <TabsContent value="saved">
          <SavedDietPlans />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default DietSection;
