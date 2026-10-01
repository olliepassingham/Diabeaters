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

export type SupporterHomeCardOption = {
  id: SupporterQuietCardId;
  label: string;
  detail: string;
  shown: boolean;
  locked: boolean;
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
        <DialogHeader>
          <DialogTitle className="text-lg">Cards on this screen</DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            Treated hypos, an active sick day, low supplies, and emergency details stay here. Hide the other cards
            if you do not need them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {cards.map((card) => {
            const switchId = `supporter-card-${card.id}`;
            return (
              <div
                key={card.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Label htmlFor={switchId} className="text-base font-medium text-foreground">
                    {card.label}
                  </Label>
                  <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{card.detail}</p>
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
