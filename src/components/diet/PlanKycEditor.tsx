import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { KYC_ROWS, clientKyc, type PlanKyc } from '@/lib/dietPlanHtml';

type Macros = Partial<Pick<PlanKyc, 'calories' | 'protein' | 'carbs' | 'fat'>>;

const str = (v: unknown) => (v == null || v === '' ? '' : String(v));

// Pre-fill: the client record, then the latest body measurement (weight, BMI,
// body fat, BMR = resting metabolism) and the latest intake form (likes,
// dislikes, allergies, tea/coffee), then the plan's own calories/macros if known.
async function loadKycDefaults(client: any, macros?: Macros): Promise<PlanKyc> {
  const kyc = clientKyc(client);
  const [{ data: bm }, { data: intake }] = await Promise.all([
    (supabase.from('body_measurements' as any) as any)
      .select('weight, bmi, body_fat_percent, resting_metabolism')
      .eq('client_id', client.id)
      .order('measurement_date', { ascending: false })
      .limit(1),
    (supabase.from('intake_submissions' as any) as any)
      .select('payload')
      .eq('pms_lead_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  const m = (bm as any[])?.[0];
  if (m) {
    kyc.weight = str(m.weight) || kyc.weight;
    kyc.bmi = str(m.bmi) || kyc.bmi;
    kyc.bodyFat = m.body_fat_percent != null ? `${m.body_fat_percent}%` : '';
    kyc.bmr = str(m.resting_metabolism);
  }
  const opt = (intake as any[])?.[0]?.payload?.optional ?? {};
  const food = opt.foodPattern ?? {};
  kyc.likes = str(food.foodLikes);
  kyc.dislikes = str(food.foodDislikes);
  kyc.allergies = str(opt.allergies);
  if (Number(food.teaCoffeePerDay) > 0) kyc.addicted = `tea/coffee (${food.teaCoffeePerDay}/day)`;
  if (!kyc.familyHistory && Array.isArray(opt.familyHistory)) kyc.familyHistory = opt.familyHistory.join(', ');
  return { ...kyc, ...Object.fromEntries(Object.entries(macros ?? {}).filter(([, v]) => v)) };
}

type Props = {
  client: any | null | undefined;
  kyc: PlanKyc | undefined;
  onChange: (kyc: PlanKyc) => void;
  macros?: Macros; // e.g. the AI plan's daily totals, used when pre-filling
};

// "Client Details (KYC)" card: the rows printed in the Client Details box of
// every diet chart. Pre-filled once per client; staff can change anything.
export const PlanKycEditor = ({ client, kyc, onChange, macros }: Props) => {
  const [loading, setLoading] = useState(false);

  const refill = async () => {
    if (!client) return;
    setLoading(true);
    try { onChange(await loadKycDefaults(client, macros)); } finally { setLoading(false); }
  };

  // Fill when there's nothing yet, or the plan's client changed.
  useEffect(() => {
    if (!client?.id || kyc?.clientId === client.id) return;
    let cancelled = false;
    setLoading(true);
    loadKycDefaults(client, macros)
      .then((k) => { if (!cancelled) onChange(k); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, kyc?.clientId]);

  if (!client) return null;
  const set = (field: keyof PlanKyc, value: string) => kyc && onChange({ ...kyc, [field]: value });

  return (
    <Card className="p-6 mb-6 shadow-card">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="font-semibold text-foreground">Client Details (KYC)</h3>
        <Button variant="outline" size="sm" onClick={refill} disabled={loading} title="Fill again from the client's profile, body measurements and intake form">
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refill from profile
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Printed as the Client Details table at the top of the diet chart. Changes apply to this plan only.
      </p>
      {!kyc ? (
        <p className="text-sm text-muted-foreground italic">Loading client details...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {KYC_ROWS.map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={kyc[key]} onChange={(e) => set(key, e.target.value)} placeholder="--" />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note under the table</Label>
            <Input value={kyc.note} onChange={(e) => set('note', e.target.value)} placeholder="Leave empty to hide" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {([['calories', 'Calories given'], ['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']] as const).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={kyc[key]} onChange={(e) => set(key, e.target.value)} placeholder={key === 'calories' ? 'e.g., 1064' : 'e.g., 86g'} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
