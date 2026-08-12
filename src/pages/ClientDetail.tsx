import { useState, type ReactNode } from 'react';
import { LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Home, ChevronRight, ArrowLeft, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useClientById,
  useClientIntakeSubmissions,
  useClientProgressEntries,
  type ProgressEntry,
} from '@/hooks/useClientDetail';
import { useUpdateClient } from '@/hooks/useClients';
import { ClientMeasurementsPanel } from '@/components/clients/ClientMeasurementsPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Weight Loss', weight_gain: 'Weight Gain', muscle_gain: 'Muscle Gain',
  energy: 'More Energy', gut_health: 'Gut Health', hormonal_balance: 'Hormonal Balance',
  sports_performance: 'Sports Performance', manage_medical_condition: 'Manage Condition',
  general_wellness: 'General Wellness',
};
const DIET_LABELS: Record<string, string> = {
  veg: 'Vegetarian', non_veg: 'Non-Vegetarian', eggetarian: 'Eggetarian',
  pescatarian: 'Pescatarian', vegan: 'Vegan', jain: 'Jain',
};
const WATER_LABELS: Record<string, string> = {
  '<1L': '<1 L', '1-2L': '1–2 L', '2-3L': '2–3 L', '3L+': '3 L+',
};
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary', light: 'Light', moderate: 'Moderate',
  active: 'Active', very_active: 'Very Active',
};
const EXERCISE_DURATION_LABELS: Record<string, string> = {
  none: 'None', '15_30': '15–30 min', '30_45': '30–45 min',
  '45_60': '45–60 min', '60_plus': '60+ min',
};
const EXERCISE_FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily', '4_5_wk': '4–5x/week', '2_3_wk': '2–3x/week', rarely: 'Rarely',
};
const STRESS_SOURCE_LABELS: Record<string, string> = {
  work: 'Work', family: 'Family', health: 'Health', financial: 'Financial', multiple: 'Multiple',
};
const LUNCH_DURATION_LABELS: Record<string, string> = {
  under_10: 'Under 10 min', '10_20': '10–20 min', over_20: 'Over 20 min',
};
const HOME_COOKED_LABELS: Record<string, string> = {
  yes: 'Yes', partially: 'Partially', rarely: 'Rarely',
};
const WHO_COOKS_LABELS: Record<string, string> = {
  self: 'Self', family: 'Family', cook_help: 'Cook / help', mix: 'Mix',
};
const EATING_SPEED_LABELS: Record<string, string> = {
  slow: 'Slow', moderate: 'Moderate', fast: 'Fast',
};
const BINGE_EATING_LABELS: Record<string, string> = {
  no: 'No', occasionally: 'Occasionally', frequently: 'Frequently',
};
const ENERGY_DRINKS_LABELS: Record<string, string> = {
  never: 'Never', rarely: 'Rarely', sometimes: 'Sometimes', daily: 'Daily',
};
const BLOOD_GROUP_LABELS: Record<string, string> = {
  'A+': 'A+', 'A-': 'A-', 'B+': 'B+', 'B-': 'B-', 'AB+': 'AB+', 'AB-': 'AB-', 'O+': 'O+', 'O-': 'O-', unknown: 'Not sure',
};
const ONCOLOGY_TREATMENT_LABELS: Record<string, string> = {
  chemotherapy: 'Chemotherapy', radiation: 'Radiation', immunotherapy: 'Immunotherapy',
  surgery: 'Surgery', bone_marrow_transplant: 'Bone marrow transplant', other: 'Other',
};
const ONCOLOGY_SYMPTOM_LABELS: Record<string, string> = {
  loss_of_appetite: 'Loss of appetite', nausea: 'Nausea', vomiting: 'Vomiting', taste_changes: 'Taste changes',
  mouth_sores: 'Mouth sores', dry_mouth: 'Dry mouth', difficulty_swallowing: 'Difficulty swallowing',
  early_satiety: 'Early satiety', food_aversion: 'Food aversion', diarrhea: 'Diarrhea', constipation: 'Constipation',
  fatigue: 'Fatigue', weight_loss: 'Weight loss', weight_gain: 'Weight gain',
};
const FOOD_SAFETY_LABELS: Record<string, string> = {
  raw_sprouts: 'Raw sprouts', street_food: 'Street food', raw_eggs: 'Raw eggs',
  unpasteurized_dairy: 'Unpasteurized dairy', none: 'None',
};
const FERTILITY_DURATION_LABELS: Record<string, string> = {
  under_6mo: '< 6 months', '6_12mo': '6–12 months', '1_2yr': '1–2 years', '2yr_plus': '2+ years',
};
const FERTILITY_TREATMENT_LABELS: Record<string, string> = {
  none: 'None', iui: 'IUI', ivf: 'IVF', other: 'Other',
};
const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: 'Single', married: 'Married', divorced: 'Divorced', widowed: 'Widowed',
};

function ratingBar(val: number | undefined) {
  if (!val) return null;
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`inline-block h-2.5 w-2.5 rounded-full ${i <= val ? 'bg-primary' : 'bg-muted'}`}
        />
      ))}
      <span className="ml-1.5 text-sm font-medium">{val}/5</span>
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex min-h-[2rem] items-start gap-2 py-1">
      <span className="w-44 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border bg-card">
      <div className="border-b px-4 py-2.5">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      <div className="divide-y px-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intake Payload Renderer
// ---------------------------------------------------------------------------
function IntakePayloadView({ submission }: { submission: { payload: Record<string, any>; created_at: string; branch: string } }) {
  const p = submission.payload;
  const req = p.required ?? {};
  const opt = p.optional ?? {};
  const branch = submission.branch;

  const symptoms = req.symptoms ?? {};
  const lifestyle = req.lifestyle ?? {};
  const body = req.body ?? {};
  const digestion = opt.digestion ?? {};
  const foodPattern = opt.foodPattern ?? {};
  const dailyMeals = foodPattern.dailyMeals ?? {};
  const lifestyleDepth = opt.lifestyleDepth ?? {};
  const oncology = opt.oncology ?? {};
  const bodyMeasurements = opt.bodyMeasurements ?? {};
  const goals = opt.goals ?? {};
  const contact = p.contact ?? {};
  const guardian = p.guardian ?? {};
  const female = p.female ?? {};
  const fertility = female.fertility ?? {};
  const pregnancy = female.pregnancy ?? {};
  const lactation = female.lactation ?? {};
  const male = p.male ?? {};
  const child = p.child ?? {};
  const childFeeding = child.feeding ?? {};

  const MEAL_LABELS: Record<string, string> = {
    breakfast: 'Breakfast', midMorning: 'Mid-Morning', lunch: 'Lunch',
    evening: 'Evening', dinner: 'Dinner', postDinner: 'Post-Dinner',
  };

  return (
    <div>
      <p className="mb-4 text-xs text-muted-foreground">
        Submitted {new Date(submission.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        {' · '}Branch: <span className="capitalize font-medium">{branch}</span>
      </p>

      <Section title="Identity">
        <InfoRow label="Name" value={req.fullName} />
        <InfoRow label="Date of Birth" value={req.dob} />
        <InfoRow label="Age" value={formatAge(req.dob) ?? req.age} />
        <InfoRow label="City" value={req.city} />
        <InfoRow label="Address" value={opt.address} />
        {branch === 'child' ? (
          <>
            <InfoRow label="Guardian Name" value={guardian.guardianName} />
            <InfoRow label="Guardian Relationship" value={guardian.guardianRelationship} />
            <InfoRow label="Guardian Phone" value={guardian.guardianPhone} />
            <InfoRow label="Guardian Email" value={guardian.guardianEmail} />
            <InfoRow label="Referred By" value={guardian.referredBy} />
          </>
        ) : (
          <>
            <InfoRow label="Phone" value={contact.phone} />
            <InfoRow label="Email" value={contact.email} />
            <InfoRow label="Profession" value={contact.profession} />
            <InfoRow label="Marital Status" value={MARITAL_STATUS_LABELS[contact.maritalStatus] ?? contact.maritalStatus} />
            <InfoRow label="Children" value={contact.childrenCount} />
            <InfoRow label="Referred By" value={contact.referredBy} />
          </>
        )}
      </Section>

      <Section title="Goal & Complaints">
        <InfoRow label="Primary Goal" value={GOAL_LABELS[req.primaryGoal] ?? req.primaryGoal} />
        <InfoRow label="Chief Complaints" value={req.chiefComplaints?.join(', ')} />
      </Section>

      {Object.keys(goals).length > 0 ? (
        <Section title="Goals & Expectations">
          <InfoRow label="Past attempts" value={goals.pastAttempts} />
          <InfoRow label="What worked / didn't" value={goals.pastAttemptsOutcome} />
          <InfoRow label="Biggest challenge" value={goals.biggestChallenge} />
          <InfoRow label="Expectations from program" value={goals.programExpectations} />
        </Section>
      ) : null}

      <Section title="Body Snapshot">
        <InfoRow label="Weight" value={body.weightKg ? `${body.weightKg} kg` : null} />
        <InfoRow label="Height" value={body.heightCm ? `${body.heightCm} cm` : null} />
      </Section>

      {Object.keys(bodyMeasurements).length > 0 ? (
        <Section title="Body Measurements & Vitals">
          <InfoRow label="Blood group" value={BLOOD_GROUP_LABELS[bodyMeasurements.bloodGroup] ?? bodyMeasurements.bloodGroup} />
          <InfoRow label="Target weight" value={bodyMeasurements.targetWeightKg ? `${bodyMeasurements.targetWeightKg} kg` : null} />
          <InfoRow label="Waist at navel" value={bodyMeasurements.waistNavelCm ? `${bodyMeasurements.waistNavelCm} cm` : null} />
          <InfoRow label="Waist at thinnest" value={bodyMeasurements.waistThinnestCm ? `${bodyMeasurements.waistThinnestCm} cm` : null} />
          <InfoRow label="Hip" value={bodyMeasurements.hipCm ? `${bodyMeasurements.hipCm} cm` : null} />
          <InfoRow label="Neck" value={bodyMeasurements.neckCm ? `${bodyMeasurements.neckCm} cm` : null} />
          <InfoRow label="Blood pressure" value={bodyMeasurements.bloodPressure} />
          <InfoRow label="Pulse rate" value={bodyMeasurements.pulseRate ? `${bodyMeasurements.pulseRate} bpm` : null} />
          <InfoRow label="Heaviest adult weight" value={bodyMeasurements.heaviestWeightKg ? `${bodyMeasurements.heaviestWeightKg} kg` : null} />
          <InfoRow label="Lightest adult weight" value={bodyMeasurements.lightestWeightKg ? `${bodyMeasurements.lightestWeightKg} kg` : null} />
          <InfoRow label="Weight 6 months ago" value={bodyMeasurements.weight6moAgoKg ? `${bodyMeasurements.weight6moAgoKg} kg` : null} />
          <InfoRow label="Weight 3 years ago" value={bodyMeasurements.weight3yrAgoKg ? `${bodyMeasurements.weight3yrAgoKg} kg` : null} />
        </Section>
      ) : null}

      <Section title="Daily Rhythm">
        <InfoRow label="Sleep / night" value={lifestyle.sleepHours ? `${lifestyle.sleepHours} hrs` : null} />
        <InfoRow label="Water intake" value={WATER_LABELS[lifestyle.waterIntake] ?? lifestyle.waterIntake} />
        <InfoRow label="Activity level" value={ACTIVITY_LABELS[lifestyle.activityLevel] ?? lifestyle.activityLevel} />
        <InfoRow label="Screen time" value={lifestyleDepth.screenTimeHrs != null ? `${lifestyleDepth.screenTimeHrs} hrs/day` : (opt.screenTimeHrs != null ? `${opt.screenTimeHrs} hrs/day` : null)} />
      </Section>

      <Section title="Symptom Ratings (1–5)">
        <InfoRow label="Sleep quality" value={ratingBar(symptoms.sleep)} />
        <InfoRow label="Digestion" value={ratingBar(symptoms.digestion)} />
        <InfoRow label="Daily energy" value={ratingBar(symptoms.energy)} />
        <InfoRow label="Fatigue" value={ratingBar(symptoms.fatigue)} />
        <InfoRow label="Skin health" value={ratingBar(symptoms.skin)} />
        <InfoRow label="Hair health" value={ratingBar(symptoms.hair)} />
      </Section>

      {Object.keys(digestion).length > 0 ? (
        <Section title="Digestion Detail">
          <InfoRow label="Acidity severity" value={ratingBar(digestion.acidityRating)} />
          <InfoRow label="Bloating severity" value={ratingBar(digestion.bloatingRating)} />
          <InfoRow label="Constipation severity" value={ratingBar(digestion.constipationRating)} />
          <InfoRow label="Bowel frequency" value={digestion.bowelFrequency} />
          <InfoRow label="Stool consistency" value={digestion.stoolConsistency?.join(', ')} />
          <InfoRow label="Bloating timing" value={digestion.bloatingTiming?.join(', ')} />
          <InfoRow label="Acidity triggers" value={digestion.acidityTriggers?.join(', ')} />
          <InfoRow label="Other digestive symptoms" value={digestion.digestiveSymptoms?.join(', ')} />
          <InfoRow label="Daily rituals" value={digestion.dailyRituals?.join(', ')} />
          <InfoRow label="Lunch duration" value={LUNCH_DURATION_LABELS[digestion.lunchDuration] ?? digestion.lunchDuration} />
        </Section>
      ) : null}

      {(opt.bloodParameters?.length || opt.inflammationConcerns != null) ? (
        <Section title="Blood & Inflammation">
          <InfoRow label="Blood markers" value={opt.bloodParameters?.join(', ')} />
          <InfoRow label="Inflammation concerns" value={opt.inflammationConcerns != null ? (opt.inflammationConcerns ? 'Yes' : 'No') : null} />
        </Section>
      ) : null}

      {Object.keys(foodPattern).length > 0 ? (
        <Section title="Food Pattern">
          <InfoRow label="Diet type" value={DIET_LABELS[foodPattern.dietType] ?? foodPattern.dietType} />
          <InfoRow label="Home cooked?" value={HOME_COOKED_LABELS[foodPattern.homeCooked] ?? foodPattern.homeCooked} />
          <InfoRow label="Who cooks?" value={WHO_COOKS_LABELS[foodPattern.whoCooks] ?? foodPattern.whoCooks} />
          <InfoRow label="Cooking oil" value={foodPattern.cookingOil} />
          <InfoRow label="Meals / day" value={foodPattern.mealsPerDay} />
          <InfoRow label="Eats out / week" value={foodPattern.eatsOutPerWeek != null ? `${foodPattern.eatsOutPerWeek}x` : null} />
          <InfoRow label="Packaged food" value={foodPattern.packagedFoodFrequency?.replace('_', '/')} />
          <InfoRow label="Sugar drinks" value={foodPattern.sugarDrinks != null ? (foodPattern.sugarDrinks ? 'Yes' : 'No') : null} />
          <InfoRow label="Energy/carbonated drinks" value={ENERGY_DRINKS_LABELS[foodPattern.energyCarbonatedDrinks] ?? foodPattern.energyCarbonatedDrinks} />
          <InfoRow label="Tea/coffee/day" value={foodPattern.teaCoffeePerDay != null ? `${foodPattern.teaCoffeePerDay}` : null} />
          <InfoRow label="First cup timing" value={foodPattern.teaCoffeeFirstCupTime} />
          <InfoRow label="Cuisines" value={foodPattern.cuisines?.join(', ')} />
          <InfoRow label="Food likes" value={foodPattern.foodLikes} />
          <InfoRow label="Food dislikes" value={foodPattern.foodDislikes} />
          <InfoRow label="Cravings" value={foodPattern.cravings} />
          <InfoRow label="Eating speed" value={EATING_SPEED_LABELS[foodPattern.eatingSpeed] ?? foodPattern.eatingSpeed} />
          <InfoRow label="Binge/emotional eating" value={BINGE_EATING_LABELS[foodPattern.bingeEating] ?? foodPattern.bingeEating} />
        </Section>
      ) : null}

      {Object.keys(dailyMeals).length > 0 ? (
        <Section title="Typical Daily Meals">
          {Object.entries(dailyMeals as Record<string, { time?: string; items?: string[] }>).map(([key, meal]) => {
            if (!meal || (!meal.time && !meal.items?.length)) return null;
            const value = [meal.time, meal.items?.join(', ')].filter(Boolean).join(' — ');
            return <InfoRow key={key} label={MEAL_LABELS[key] ?? key} value={value} />;
          })}
        </Section>
      ) : null}

      {(opt.medicalHistory?.length || opt.allergies || opt.surgicalHistory) ? (
        <Section title="Medical History">
          <InfoRow label="Diagnosed conditions" value={opt.medicalHistory?.join(', ')} />
          <InfoRow label="Allergies / intolerances" value={opt.allergies} />
          <InfoRow label="Surgical history" value={opt.surgicalHistory} />
        </Section>
      ) : null}

      {opt.familyHistory?.length ? (
        <Section title="Family History">
          <InfoRow label="Conditions" value={opt.familyHistory.join(', ')} />
        </Section>
      ) : null}

      {opt.medications?.length ? (
        <Section title="Medications">
          {opt.medications.map((m: any, i: number) => (
            <InfoRow key={i} label={m.name} value={m.frequency ?? '—'} />
          ))}
        </Section>
      ) : null}

      {Object.keys(oncology).length > 0 ? (
        <Section title="Oncology / Cancer Nutrition">
          <InfoRow label="Diagnosis" value={oncology.diagnosis} />
          <InfoRow label="Type of cancer" value={oncology.type} />
          <InfoRow label="Date of diagnosis" value={oncology.diagnosisDate} />
          <InfoRow label="Current treatment" value={oncology.treatment?.map((t: string) => ONCOLOGY_TREATMENT_LABELS[t] ?? t).join(', ')} />
          <InfoRow label="Treatment cycle / stage" value={oncology.treatmentStage} />
          <InfoRow label="Treatment-related symptoms" value={oncology.treatmentSymptoms?.map((s: string) => ONCOLOGY_SYMPTOM_LABELS[s] ?? s).join(', ')} />
          <InfoRow label="Eating pattern changes" value={oncology.eatingPatternChanges} />
          <InfoRow label="Food preferences in treatment" value={oncology.treatmentFoodPreferences} />
          <InfoRow label="Food intolerances in treatment" value={oncology.treatmentFoodIntolerances} />
          <InfoRow label="Nutritional supplements" value={oncology.supplements} />
          <InfoRow label="Tube feeding" value={oncology.tubeFeeding != null ? (oncology.tubeFeeding ? 'Yes' : 'No') : null} />
          <InfoRow label="Food safety concerns" value={oncology.foodSafetyConcerns?.map((s: string) => FOOD_SAFETY_LABELS[s] ?? s).join(', ')} />
        </Section>
      ) : null}

      {Object.keys(lifestyleDepth).length > 1 ? (
        <Section title="Lifestyle Depth">
          <InfoRow label="Sleep time" value={lifestyleDepth.sleepTime} />
          <InfoRow label="Wake up time" value={lifestyleDepth.wakeTime} />
          <InfoRow label="Daily steps" value={lifestyleDepth.dailySteps != null ? lifestyleDepth.dailySteps.toLocaleString() : null} />
          <InfoRow label="Exercise type" value={lifestyleDepth.exerciseType} />
          <InfoRow label="Exercise duration" value={EXERCISE_DURATION_LABELS[lifestyleDepth.exerciseDuration] ?? lifestyleDepth.exerciseDuration} />
          <InfoRow label="Exercise frequency" value={EXERCISE_FREQUENCY_LABELS[lifestyleDepth.exerciseFrequency] ?? lifestyleDepth.exerciseFrequency} />
          <InfoRow label="Stress level" value={ratingBar(lifestyleDepth.stress)} />
          <InfoRow label="Primary stress source" value={STRESS_SOURCE_LABELS[lifestyleDepth.stressSource] ?? lifestyleDepth.stressSource} />
          <InfoRow label="Smoking" value={lifestyleDepth.smoking?.active != null ? (lifestyleDepth.smoking.active ? `Yes — ${lifestyleDepth.smoking.frequency ?? ''}` : 'No') : null} />
          <InfoRow label="Alcohol" value={lifestyleDepth.alcohol?.active != null ? (lifestyleDepth.alcohol.active ? `Yes — ${lifestyleDepth.alcohol.frequency ?? ''}` : 'No') : null} />
          <InfoRow label="Shift work" value={lifestyleDepth.shiftWork != null ? (lifestyleDepth.shiftWork ? 'Yes' : 'No') : null} />
          <InfoRow label="Travel frequency" value={lifestyleDepth.travelFrequency} />
          <InfoRow label="Wellness rituals" value={lifestyleDepth.wellnessRituals?.length ? lifestyleDepth.wellnessRituals.join(', ') : null} />
        </Section>
      ) : null}

      {branch === 'female' && Object.keys(female).length > 0 ? (
        <Section title="Women's Health">
          <InfoRow label="Periods status" value={female.periodsStatus} />
          <InfoRow label="Last period date" value={female.lastPeriodDate} />
          <InfoRow label="Cycle length" value={female.cycleLengthDays ? `${female.cycleLengthDays} days` : null} />
          <InfoRow label="Period days" value={female.periodDays ? `${female.periodDays} days` : null} />
          <InfoRow label="Flow" value={female.flow?.join(', ')} />
          <InfoRow label="Pain severity" value={ratingBar(female.painSeverity)} />
          <InfoRow label="Pain medication" value={female.periodPainMeds != null ? (female.periodPainMeds ? 'Yes' : 'No') : null} />
          <InfoRow label="Endometriosis surgery" value={female.endometriosisSurgery != null ? (female.endometriosisSurgery ? 'Yes' : 'No') : null} />
          <InfoRow label="Hysterectomy" value={female.hysterectomy != null ? (female.hysterectomy ? 'Yes' : 'No') : null} />
          <InfoRow label="Hormonal intervention" value={female.hormonalIntervention?.active != null ? (female.hormonalIntervention.active ? `Yes — ${female.hormonalIntervention.types?.join(', ') ?? ''}` : 'No') : null} />
          <InfoRow label="PMS symptoms" value={female.pmsSymptoms?.join(', ')} />
          <InfoRow label="Pregnancy / breastfeeding status" value={pregnancy.status} />
          <InfoRow label="Menopause" value={female.menopause?.reached != null ? (female.menopause.reached ? `Yes, age ${female.menopause.ageAt ?? '?'} (${female.menopause.type ?? ''})` : 'No') : null} />
        </Section>
      ) : null}

      {pregnancy.status === 'trying' && Object.keys(fertility).length > 0 ? (
        <Section title="Fertility Details">
          <InfoRow label="Trying to conceive for" value={FERTILITY_DURATION_LABELS[fertility.tryingDuration] ?? fertility.tryingDuration} />
          <InfoRow label="Fertility treatment" value={FERTILITY_TREATMENT_LABELS[fertility.treatment] ?? fertility.treatment} />
          <InfoRow label="Diagnosed fertility conditions" value={fertility.diagnosedConditions} />
        </Section>
      ) : null}

      {pregnancy.status === 'pregnant' ? (
        <Section title="Pregnancy Details">
          <InfoRow label="Trimester" value={pregnancy.trimester} />
          <InfoRow label="Expected due date" value={pregnancy.dueDate} />
          <InfoRow label="Pre-pregnancy weight" value={pregnancy.prePregnancyWeightKg ? `${pregnancy.prePregnancyWeightKg} kg` : null} />
          <InfoRow label="Gestational diabetes" value={pregnancy.gestationalDiabetes != null ? (pregnancy.gestationalDiabetes ? 'Yes' : 'No') : null} />
          <InfoRow label="Pregnancy-induced hypertension" value={pregnancy.pregnancyInducedHypertension != null ? (pregnancy.pregnancyInducedHypertension ? 'Yes' : 'No') : null} />
          <InfoRow label="High-risk pregnancy" value={pregnancy.highRiskPregnancy != null ? (pregnancy.highRiskPregnancy ? 'Yes' : 'No') : null} />
          <InfoRow label="Previous pregnancies" value={pregnancy.previousPregnanciesCount} />
          <InfoRow label="Prenatal supplements" value={pregnancy.prenatalSupplements} />
          <InfoRow label="Pregnancy symptoms" value={pregnancy.symptoms?.join(', ')} />
        </Section>
      ) : null}

      {pregnancy.status === 'lactating' ? (
        <Section title="Lactation Details">
          <InfoRow label="Breastfeeding difficulties" value={lactation.breastfeedingDifficulties} />
          <InfoRow label="Supplementing with formula" value={lactation.formulaSupplementing != null ? (lactation.formulaSupplementing ? 'Yes' : 'No') : null} />
        </Section>
      ) : null}

      {branch === 'male' && Object.keys(male).length > 0 ? (
        <Section title="Men's Health">
          <InfoRow label="Libido" value={ratingBar(male.libido)} />
          <InfoRow label="Erectile concerns" value={male.erectileConcerns != null ? (male.erectileConcerns ? 'Yes' : 'No') : null} />
          <InfoRow label="Testosterone status" value={male.testosteroneStatus} />
          <InfoRow label="TRT use" value={male.trtUse != null ? (male.trtUse ? 'Yes' : 'No') : null} />
          <InfoRow label="Anabolic / steroids" value={male.steroidUse?.status} />
          <InfoRow label="Substances used" value={male.steroidUse?.substances?.join(', ')} />
          <InfoRow label="Urinary symptoms" value={male.urinarySymptoms?.join(', ')} />
          <InfoRow label="Prostate concerns" value={male.prostateConcerns != null ? (male.prostateConcerns ? 'Yes' : 'No') : null} />
        </Section>
      ) : null}

      {branch === 'child' && Object.keys(child).length > 0 ? (
        <Section title="Child-specific">
          <InfoRow label="Gender" value={child.gender} />
          <InfoRow label="Birth weight" value={child.birthWeightKg ? `${child.birthWeightKg} kg` : null} />
          <InfoRow label="Weight-for-age percentile" value={child.weightForAgePercentile != null ? `${child.weightForAgePercentile}%ile` : null} />
          <InfoRow label="Height-for-age percentile" value={child.heightForAgePercentile != null ? `${child.heightForAgePercentile}%ile` : null} />
          <InfoRow label="Mother's medical history" value={child.motherMedicalHistory} />
          <InfoRow label="Father's medical history" value={child.fatherMedicalHistory} />
          <InfoRow label="School grade" value={child.schoolGrade} />
          <InfoRow label="Stamina" value={ratingBar(child.stamina)} />
          <InfoRow label="Attention span" value={ratingBar(child.attentionSpan)} />
          <InfoRow label="Memory" value={ratingBar(child.memory)} />
          <InfoRow label="Focus" value={ratingBar(child.focus)} />
          <InfoRow label="Appetite" value={child.appetite} />
          <InfoRow label="Picky eater" value={ratingBar(child.pickyEater)} />
          <InfoRow label="Feeding concerns" value={child.feedingConcerns?.join(', ')} />
          <InfoRow label="Sports / week" value={child.sportsPerWeek != null ? `${child.sportsPerWeek}x` : null} />
          <InfoRow label="Sports timing" value={child.sportsTiming?.join(', ')} />
          <InfoRow label="Outdoor sports" value={child.outdoorSports?.join(', ')} />
          <InfoRow label="Indoor activities" value={child.indoorSports?.join(', ')} />
          <InfoRow label="Packaged food" value={child.packagedFoodFrequency?.replace('_', '/')} />
          <InfoRow label="Screen time" value={child.screenTimeHrs != null ? `${child.screenTimeHrs} hrs/day` : null} />
          <InfoRow label="Growth concerns" value={child.growthConcerns?.join(', ')} />
        </Section>
      ) : null}

      {Object.keys(childFeeding).length > 0 ? (
        <Section title="Infant Feeding History">
          <InfoRow label="Breastfed" value={childFeeding.breastfed != null ? (childFeeding.breastfed ? 'Yes' : 'No') : null} />
          <InfoRow label="Breastfeeding duration" value={childFeeding.breastfeedingDurationMonths != null ? `${childFeeding.breastfeedingDurationMonths} months` : null} />
          <InfoRow label="Formula fed" value={childFeeding.formulaFed != null ? (childFeeding.formulaFed ? 'Yes' : 'No') : null} />
          <InfoRow label="Age started solids" value={childFeeding.solidsStartAgeMonths != null ? `${childFeeding.solidsStartAgeMonths} months` : null} />
          <InfoRow label="Feeding difficulties" value={childFeeding.feedingDifficulties} />
        </Section>
      ) : null}

      {p.optional?.notes ? (
        <Section title="Additional Notes">
          <div className="py-2 text-sm text-foreground">{p.optional.notes}</div>
        </Section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress History Row
// ---------------------------------------------------------------------------
function ProgressRow({ entry }: { entry: ProgressEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ratings = [
    ['Sleep', entry.sleep_quality_rating],
    ['Digestion', entry.digestion_rating],
    ['Energy', entry.energy_rating],
    ['Fatigue', entry.fatigue_rating],
    ['Skin', entry.skin_rating],
    ['Hair', entry.hair_rating],
    ['Acidity', entry.acidity_rating],
    ['Bloating', entry.bloating_rating],
  ].filter(([, v]) => v != null) as [string, number][];

  return (
    <div className="rounded-xl border bg-card mb-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {new Date(entry.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {entry.weight_kg && <span className="text-xs text-muted-foreground">{entry.weight_kg} kg</span>}
          {ratings.slice(0, 3).map(([label, val]) => (
            <span key={label} className="text-xs text-muted-foreground">{label}: {val}/5</span>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3">
            {entry.weight_kg != null && <InfoRow label="Weight" value={`${entry.weight_kg} kg`} />}
            {entry.height_cm != null && <InfoRow label="Height" value={`${entry.height_cm} cm`} />}
            {entry.sleep_hours != null && <InfoRow label="Sleep hrs" value={`${entry.sleep_hours} hrs`} />}
            {entry.water_intake && <InfoRow label="Water" value={WATER_LABELS[entry.water_intake] ?? entry.water_intake} />}
            {entry.activity_level && <InfoRow label="Activity" value={ACTIVITY_LABELS[entry.activity_level] ?? entry.activity_level} />}
            {entry.screen_time_hrs != null && <InfoRow label="Screen time" value={`${entry.screen_time_hrs} hrs/day`} />}
            {entry.stress_rating != null && <InfoRow label="Stress" value={ratingBar(entry.stress_rating)} />}
            {entry.meals_per_day != null && <InfoRow label="Meals/day" value={`${entry.meals_per_day}`} />}
          </div>
          {ratings.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3">
              {ratings.map(([label, val]) => (
                <InfoRow key={label} label={label} value={ratingBar(val)} />
              ))}
            </div>
          )}
          {entry.blood_parameters?.length ? <InfoRow label="Blood markers" value={entry.blood_parameters.join(', ')} /> : null}
          {entry.inflammation_concerns != null && <InfoRow label="Inflammation" value={entry.inflammation_concerns ? 'Yes' : 'No'} />}
          {/* Branch-specific */}
          {entry.periods_status && <InfoRow label="Periods" value={entry.periods_status} />}
          {entry.period_pain_severity != null && <InfoRow label="Period pain" value={ratingBar(entry.period_pain_severity)} />}
          {entry.libido_rating != null && <InfoRow label="Libido" value={ratingBar(entry.libido_rating)} />}
          {entry.testosterone_status && <InfoRow label="Testosterone" value={entry.testosterone_status} />}
          {entry.stamina_rating != null && <InfoRow label="Stamina" value={ratingBar(entry.stamina_rating)} />}
          {entry.memory_rating != null && <InfoRow label="Memory" value={ratingBar(entry.memory_rating)} />}
          {entry.focus_rating != null && <InfoRow label="Focus" value={ratingBar(entry.focus_rating)} />}
          {entry.appetite && <InfoRow label="Appetite" value={entry.appetite} />}
          {/* Infant feeding */}
          {entry.breastfed != null && <InfoRow label="Breastfed" value={entry.breastfed ? 'Yes' : 'No'} />}
          {entry.breastfeeding_duration_months != null && <InfoRow label="Breastfeeding duration" value={`${entry.breastfeeding_duration_months} months`} />}
          {entry.formula_fed != null && <InfoRow label="Formula fed" value={entry.formula_fed ? 'Yes' : 'No'} />}
          {entry.solids_start_age_months != null && <InfoRow label="Solids started at" value={`${entry.solids_start_age_months} months`} />}
          {entry.feeding_difficulties && <InfoRow label="Feeding difficulties" value={entry.feeding_difficulties} />}
          {entry.notes && <div className="mt-2 text-sm text-muted-foreground border-t pt-2">{entry.notes}</div>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile Editor (inline)
// ---------------------------------------------------------------------------
function calcBmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

function formatAge(dob: string | null | undefined): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let totalMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) totalMonths--;
  if (totalMonths < 0 || totalMonths > 120 * 12) return null;
  const years = Math.floor(totalMonths / 12);
  if (years >= 1) return years === 1 ? '1 year' : `${years} years`;
  return totalMonths === 1 ? '1 month' : `${totalMonths} months`;
}

function ProfileTab({ client }: { client: any }) {
  const [editing, setEditing] = useState(false);
  const updateClient = useUpdateClient();
  const [form, setForm] = useState({
    weight: client.weight?.toString() ?? '',
    height: client.height?.toString() ?? '',
    goal: client.goal ?? '',
    diet_preference: client.diet_preference ?? '',
    supplements: client.supplements ?? '',
    chief_complaints: (client.chief_complaints ?? []).join(', '),
    family_history: (client.family_history ?? []).join(', '),
    health_conditions: (client.health_conditions ?? []).join(', '),
    notes: client.notes ?? '',
  });

  const handleSave = async () => {
    const weight = form.weight ? parseFloat(form.weight) : null;
    const height = form.height ? parseFloat(form.height) : null;
    await updateClient.mutateAsync({
      id: client.id,
      weight,
      height,
      bmi: calcBmi(weight, height),
      goal: (form.goal || null) as any,
      diet_preference: (form.diet_preference || null) as any,
      supplements: form.supplements || null,
      chief_complaints: (form.chief_complaints ? form.chief_complaints.split(',').map((s: string) => s.trim()).filter(Boolean) : []) as any,
      family_history: (form.family_history ? form.family_history.split(',').map((s: string) => s.trim()).filter(Boolean) : []) as any,
      health_conditions: (form.health_conditions ? form.health_conditions.split(',').map((s: string) => s.trim()).filter(Boolean) : []) as any,
      notes: form.notes || null,
    } as any);
    setEditing(false);
  };

  const F = ({ label, field, type = 'text' }: { label: string; field: keyof typeof form; type?: string }) => (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {editing ? (
        <Input
          type={type}
          value={form[field]}
          onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
          className="h-9"
        />
      ) : (
        <p className="text-sm text-foreground">{form[field] || '—'}</p>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        {editing ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={updateClient.isPending}><Save className="h-4 w-4 mr-1" />Save</Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-4 space-y-4">
          <CardHeader className="p-0 pb-2"><CardTitle className="text-sm">Contact & Identity</CardTitle></CardHeader>
          <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</p><p className="text-sm">{client.name}</p></div>
          <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p><p className="text-sm">{client.email ?? '—'}</p></div>
          <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</p><p className="text-sm">{client.phone ?? '—'}</p></div>
          <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Date of Birth</p><p className="text-sm">{client.date_of_birth ?? '—'}</p></div>
          <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Age</p><p className="text-sm">{formatAge(client.date_of_birth) ?? '—'}</p></div>
          <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Gender</p><p className="text-sm capitalize">{client.gender ?? '—'}</p></div>
          <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">City</p><p className="text-sm">{client.address ?? '—'}</p></div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-4">
          <CardHeader className="p-0 pb-2"><CardTitle className="text-sm">Health Profile</CardTitle></CardHeader>
          <F label="Weight (kg)" field="weight" type="number" />
          <F label="Height (cm)" field="height" type="number" />
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">BMI</p>
            <p className="text-sm">
              {calcBmi(form.weight ? parseFloat(form.weight) : null, form.height ? parseFloat(form.height) : null) ?? '—'}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Goal</p>
            {editing ? (
              <Select value={form.goal} onValueChange={(v) => setForm(f => ({ ...f, goal: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select goal" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : <p className="text-sm">{GOAL_LABELS[form.goal] ?? (form.goal || '—')}</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Diet Preference</p>
            {editing ? (
              <Select value={form.diet_preference} onValueChange={(v) => setForm(f => ({ ...f, diet_preference: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select diet type" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DIET_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : <p className="text-sm">{DIET_LABELS[form.diet_preference] ?? (form.diet_preference || '—')}</p>}
          </div>
          <F label="Supplements" field="supplements" />
        </CardContent></Card>

        <Card className="sm:col-span-2"><CardContent className="p-4 space-y-4">
          <CardHeader className="p-0 pb-2"><CardTitle className="text-sm">Health History</CardTitle></CardHeader>
          <F label="Chief Complaints (comma-separated)" field="chief_complaints" />
          <F label="Medical History / Diagnosed Conditions (comma-separated)" field="health_conditions" />
          <F label="Family History (comma-separated)" field="family_history" />
        </CardContent></Card>

        <Card className="sm:col-span-2"><CardContent className="p-4">
          <CardHeader className="p-0 pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          {editing ? (
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          ) : <p className="text-sm whitespace-pre-wrap">{form.notes || '—'}</p>}
        </CardContent></Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend Charts
// ---------------------------------------------------------------------------

// goodDir: +1 = higher is better (green), -1 = lower is better (green)
type MetricDef = { key: string; label: string; unit: string; color: string; goodDir: 1 | -1 };

const BODY_METRICS: MetricDef[] = [
  { key: 'weight_kg', label: 'Weight', unit: 'kg', color: '#FF4D06', goodDir: -1 },
];

const SYMPTOM_METRICS: MetricDef[] = [
  { key: 'sleep_quality_rating', label: 'Sleep Quality', unit: '/5', color: '#6366f1', goodDir:  1 },
  { key: 'energy_rating',        label: 'Energy',        unit: '/5', color: '#f59e0b', goodDir:  1 },
  { key: 'digestion_rating',     label: 'Digestion',     unit: '/5', color: '#10b981', goodDir:  1 },
  { key: 'fatigue_rating',       label: 'Fatigue',       unit: '/5', color: '#ef4444', goodDir: -1 },
  { key: 'skin_rating',          label: 'Skin Health',   unit: '/5', color: '#ec4899', goodDir:  1 },
  { key: 'hair_rating',          label: 'Hair Health',   unit: '/5', color: '#8b5cf6', goodDir:  1 },
  { key: 'acidity_rating',       label: 'Acidity',       unit: '/5', color: '#f97316', goodDir: -1 },
  { key: 'bloating_rating',      label: 'Bloating',      unit: '/5', color: '#06b6d4', goodDir: -1 },
];

const LIFESTYLE_METRICS: MetricDef[] = [
  { key: 'stress_rating',   label: 'Stress',      unit: '/5',  color: '#dc2626', goodDir: -1 },
  { key: 'sleep_hours',     label: 'Sleep Hours', unit: 'hrs', color: '#6366f1', goodDir:  1 },
  { key: 'screen_time_hrs', label: 'Screen Time', unit: 'hrs', color: '#f59e0b', goodDir: -1 },
];

function MiniChart({ data, metric }: { data: Record<string, any>[]; metric: MetricDef }) {
  const points = data.filter((d) => d[metric.key] != null);
  if (points.length < 2) return null;

  const latest = points[points.length - 1][metric.key] as number;
  const prev = points[points.length - 2][metric.key] as number;
  const delta = latest - prev;
  const isGood = delta * metric.goodDir > 0;
  const trendColor = delta === 0 ? '#94a3b8' : isGood ? '#10b981' : '#ef4444';
  const trendArrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '→';

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">{metric.label}</p>
        <span style={{ color: trendColor }} className="text-xs font-bold">
          {trendArrow} {Math.abs(delta).toFixed(1)}{metric.unit}
        </span>
      </div>
      <div className="mb-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-foreground">{latest}</span>
        <span className="text-xs text-muted-foreground">{metric.unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <Line
            type="monotone"
            dataKey={metric.key}
            stroke={metric.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls
          />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: 11 }}
            formatter={(v: any) => [`${v}${metric.unit}`, metric.label]}
            labelFormatter={(label) => label}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}

function MetricGroup({ title, metrics, data }: { title: string; metrics: MetricDef[]; data: Record<string, any>[] }) {
  const visible = metrics.filter((m) => data.some((d) => d[m.key] != null && data.filter((x) => x[m.key] != null).length >= 2));
  if (visible.length === 0) return null;
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((m) => <MiniChart key={m.key} data={data} metric={m} />)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend Summary Card — overall analysis across all tracked metrics
// ---------------------------------------------------------------------------

type AnalysisResult = {
  label: string;
  delta: number;
  status: 'improving' | 'declining' | 'stable';
};

// goodDir: +1 = higher is better, -1 = lower is better
const ANALYSIS_METRICS = [
  { key: 'sleep_quality_rating', label: 'Sleep Quality',   goodDir:  1 },
  { key: 'energy_rating',        label: 'Energy',          goodDir:  1 },
  { key: 'digestion_rating',     label: 'Digestion',       goodDir:  1 },
  { key: 'fatigue_rating',       label: 'Fatigue',         goodDir: -1 },
  { key: 'skin_rating',          label: 'Skin Health',     goodDir:  1 },
  { key: 'hair_rating',          label: 'Hair Health',     goodDir:  1 },
  { key: 'acidity_rating',       label: 'Acidity',         goodDir: -1 },
  { key: 'bloating_rating',      label: 'Bloating',        goodDir: -1 },
  { key: 'stress_rating',        label: 'Stress',          goodDir: -1 },
  { key: 'sleep_hours',          label: 'Sleep Duration',  goodDir:  1 },
  { key: 'screen_time_hrs',      label: 'Screen Time',     goodDir: -1 },
];

function analyseEntries(entries: ProgressEntry[]): AnalysisResult[] {
  if (entries.length < 2) return [];
  // Compare latest vs the entry right before it
  const sorted = [...entries].reverse();
  const latest = sorted[sorted.length - 1];
  const prev   = sorted[sorted.length - 2];

  return ANALYSIS_METRICS.flatMap((m) => {
    const lv = (latest as any)[m.key] as number | null;
    const pv = (prev   as any)[m.key] as number | null;
    if (lv == null || pv == null) return [];
    const delta = lv - pv;
    const isStable = delta === 0;
    const dirGood  = delta * m.goodDir > 0;
    return [{
      label:  m.label,
      delta,
      status: isStable ? 'stable' : dirGood ? 'improving' : 'declining',
    }];
  });
}

function TrendSummaryCard({ entries }: { entries: ProgressEntry[] }) {
  const results = analyseEntries(entries);
  if (results.length === 0) return null;

  const sorted   = [...entries].reverse();
  const firstFmt = new Date(sorted[0].entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const lastFmt  = new Date(sorted[sorted.length - 1].entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const improving = results.filter((r) => r.status === 'improving');
  const declining = results.filter((r) => r.status === 'declining');
  const stable    = results.filter((r) => r.status === 'stable');

  const overall = improving.length > declining.length
    ? 'improving'
    : declining.length > improving.length
      ? 'declining'
      : 'stable';

  const topWins     = improving.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
  const topConcerns = declining.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);

  const bannerCls =
    overall === 'improving' ? 'bg-green-50 border-green-200' :
    overall === 'declining' ? 'bg-red-50 border-red-100'    :
    'bg-muted/40 border-border';

  const pillCls =
    overall === 'improving' ? 'bg-green-100 text-green-700' :
    overall === 'declining' ? 'bg-red-100 text-red-600'     :
    'bg-muted text-muted-foreground';

  const pillLabel =
    overall === 'improving' ? '↑ Improving overall' :
    overall === 'declining' ? '↓ Needs attention'   :
    '→ Stable overall';

  return (
    <div className={`rounded-xl border p-5 ${bannerCls}`}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Overall Health Analysis</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entries.length} check-ins · {firstFmt} → {lastFmt}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${pillCls}`}>
          {pillLabel}
        </span>
      </div>

      {/* Score strip */}
      <div className="mb-4 grid grid-cols-3 divide-x overflow-hidden rounded-lg bg-white/70">
        <div className="py-3 text-center">
          <p className="text-2xl font-bold text-green-600">{improving.length}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Improving</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{stable.length}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Stable</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-2xl font-bold text-red-500">{declining.length}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Declining</p>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {topWins.length > 0 && (
          <div className="rounded-lg bg-white/70 p-3">
            <p className="mb-2 text-xs font-semibold text-green-700">✓ Key Wins (since last check-in)</p>
            <ul className="space-y-1.5">
              {topWins.map((w) => (
                <li key={w.label} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{w.label}</span>
                  <span className="font-semibold text-green-600">
                    ▲ {Math.abs(w.delta).toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {topConcerns.length > 0 && (
          <div className="rounded-lg bg-white/70 p-3">
            <p className="mb-2 text-xs font-semibold text-red-600">⚠ Watch Out</p>
            <ul className="space-y-1.5">
              {topConcerns.map((c) => (
                <li key={c.label} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{c.label}</span>
                  <span className="font-semibold text-red-500">
                    ▼ {Math.abs(c.delta).toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {improving.length === 0 && declining.length === 0 && (
          <p className="col-span-2 text-center text-xs text-muted-foreground">
            All tracked metrics are stable since the last check-in.
          </p>
        )}
      </div>
    </div>
  );
}

function TrendsTab({ entries }: { entries: ProgressEntry[] }) {
  if (entries.length < 2) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        At least 2 progress entries are needed to show trends.
      </div>
    );
  }

  // Sort oldest → newest
  const sorted = [...entries].reverse();
  const data = sorted.map((e) => ({
    date: new Date(e.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    weight_kg:             e.weight_kg,
    sleep_quality_rating:  e.sleep_quality_rating,
    energy_rating:         e.energy_rating,
    digestion_rating:      e.digestion_rating,
    fatigue_rating:        e.fatigue_rating,
    skin_rating:           e.skin_rating,
    hair_rating:           e.hair_rating,
    acidity_rating:        e.acidity_rating,
    bloating_rating:       e.bloating_rating,
    stress_rating:         e.stress_rating,
    sleep_hours:           e.sleep_hours,
    screen_time_hrs:       e.screen_time_hrs,
  }));

  return (
    <div className="space-y-8">
      <TrendSummaryCard entries={entries} />
      <MetricGroup title="Body" metrics={BODY_METRICS} data={data} />
      <MetricGroup title="Symptom Ratings (1 = poor · 5 = excellent)" metrics={SYMPTOM_METRICS} data={data} />
      <MetricGroup title="Lifestyle" metrics={LIFESTYLE_METRICS} data={data} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClientById(id);
  const { data: intakeSubmissions = [] } = useClientIntakeSubmissions(id);
  const { data: progressEntries = [] } = useClientProgressEntries(id);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">Loading…</div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">Client not found.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <button onClick={() => navigate('/clients')} className="hover:text-foreground">Clients</button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{client.name}</span>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={client.is_active ? 'default' : 'secondary'}>{client.is_active ? 'Active' : 'Inactive'}</Badge>
            {client.portal_access_enabled && <Badge variant="outline">Portal enabled</Badge>}
            {client.gender && <span className="text-xs text-muted-foreground capitalize">{client.gender}</span>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="intake">
            Intake Form {intakeSubmissions.length > 0 && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">{intakeSubmissions.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="progress">
            Progress {progressEntries.length > 0 && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">{progressEntries.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="measurements">Body Measurements</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab client={client} />
        </TabsContent>

        <TabsContent value="intake">
          {intakeSubmissions.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              No intake form submissions linked to this client yet.
            </div>
          ) : (
            <div>
              {intakeSubmissions.length > 1 && (
                <p className="mb-3 text-xs text-muted-foreground">{intakeSubmissions.length} submissions — showing most recent first.</p>
              )}
              {intakeSubmissions.map((sub, i) => (
                <div key={sub.id} className={i > 0 ? 'mt-8 pt-6 border-t' : ''}>
                  <IntakePayloadView submission={sub} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress">
          {progressEntries.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              No progress entries yet. The client can log check-ins from their portal.
            </div>
          ) : (
            <div>
              <p className="mb-3 text-xs text-muted-foreground">{progressEntries.length} entries — newest first. Click any entry to expand.</p>
              {progressEntries.map((entry) => <ProgressRow key={entry.id} entry={entry} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trends">
          <TrendsTab entries={progressEntries} />
        </TabsContent>

        <TabsContent value="measurements">
          <ClientMeasurementsPanel clientId={id!} clientName={client?.name ?? ''} heightCm={client?.height ?? null} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default ClientDetail;
