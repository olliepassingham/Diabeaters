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
import { Plus, Pencil, Trash2, Package, Syringe, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage, Supply } from "@/lib/storage";
import { FaceLogoWatermark } from "@/components/face-logo";

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
  onUpdateQuantity 
}: { 
  supply: Supply; 
  onEdit: (supply: Supply) => void;
  onDelete: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
}) {
  const daysRemaining = storage.getDaysRemaining(supply);
  const status = storage.getSupplyStatus(supply);
  const Icon = typeIcons[supply.type] || Package;

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
        </div>
      </CardContent>
    </Card>
  );
}

function SupplyDialog({ 
  supply, 
  open, 
  onOpenChange, 
  onSave 
}: { 
  supply: Supply | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Supply, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Supply["type"]>("needle");
  const [quantity, setQuantity] = useState("");
  const [dailyUsage, setDailyUsage] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (supply) {
      setName(supply.name);
      setType(supply.type);
      setQuantity(supply.currentQuantity.toString());
      setDailyUsage(supply.dailyUsage.toString());
      setNotes(supply.notes || "");
    } else {
      setName("");
      setType("needle");
      setQuantity("");
      setDailyUsage("");
      setNotes("");
    }
  }, [supply, open]);

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

export default function Supplies() {
  const { toast } = useToast();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);

  useEffect(() => {
    setSupplies(storage.getSupplies());
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
        <Button onClick={handleAddNew} data-testid="button-add-new-supply">
          <Plus className="h-4 w-4 mr-2" />
          Add New Supply
        </Button>
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
      />
    </div>
  );
}
