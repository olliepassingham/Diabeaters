import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Package, Syringe, Activity, Settings, Calendar, RotateCcw, AlertTriangle, ClipboardList, Save, Undo2, Plug, Cylinder } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage, Supply, LastPrescription, UsualPrescription } from "@/lib/storage";
import { FaceLogoWatermark } from "@/components/face-logo";
import { Link } from "wouter";
import { formatDistanceToNow, format } from "date-fns";

const typeIcons = {
  needle: Syringe,
  insulin: Package,
  cgm: Activity,
  infusion_set: Plug,
  reservoir: Cylinder,
  other: Package,
};

const typeLabels = {
  needle: "Needles/Lancets",
  insulin: "Insulin",
  cgm: "CGM/Monitors",
  infusion_set: "Infusion Sets",
  reservoir: "Reservoirs/Cartridges",
  other: "Other",
};

function SupplyCard({ 
  supply, 
  onEdit, 
  onDelete, 
  onUpdateQuantity,
  onLogPickup 
}: { 
  supply: Supply; 
  onEdit: (supply: Supply) => void;
  onDelete: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onLogPickup: (supply: Supply) => void;
}) {
  const adjustedQuantity = storage.getAdjustedQuantity(supply);
  const daysRemaining = storage.getDaysRemaining(supply);
  const runOutDate = storage.getRunOutDate(supply);
  const status = storage.getSupplyStatus(supply);
  const daysSincePickup = storage.getDaysSincePickup(supply);
  const Icon = typeIcons[supply.type] || Package;

  const getLastPickupText = () => {
    if (!supply.lastPickupDate) return null;
    try {
      const pickupDate = new Date(supply.lastPickupDate);
      const dayText = daysSincePickup !== null && daysSincePickup > 0 
        ? ` (${daysSincePickup} day${daysSincePickup !== 1 ? 's' : ''} ago)`
        : ' (today)';
      return `Picked up ${format(pickupDate, "MMM d")}${dayText}`;
    } catch {
      return null;
    }
  };

  const lastPickupText = getLastPickupText();

  return (
    <Card className={status === "critical" ? "border-red-500/50" : status === "low" ? "border-yellow-500/50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
              status === "critical" ? "bg-red-500/10" : 
              status === "low" ? "bg-yellow-500/10" : "bg-primary/10"
            }`}>
              <Icon className={`h-4 w-4 ${
                status === "critical" ? "text-red-600 dark:text-red-500" : 
                status === "low" ? "text-yellow-600 dark:text-yellow-500" : "text-primary"
              }`} />
            </div>
            <div>
              <p className="font-medium text-sm">{supply.name}</p>
              <p className="text-xs text-muted-foreground">{typeLabels[supply.type]}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(supply)} data-testid={`button-edit-${supply.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-delete-${supply.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Supply</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{supply.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(supply.id)} data-testid="button-confirm-delete">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className={`p-3 rounded-lg mb-3 ${
          status === "critical" ? "bg-red-500/10" : 
          status === "low" ? "bg-yellow-500/10" : "bg-primary/5"
        }`}>
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Estimated Remaining</p>
              {supply.type === "insulin" ? (
                <div data-testid={`text-remaining-${supply.id}`}>
                  <p className={`text-2xl font-bold ${
                    status === "critical" ? "text-red-600 dark:text-red-500" : 
                    status === "low" ? "text-yellow-600 dark:text-yellow-500" : ""
                  }`}>
                    {Math.floor(adjustedQuantity / 100)} {Math.floor(adjustedQuantity / 100) === 1 ? "pen" : "pens"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    (~{Math.round(adjustedQuantity)} units)
                  </p>
                </div>
              ) : (
                <p className={`text-2xl font-bold ${
                  status === "critical" ? "text-red-600 dark:text-red-500" : 
                  status === "low" ? "text-yellow-600 dark:text-yellow-500" : ""
                }`} data-testid={`text-remaining-${supply.id}`}>
                  ~{Math.round(adjustedQuantity)}
                </p>
              )}
            </div>
            <div className="text-right">
              <Badge 
                variant={status === "critical" ? "destructive" : status === "low" ? "secondary" : "outline"}
                className="mb-1"
                data-testid={`badge-days-${supply.id}`}
              >
                {status === "critical" && <AlertTriangle className="h-3 w-3 mr-1" />}
                {daysRemaining === 999 ? "N/A" : `~${daysRemaining} days`}
              </Badge>
              {runOutDate && daysRemaining < 999 && (
                <p className="text-xs text-muted-foreground">
                  Est. run out: {format(runOutDate, "MMM d")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Daily usage</span>
            <span>{supply.dailyUsage}/day</span>
          </div>
          
          {lastPickupText && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {lastPickupText}
            </div>
          )}
          
          {supply.quantityAtPickup && daysSincePickup !== null && daysSincePickup > 0 && (
            <div className="text-xs text-muted-foreground">
              Started with {supply.quantityAtPickup} • Used ~{Math.round(daysSincePickup * supply.dailyUsage)}
            </div>
          )}
        </div>

        <div className="pt-3 mt-3 border-t flex gap-2">
          <Button 
            variant="default" 
            size="sm" 
            className="flex-1"
            onClick={() => onLogPickup(supply)}
            data-testid={`button-refill-${supply.id}`}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Refill
          </Button>
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onUpdateQuantity(supply.id, Math.max(0, supply.currentQuantity - 1))}
              data-testid={`button-decrease-${supply.id}`}
            >
              -
            </Button>
            <span className="w-8 text-center text-sm" data-testid={`text-quantity-${supply.id}`}>
              {supply.currentQuantity}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onUpdateQuantity(supply.id, supply.currentQuantity + 1)}
              data-testid={`button-increase-${supply.id}`}
            >
              +
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplyDialog({ 
  supply, 
  open, 
  onOpenChange, 
  onSave,
  lastPrescription 
}: { 
  supply: Supply | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Supply, "id">) => void;
  lastPrescription: LastPrescription | null;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Supply["type"]>("needle");
  const [quantity, setQuantity] = useState("");
  const [dailyUsage, setDailyUsage] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [showLastPrescriptionOption, setShowLastPrescriptionOption] = useState(false);

  useEffect(() => {
    if (supply) {
      setName(supply.name);
      setType(supply.type);
      setQuantity(supply.currentQuantity.toString());
      setDailyUsage(supply.dailyUsage.toString());
      setNotes(supply.notes || "");
      setPickupDate(supply.lastPickupDate ? format(new Date(supply.lastPickupDate), "yyyy-MM-dd") : "");
      setShowLastPrescriptionOption(false);
    } else {
      setName("");
      setType("needle");
      setQuantity("");
      setDailyUsage("");
      setNotes("");
      setPickupDate(format(new Date(), "yyyy-MM-dd"));
      setShowLastPrescriptionOption(lastPrescription !== null);
    }
  }, [supply, open, lastPrescription]);

  const useLastPrescription = () => {
    if (lastPrescription) {
      setName(lastPrescription.name);
      setType(lastPrescription.type);
      setQuantity(lastPrescription.quantity.toString());
      setDailyUsage(lastPrescription.dailyUsage.toString());
      setNotes(lastPrescription.notes || "");
      setShowLastPrescriptionOption(false);
    }
  };

  const handleSubmit = () => {
    const parsedQuantity = parseFloat(quantity) || 0;
    onSave({
      name,
      type,
      currentQuantity: parsedQuantity,
      dailyUsage: parseFloat(dailyUsage) || 0,
      notes: notes || undefined,
      lastPickupDate: pickupDate ? new Date(pickupDate).toISOString() : undefined,
      quantityAtPickup: parsedQuantity,
    });
    onOpenChange(false);
  };

  const isValid = name.trim() && quantity && dailyUsage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supply ? "Edit Supply" : "Add New Supply"}</DialogTitle>
          <DialogDescription>
            {supply ? "Update the details of your supply item." : "Add a new item to track in your inventory."}
          </DialogDescription>
        </DialogHeader>
        {!supply && showLastPrescriptionOption && lastPrescription && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Use last prescription?</p>
                  <p className="text-xs text-muted-foreground truncate">{lastPrescription.name}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowLastPrescriptionOption(false)} data-testid="button-add-different">
                    New
                  </Button>
                  <Button size="sm" onClick={useLastPrescription} data-testid="button-use-last">
                    Use
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              placeholder="e.g., NovoRapid FlexPen" 
              value={name} 
              onChange={e => setName(e.target.value)}
              data-testid="input-supply-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as Supply["type"])}>
              <SelectTrigger id="type" data-testid="select-supply-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needle">Needles/Lancets</SelectItem>
                <SelectItem value="insulin">Insulin</SelectItem>
                <SelectItem value="cgm">CGM/Monitors</SelectItem>
                <SelectItem value="infusion_set">Infusion Sets (Pump)</SelectItem>
                <SelectItem value="reservoir">Reservoirs/Cartridges (Pump)</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Current Quantity</Label>
              <Input 
                id="quantity" 
                type="number" 
                placeholder="e.g., 50" 
                value={quantity} 
                onChange={e => setQuantity(e.target.value)}
                data-testid="input-supply-quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-usage">Daily Usage</Label>
              <Input 
                id="daily-usage" 
                type="number" 
                step="0.1"
                placeholder="e.g., 4" 
                value={dailyUsage} 
                onChange={e => setDailyUsage(e.target.value)}
                data-testid="input-supply-daily-usage"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pickup-date">Pickup Date</Label>
            <Input 
              id="pickup-date" 
              type="date"
              value={pickupDate} 
              onChange={e => setPickupDate(e.target.value)}
              data-testid="input-supply-pickup-date"
            />
            <p className="text-xs text-muted-foreground">
              When you received this supply. Used to estimate remaining quantity.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input 
              id="notes" 
              placeholder="Any additional notes..." 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              data-testid="input-supply-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid} data-testid="button-save-supply">
            {supply ? "Save Changes" : "Add Supply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefillDialog({
  supply,
  open,
  onOpenChange,
  onConfirm
}: {
  supply: Supply | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quantity: number, saveAsTypical: boolean) => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [saveAsTypical, setSaveAsTypical] = useState(false);
  const hasTypicalQuantity = supply?.typicalRefillQuantity && supply.typicalRefillQuantity > 0;

  useEffect(() => {
    if (supply && open) {
      if (supply.typicalRefillQuantity && supply.typicalRefillQuantity > 0) {
        setQuantity(supply.typicalRefillQuantity.toString());
        setSaveAsTypical(false);
      } else {
        setQuantity("");
        setSaveAsTypical(true);
      }
    }
  }, [supply, open]);

  const handleQuickRefill = () => {
    if (supply?.typicalRefillQuantity) {
      onConfirm(supply.typicalRefillQuantity, false);
      onOpenChange(false);
    }
  };

  const handleConfirm = () => {
    const qty = parseFloat(quantity) || 0;
    onConfirm(qty, saveAsTypical);
    onOpenChange(false);
  };

  const parsedQty = parseFloat(quantity) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refill {supply?.name}</DialogTitle>
          <DialogDescription>
            Record your prescription refill. This resets your supply count and starts fresh tracking.
          </DialogDescription>
        </DialogHeader>
        
        {hasTypicalQuantity && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Quick refill</p>
                  <p className="text-xs text-muted-foreground">
                    Your usual: {supply?.typicalRefillQuantity} units
                  </p>
                </div>
                <Button onClick={handleQuickRefill} data-testid="button-quick-refill">
                  Refill Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pickup-quantity">
              {hasTypicalQuantity ? "Or enter different quantity" : "Quantity received"}
            </Label>
            <Input
              id="pickup-quantity"
              type="number"
              placeholder="e.g., 50"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              data-testid="input-pickup-quantity"
            />
            {parsedQty > 0 && (
              <p className="text-xs text-muted-foreground">
                New supply level: {parsedQty}
              </p>
            )}
          </div>
          
          {parsedQty > 0 && !hasTypicalQuantity && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="save-typical"
                checked={saveAsTypical}
                onChange={(e) => setSaveAsTypical(e.target.checked)}
                className="rounded"
                data-testid="checkbox-save-typical"
              />
              <Label htmlFor="save-typical" className="text-sm font-normal cursor-pointer">
                Remember this as my usual refill amount
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirm} 
            disabled={parsedQty <= 0} 
            data-testid="button-confirm-pickup"
          >
            Confirm Refill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Supplies() {
  const { toast } = useToast();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [lastPrescription, setLastPrescription] = useState<LastPrescription | null>(null);
  const [usualPrescription, setUsualPrescription] = useState<UsualPrescription | null>(null);
  const [pickupDialogOpen, setPickupDialogOpen] = useState(false);
  const [pickupSupply, setPickupSupply] = useState<Supply | null>(null);
  const [previousSupplies, setPreviousSupplies] = useState<Supply[] | null>(null);

  useEffect(() => {
    setSupplies(storage.getSupplies());
    setLastPrescription(storage.getLastPrescription());
    setUsualPrescription(storage.getUsualPrescription());
  }, []);

  const refreshSupplies = () => {
    setSupplies(storage.getSupplies());
    setUsualPrescription(storage.getUsualPrescription());
  };

  const saveStateForUndo = () => {
    setPreviousSupplies([...storage.getSupplies()]);
  };

  const handleAddUsualPrescription = () => {
    saveStateForUndo();
    const result = storage.addUsualPrescriptionSupplies();
    if (result.added > 0 || result.merged > 0) {
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} new`);
      if (result.merged > 0) parts.push(`${result.merged} merged`);
      toast({ 
        title: "Usual prescription added", 
        description: `${parts.join(", ")} item${(result.added + result.merged) > 1 ? "s" : ""} from your usual prescription.` 
      });
      refreshSupplies();
    } else {
      setPreviousSupplies(null);
      toast({ 
        title: "No usual prescription saved", 
        description: "Add supplies first, then save them as your usual prescription.",
        variant: "destructive"
      });
    }
  };

  const handleSaveAsUsualPrescription = () => {
    if (supplies.length === 0) {
      toast({ 
        title: "No supplies to save", 
        description: "Add some supplies first before saving as your usual prescription.",
        variant: "destructive"
      });
      return;
    }
    storage.saveCurrentSuppliesAsUsualPrescription();
    setUsualPrescription(storage.getUsualPrescription());
    toast({ 
      title: "Usual prescription saved", 
      description: `Saved ${supplies.length} item${supplies.length > 1 ? "s" : ""} as your usual prescription.` 
    });
  };

  const handleAddNew = () => {
    setEditingSupply(null);
    setDialogOpen(true);
  };

  const handleEdit = (supply: Supply) => {
    setEditingSupply(supply);
    setDialogOpen(true);
  };

  const handleSave = (data: Omit<Supply, "id">) => {
    if (editingSupply) {
      storage.updateSupply(editingSupply.id, data);
      toast({ title: "Supply updated", description: `${data.name} has been updated.` });
    } else {
      const result = storage.addSupply(data);
      storage.saveLastPrescription({
        name: data.name,
        type: data.type,
        quantity: data.currentQuantity,
        dailyUsage: data.dailyUsage,
        notes: data.notes,
      });
      setLastPrescription(storage.getLastPrescription());
      if (result.merged) {
        toast({ title: "Supply merged", description: `Added ${data.currentQuantity} to existing ${data.name}.` });
      } else {
        toast({ title: "Supply added", description: `${data.name} has been added to your inventory.` });
      }
    }
    refreshSupplies();
  };

  const handleDelete = (id: string) => {
    saveStateForUndo();
    const supply = supplies.find(s => s.id === id);
    storage.deleteSupply(id);
    toast({ title: "Supply deleted", description: supply ? `${supply.name} has been removed.` : "Supply removed." });
    refreshSupplies();
  };

  const handleUndo = () => {
    if (previousSupplies) {
      localStorage.setItem("diabeater_supplies", JSON.stringify(previousSupplies));
      toast({ title: "Undo successful", description: "Changes have been reverted." });
      setPreviousSupplies(null);
      refreshSupplies();
    }
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    storage.updateSupply(id, { currentQuantity: quantity });
    refreshSupplies();
  };

  const handleLogPickup = (supply: Supply) => {
    setPickupSupply(supply);
    setPickupDialogOpen(true);
  };

  const handleConfirmRefill = (quantity: number, saveAsTypical: boolean) => {
    if (pickupSupply) {
      const updates: Partial<Supply> = { 
        currentQuantity: quantity,
        quantityAtPickup: quantity,
        lastPickupDate: new Date().toISOString()
      };
      
      if (saveAsTypical) {
        updates.typicalRefillQuantity = quantity;
      }
      
      storage.updateSupply(pickupSupply.id, updates);
      storage.addPickupRecord(pickupSupply.id, pickupSupply.name, quantity);
      toast({ 
        title: "Refill recorded", 
        description: `${pickupSupply.name} refilled with ${quantity} units.${saveAsTypical ? " Saved as your typical amount." : ""}` 
      });
      refreshSupplies();
    }
  };

  const filterByType = (type: string) => {
    if (type === "all") return supplies;
    return supplies.filter(s => s.type === type);
  };

  const lowStockCount = supplies.filter(s => storage.getSupplyStatus(s) !== "ok").length;

  return (
    <div className="space-y-6 relative">
      <FaceLogoWatermark />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Supply Tracker</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your diabetes supplies.
            {lowStockCount > 0 && (
              <span className="text-yellow-600 dark:text-yellow-500 ml-2">
                ({lowStockCount} item{lowStockCount > 1 ? "s" : ""} running low)
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleAddNew} data-testid="button-add-new-supply">
              <Plus className="h-4 w-4 mr-1" />
              Add Supply
            </Button>
            {supplies.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleSaveAsUsualPrescription} data-testid="button-save-usual-prescription">
                <Save className="h-4 w-4 mr-1" />
                Save Usual
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleUndo} 
              disabled={!previousSupplies}
              data-testid="button-undo"
            >
              <Undo2 className="h-4 w-4 mr-1" />
              Undo
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {usualPrescription && usualPrescription.items.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleAddUsualPrescription} data-testid="button-add-usual-prescription">
                <ClipboardList className="h-4 w-4 mr-1" />
                Add Usual
              </Button>
            )}
            <Link href="/settings#usual-habits">
              <Button variant="outline" size="sm" data-testid="button-usage-settings">
                <Settings className="h-4 w-4 mr-1" />
                Habits
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({supplies.length})
          </TabsTrigger>
          <TabsTrigger value="needle" data-testid="tab-needles">
            Needles ({filterByType("needle").length})
          </TabsTrigger>
          <TabsTrigger value="insulin" data-testid="tab-insulin">
            Insulin ({filterByType("insulin").length})
          </TabsTrigger>
          <TabsTrigger value="cgm" data-testid="tab-cgm">
            CGM ({filterByType("cgm").length})
          </TabsTrigger>
          <TabsTrigger value="infusion_set" data-testid="tab-infusion-sets">
            Infusion ({filterByType("infusion_set").length})
          </TabsTrigger>
          <TabsTrigger value="reservoir" data-testid="tab-reservoirs">
            Reservoirs ({filterByType("reservoir").length})
          </TabsTrigger>
        </TabsList>

        {["all", "needle", "insulin", "cgm", "infusion_set", "reservoir"].map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue} className="mt-6">
            {filterByType(tabValue).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No supplies in this category yet.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={handleAddNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Supply
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filterByType(tabValue).map((supply) => (
                  <SupplyCard
                    key={supply.id}
                    supply={supply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onUpdateQuantity={handleUpdateQuantity}
                    onLogPickup={handleLogPickup}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <SupplyDialog
        supply={editingSupply}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        lastPrescription={lastPrescription}
      />

      <RefillDialog
        supply={pickupSupply}
        open={pickupDialogOpen}
        onOpenChange={setPickupDialogOpen}
        onConfirm={handleConfirmRefill}
      />
    </div>
  );
}
