import { StatCard } from "@/components/stat-card";
import { SupplyCard } from "@/components/supply-card";
import { Package, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Dashboard() {
  const supplies = [
    { id: "1", name: "Insulin Pen Needles", type: "needle" as const, currentQuantity: 45, dailyUsage: 4 },
    { id: "2", name: "NovoRapid FlexPen", type: "insulin" as const, currentQuantity: 15, dailyUsage: 3 },
    { id: "3", name: "CGM Sensor", type: "cgm" as const, currentQuantity: 2, dailyUsage: 0.1 },
  ];

  const lowStockSupplies = supplies.filter(s => (s.currentQuantity / s.dailyUsage) <= 7);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your supply overview.</p>
        </div>
        <Button data-testid="button-add-supply">
          <Plus className="h-4 w-4 mr-2" />
          Add Supply
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Supplies"
          value={supplies.length}
          icon={Package}
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockSupplies.length}
          icon={AlertCircle}
          description="< 7 days remaining"
        />
        <StatCard
          title="Last Updated"
          value="Today"
          icon={Clock}
          description="3 items modified"
        />
      </div>

      {lowStockSupplies.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
            <h2 className="text-xl font-semibold">Low Stock Alerts</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStockSupplies.map((supply) => (
              <SupplyCard key={supply.id} {...supply} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">All Supplies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supplies.map((supply) => (
            <SupplyCard key={supply.id} {...supply} />
          ))}
        </div>
      </div>
    </div>
  );
}
