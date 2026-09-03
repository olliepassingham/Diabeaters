import { useEffect, useMemo, useState } from "react";
import { Calculator, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  CARB_CATEGORY_LABELS,
  type CarbCompositionHint,
  type CarbFood,
  type CarbFoodCategory,
} from "@/lib/carb-estimator-data";
import {
  estimateCarbMeal,
  getCarbFood,
  searchCarbFoods,
  type CarbEstimateSelection,
} from "@/lib/carb-estimator";
import { cn } from "@/lib/utils";

type CarbEstimatorSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: { grams: number; compositionHint: CarbCompositionHint | null }) => void;
};

const CATEGORIES: CarbFoodCategory[] = [
  "meals",
  "breakfast",
  "bread",
  "staples",
  "fruit",
  "dairy",
  "snacks",
  "drinks",
];

function selectionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `carb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CarbEstimatorSheet({
  open,
  onOpenChange,
  onConfirm,
}: CarbEstimatorSheetProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CarbFoodCategory | "all">("meals");
  const [selections, setSelections] = useState<CarbEstimateSelection[]>([]);
  const estimate = useMemo(() => estimateCarbMeal(selections), [selections]);
  const [confirmedGrams, setConfirmedGrams] = useState("");

  useEffect(() => {
    setConfirmedGrams(estimate.suggestedGrams > 0 ? String(estimate.suggestedGrams) : "");
  }, [estimate.suggestedGrams]);

  const results = useMemo(
    () =>
      searchCarbFoods(query, {
        category: query.trim() ? "all" : category,
        limit: query.trim() ? 12 : 10,
      }),
    [category, query],
  );

  const addFood = (food: CarbFood) => {
    const defaultPortion = food.portions[Math.min(1, food.portions.length - 1)] ?? food.portions[0];
    if (!defaultPortion) return;
    setSelections((current) => [
      ...current,
      {
        id: selectionId(),
        foodId: food.id,
        portionId: defaultPortion.id,
        quantity: 1,
      },
    ]);
  };

  const updateSelection = (id: string, updates: Partial<CarbEstimateSelection>) => {
    setSelections((current) =>
      current.map((selection) => (selection.id === id ? { ...selection, ...updates } : selection)),
    );
  };

  const useEstimate = () => {
    const grams = Math.round(Number(confirmedGrams));
    if (!Number.isFinite(grams) || grams <= 0 || grams > 1000) return;
    onConfirm({ grams, compositionHint: estimate.compositionHint });
    onOpenChange(false);
  };

  const finalGrams = Number(confirmedGrams);
  const finalGramsValid = Number.isFinite(finalGrams) && finalGrams > 0 && finalGrams <= 1000;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      className="max-h-[94dvh] rounded-t-[1.75rem]"
      title={
        <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Calculator className="h-4 w-4" aria-hidden />
            </span>
            <span>Estimate meal carbs</span>
        </span>
      }
      description="Build your meal from typical portions, then check the result. Drag down to close."
    >
      <div className="flex min-h-0 flex-1 flex-col" data-testid="carb-estimator-sheet">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search food or meal"
              className="h-11 rounded-full pl-9"
              data-testid="input-carb-food-search"
            />
          </div>

          <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Food categories">
            <Button
              type="button"
              variant={category === "all" ? "default" : "ghost"}
              size="sm"
              className="h-8 shrink-0 rounded-full px-3 text-xs"
              onClick={() => setCategory("all")}
            >
              All
            </Button>
            {CATEGORIES.map((item) => (
              <Button
                key={item}
                type="button"
                variant={category === item ? "default" : "ghost"}
                size="sm"
                className="h-8 shrink-0 rounded-full px-3 text-xs"
                onClick={() => setCategory(item)}
              >
                {CARB_CATEGORY_LABELS[item]}
              </Button>
            ))}
          </div>

          <section className="mt-3" aria-labelledby="carb-search-results-title">
            <h3
              id="carb-search-results-title"
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              {query.trim() ? "Search results" : "Common choices"}
            </h3>
            {results.length ? (
              <div className="mt-1 grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                {results.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    className="group flex min-h-11 items-center justify-between gap-2 border-b border-border/30 py-2 text-left"
                    onClick={() => addFood(food)}
                    data-testid={`button-add-carb-food-${food.id}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{food.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {food.portions[Math.min(1, food.portions.length - 1)]?.label}
                      </span>
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-5 text-center text-sm text-muted-foreground">
                No curated match. Try a simpler food name.
              </p>
            )}
          </section>

          <section className="mt-5" aria-labelledby="selected-foods-title">
            <div className="flex items-center justify-between gap-2">
              <h3
                id="selected-foods-title"
                className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Your meal · {selections.length} {selections.length === 1 ? "item" : "items"}
              </h3>
              {selections.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2 text-xs text-muted-foreground"
                  onClick={() => setSelections([])}
                >
                  Clear
                </Button>
              ) : null}
            </div>

            {selections.length ? (
              <div className="mt-1 space-y-2">
                {selections.map((selection) => {
                  const food = getCarbFood(selection.foodId);
                  if (!food) return null;
                  return (
                    <div
                      key={selection.id}
                      className="rounded-2xl bg-muted/35 p-3"
                      data-testid={`carb-estimator-item-${selection.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{food.name}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-full text-muted-foreground"
                          onClick={() =>
                            setSelections((current) =>
                              current.filter((candidate) => candidate.id !== selection.id),
                            )
                          }
                          aria-label={`Remove ${food.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                      <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <Select
                          value={selection.portionId}
                          onValueChange={(portionId) => updateSelection(selection.id, { portionId })}
                        >
                          <SelectTrigger
                            className="h-10 min-w-0 rounded-xl bg-background/70 text-xs"
                            aria-label={`${food.name} portion`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {food.portions.map((portion) => (
                              <SelectItem key={portion.id} value={portion.id}>
                                {portion.label} · {portion.carbsGrams}g
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center rounded-xl bg-background/70">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-9 rounded-xl"
                            onClick={() =>
                              updateSelection(selection.id, {
                                quantity: Math.max(0.25, selection.quantity - 0.25),
                              })
                            }
                            aria-label={`Reduce ${food.name} quantity`}
                          >
                            <Minus className="h-3 w-3" aria-hidden />
                          </Button>
                          <span className="w-9 text-center text-xs font-semibold tabular-nums">
                            {selection.quantity}×
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-9 rounded-xl"
                            onClick={() =>
                              updateSelection(selection.id, {
                                quantity: Math.min(20, selection.quantity + 0.25),
                              })
                            }
                            aria-label={`Increase ${food.name} quantity`}
                          >
                            <Plus className="h-3 w-3" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-foreground">Start with one part of your meal</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Search above or browse a category. You can combine several foods.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-background/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-6">
          {estimate.items.length ? (
            <>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Typical estimate
                  </p>
                  <p className="font-display text-3xl font-semibold tracking-tight text-foreground">
                    {estimate.suggestedGrams}g
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Likely range {estimate.lowGrams}–{estimate.highGrams}g
                  </p>
                </div>
                <div className="w-28">
                  <Label htmlFor="confirmed-carb-estimate" className="text-[10px] text-muted-foreground">
                    Use grams
                  </Label>
                  <Input
                    id="confirmed-carb-estimate"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max="1000"
                    value={confirmedGrams}
                    onChange={(event) => setConfirmedGrams(event.target.value)}
                    className={cn("mt-1 h-10 rounded-xl text-right font-semibold tabular-nums", !finalGramsValid && confirmedGrams && "border-destructive")}
                    data-testid="input-confirmed-carb-estimate"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                Portions and recipes vary. Check packaging or weigh food when accuracy matters, especially before dosing.
              </p>
              <Button
                type="button"
                className="mt-3 h-11 w-full rounded-xl"
                onClick={useEstimate}
                disabled={!finalGramsValid}
                data-testid="button-use-carb-estimate"
              >
                Use this estimate
              </Button>
            </>
          ) : (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Add a food to calculate a typical range.
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
