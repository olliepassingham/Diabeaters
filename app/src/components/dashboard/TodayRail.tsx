import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildCoachHref } from "@/lib/ai-coach/links";
import type { TodayRailItem } from "@/lib/dashboard/today-rail";

export function TodayRail({
  items,
  onOpenAsk,
}: {
  items: TodayRailItem[];
  onOpenAsk: (source: string) => void;
}) {
  const visible = items.slice(0, 3);
  const overflow = items.length - visible.length;

  if (items.length === 0) {
    return (
      <Card className="border-border/70 shadow-sm" data-testid="today-rail-empty">
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="font-semibold text-foreground">Nothing waiting today</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Got a question? Ask Diabeaters about anything T1D.
            </p>
          </div>
          <Button type="button" className="w-full sm:w-auto" onClick={() => onOpenAsk("today-empty")}>
            Ask Diabeaters
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 shadow-sm" data-testid="today-rail">
      <CardContent className="space-y-2 p-4">
        <h3 className="font-semibold text-foreground">Today</h3>
        <ul className="space-y-2">
          {visible.map((it) => (
            <TodayRailRow key={it.id} item={it} />
          ))}
        </ul>
        {overflow > 0 ? (
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link href="/notifications">+{overflow} more in inbox</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TodayRailRow({ item }: { item: TodayRailItem }) {
  const askHref = item.ask
    ? buildCoachHref({ topic: item.ask.topic, from: "today-rail" })
    : null;

  return (
    <li className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-sm">{item.title}</p>
          {item.detail ? <p className="text-xs text-muted-foreground truncate">{item.detail}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button size="sm" variant="default" className="min-h-9" asChild>
            <Link href={item.primary.href}>{item.primary.label}</Link>
          </Button>
          {askHref && item.ask ? (
            <Button size="sm" variant="outline" className="min-h-9" asChild>
              <Link href={askHref}>{item.ask.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
