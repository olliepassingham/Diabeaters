import { Cpu } from "lucide-react";
import { publicTechChips, type PublicTechProfileFields } from "@/lib/profile-tech";
import { cn } from "@/lib/utils";

/** Small chips naming the member's diabetes tech, e.g. "Dexcom G7" + "Omnipod · Closed loop". */
export function PublicTechChips({
  profile,
  className,
  testId = "public-tech-chips",
}: {
  profile: PublicTechProfileFields | null | undefined;
  className?: string;
  testId?: string;
}) {
  const chips = publicTechChips(profile);
  if (chips.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} data-testid={testId}>
      <Cpu className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-foreground/85 ring-1 ring-primary/15"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}
