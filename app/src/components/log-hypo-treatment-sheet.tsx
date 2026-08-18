import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CgmPrefillButton } from "@/components/cgm-prefill-button";
import { useAutoCgmBgField } from "@/hooks/use-auto-cgm-bg-field";
import { carbSourceLogLabel } from "@/lib/hypo-treatment-display";
import type { UserProfile } from "@/lib/storage";
import { cn } from "@/lib/utils";

const TREATMENT_OPTIONS = [
  { value: "Glucose tablets", short: "Tablets" },
  { value: "Juice", short: "Juice" },
  { value: "Sweets", short: "Sweets" },
  { value: "Sugary drink", short: "Drink" },
  { value: "Gel", short: "Gel" },
  { value: "Other", short: "Other" },
] as const;

type LogHypoTreatmentSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
  onSubmit: (fields: { glucoseInput: string; treatment: string; notes: string }) => void;
};

export function LogHypoTreatmentSheet({
  open,
  onOpenChange,
  profile,
  onSubmit,
}: LogHypoTreatmentSheetProps) {
  const [glucose, setGlucose] = useState("");
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");
  const cgm = useAutoCgmBgField({
    bgValue: glucose,
    onApplyBg: setGlucose,
    autoApplyKey: open ? "dashboard-hypo" : undefined,
  });

  const bgUnitsLabel: "mmol/L" | "mg/dL" = profile?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const glucoseStep = bgUnitsLabel === "mg/dL" ? "1" : "0.1";
  const preferred = carbSourceLogLabel(profile, "hypo");

  const treatments = useMemo(() => {
    if (!preferred || TREATMENT_OPTIONS.some((opt) => opt.value === preferred)) {
      return [...TREATMENT_OPTIONS];
    }
    return [{ value: preferred, short: preferred }, ...TREATMENT_OPTIONS];
  }, [preferred]);

  useEffect(() => {
    if (!open) return;
    setGlucose("");
    setNotes("");
    setTreatment(preferred ?? "");
  }, [open, preferred]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Log treatment"
      description="What you took is enough — glucose and notes are optional."
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-3"
        data-testid="sheet-log-hypo-treatment"
      >
        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Blood glucose</p>
          <div className="flex h-12 items-center gap-2 rounded-xl border border-border/70 bg-background px-3">
            <Input
              id="dash-hypo-glucose"
              type="number"
              inputMode="decimal"
              step={glucoseStep}
              placeholder={bgUnitsLabel === "mg/dL" ? "58" : "3.2"}
              value={glucose}
              onChange={(e) => cgm.onBgChange(e.target.value)}
              className="h-11 border-0 bg-transparent px-0 text-lg tabular-nums shadow-none focus-visible:ring-0"
              data-testid="input-dashboard-hypo-glucose"
            />
            <span className="shrink-0 text-sm text-muted-foreground">{bgUnitsLabel}</span>
          </div>
          <CgmPrefillButton
            prefill={cgm.prefill}
            loading={cgm.loading}
            bgUnits={bgUnitsLabel}
            currentValue={glucose}
            onApply={cgm.onBgChange}
            onRefresh={cgm.refresh}
            emptyHint={cgm.emptyHint}
            allowSync
            testId="button-dashboard-hypo-cgm-prefill"
          />
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">What did you take?</p>
          <div className="grid grid-cols-3 gap-2" data-testid="select-dashboard-hypo-treatment" role="group">
            {treatments.map((opt) => {
              const selected = treatment === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTreatment(selected ? "" : opt.value)}
                  className={cn(
                    "min-h-11 truncate rounded-xl border px-2 text-sm font-medium leading-tight transition-colors",
                    selected
                      ? "border-emerald-500/50 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100"
                      : "border-border/70 bg-muted/20 text-foreground",
                  )}
                  aria-pressed={selected}
                >
                  {opt.short}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Notes</p>
          <Input
            id="dash-hypo-notes"
            placeholder="e.g. shaky before lunch"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-12 rounded-xl"
            data-testid="input-dashboard-hypo-notes"
          />
        </section>
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/50 px-4 pb-4 pt-3">
        <Button
          type="button"
          onClick={() => onSubmit({ glucoseInput: glucose, treatment, notes })}
          className="h-12 w-full gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
          data-testid="button-dashboard-confirm-hypo"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Log treatment
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          <Link
            href="/tools/hypo-history"
            className="font-medium text-primary underline-offset-4 hover:underline"
            data-testid="link-hypo-full-history"
            onClick={() => onOpenChange(false)}
          >
            Hypo history
          </Link>
        </p>
      </div>
    </BottomSheet>
  );
}
