import { Calendar, HeartPulse, History, Package, Route, type LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SupporterQuietCardId } from "@/lib/supporter-home-cards";
import { cn } from "@/lib/utils";

export type SupporterHomeCardOption = {
  id: SupporterQuietCardId;
  label: string;
  detail: string;
  shown: boolean;
  locked: boolean;
};

const CARD_ICONS: Record<SupporterQuietCardId, LucideIcon> = {
  supplies: Package,
  situations: Route,
  activity: History,
  appointments: Calendar,
  clinical: HeartPulse,
};

export function SupporterHomeCardsSheet({
  open,
  onOpenChange,
  cards,
  onShownChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: SupporterHomeCardOption[];
  onShownChange: (id: SupporterQuietCardId, shown: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4" data-testid="supporter-home-cards-dialog">
        <DialogHeader className="space-y-1 text-center sm:text-center">
          <DialogTitle className="font-display text-xl tracking-tight">Home cards</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">Alerts stay visible.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {cards.map((card, index) => {
            const switchId = `supporter-card-${card.id}`;
            const Icon = CARD_ICONS[card.id];
            const note = card.detail.trim();
            return (
              <div
                key={card.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5",
                  index > 0 && "border-t border-border/50",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    card.shown ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <Label htmlFor={switchId} className="text-[15px] font-medium leading-tight text-foreground">
                    {card.label}
                  </Label>
                  {note ? <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{note}</p> : null}
                </div>
                <Switch
                  id={switchId}
                  className="shrink-0"
                  checked={card.shown}
                  disabled={card.locked}
                  onCheckedChange={(shown) => onShownChange(card.id, shown)}
                  data-testid={`switch-supporter-card-${card.id}`}
                />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
