import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, ChevronRight, Download, Mail, Plus, Trash2, ClipboardList, FilePlus } from 'lucide-react';
import { useDietOptions } from '@/hooks/useDietOptions';
import { useActiveClients } from '@/hooks/useClients';
import { useCreateDietPlan } from '@/hooks/useDietPlans';
import { toast } from 'sonner';
import { AIDietPlanGenerator } from '@/components/diet/AIDietPlanGenerator';
import SavedDietPlans from '@/components/diet/SavedDietPlans';
import { MealPicker, MealValue, emptyMeal } from '@/components/diet/MealPicker';
import { openDietPlanForPrint } from '@/lib/dietPlanPdf';

interface DayPlan {
  id: string;
  day: string;
  week: string;
  breakfast: MealValue;
  lunch: MealValue;
  snacks: MealValue;
  dinner: MealValue;
  instructions: string;
}

type MealKey = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
const MEAL_KEYS: MealKey[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

const DietSection = () => {
  const [selectedClient, setSelectedClient] = useState('');
  const [planName, setPlanName] = useState('');
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([
    {
      id: '1',
      day: 'Monday',
      week: 'Week 1',
      breakfast: emptyMeal,
      lunch: emptyMeal,
      snacks: emptyMeal,
      dinner: emptyMeal,
      instructions: '',
    },
  ]);

  const { data: dietOptions = [], isLoading: optionsLoading } = useDietOptions();
  const { data: clients = [], isLoading: clientsLoading } = useActiveClients();
  const createDietPlan = useCreateDietPlan();

  const breakfastOptions = dietOptions.filter(opt => opt.meal_type === 'breakfast');
  const lunchOptions = dietOptions.filter(opt => opt.meal_type === 'lunch');
  const snacksOptions = dietOptions.filter(opt => opt.meal_type === 'snacks');
  const dinnerOptions = dietOptions.filter(opt => opt.meal_type === 'dinner');

  const addDayPlan = () => {
    const newPlan: DayPlan = {
      id: Date.now().toString(),
      day: 'Monday',
      week: 'Week 1',
      breakfast: emptyMeal,
      lunch: emptyMeal,
      snacks: emptyMeal,
      dinner: emptyMeal,
      instructions: '',
    };
    setDayPlans([...dayPlans, newPlan]);
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

  // Only meals picked from diet_options carry calories; recipes and typed meals count as 0.
  const calculateTotalCalories = (plan: DayPlan): number =>
    MEAL_KEYS.reduce((total, key) => {
      const meal = dietOptions.find((opt) => opt.id === plan[key].optionId);
      return total + (meal?.calories ?? 0);
    }, 0);

  const validatePlan = () => {
    if (!selectedClient || !planName.trim()) {
      toast.error('Please select client and enter plan name');
      return false;
    }
    if (!dayPlans.some((plan) => MEAL_KEYS.some((key) => plan[key].text.trim()))) {
      toast.error('Add at least one meal before saving');
      return false;
    }
    return true;
  };

  const buildDays = () =>
    dayPlans.map((plan, index) => ({
      day_label: `${plan.day} - ${plan.week}`,
      breakfast_option_id: plan.breakfast.optionId,
      lunch_option_id: plan.lunch.optionId,
      snacks_option_id: plan.snacks.optionId,
      dinner_option_id: plan.dinner.optionId,
      breakfast_text: plan.breakfast.text.trim() || null,
      lunch_text: plan.lunch.text.trim() || null,
      snacks_text: plan.snacks.text.trim() || null,
      dinner_text: plan.dinner.text.trim() || null,
      total_calories: calculateTotalCalories(plan),
      notes: plan.instructions,
      sort_order: index,
    }));

  const savePlan = async () => {
    if (!validatePlan()) return;

    const days = buildDays();

    await createDietPlan.mutateAsync({
      client_id: selectedClient,
      plan_name: planName.trim(),
      instructions: generalInstructions,
      days,
    });

    // Reset form
    setPlanName('');
    setGeneralInstructions('');
    setDayPlans([{
      id: '1',
      day: 'Monday',
      week: 'Week 1',
      breakfast: emptyMeal,
      lunch: emptyMeal,
      snacks: emptyMeal,
      dinner: emptyMeal,
      instructions: '',
    }]);
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
                  <div className="space-y-2">
                    <Label>Breakfast</Label>
                    <MealPicker
                      value={plan.breakfast}
                      onChange={(val) => updateDayPlan(plan.id, 'breakfast', val)}
                      options={breakfastOptions}
                      placeholder="Select or type breakfast"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lunch</Label>
                    <MealPicker
                      value={plan.lunch}
                      onChange={(val) => updateDayPlan(plan.id, 'lunch', val)}
                      options={lunchOptions}
                      placeholder="Select or type lunch"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Snacks</Label>
                    <MealPicker
                      value={plan.snacks}
                      onChange={(val) => updateDayPlan(plan.id, 'snacks', val)}
                      options={snacksOptions}
                      placeholder="Select or type snacks"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dinner</Label>
                    <MealPicker
                      value={plan.dinner}
                      onChange={(val) => updateDayPlan(plan.id, 'dinner', val)}
                      options={dinnerOptions}
                      placeholder="Select or type dinner"
                    />
                  </div>
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
