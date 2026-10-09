import type { Hba1cUnit } from "@/lib/hba1c-units";
import { cn } from "@/lib/utils";

export function Hba1cUnitToggle({
  unit,
  onChange,
}: {
  unit: Hba1cUnit;
  onChange: (unit: Hba1cUnit) => void;
}) {
  return (
    <div role="radiogroup" aria-label="HbA1c units" className="inline-flex shrink-0 rounded-full bg-muted p-0.5">
      {(
        [
          ["percent", "%"],
          ["mmol", "mmol/mol"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={unit === id}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-full px-3 py-1 text-[13px] font-medium",
            unit === id ? "bg-foreground text-background" : "text-muted-foreground",
          )}
          data-testid={`hba1c-unit-${id}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
