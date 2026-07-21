import { Beef, Droplet, Wheat } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEAL_CARB_TYPE_OPTIONS, type MealComposition } from "@/lib/meal-impact";
import { cn } from "@/lib/utils";

type MealCompositionBuilderProps = {
  value: MealComposition;
  onChange: (value: MealComposition) => void;
  className?: string;
};

const TOGGLES: {
  key: "hasFat" | "hasProtein" | "hasFibre";
  label: string;
  icon: typeof Droplet;
}[] = [
  { key: "hasFat", label: "Has fat", icon: Droplet },
  { key: "hasProtein", label: "Has protein", icon: Beef },
  { key: "hasFibre", label: "High fibre", icon: Wheat },
];

/** Guided "describe your meal" builder driving the meal impact prediction — no food database. */
export function MealCompositionBuilder({ value, onChange, className }: MealCompositionBuilderProps) {
  return (
    <div className={cn("space-y-3", className)} data-testid="meal-composition-builder">
      <div className="space-y-2">
        <Label htmlFor="meal-carb-type">What's the main carb?</Label>
        <Select
          value={value.carbType}
          onValueChange={(v) => onChange({ ...value, carbType: v as MealComposition["carbType"] })}
        >
          <SelectTrigger id="meal-carb-type" data-testid="select-meal-carb-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEAL_CARB_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Anything else in this meal?</Label>
        <div className="grid grid-cols-3 gap-2">
          {TOGGLES.map(({ key, label, icon: Icon }) => {
            const active = value[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...value, [key]: !active })}
                data-testid={`toggle-meal-${key}`}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 bg-muted/20 text-muted-foreground hover:bg-muted/40",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="text-[11px] font-medium leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
