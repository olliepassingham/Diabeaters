import { Info } from "lucide-react";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const popoverTextClass =
  "w-full max-w-[min(18rem,calc(100vw-2rem))] text-sm leading-relaxed text-popover-foreground/90 sm:w-72";

type FieldLabelWithInfoProps = {
  htmlFor: string;
  children: React.ReactNode;
  info: React.ReactNode;
  className?: string;
};

/** Label plus click-to-open helper (popover). Keeps forms scannable without hiding the label. */
export function FieldLabelWithInfo({ htmlFor, children, info, className }: FieldLabelWithInfoProps) {
  return (
    <div className={cn("flex items-start gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="mb-0 flex-1 min-w-0 cursor-default leading-snug">
        {children}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="More information"
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className={popoverTextClass}>{info}</PopoverContent>
      </Popover>
    </div>
  );
}

type InlineInfoHintProps = {
  content: React.ReactNode;
  ariaLabel: string;
  className?: string;
  /** Use a higher z-index when the hint sits inside a sheet or drawer (default popover is z-50). */
  popoverClassName?: string;
};

type StaticLabelWithInfoProps = {
  children: React.ReactNode;
  info: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  labelClassName?: string;
};

/** Label row without a field id — toggles, subsection titles, read-only values. */
export function StaticLabelWithInfo({
  children,
  info,
  ariaLabel = "More information",
  className,
  labelClassName,
}: StaticLabelWithInfoProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <span className={cn("text-sm font-medium leading-snug", labelClassName)}>{children}</span>
      <InlineInfoHint ariaLabel={ariaLabel} content={info} />
    </div>
  );
}

/** Standalone info icon that opens helper text (e.g. section intros). */
export function InlineInfoHint({ content, ariaLabel, className, popoverClassName }: InlineInfoHintProps) {
  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label={ariaLabel}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className={cn(popoverTextClass, "z-[120]", popoverClassName)}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
