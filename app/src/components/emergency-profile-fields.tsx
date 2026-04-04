import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

type FieldKey =
  | "contactName"
  | "relation"
  | "phone"
  | "phoneSecondary"
  | "medicalInstructions"
  | "notes";

function fieldShellClass(prefilled: boolean): string {
  return cn(
    "rounded-md transition-[box-shadow,background-color,border-color] duration-500 ease-out",
    prefilled && "border-primary/35 bg-primary/[0.06] shadow-[inset_0_0_0_1px_rgb(var(--color-primary)/0.2)]",
    prefilled && "animate-[emergency-prefill-glow_1.2s_ease-out_1]",
  );
}

/**
 * Shared inputs for the unified emergency profile. Used on Account and Settings so every edit hits the same store.
 */
export function EmergencyProfileFields({
  className,
  syncGeneration,
}: {
  className?: string;
  /** Pass from parent so the optional @keyframes scope applies when sync bumps. */
  syncGeneration: number;
}) {
  const { data, updateField, isFieldPrefilled } = useEmergencyProfile();
  const hasOptional = (data.medicalInstructions || "").trim() || (data.notes || "").trim();
  const [optionalOpen, setOptionalOpen] = useState(false);
  const effectiveOptionalOpen = useMemo(() => optionalOpen || Boolean(hasOptional), [optionalOpen, hasOptional]);

  const shell = (key: FieldKey) => fieldShellClass(isFieldPrefilled(key));

  return (
    <div key={syncGeneration} className={cn("space-y-4", className)}>
      <style>{`
        @keyframes emergency-prefill-glow {
          0% { box-shadow: inset 0 0 0 1px rgb(var(--color-primary) / 0.35); }
          100% { box-shadow: inset 0 0 0 1px rgb(var(--color-primary) / 0.08); }
        }
      `}</style>

      <div className="space-y-2">
        <Label htmlFor="ep-contact-name">Contact name</Label>
        <Input
          id="ep-contact-name"
          autoComplete="name"
          placeholder="e.g. Parent or partner"
          value={data.contactName}
          onChange={(e) => updateField("contactName", e.target.value)}
          className={shell("contactName")}
          data-testid="emergency-contact-name"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ep-phone">Primary phone</Label>
          <Input
            id="ep-phone"
            type="tel"
            autoComplete="tel"
            placeholder="e.g. 07123 456789"
            value={data.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            className={shell("phone")}
            data-testid="emergency-contact-phone"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ep-phone-2">Secondary phone</Label>
          <Input
            id="ep-phone-2"
            type="tel"
            autoComplete="tel"
            placeholder="Backup number"
            value={data.phoneSecondary}
            onChange={(e) => updateField("phoneSecondary", e.target.value)}
            className={shell("phoneSecondary")}
            data-testid="emergency-phone-secondary"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ep-relation">Relationship</Label>
        <Input
          id="ep-relation"
          placeholder="e.g. Mother, partner, friend"
          value={data.relation}
          onChange={(e) => updateField("relation", e.target.value)}
          className={shell("relation")}
          data-testid="emergency-relation"
        />
      </div>

      <Collapsible open={effectiveOptionalOpen} onOpenChange={setOptionalOpen}>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">More emergency info</p>
            <p className="text-xs text-muted-foreground">
              Optional details for context. {hasOptional ? "Filled" : "Not set"}
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-2">
              {effectiveOptionalOpen ? "Hide" : "Show"}
              {effectiveOptionalOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="pt-3 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ep-medical">Medical instructions</Label>
            <Textarea
              id="ep-medical"
              placeholder="e.g. Allergies, glucagon location, pump/CGM notes"
              value={data.medicalInstructions}
              onChange={(e) => updateField("medicalInstructions", e.target.value)}
              rows={3}
              className={cn("min-h-[80px] resize-y", shell("medicalInstructions"))}
              data-testid="emergency-medical-instructions"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-notes">Other notes</Label>
            <Textarea
              id="ep-notes"
              placeholder="e.g. Campus accommodation, door codes"
              value={data.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={3}
              className={cn("min-h-[80px] resize-y", shell("notes"))}
              data-testid="emergency-notes"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <p className="text-xs text-muted-foreground">
        Highlighted fields were restored from your saved profile. Editing clears the highlight.
      </p>
    </div>
  );
}
