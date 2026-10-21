import mammoth from 'mammoth';

// Parses the clinic's Word recipe docs into meal_recipes-shaped rows.
//
// Layout these docs follow (see PMS/Sample recipe files/), one or more
// recipes per file:
//
//   MOZZARELLA AVOCADO GREEK SALAD      <- title: the line right before INGREDIENTS
//   INGREDIENTS                          <- optional trailing colon
//   30g mozzarella, cubed
//   ...
//   INSTRUCTIONS  (or METHOD)
//   Add lettuce, cucumber ...
//   For a creamier pesto: ...           <- "For a/an ...:", "Storage:", "Note:", "Tip:" -> Remarks
//
// Anything else after the method header (including sub-headings like
// "TO MAKE THAI RED CURRY") stays in Instructions, in order.

export type DocxRecipe = {
  Meal_name: string;
  Ingredients: string;
  Instructions: string;
  Remarks: string;
};

const INGREDIENTS_HEADER = /^ingredients?\s*:?$/i;
const METHOD_HEADER = /^(instructions?|method|directions?|preparation|steps)\s*:?$/i;
const REMARK_LINE = /^(for (a|an)\b[^:]{0,60}|storage|notes?|tips?|variations?|serving( suggestions?)?)\s*:/i;

const toTitleCase = (s: string) =>
  s === s.toUpperCase()
    ? s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase())
    : s;

export const parseRecipeText = (text: string, fallbackTitle = ''): DocxRecipe[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const starts = lines.reduce<number[]>((acc, l, i) => (INGREDIENTS_HEADER.test(l) ? [...acc, i] : acc), []);

  return starts.map((start, k) => {
    const title = start > 0 && !METHOD_HEADER.test(lines[start - 1]) ? lines[start - 1] : fallbackTitle;
    // Stop before the next recipe's title line.
    const end = k + 1 < starts.length ? starts[k + 1] - 1 : lines.length;
    const body = lines.slice(start + 1, end);
    const methodAt = body.findIndex((l) => METHOD_HEADER.test(l));

    const ingredients = methodAt === -1 ? body : body.slice(0, methodAt);
    const method = methodAt === -1 ? [] : body.slice(methodAt + 1);

    return {
      Meal_name: toTitleCase(title),
      Ingredients: ingredients.join('\n'),
      Instructions: method.filter((l) => !REMARK_LINE.test(l)).join('\n'),
      Remarks: method.filter((l) => REMARK_LINE.test(l)).join('\n'),
    };
  });
};

export const parseRecipeDocx = async (file: File): Promise<DocxRecipe[]> => {
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return parseRecipeText(value, file.name.replace(/\.docx$/i, ''));
};
