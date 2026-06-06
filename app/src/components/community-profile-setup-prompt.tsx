import { Link } from "wouter";
import { ArrowRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Shown when community features need a public profile before the user can participate. */
export function CommunityProfileSetupPrompt({
  title = "Set up your community profile",
  description = "Choose a display name and make your profile public to join the feed, follow people, and send messages.",
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
          ? "rounded-2xl border border-border/50 bg-card/40 px-4 py-8 text-center shadow-sm"
          : "flex min-h-[50vh] flex-col items-center justify-center px-6 py-12 text-center"
      }
      data-testid="community-profile-setup-prompt"
    >
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Users className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Button asChild className="mt-5 rounded-xl" size="sm">
        <Link href="/account#profile">
          Set up profile
          <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
        </Link>
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        Or{" "}
        <Link href="/tools" className="text-primary underline-offset-2 hover:underline">
          browse tools
        </Link>{" "}
        while you decide.
      </p>
    </div>
  );
}
