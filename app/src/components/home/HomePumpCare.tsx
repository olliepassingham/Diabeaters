import { useCallback, useEffect, useState } from "react";
import { Cylinder, Plug, RefreshCw } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import {
  getPumpCareSnapshot,
  seedPumpSuppliesIfNeeded,
  type PumpCareItem,
  type PumpCareSnapshot,
} from "@/lib/pump-supplies";
import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  DIABEATER_SUPPLIES_CHANGED_EVENT,
  storage,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

function readSnapshot(): PumpCareSnapshot {
  return getPumpCareSnapshot(storage.getSupplies());
}

function daysHeadline(item: PumpCareItem): string {
  if (item.daysLeft == null) return "Not started";
  if (item.dueToday) return "Due today";
  if (item.daysLeft === 1) return "1 day left";
  return `${item.daysLeft} days left`;
}

function CareBlock({
  item,
  icon: Icon,
  title,
  onChanged,
}: {
  item: PumpCareItem;
  icon: typeof Plug;
  title: string;
  onChanged: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5",
        item.dueToday
          ? "bg-amber-500/[0.1] ring-1 ring-amber-500/20"
          : "bg-background/50 ring-1 ring-border/30",
      )}
      data-testid={`home-pump-care-${item.kind}`}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          item.dueToday
            ? "bg-amber-500 text-white"
            : "bg-teal-600/90 text-white dark:bg-teal-500",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.12em]",
            item.dueToday ? "text-amber-800/85 dark:text-amber-200/85" : "text-muted-foreground",
          )}
        >
          {title}
        </p>
        <p className="font-display text-base font-semibold leading-tight tracking-tight text-foreground">
          {daysHeadline(item)}
        </p>
      </div>

      {item.daysLeft != null ? (
        <Button
          type="button"
          size="sm"
          variant={item.dueToday ? "default" : "outline"}
          className={cn(
            "h-8 shrink-0 rounded-xl px-2.5 text-xs font-semibold",
            item.dueToday && "bg-amber-700 text-white hover:bg-amber-700/90 dark:bg-amber-600",
          )}
          onClick={() => onChanged(item.id)}
          data-testid={`button-home-pump-changed-${item.kind}`}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {item.changeButtonLabel}
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline" className="h-8 shrink-0 rounded-xl px-2.5 text-xs font-semibold">
          <Link href="/supplies">Set up</Link>
        </Button>
      )}
    </div>
  );
}

export function HomePumpCare() {
  const [isPump, setIsPump] = useState(() =>
    isPumpDeliveryMethod(storage.getProfile()?.insulinDeliveryMethod),
  );
  const [snap, setSnap] = useState<PumpCareSnapshot>(() => readSnapshot());

  const refresh = useCallback(() => {
    setIsPump(isPumpDeliveryMethod(storage.getProfile()?.insulinDeliveryMethod));
    setSnap(readSnapshot());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(DIABEATER_SUPPLIES_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(DIABEATER_SUPPLIES_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  if (!isPump) return null;

  const onChanged = (id: string) => {
    storage.markItemChangedEarly(id);
    refresh();
  };

  const onSeed = () => {
    seedPumpSuppliesIfNeeded();
    refresh();
  };

  const due = Boolean(snap.dueSoonKind);

  return (
    <section
      id="home-pump-care"
      className="animate-fade-in-up px-1 py-2"
      data-testid="home-pump-care"
      aria-labelledby="home-pump-care-title"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.35rem] px-3.5 py-3",
          "bg-muted/25 ring-1 ring-border/40",
          due && "bg-amber-500/[0.07] ring-amber-500/25",
        )}
      >
        <div className="relative space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2
              id="home-pump-care-title"
              className="font-display text-sm font-semibold tracking-tight text-foreground"
            >
              Pump care
            </h2>
            {due ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                Change due
              </span>
            ) : null}
          </div>

          {snap.setupIncomplete ? (
            <div className="flex items-center gap-3 rounded-2xl bg-background/55 px-3 py-2.5 ring-1 ring-border/35">
              <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
                Add infusion sets and reservoirs to track your next change.
              </p>
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 rounded-xl px-2.5 text-xs font-semibold"
                onClick={onSeed}
                data-testid="button-home-pump-care-seed"
              >
                Set up
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {snap.set ? (
                <CareBlock item={snap.set} icon={Plug} title="Infusion set" onChanged={onChanged} />
              ) : null}
              {snap.reservoir ? (
                <CareBlock item={snap.reservoir} icon={Cylinder} title="Reservoir" onChanged={onChanged} />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
