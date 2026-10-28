import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { loadMatchedRecipes, type RecipeEdits, type RecipeRow } from '@/lib/dietPlanPdf';
import { aiRecipeCandidates, manualRecipeKeys } from '@/lib/dietPlanHtml';

// What's being edited in the dialog: a matched recipe (by its original name),
// an added recipe (by index), or a new one.
type Target = { kind: 'matched'; source: string } | { kind: 'added'; index: number } | { kind: 'new' };

const blankRecipe: RecipeRow = { Meal_name: '', Ingredients: '', Instructions: '', Remarks: '' };

type Props = {
  // The plan as the PDF builder sees it (is_ai_generated + ai_plan_data, or diet_plan_days).
  plan: any;
  edits: RecipeEdits;
  onChange: (edits: RecipeEdits) => void;
};

// "Recipes in the PDF" card: lists the recipes matched to the plan's meals and
// lets staff reword, remove or add recipes. Edits are saved with the plan and
// applied by buildPlanHtml, so every download and the Publish PDF match.
export const PlanRecipesEditor = ({ plan, edits, onChange }: Props) => {
  const [matched, setMatched] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [draft, setDraft] = useState<RecipeRow>(blankRecipe);

  // Re-match only when the meal names that matching looks at change.
  const isAI = !!(plan?.is_ai_generated && plan?.ai_plan_data);
  const matchKey = isAI ? aiRecipeCandidates(plan.ai_plan_data).join('|') : manualRecipeKeys(plan?.diet_plan_days ?? []).join('|');

  const reload = async () => {
    setLoading(true);
    try { setMatched(await loadMatchedRecipes(plan)); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!matchKey) { setMatched([]); return; }
    const t = setTimeout(reload, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey]);

  const removed = new Set(edits.removed ?? []);
  const added = edits.added ?? [];

  const open = (t: Target, recipe: RecipeRow) => { setTarget(t);
    setDraft({ Meal_name: recipe.Meal_name ?? '', Ingredients: recipe.Ingredients ?? '', Instructions: recipe.Instructions ?? '', Remarks: recipe.Remarks ?? '' });
  };

  const save = () => {
    if (!target || !draft.Meal_name.trim()) return;
    const recipe = { ...draft, Meal_name: draft.Meal_name.trim() };
    if (target.kind === 'matched') onChange({ ...edits, edited: { ...edits.edited, [target.source]: recipe } });
    else if (target.kind === 'added') onChange({ ...edits, added: added.map((r, i) => (i === target.index ? recipe : r)) });
    else onChange({ ...edits, added: [...added, recipe] });
    setTarget(null);
  };

  const resetMatched = (source: string) => {
    const { [source]: _dropped, ...rest } = edits.edited ?? {};
    onChange({ ...edits, edited: rest });
  };
  const toggleRemoved = (source: string) =>
    onChange({ ...edits, removed: removed.has(source) ? [...removed].filter((n) => n !== source) : [...removed, source] });

  const preview = (r: RecipeRow) => (r.Ingredients || r.Instructions || '').split('\n').filter(Boolean).slice(0, 2).join(' · ');

  return (
    <Card className="p-6 mt-6 shadow-card">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="font-semibold text-foreground">Recipes in the PDF</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={reload} disabled={loading || !matchKey} title="Match recipes again">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => open({ kind: 'new' }, blankRecipe)}>
            <Plus className="h-4 w-4 mr-1" /> Add Recipe
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Recipes matched to the meals above, printed under "Recipes for mentioned meals". Changes here apply to this plan only, not to the Meal Recipes library.
      </p>

      {matched.length === 0 && added.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{loading ? 'Matching recipes...' : 'No recipes match the meals in this plan yet.'}</p>
      ) : (
        <div className="divide-y rounded-md border">
          {matched.map((original) => {
            const source = original.Meal_name;
            const isRemoved = removed.has(source);
            const edited = edits.edited?.[source];
            const shown = edited ?? original;
            return (
              <div key={`m:${source}`} className={`flex items-start gap-3 p-3 ${isRemoved ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${isRemoved ? 'line-through' : ''}`}>{shown.Meal_name}</span>
                    {edited && !isRemoved && <Badge variant="secondary">Edited</Badge>}
                    {isRemoved && <Badge variant="outline">Not printed</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{preview(shown)}</p>
                </div>
                {isRemoved ? (
                  <Button variant="ghost" size="sm" onClick={() => toggleRemoved(source)}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Restore
                  </Button>
                ) : (
                  <>
                    {edited && (
                      <Button variant="ghost" size="icon" onClick={() => resetMatched(source)} title="Undo edits (use the library recipe)">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => open({ kind: 'matched', source }, shown)} title="Edit recipe">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleRemoved(source)} title="Don't print this recipe" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
          {added.map((r, i) => (
            <div key={`a:${i}`} className="flex items-start gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{r.Meal_name}</span>
                  <Badge variant="secondary">Added</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{preview(r)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => open({ kind: 'added', index: i }, r)} title="Edit recipe">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange({ ...edits, added: added.filter((_, j) => j !== i) })}
                title="Remove recipe"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{target?.kind === 'new' ? 'Add Recipe' : 'Edit Recipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Recipe name</Label>
              <Input value={draft.Meal_name} onChange={(e) => setDraft({ ...draft, Meal_name: e.target.value })} placeholder="e.g., Moong Dal Chilla" />
            </div>
            <div className="space-y-1">
              <Label>Ingredients <span className="text-xs text-muted-foreground font-normal">(one per line)</span></Label>
              <Textarea rows={6} value={draft.Ingredients} onChange={(e) => setDraft({ ...draft, Ingredients: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Instructions <span className="text-xs text-muted-foreground font-normal">(one step per line)</span></Label>
              <Textarea rows={8} value={draft.Instructions} onChange={(e) => setDraft({ ...draft, Instructions: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Textarea rows={3} value={draft.Remarks} onChange={(e) => setDraft({ ...draft, Remarks: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={save} disabled={!draft.Meal_name.trim()} className="gradient-primary text-primary-foreground">Save Recipe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
