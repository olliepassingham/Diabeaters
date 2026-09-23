import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppointmentType } from "@/lib/storage";
import {
  appointmentShowsEyeFields,
  appointmentShowsFootFields,
  appointmentShowsHba1cFields,
  screeningResultLabel,
  type AppointmentOutcome,
  type AppointmentScreeningResult,
} from "@/lib/appointment-outcomes";

const SCREENING_OPTIONS: AppointmentScreeningResult[] = ["clear", "follow_up", "referral", "other"];

type Props = {
  type: AppointmentType;
  visitDate: string;
  outcome: AppointmentOutcome;
  onChange: (next: AppointmentOutcome) => void;
};

/**
 * Type-driven post-visit results (HbA1c, eye/foot, short note).
 * Educational history only — not lab interpretation.
 */
export function AppointmentResultsFields({ type, visitDate, outcome, onChange }: Props) {
  const showHba1c = appointmentShowsHba1cFields(type);
  const showEye = appointmentShowsEyeFields(type);
  const showFoot = appointmentShowsFootFields(type);

  return (
    <div
      className="space-y-4 rounded-2xl border border-border/60 bg-muted/15 p-3.5"
      data-testid="appointment-results-fields"
    >
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-foreground">Results</p>
        <p className="text-xs leading-snug text-muted-foreground">
          Optional — log what you were told after the visit. For your records and Patterns, not a diagnosis.
        </p>
      </div>

      {showHba1c ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="outcome-hba1c" className="text-xs font-medium text-muted-foreground">
              HbA1c (%)
            </Label>
            <Input
              id="outcome-hba1c"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={3}
              max={20}
              placeholder="e.g. 7.2"
              value={outcome.hba1cPercent ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw.trim()) {
                  onChange({ ...outcome, hba1cPercent: undefined });
                  return;
                }
                const n = Number(raw);
                onChange({
                  ...outcome,
                  hba1cPercent: Number.isFinite(n) ? n : outcome.hba1cPercent,
                });
              }}
              data-testid="input-outcome-hba1c"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outcome-result-date" className="text-xs font-medium text-muted-foreground">
              Result date
            </Label>
            <Input
              id="outcome-result-date"
              type="date"
              value={outcome.resultDate ?? visitDate}
              onChange={(e) =>
                onChange({
                  ...outcome,
                  resultDate: e.target.value || undefined,
                })
              }
              data-testid="input-outcome-result-date"
            />
          </div>
        </div>
      ) : null}

      {showEye ? (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Eye screening</Label>
          <Select
            value={outcome.eyeResult ?? "none"}
            onValueChange={(v) =>
              onChange({
                ...outcome,
                eyeResult: v === "none" ? undefined : (v as AppointmentScreeningResult),
              })
            }
          >
            <SelectTrigger className="h-11 rounded-xl" data-testid="select-outcome-eye">
              <SelectValue placeholder="Not recorded" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not recorded</SelectItem>
              {SCREENING_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {screeningResultLabel(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {showFoot ? (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Foot check</Label>
          <Select
            value={outcome.footResult ?? "none"}
            onValueChange={(v) =>
              onChange({
                ...outcome,
                footResult: v === "none" ? undefined : (v as AppointmentScreeningResult),
              })
            }
          >
            <SelectTrigger className="h-11 rounded-xl" data-testid="select-outcome-foot">
              <SelectValue placeholder="Not recorded" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not recorded</SelectItem>
              {SCREENING_OPTIONS.filter((o) => o !== "referral").map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {screeningResultLabel(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="outcome-note" className="text-xs font-medium text-muted-foreground">
          Outcome note
        </Label>
        <Textarea
          id="outcome-note"
          rows={2}
          maxLength={500}
          placeholder="Anything else from the visit (optional)"
          value={outcome.outcomeNote ?? ""}
          onChange={(e) => onChange({ ...outcome, outcomeNote: e.target.value })}
          data-testid="input-outcome-note"
        />
      </div>
    </div>
  );
}
