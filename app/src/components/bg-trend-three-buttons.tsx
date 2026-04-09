import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type BgTrendThreeValue = "rising" | "flat" | "falling";

type Unset = "unknown" | "not_sure";

type BgTrendThreeButtonsProps = {
  label: string;
  labelClassName?: string;
  value: BgTrendThreeValue | Unset;
  onChange: (v: BgTrendThreeValue | Unset) => void;
  unsetValue: Unset;
  /** Shown on the middle button (e.g. "Flat / stable" in scenario flows). */
  flatLabel?: string;
  className?: string;
  buttonClassName?: string;
  /** Optional wrapper id for tests (e.g. replaces legacy select test id). */
  groupTestId?: string;
};

/**
 * Three-button control for current glucose direction (rising / flat / falling).
 * Tapping the active choice again clears to `unsetValue` (unknown / not sure).
 */
export function BgTrendThreeButtons({
  label,
  labelClassName,
  value,
  onChange,
  unsetValue,
  flatLabel = "Flat",
  className,
  buttonClassName,
  groupTestId,
}: BgTrendThreeButtonsProps) {
  const options: { key: BgTrendThreeValue; title: string }[] = [
    { key: "rising", title: "Rising" },
    { key: "flat", title: flatLabel },
    { key: "falling", title: "Falling" },
  ];

  return (
    <div className={cn("space-y-2", className)} data-testid={groupTestId}>
      <Label className={cn("text-sm font-medium", labelClassName)}>{label}</Label>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map(({ key, title }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={value === key ? "default" : "outline"}
            className={cn("min-h-10 min-w-[5.25rem] flex-1 sm:flex-initial sm:min-w-[6.5rem]", buttonClassName)}
            data-testid={`bg-trend-${key}`}
            aria-pressed={value === key}
            onClick={() => onChange(value === key ? unsetValue : key)}
          >
            {title}
          </Button>
        ))}
      </div>
    </div>
  );
}
