import { Info } from "lucide-react";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const popoverTextClass = "w-full max-w-[min(18rem,calc(100vw-2rem))] text-sm text-muted-foreground sm:w-72";

type FieldLabelWithInfoProps = {
  htmlFor: string;
  children: React.ReactNode;
  info: React.ReactNode;
  className?: string;
};

/** Label plus click-to-open helper (popover). Keeps forms scannable without hiding the label. */
export function FieldLabelWithInfo({ htmlFor, children, info, className }: FieldLabelWithInfoProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="mb-0 cursor-default">
        {children}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
};

/** Standalone info icon that opens helper text (e.g. section intros). */
export function InlineInfoHint({ content, ariaLabel, className }: InlineInfoHintProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label={ariaLabel}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className={popoverTextClass}>{content}</PopoverContent>
    </Popover>
  );
}
