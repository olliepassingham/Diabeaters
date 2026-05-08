import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ScenarioActiveCard(props: {
  title: string;
  subtitle?: string;
  badgeText?: string;
  tone?: "default" | "blue" | "amber" | "red";
  icon?: ReactNode;
  facts?: { label: string; value: ReactNode }[];
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  const tone =
    props.tone === "red"
      ? "border-red-500/30 bg-red-500/[0.06]"
      : props.tone === "amber"
        ? "border-amber-500/30 bg-amber-500/[0.06]"
        : props.tone === "blue"
          ? "border-blue-500/30 bg-blue-500/[0.06]"
          : "border-border/60 bg-card/70";

  return (
    <Card
      className={cn("overflow-hidden rounded-2xl shadow-sm ring-1 ring-border/30", tone, props.className)}
      data-testid={props["data-testid"]}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {props.icon ? <span className="shrink-0">{props.icon}</span> : null}
              <div className="truncate text-sm font-semibold text-foreground">{props.title}</div>
              {props.badgeText ? (
                <Badge variant="outline" className="ml-1 text-[11px]">
                  {props.badgeText}
                </Badge>
              ) : null}
            </div>
            {props.subtitle ? (
              <div className="mt-1 text-xs text-muted-foreground leading-snug">{props.subtitle}</div>
            ) : null}
          </div>
          {props.actions ? <div className="shrink-0">{props.actions}</div> : null}
        </div>

        {props.facts && props.facts.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {props.facts.map((f) => (
              <div key={f.label} className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </div>
                <div className="mt-0.5 text-sm font-semibold text-foreground">{f.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {props.children ? <div className="mt-3">{props.children}</div> : null}
      </CardContent>
    </Card>
  );
}

