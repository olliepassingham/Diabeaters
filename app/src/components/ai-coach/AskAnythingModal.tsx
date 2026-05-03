import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildCoachHref } from "@/lib/ai-coach/links";
import type { CoachTopicSlug } from "@/lib/ai-coach/topics";
import type { CoachAudience } from "@/lib/ai-coach/types";
import { isAiCoachEnabled } from "@/lib/flags";

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
      <DialogContent className="max-w-md" data-testid="dialog-ask-anything">
        <DialogHeader>
          <DialogTitle>Ask Diabeaters</DialogTitle>
          <DialogDescription>
            Anything about type 1 diabetes — clinic prep, sick day, supplies, travel, exercise.
          </DialogDescription>
        </DialogHeader>
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
          <p className="text-xs text-muted-foreground">
            Educational only — for urgent symptoms,{" "}
            <Link href="/help-now" className="underline underline-offset-2">
              open Help Now
            </Link>
            .
          </p>
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
