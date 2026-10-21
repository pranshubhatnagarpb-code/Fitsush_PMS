import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, PenLine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { DietOption } from '@/hooks/useDietOptions';
import { cn } from '@/lib/utils';

// A meal slot in the manual diet planner. `text` is what gets shown/saved;
// `optionId` is set only when the meal came from diet_options (the only
// source that carries calories).
export type MealValue = { optionId: string | null; text: string };

export const emptyMeal: MealValue = { optionId: null, text: '' };

const RECIPE_RESULT_LIMIT = 50;

type Props = {
  value: MealValue;
  onChange: (value: MealValue) => void;
  options: DietOption[];
  placeholder: string;
};

export const MealPicker = ({ value, onChange, options, placeholder }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [recipes, setRecipes] = useState<string[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // meal_recipes has ~13k rows, so search it in the database instead of loading it all.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const term = search.trim().replace(/[%*\\]/g, ' ').trim();
    const t = setTimeout(async () => {
      setLoadingRecipes(true);
      let query = supabase
        .from('meal_recipes')
        .select('Meal_name')
        .order('Meal_name', { ascending: true })
        .limit(RECIPE_RESULT_LIMIT);
      if (term) query = query.ilike('Meal_name', `%${term}%`);
      const { data } = await query;
      if (!cancelled) {
        setRecipes((data || []).map((r) => r.Meal_name));
        setLoadingRecipes(false);
      }
    }, term ? 250 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, open]);

  const typed = search.trim();
  const q = typed.toLowerCase();
  const matchingOptions = options.filter((o) => !q || o.name.toLowerCase().includes(q));
  const exactExists = !!typed && [...options.map((o) => o.name), ...recipes].some((n) => n.toLowerCase() === q);
  const selectedOption = value.optionId ? options.find((o) => o.id === value.optionId) : undefined;

  const pick = (next: MealValue) => {
    onChange(next);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-auto min-h-10 whitespace-normal text-left"
        >
          <span className={cn('line-clamp-2', !value.text && 'text-muted-foreground')}>
            {value.text
              ? `${value.text}${selectedOption ? ` (${selectedOption.calories} kcal)` : ''}`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search recipes or type a meal..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[320px]">
            {typed && !exactExists && (
              <CommandGroup heading="Write your own">
                <CommandItem value={`custom:${typed}`} onSelect={() => pick({ optionId: null, text: typed })}>
                  <PenLine className="mr-2 h-4 w-4" />
                  Use "{typed}"
                </CommandItem>
              </CommandGroup>
            )}
            {value.text && (
              <CommandGroup>
                <CommandItem value="clear" onSelect={() => pick(emptyMeal)} className="text-muted-foreground">
                  <X className="mr-2 h-4 w-4" /> Clear selection
                </CommandItem>
              </CommandGroup>
            )}
            {matchingOptions.length > 0 && (
              <CommandGroup heading="Meal options (with calories)">
                {matchingOptions.map((opt) => (
                  <CommandItem key={opt.id} value={`option:${opt.id}`} onSelect={() => pick({ optionId: opt.id, text: opt.name })}>
                    <Check className={cn('mr-2 h-4 w-4', value.optionId === opt.id ? 'opacity-100' : 'opacity-0')} />
                    {opt.name} ({opt.calories} kcal) {!opt.is_vegetarian && '🍗'}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading={loadingRecipes ? 'Recipes — searching...' : `Recipes${recipes.length === RECIPE_RESULT_LIMIT ? ` (first ${RECIPE_RESULT_LIMIT} — type to narrow)` : ''}`}>
              {recipes.map((name) => (
                <CommandItem key={name} value={`recipe:${name}`} onSelect={() => pick({ optionId: null, text: name })}>
                  <Check className={cn('mr-2 h-4 w-4', !value.optionId && value.text === name ? 'opacity-100' : 'opacity-0')} />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandEmpty>{loadingRecipes ? 'Searching...' : 'No meals found.'}</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
