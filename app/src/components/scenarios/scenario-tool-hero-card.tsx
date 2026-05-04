import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

type ScenarioToolHeroCardOwnProps = {
  /** Gradient / border utilities for the outer surface. */
  className?: string;
  /** Optional top region (icons, titles, badges). Omit when `PageHeader` sits above this card. */
  header?: ReactNode;
  classNames?: {
    header?: string;
    content?: string;
  };
  /** Main body below the optional header. */
  body?: ReactNode;
};

export type ScenarioToolHeroCardProps = ScenarioToolHeroCardOwnProps &
  Omit<ComponentPropsWithoutRef<typeof Card>, "children">;

/**
 * Shared elevated card for scenario “status” views (active sick day, active travel, bedtime verdict).
 * Keeps header vs body padding consistent across tools.
 */
export function ScenarioToolHeroCard({
  className,
  header,
  classNames,
  body,
  ...cardProps
}: ScenarioToolHeroCardProps) {
  const hasBody = body != null;

  return (
    <Card className={cn("overflow-hidden shadow-sm", className)} {...cardProps}>
      {header != null ? (
        <CardHeader className={cn(hasBody ? "pb-3" : "pb-4 sm:pb-5", classNames?.header)}>{header}</CardHeader>
      ) : null}
      {hasBody ? (
        <CardContent className={cn(header != null ? "pt-0" : "pt-5 sm:pt-6", "space-y-3", classNames?.content)}>
          {body}
        </CardContent>
      ) : null}
    </Card>
  );
}
