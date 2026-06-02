import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarClock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DIABEATER_SETTINGS_CHANGED_EVENT, storage } from "@/lib/storage";
import { isDateOfBirthUnknown } from "@/lib/user-age";
import { cn } from "@/lib/utils";
import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";
import { SETTINGS_DATE_OF_BIRTH_HREF } from "@/lib/settings-nav";

const DEFAULT_TITLE = "Add your date of birth to unlock adult-only sections";

function defaultDobUnknownBody(): string {
  return `Until we know your age, the app keeps adult-only screens like alcohol and driving guidance turned off, and ${AI_ASSISTANT_NAME} uses the same boundary.`;
}

export type DobUnknownNoticeProps = {
  title?: string;
  body?: string;
  ctaLabel?: string;
  testId?: string;
  className?: string;
  /** When true, the notice never renders (e.g. supporter mode). */
  hidden?: boolean;
};

/**
 * Default-deny inline CTA shown when the profile has no usable date of birth.
 * Adult-only routes (alcohol, driving) and the in-app assistant treat unknown DOB the same as
 * `under-18`, so this nudge gives users a clear, low-friction way to unlock
 * the right experience for their age.
 */
export function DobUnknownNotice({
  title = DEFAULT_TITLE,
  body,
  ctaLabel = "Add date of birth",
  testId = "dob-unknown-notice",
  className,
  hidden,
}: DobUnknownNoticeProps) {
  const [localDob, setLocalDob] = useState<string | null | undefined>(undefined);
  const resolvedBody = body ?? defaultDobUnknownBody();

  useEffect(() => {
    setLocalDob(storage.getProfile()?.dateOfBirth ?? null);
    const onChanged = () => {
      setLocalDob(storage.getProfile()?.dateOfBirth ?? null);
    };
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onChanged);
  }, []);

  if (hidden) return null;
  if (localDob === undefined) return null;
  if (!isDateOfBirthUnknown(localDob)) return null;

  return (
    <Card
      className={cn(
        "rounded-2xl border-amber-200/80 bg-amber-50/70 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30",
        className,
      )}
      data-testid={testId}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200"
            aria-hidden
          >
            <CalendarClock className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{resolvedBody}</p>
            <Link
              href={SETTINGS_DATE_OF_BIRTH_HREF}
              className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              data-testid={`${testId}-cta`}
            >
              <span>{ctaLabel}</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
