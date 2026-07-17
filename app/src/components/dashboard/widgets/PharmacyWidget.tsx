import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { storage, DIABEATER_SETTINGS_CHANGED_EVENT, type Pharmacy } from "@/lib/storage";
import { describePharmacyStatus, pharmacyHasAnyHours } from "@/lib/pharmacy";
import { cn } from "@/lib/utils";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";

export function PharmacyWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);
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
    <WidgetCard data-testid="widget-pharmacy">
      <CardHeader className={cn("space-y-0 pb-2", compact ? "px-4 pt-4" : "px-4 pt-4")}>
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/settings/pharmacy"
            className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Open pharmacy — opening hours and details"
            data-testid="link-pharmacy-widget-title"
          >
            <div className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" aria-hidden />
              </span>
              <CardTitle className="text-h3">Pharmacy</CardTitle>
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
      <CardContent className="px-4 pb-4 pt-1">
        {!pharmacy ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Add your pharmacy</p>
              <p className="text-xs text-muted-foreground">Save opening hours for realistic collect‑by dates.</p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0" data-testid="button-pharmacy-widget-add">
              <Link href="/settings/pharmacy">Add</Link>
            </Button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{pharmacy.name}</p>
              {pharmacy.addressLine ? (
                <p className="truncate text-xs text-muted-foreground">{pharmacy.addressLine}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Primary pharmacy</p>
              )}
            </div>
            {status ? (
              <Badge variant={status.open ? "default" : "secondary"} className="shrink-0 text-[11px]">
                {status.line}
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0 text-[11px]">
                Add hours
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </WidgetCard>
  );
}

