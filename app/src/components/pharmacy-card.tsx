import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Building2, ChevronRight, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DIABEATER_SETTINGS_CHANGED_EVENT,
  storage,
  type Pharmacy,
} from "@/lib/storage";
import { describePharmacyStatus, pharmacyHasAnyHours } from "@/lib/pharmacy";

type Props = {
  /** Compact: single-line for tight spots like the prescription cycle card; default expanded. */
  variant?: "default" | "compact";
  className?: string;
};

/**
 * Shows the user's saved pharmacy and "Open now" / "Closed - opens X" status.
 * Renders nothing when no pharmacy has been saved (so callers can drop it in unconditionally).
 */
export function PharmacyCard({ variant = "default", className }: Props) {
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(() => storage.getPharmacy());
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const handle = () => setPharmacy(storage.getPharmacy());
    handle();
    if (typeof window === "undefined") return;
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

  if (!pharmacy) {
    if (variant === "compact") return null;
    return (
      <Card className={cn("border-dashed border-border/70", className)} data-testid="card-pharmacy-empty">
        <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Add your pharmacy</p>
              <p className="text-xs text-muted-foreground">
                Save opening hours so we can suggest realistic collect-by dates.
              </p>
            </div>
          </div>
          <Link
            href="/settings/pharmacy"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
            data-testid="link-pharmacy-add"
          >
            Add <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </CardContent>
      </Card>
    );
  }

  const status = pharmacyHasAnyHours(pharmacy) ? describePharmacyStatus(pharmacy, now) : null;

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs",
          className,
        )}
        data-testid="card-pharmacy-compact"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 truncate font-medium text-foreground">{pharmacy.name}</span>
        {status ? (
          <Badge variant={status.open ? "default" : "secondary"} className="shrink-0 text-[11px]">
            {status.line}
          </Badge>
        ) : null}
      </div>
    );
  }

  return (
    <Card className={cn("border-border/70 shadow-sm", className)} data-testid="card-pharmacy">
      <CardContent className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-foreground">{pharmacy.name}</p>
              {status ? (
                <Badge variant={status.open ? "default" : "secondary"} className="shrink-0 text-[11px]">
                  {status.line}
                </Badge>
              ) : null}
            </div>
            {pharmacy.addressLine ? (
              <p className="truncate text-xs text-muted-foreground">{pharmacy.addressLine}</p>
            ) : null}
            {pharmacy.phone ? (
              <a
                href={`tel:${pharmacy.phone.replace(/[^+0-9]/g, "")}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                data-testid="link-pharmacy-call"
              >
                <Phone className="h-3 w-3" aria-hidden />
                {pharmacy.phone}
              </a>
            ) : null}
            {!status ? (
              <p className="text-xs text-muted-foreground">
                <Link
                  href="/settings/pharmacy"
                  className="text-primary hover:underline"
                  data-testid="link-pharmacy-add-hours"
                >
                  Add opening hours
                </Link>{" "}
                so the app can suggest collect-by times.
              </p>
            ) : null}
          </div>
        </div>
        <Link
          href="/settings/pharmacy"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          data-testid="link-pharmacy-edit"
        >
          Edit <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
