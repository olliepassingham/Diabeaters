import { useEffect, useState } from "react";
import {
  Copy,
  Lightbulb,
  Package,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getSupplyIncrement,
  type Supply,
  type UsualPrescription,
  type UsualPrescriptionItem,
} from "@/lib/storage";
import {
  formatUsualItemQuantity,
  supplyToUsualPrescriptionItem,
  USUAL_SUPPLY_TYPE_ACCENTS,
  USUAL_SUPPLY_TYPE_BADGES,
} from "@/lib/usual-prescription";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  needle: "Needles/Lancets",
  insulin: "Insulin",
  insulin_short: "Short-Acting Insulin",
  insulin_long: "Long-Acting Insulin",
  insulin_vial: "Insulin Vials (Pump)",
  cgm: "CGM/Monitors",
  infusion_set: "Infusion Sets",
  reservoir: "Reservoirs/Cartridges",
  other: "Other",
};

function PumpOnlySupplySelectItems() {
  return (
    <>
      <SelectItem value="insulin_vial">Insulin Vials (Pump)</SelectItem>
      <SelectItem value="infusion_set">Infusion Sets (Pump)</SelectItem>
      <SelectItem value="reservoir">Reservoirs/Cartridges (Pump)</SelectItem>
    </>
  );
}

function UsualPrescriptionItemRow({
  item,
  index,
  onUpdateQuantity,
  onRemove,
}: {
  item: UsualPrescriptionItem;
  index: number;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
}) {
  const inc = getSupplyIncrement(item.type);
  const formatted = formatUsualItemQuantity(item);
  const accent = USUAL_SUPPLY_TYPE_ACCENTS[item.type] ?? USUAL_SUPPLY_TYPE_ACCENTS.other;
  const badge = USUAL_SUPPLY_TYPE_BADGES[item.type] ?? USUAL_SUPPLY_TYPE_BADGES.other;

  return (
    <div
      className={cn(
        "rounded-xl border border-l-4 p-3 shadow-sm",
        accent,
      )}
      data-testid={`usual-item-${index}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <Badge variant="secondary" className={cn("mt-1.5 text-[10px] font-medium", badge)}>
            {typeLabels[item.type] ?? item.type}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${item.name}`}
          data-testid={`button-usual-remove-${index}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tabular-nums leading-none">{formatted.primary}</p>
          {formatted.secondary ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{formatted.secondary}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => onUpdateQuantity(index, Math.max(0, item.quantity - inc.amount))}
            disabled={item.quantity <= 0}
            data-testid={`button-usual-decrease-${index}`}
            aria-label={`Decrease ${item.name}`}
          >
            <span className="text-base leading-none">−</span>
          </Button>
          <Input
            type="number"
            min={0}
            value={item.quantity}
            onChange={(e) => onUpdateQuantity(index, parseFloat(e.target.value) || 0)}
            className="h-9 w-[4.5rem] text-center text-sm tabular-nums"
            data-testid={`input-usual-quantity-${index}`}
            aria-label={`Quantity for ${item.name}`}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => onUpdateQuantity(index, item.quantity + inc.amount)}
            data-testid={`button-usual-increase-${index}`}
            aria-label={`Increase ${item.name}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {item.dailyUsage > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Daily usage when added: {item.dailyUsage}
          {item.type.includes("insulin") ? " units/day" : "/day"}
        </p>
      ) : null}
    </div>
  );
}

export function UsualPrescriptionDialog({
  open,
  onOpenChange,
  usualPrescription,
  currentSupplies,
  onSave,
  isPumpUser,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usualPrescription: UsualPrescription | null;
  currentSupplies: Supply[];
  onSave: (items: UsualPrescriptionItem[]) => void;
  isPumpUser: boolean;
}) {
  const [items, setItems] = useState<UsualPrescriptionItem[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Supply["type"]>("needle");
  const [newQuantity, setNewQuantity] = useState("");
  const [newDailyUsage, setNewDailyUsage] = useState("");
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setItems(usualPrescription?.items ? usualPrescription.items.map((i) => ({ ...i })) : []);
      setAddingNew(false);
      resetNewForm();
    }
  }, [open, usualPrescription]);

  const resetNewForm = () => {
    setNewName("");
    setNewType("needle");
    setNewQuantity("");
    setNewDailyUsage("");
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], quantity: Math.max(0, quantity) };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    if (!newName.trim() || !newQuantity) return;
    const newInc = getSupplyIncrement(newType);
    const rawQty = parseFloat(newQuantity) || 0;
    const actualUnits = newInc.amount > 1 ? Math.round(rawQty * newInc.amount) : rawQty;
    const item: UsualPrescriptionItem = {
      name: newName.trim(),
      type: newType,
      quantity: actualUnits,
      dailyUsage: parseFloat(newDailyUsage) || 0,
    };

    const existingIndex = items.findIndex(
      (i) => i.name.toLowerCase() === item.name.toLowerCase() && i.type === item.type,
    );
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + actualUnits,
        dailyUsage: item.dailyUsage || updated[existingIndex].dailyUsage,
      };
      setItems(updated);
    } else {
      setItems([...items, item]);
    }

    setAddingNew(false);
    resetNewForm();
  };

  const applyFromCurrentSupplies = () => {
    setItems(currentSupplies.map(supplyToUsualPrescriptionItem));
    setConfirmReplaceOpen(false);
  };

  const handleUseCurrentSupplies = () => {
    if (items.length > 0) {
      setConfirmReplaceOpen(true);
      return;
    }
    applyFromCurrentSupplies();
  };

  const handleSave = () => {
    onSave(items);
    onOpenChange(false);
  };

  const hasChanges =
    JSON.stringify(items) !== JSON.stringify(usualPrescription?.items || []);
  const canSave = hasChanges && (items.length > 0 || (usualPrescription?.items?.length ?? 0) > 0);

  const addInc = getSupplyIncrement(newType);
  const usesPacks = addInc.amount > 1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Usual prescription</DialogTitle>
            <DialogDescription>
              Items and amounts you normally collect on your repeat script.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {items.length === 0 && !addingNew ? (
              <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-8 text-center">
                <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">Nothing saved yet</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                  Build your repeat prescription once — then log pickups without re-entering everything.
                </p>

                {currentSupplies.length > 0 ? (
                  <Button
                    className="mt-5 w-full sm:w-auto"
                    onClick={handleUseCurrentSupplies}
                    data-testid="button-usual-from-current"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy from supply tracker
                  </Button>
                ) : null}

                <Button
                  variant={currentSupplies.length > 0 ? "outline" : "default"}
                  className="mt-2 w-full sm:w-auto"
                  onClick={() => setAddingNew(true)}
                  data-testid="button-usual-add-new"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add item manually
                </Button>
              </div>
            ) : null}

            {items.map((item, index) => (
              <UsualPrescriptionItemRow
                key={`${item.name}-${item.type}-${index}`}
                item={item}
                index={index}
                onUpdateQuantity={handleUpdateQuantity}
                onRemove={handleRemoveItem}
              />
            ))}

            {items.length > 0 && currentSupplies.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUseCurrentSupplies}
                className="w-full"
                data-testid="button-usual-from-current-inline"
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                Replace with tracker amounts
              </Button>
            ) : null}

            {addingNew ? (
              <div className="space-y-3 rounded-2xl border border-dashed bg-muted/10 p-4">
                <p className="text-sm font-medium">New item</p>
                <div className="space-y-2">
                  <Label htmlFor="usual-new-name">Name</Label>
                  <Input
                    id="usual-new-name"
                    placeholder="e.g. NovoRapid FlexPen"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    data-testid="input-usual-new-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usual-new-type">Type</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as Supply["type"])}>
                    <SelectTrigger id="usual-new-type" data-testid="select-usual-new-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="needle">Needles/Lancets</SelectItem>
                      <SelectItem value="insulin_short">Short-Acting Insulin</SelectItem>
                      <SelectItem value="insulin_long">Long-Acting Insulin</SelectItem>
                      {isPumpUser ? <PumpOnlySupplySelectItems /> : null}
                      <SelectItem value="cgm">CGM/Monitors</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="usual-new-qty">
                      {usesPacks ? `How many ${addInc.label}s?` : "Quantity"}
                    </Label>
                    <Input
                      id="usual-new-qty"
                      type="number"
                      min={0}
                      placeholder={usesPacks ? "e.g. 5" : "e.g. 100"}
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      data-testid="input-usual-new-quantity"
                    />
                    {usesPacks && newQuantity ? (
                      <p className="text-xs text-muted-foreground">
                        = {Math.round((parseFloat(newQuantity) || 0) * addInc.amount)} units
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usual-new-daily">Daily usage (optional)</Label>
                    <Input
                      id="usual-new-daily"
                      type="number"
                      step="0.1"
                      placeholder="e.g. 4"
                      value={newDailyUsage}
                      onChange={(e) => setNewDailyUsage(e.target.value)}
                      data-testid="input-usual-new-daily-usage"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddItem}
                    disabled={!newName.trim() || !newQuantity}
                    data-testid="button-usual-confirm-add"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add to list
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAddingNew(false);
                      resetNewForm();
                    }}
                    data-testid="button-usual-cancel-add"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : items.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddingNew(true)}
                className="w-full"
                data-testid="button-usual-add-new"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add another item
              </Button>
            ) : null}

            <div className="flex gap-2 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Quantities are what you <span className="font-medium text-foreground">receive</span>{" "}
                each time — not what&apos;s left in stock. Copying from the tracker uses your saved
                refill amounts when available.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 pt-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
              data-testid="button-usual-cancel"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={handleSave}
              disabled={!canSave}
              data-testid="button-usual-save"
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              Save prescription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your usual prescription?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current list with amounts from your supply tracker (usual refill
              amounts where saved).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current list</AlertDialogCancel>
            <AlertDialogAction onClick={applyFromCurrentSupplies}>
              <Sparkles className="mr-2 h-4 w-4" />
              Replace list
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
