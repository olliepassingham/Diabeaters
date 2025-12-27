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
import { Plus, Pencil, Trash2, Package, Syringe, Activity, Settings, Calendar, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage, Supply, LastPrescription } from "@/lib/storage";
import { FaceLogoWatermark } from "@/components/face-logo";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

const typeIcons = {
  needle: Syringe,
  insulin: Package,
  cgm: Activity,
  other: Package,
};

const typeLabels = {
  needle: "Needles/Lancets",
  insulin: "Insulin",
  cgm: "CGM/Monitors",
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
  const daysRemaining = storage.getDaysRemaining(supply);
  const status = storage.getSupplyStatus(supply);
  const Icon = typeIcons[supply.type] || Package;

  const getLastPickupText = () => {
    if (!supply.lastPickupDate) return null;
    try {
      return formatDistanceToNow(new Date(supply.lastPickupDate), { addSuffix: true });
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

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quantity</span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onUpdateQuantity(supply.id, Math.max(0, supply.currentQuantity - 1))}
                data-testid={`button-decrease-${supply.id}`}
              >
                -
              </Button>
              <span className="w-12 text-center font-medium" data-testid={`text-quantity-${supply.id}`}>
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

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Daily Usage</span>
            <span className="text-sm">{supply.dailyUsage}/day</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Days Remaining</span>
            <Badge 
              variant={status === "critical" ? "destructive" : status === "low" ? "secondary" : "outline"}
              data-testid={`badge-days-${supply.id}`}
            >
              {daysRemaining === 999 ? "N/A" : `${daysRemaining} days`}
            </Badge>
          </div>

          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {lastPickupText ? `Picked up ${lastPickupText}` : "No pickup logged"}
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => onLogPickup(supply)}
              data-testid={`button-pickup-${supply.id}`}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Log Pickup / Refill
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
  const [showLastPrescriptionOption, setShowLastPrescriptionOption] = useState(false);

  useEffect(() => {
    if (supply) {
      setName(supply.name);
      setType(supply.type);
      setQuantity(supply.currentQuantity.toString());
      setDailyUsage(supply.dailyUsage.toString());
      setNotes(supply.notes || "");
      setShowLastPrescriptionOption(false);
    } else {
      setName("");
      setType("needle");
      setQuantity("");
      setDailyUsage("");
      setNotes("");
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
    onSave({
      name,
      type,
      currentQuantity: parseFloat(quantity) || 0,
      dailyUsage: parseFloat(dailyUsage) || 0,
      notes: notes || undefined,
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

function PickupDialog({
  supply,
  open,
  onOpenChange,
  onConfirm
}: {
  supply: Supply | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    if (supply) {
      setQuantity("");
    }
  }, [supply, open]);

  const handleConfirm = () => {
    const qty = parseFloat(quantity) || 0;
    onConfirm(qty);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Pickup / Refill</DialogTitle>
          <DialogDescription>
            Record that you picked up {supply?.name}. This will update the quantity and track your pickup history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pickup-quantity">Quantity Received</Label>
            <Input
              id="pickup-quantity"
              type="number"
              placeholder="e.g., 50"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              data-testid="input-pickup-quantity"
            />
            <p className="text-xs text-muted-foreground">
              Current: {supply?.currentQuantity || 0}. After pickup: {(supply?.currentQuantity || 0) + (parseFloat(quantity) || 0)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!quantity || parseFloat(quantity) <= 0} data-testid="button-confirm-pickup">
            Log Pickup
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
  const [pickupDialogOpen, setPickupDialogOpen] = useState(false);
  const [pickupSupply, setPickupSupply] = useState<Supply | null>(null);

  useEffect(() => {
    setSupplies(storage.getSupplies());
    setLastPrescription(storage.getLastPrescription());
  }, []);

  const refreshSupplies = () => {
    setSupplies(storage.getSupplies());
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
      storage.addSupply(data);
      storage.saveLastPrescription({
        name: data.name,
        type: data.type,
        quantity: data.currentQuantity,
        dailyUsage: data.dailyUsage,
        notes: data.notes,
      });
      setLastPrescription(storage.getLastPrescription());
      toast({ title: "Supply added", description: `${data.name} has been added to your inventory.` });
    }
    refreshSupplies();
  };

  const handleDelete = (id: string) => {
    const supply = supplies.find(s => s.id === id);
    storage.deleteSupply(id);
    toast({ title: "Supply deleted", description: supply ? `${supply.name} has been removed.` : "Supply removed." });
    refreshSupplies();
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    storage.updateSupply(id, { currentQuantity: quantity });
    refreshSupplies();
  };

  const handleLogPickup = (supply: Supply) => {
    setPickupSupply(supply);
    setPickupDialogOpen(true);
  };

  const handleConfirmPickup = (quantity: number) => {
    if (pickupSupply) {
      const newQuantity = pickupSupply.currentQuantity + quantity;
      storage.updateSupply(pickupSupply.id, { currentQuantity: newQuantity });
      storage.addPickupRecord(pickupSupply.id, pickupSupply.name, quantity);
      toast({ 
        title: "Pickup logged", 
        description: `Added ${quantity} to ${pickupSupply.name}. New total: ${newQuantity}` 
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
        <div className="flex flex-wrap gap-2">
          <Link href="/settings#usage-habits">
            <Button variant="outline" data-testid="button-usage-settings">
              <Settings className="h-4 w-4 mr-2" />
              Usage Habits
            </Button>
          </Link>
          <Button onClick={handleAddNew} data-testid="button-add-new-supply">
            <Plus className="h-4 w-4 mr-2" />
            Add New Supply
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
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
        </TabsList>

        {["all", "needle", "insulin", "cgm"].map((tabValue) => (
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

      <PickupDialog
        supply={pickupSupply}
        open={pickupDialogOpen}
        onOpenChange={setPickupDialogOpen}
        onConfirm={handleConfirmPickup}
      />
    </div>
  );
}
