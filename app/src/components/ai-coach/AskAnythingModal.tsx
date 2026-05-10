import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Info } from "lucide-react";
import { buildCoachHref } from "@/lib/ai-coach/links";
import type { CoachTopicSlug } from "@/lib/ai-coach/topics";
import type { CoachAudience } from "@/lib/ai-coach/types";
import { isAiCoachEnabled } from "@/lib/flags";
import { askAssistantModalTitle } from "@/lib/ai-coach/persona";

const MAX_LEN = 500;

const CHIPS: { label: string; topic: CoachTopicSlug }[] = [
  { label: "Sick day", topic: "sick-day" },
  { label: "Exercise", topic: "exercise" },
  { label: "Driving", topic: "driving" },
  { label: "Pump failure", topic: "pump-failure" },
  { label: "Alcohol", topic: "alcohol" },
  { label: "Bedtime", topic: "bedtime" },
  { label: "Clinic visits", topic: "clinic" },
];

export type AskAnythingModalProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  audience: CoachAudience;
  source: string;
};

export function AskAnythingModal({ open, onOpenChange, audience, source }: AskAnythingModalProps) {
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState("");
  const [topic, setTopic] = useState<CoachTopicSlug | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft("");
    setTopic(null);
  }, [open]);

  const go = useCallback(() => {
    const q = draft.trim();
    const href = buildCoachHref({
      q: q || null,
      topic: topic ?? undefined,
      audience: audience === "supporter" ? "supporter" : undefined,
      from: source,
    });
    onOpenChange(false);
    setLocation(href);
  }, [audience, draft, onOpenChange, setLocation, source, topic]);

  if (!isAiCoachEnabled) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-ask-anything" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{askAssistantModalTitle()}</DialogTitle>
        </DialogHeader>
        <Alert className="border-border/60">
          <Info className="h-4 w-4" aria-hidden />
          <AlertTitle className="text-foreground">What you can ask</AlertTitle>
          <AlertDescription>
            Anything about type 1 diabetes — clinic prep, sick day, supplies, travel, exercise.
          </AlertDescription>
        </Alert>
        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
            placeholder="Type your question…"
            rows={4}
            className="resize-none"
            data-testid="textarea-ask-anything"
            autoFocus
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Topic shortcuts">
            {CHIPS.map((c) => (
              <Button
                key={c.topic}
                type="button"
                size="sm"
                variant={topic === c.topic ? "default" : "secondary"}
                className="h-auto min-h-9 text-xs font-normal"
                data-testid={`chip-ask-topic-${c.topic}`}
                onClick={() => setTopic((t) => (t === c.topic ? null : c.topic))}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <Alert variant="default" className="border-border/55 bg-muted/15">
            <Info className="h-4 w-4" aria-hidden />
            <AlertTitle className="sr-only">Safety</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Educational only — for urgent symptoms,{" "}
              <Link href="/help-now" className="font-medium text-foreground underline underline-offset-2">
                open Help Now
              </Link>
              .
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={go} data-testid="button-ask-anything-submit">
            Ask
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
