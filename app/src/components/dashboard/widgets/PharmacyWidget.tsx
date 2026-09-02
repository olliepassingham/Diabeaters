import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { storage, DIABEATER_SETTINGS_CHANGED_EVENT, type Pharmacy } from "@/lib/storage";
import { describePharmacyStatus, pharmacyHasAnyHours } from "@/lib/pharmacy";
import { cn } from "@/lib/utils";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { WidgetHeaderIcon, widgetContentClass, widgetHeaderClass } from "./widget-header";

export function PharmacyWidget(_props: DashboardWidgetLayoutProps) {
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(() => storage.getPharmacy());
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const handle = () => setPharmacy(storage.getPharmacy());
    handle();
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, handle);
    window.addEventListener("storage", handle);
    return () => {
      window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, handle);
      window.removeEventListener("storage", handle);
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const status = useMemo(() => {
    if (!pharmacy || !pharmacyHasAnyHours(pharmacy)) return null;
    return describePharmacyStatus(pharmacy, now);
  }, [pharmacy, now]);

  return (
    <WidgetCard accent="tracking" data-testid="widget-pharmacy">
      <CardHeader className={widgetHeaderClass}>
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/settings/pharmacy"
            className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Open pharmacy — opening hours and details"
            data-testid="link-pharmacy-widget-title"
          >
            <div className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80">
              <WidgetHeaderIcon icon={Building2} className="bg-cyan-500/10 ring-cyan-500/15 [&_svg]:text-cyan-600 dark:[&_svg]:text-cyan-300" />
              <CardTitle className="text-base font-semibold leading-tight">Pharmacy</CardTitle>
            </div>
          </Link>
          <Link
            href="/settings/pharmacy"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            data-testid="link-pharmacy-widget-edit"
          >
            Edit <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </CardHeader>
      <CardContent className={cn(widgetContentClass, "pt-0")}>
        {!pharmacy ? (
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Add your pharmacy</p>
              <p className="text-xs text-muted-foreground">Save opening hours for realistic collect‑by dates.</p>
            </div>
            <Button asChild size="sm" variant="ghost" className="shrink-0 rounded-full" data-testid="button-pharmacy-widget-add">
              <Link href="/settings/pharmacy">Add</Link>
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{pharmacy.name}</p>
              {pharmacy.addressLine ? (
                <p className="truncate text-xs text-muted-foreground">{pharmacy.addressLine}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Primary pharmacy</p>
              )}
            </div>
            {status ? (
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", status.open ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                {status.line}
              </span>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">Add hours</span>
            )}
          </div>
        )}
      </CardContent>
    </WidgetCard>
  );
}

