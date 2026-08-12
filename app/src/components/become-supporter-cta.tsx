import { Link } from "wouter";
import { ArrowRight, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BecomeSupporterCtaProps = {
  className?: string;
  /** Smaller padding for denser pages (e.g. Mode chooser). */
  compact?: boolean;
  testId?: string;
};

/**
 * Discoverable entry for patients (or any signed-in user) who also want to support
 * someone with Type 1 via invite code → Supporter Mode.
 */
export function BecomeSupporterCta({
  className,
  compact = false,
  testId = "link-become-supporter",
}: BecomeSupporterCtaProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/[0.09] via-background to-background shadow-sm",
        "dark:border-blue-400/25 dark:from-blue-500/[0.14]",
        className,
      )}
      data-testid="become-supporter-cta"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/15 blur-2xl dark:bg-blue-400/10"
        aria-hidden
      />
      <div
        className={cn(
          "relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
          compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-300",
              compact ? "h-10 w-10" : "h-11 w-11",
            )}
          >
            <HeartHandshake className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-800/75 dark:text-blue-300/90">
              Supporting someone?
            </p>
            <h2
              className={cn(
                "mt-0.5 font-semibold tracking-tight text-foreground",
                compact ? "text-base" : "text-base sm:text-lg",
              )}
            >
              Become a supporter
            </h2>
          </div>
        </div>

        <Button
          asChild
          className={cn(
            "min-h-11 w-full shrink-0 rounded-xl bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500",
            "sm:w-auto",
          )}
        >
          <Link href="/carer-setup" data-testid={testId}>
            Enter invite code
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}
