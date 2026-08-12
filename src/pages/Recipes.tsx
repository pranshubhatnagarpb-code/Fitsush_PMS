import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ChefHat, Clock, Users, Flame, Search, Loader2, Lightbulb, UtensilsCrossed, Download, Pencil, Check, Plus, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Recipe {
  dishName: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  difficulty: string;
  calories: string;
  ingredients: { item: string; quantity: string }[];
  instructions: string[];
  nutritionTips: string;
  variations: string[];
  servingSuggestions: string;
}

const SERVING_OPTIONS = ["1", "2", "3", "4", "6", "8", "10"];

const Recipes = () => {
  const [dishName, setDishName] = useState("");
  const [servings, setServings] = useState("4");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleGenerateRecipe = async () => {
    if (!dishName.trim()) {
      toast.error("Please enter a dish name");
      return;
    }

    setIsLoading(true);
    setRecipe(null);
    setIsEditing(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-recipe', {
        body: {
          dishName: dishName.trim(),
          servings,
          additionalInstructions: additionalInstructions.trim(),
        },
      });

      if (fnError) {
        let message = fnError.message;
        if (fnError instanceof FunctionsHttpError) {
          const body = await fnError.context.json().catch(() => null);
          if (body?.error) message = body.error;
        }
        throw new Error(message);
      }

      setRecipe(data.recipe);
      toast.success("Recipe generated successfully!");
    } catch (err: any) {
      console.error("Error:", err);
      toast.error(err.message || "Failed to generate recipe");
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = <K extends keyof Recipe>(field: K, value: Recipe[K]) => {
    setRecipe((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateIngredient = (index: number, key: "item" | "quantity", value: string) => {
    setRecipe((prev) => {
      if (!prev) return prev;
      const ingredients = prev.ingredients.map((ing, i) => (i === index ? { ...ing, [key]: value } : ing));
      return { ...prev, ingredients };
    });
  };

  const addIngredient = () => {
    setRecipe((prev) => (prev ? { ...prev, ingredients: [...prev.ingredients, { item: "", quantity: "" }] } : prev));
  };

  const removeIngredient = (index: number) => {
    setRecipe((prev) => (prev ? { ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) } : prev));
  };

  const updateInstruction = (index: number, value: string) => {
    setRecipe((prev) => {
      if (!prev) return prev;
      const instructions = prev.instructions.map((step, i) => (i === index ? value : step));
      return { ...prev, instructions };
    });
  };

  const addInstruction = () => {
    setRecipe((prev) => (prev ? { ...prev, instructions: [...prev.instructions, ""] } : prev));
  };

  const removeInstruction = (index: number) => {
    setRecipe((prev) => (prev ? { ...prev, instructions: prev.instructions.filter((_, i) => i !== index) } : prev));
  };

  const updateVariation = (index: number, value: string) => {
    setRecipe((prev) => {
      if (!prev) return prev;
      const variations = prev.variations.map((v, i) => (i === index ? value : v));
      return { ...prev, variations };
    });
  };

  const addVariation = () => {
    setRecipe((prev) => (prev ? { ...prev, variations: [...prev.variations, ""] } : prev));
  };

  const removeVariation = (index: number) => {
    setRecipe((prev) => (prev ? { ...prev, variations: prev.variations.filter((_, i) => i !== index) } : prev));
  };

  const handleDownloadPDF = async () => {
    if (!recipe) return;

    try {
      toast.loading("Generating PDF...");
      
      // Create a temporary div to render the recipe content
      const element = document.getElementById('recipe-content');
      if (!element) {
        toast.error("Recipe content not found");
        return;
      }
      
      // Generate canvas from the element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
      });
      
      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Save the PDF
      const fileName = `${recipe.dishName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_recipe.pdf`;
      pdf.save(fileName);
      
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const difficultyColor = (d: string) => {
    if (d?.toLowerCase() === "easy") return "bg-green-100 text-green-800 border-green-200";
    if (d?.toLowerCase() === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ChefHat className="h-7 w-7 text-primary" />
            AI Recipe Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Enter any dish name and get a complete recipe with ingredients, steps & nutrition info
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. Paneer Butter Masala, Chicken Biryani, Masala Dosa..."
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isLoading && handleGenerateRecipe()}
                  className="pl-10"
                />
              </div>
              <div className="w-full sm:w-40 space-y-1">
                <Select value={servings} onValueChange={setServings}>
                  <SelectTrigger>
                    <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Servings" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVING_OPTIONS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n} {n === "1" ? "serving" : "servings"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerateRecipe} disabled={isLoading} className="min-w-[140px]">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <UtensilsCrossed className="h-4 w-4 mr-2" />
                    Get Recipe
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-1">
              <Label htmlFor="additional-instructions" className="text-sm text-muted-foreground">
                Additional instructions (optional)
              </Label>
              <Textarea
                id="additional-instructions"
                placeholder="e.g. diabetic-friendly, under 300 calories per serving, no onion-garlic, high protein, low oil..."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Cooking up the recipe for "{dishName}"...</p>
              <p className="text-sm text-muted-foreground mt-1">This usually takes 5-10 seconds</p>
            </CardContent>
          </Card>
        )}

        {/* Recipe Result */}
        {recipe && !isLoading && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex justify-end gap-2">
              {isEditing ? (
                <Button onClick={() => setIsEditing(false)} className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Done Editing
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(true)} className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit Recipe
                  </Button>
                  <Button onClick={handleDownloadPDF} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </>
              )}
            </div>

            {/* Recipe Content */}
            <div id="recipe-content" className="space-y-4">
            {/* Title & Meta */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px] space-y-2">
                    {isEditing ? (
                      <>
                        <Input
                          value={recipe.dishName}
                          onChange={(e) => updateField("dishName", e.target.value)}
                          className="text-xl font-semibold h-auto py-2"
                        />
                        <Textarea
                          value={recipe.description}
                          onChange={(e) => updateField("description", e.target.value)}
                          rows={2}
                        />
                      </>
                    ) : (
                      <>
                        <CardTitle className="text-xl">{recipe.dishName}</CardTitle>
                        <p className="text-muted-foreground mt-1">{recipe.description}</p>
                      </>
                    )}
                  </div>
                  {isEditing ? (
                    <Select value={recipe.difficulty} onValueChange={(v) => updateField("difficulty", v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Easy">Easy</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={difficultyColor(recipe.difficulty)}>
                      {recipe.difficulty}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    {isEditing ? (
                      <span className="flex items-center gap-1">
                        Prep: <Input value={recipe.prepTime} onChange={(e) => updateField("prepTime", e.target.value)} className="h-7 w-24" />
                      </span>
                    ) : (
                      <span>Prep: {recipe.prepTime}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    {isEditing ? (
                      <span className="flex items-center gap-1">
                        Cook: <Input value={recipe.cookTime} onChange={(e) => updateField("cookTime", e.target.value)} className="h-7 w-24" />
                      </span>
                    ) : (
                      <span>Cook: {recipe.cookTime}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0" />
                    {isEditing ? (
                      <Input value={recipe.servings} onChange={(e) => updateField("servings", e.target.value)} className="h-7 w-36" />
                    ) : (
                      <span>{recipe.servings}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Flame className="h-4 w-4 shrink-0" />
                    {isEditing ? (
                      <Input value={recipe.calories} onChange={(e) => updateField("calories", e.target.value)} className="h-7 w-44" />
                    ) : (
                      <span>{recipe.calories}</span>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Ingredients */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">🧾 Ingredients</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {recipe.ingredients?.map((ing, i) => (
                      <li key={i} className={isEditing ? "flex items-center gap-2" : "flex justify-between text-sm border-b border-border pb-2 last:border-0"}>
                        {isEditing ? (
                          <>
                            <Input
                              value={ing.item}
                              onChange={(e) => updateIngredient(i, "item", e.target.value)}
                              placeholder="Ingredient"
                              className="flex-1"
                            />
                            <Input
                              value={ing.quantity}
                              onChange={(e) => updateIngredient(i, "quantity", e.target.value)}
                              placeholder="Qty"
                              className="w-24"
                            />
                            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeIngredient(i)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="text-foreground">{ing.item}</span>
                            <span className="text-muted-foreground font-medium whitespace-nowrap ml-2">{ing.quantity}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {isEditing && (
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={addIngredient}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Ingredient
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">👨‍🍳 Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3">
                    {recipe.instructions?.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        {isEditing ? (
                          <div className="flex-1 flex items-start gap-2">
                            <Textarea
                              value={step}
                              onChange={(e) => updateInstruction(i, e.target.value)}
                              rows={2}
                              className="flex-1"
                            />
                            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeInstruction(i)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-foreground">{step}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                  {isEditing && (
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={addInstruction}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Step
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Nutrition & Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nutrition Tips */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">🥗 Nutrition Tips</CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <Textarea value={recipe.nutritionTips} onChange={(e) => updateField("nutritionTips", e.target.value)} rows={3} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{recipe.nutritionTips}</p>
                  )}
                </CardContent>
              </Card>

              {/* Variations */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-warning" />
                    Variations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {recipe.variations?.map((variation, i) => (
                      <li key={i} className="flex gap-2 text-sm text-muted-foreground items-center">
                        {isEditing ? (
                          <>
                            <Input value={variation} onChange={(e) => updateVariation(i, e.target.value)} className="flex-1" />
                            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeVariation(i)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="text-primary font-bold">•</span>
                            <span>{variation}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {isEditing && (
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={addVariation}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Variation
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Serving Suggestions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🍽️ Serving Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea value={recipe.servingSuggestions} onChange={(e) => updateField("servingSuggestions", e.target.value)} rows={2} />
                ) : (
                  <p className="text-sm text-muted-foreground">{recipe.servingSuggestions}</p>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!recipe && !isLoading && (
          <Card>
            <CardContent className="py-16 text-center">
              <ChefHat className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Enter a dish name above to get started</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try "Dal Makhani", "Chole Bhature", or any dish you'd like!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Recipes;
