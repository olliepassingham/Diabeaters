import { Link } from "wouter";
import { ArrowRight, UserCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  onDismiss: () => void;
  /** Name and public visibility are already set; only the @handle is missing. */
  onlyHandleMissing?: boolean;
  /**
   * Feed chrome: one short row so the first post stays on screen.
   * Full card is for surfaces that can spare the space.
   */
  compact?: boolean;
};

export function CommunityProfileReminderCard({
  onDismiss,
  onlyHandleMissing = false,
  compact = false,
}: Props) {
  const title = onlyHandleMissing
    ? "Pick your @handle to post and comment"
    : "Finish your public profile for the Feed";
  const cta = onlyHandleMissing ? "Choose @handle" : "Set up profile";

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.05] px-2.5 py-2",
        )}
        data-testid="community-profile-reminder-card"
      >
        <UserCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug text-foreground">
          {title}
        </p>
        <Button asChild size="sm" className="h-8 shrink-0 rounded-lg px-2.5 text-xs">
          <Link href="/community/setup">
            {onlyHandleMissing ? "Choose" : "Set up"}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full text-muted-foreground"
          aria-label="Dismiss profile setup reminder"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Card
      className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-muted/20 shadow-sm"
      data-testid="community-profile-reminder-card"
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"
            aria-hidden
          >
            <UserCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full text-muted-foreground"
                aria-label="Dismiss profile setup reminder"
                onClick={onDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {onlyHandleMissing
                ? "Your profile doesn't have a public @handle yet. Choose one to post, comment, follow, and message."
                : "You can browse the Feed without this. To post, follow, or message, add a display name, choose a public @handle, and turn your profile public."}
            </p>
            <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
              <li>· Post, comment, and follow others in the community</li>
              <li>· Show your name on posts and messages</li>
            </ul>
            <Button asChild size="sm" className="mt-1 rounded-xl">
              <Link href="/community/setup">
                {cta}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
