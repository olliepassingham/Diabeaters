import { Link } from "wouter";
import { ArrowRight, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Shown when community features need a public profile before the user can participate. */
export function CommunityProfileSetupPrompt({
  title = "Finish your public profile",
  description = "Add a display name and @handle so people know who you are on the Feed.",
  compact,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.08] to-card/90 px-5 py-8 text-center shadow-sm ring-1 ring-border/40"
          : "flex min-h-[50vh] flex-col items-center justify-center px-6 py-12 text-center"
      }
      data-testid="community-profile-setup-prompt"
    >
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15">
        <Users className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Button asChild className="mt-5 min-h-11 rounded-xl px-6 font-semibold" size="default">
        <Link href="/community/setup">
          Set up profile
          <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
        </Link>
      </Button>
      <p className="mt-4 text-xs text-muted-foreground">
        Or{" "}
        <Link href="/tools" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
          <Sparkles className="h-3 w-3" aria-hidden />
          browse tools
        </Link>{" "}
        while you decide.
      </p>
    </div>
  );
}
