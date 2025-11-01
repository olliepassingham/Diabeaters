import { useState } from "react";
import { SupplyCard } from "@/components/supply-card";
import { Button } from "@/components/ui/button";
import { Plus, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Supplies() {
  const [supplies] = useState([
    { id: "1", name: "Insulin Pen Needles", type: "needle" as const, currentQuantity: 45, dailyUsage: 4 },
    { id: "2", name: "NovoRapid FlexPen", type: "insulin" as const, currentQuantity: 15, dailyUsage: 3 },
    { id: "3", name: "Lantus SoloStar", type: "insulin" as const, currentQuantity: 25, dailyUsage: 1 },
    { id: "4", name: "CGM Sensor", type: "cgm" as const, currentQuantity: 2, dailyUsage: 0.1 },
    { id: "5", name: "Lancets", type: "needle" as const, currentQuantity: 120, dailyUsage: 5 },
    { id: "6", name: "Test Strips", type: "cgm" as const, currentQuantity: 80, dailyUsage: 6 },
  ]);

  const filterByType = (type: string) => {
    if (type === "all") return supplies;
    return supplies.filter(s => s.type === type);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Supply Tracker</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage your diabetes supplies.</p>
        </div>
        <Button data-testid="button-add-new-supply">
          <Plus className="h-4 w-4 mr-2" />
          Add New Supply
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All Supplies</TabsTrigger>
          <TabsTrigger value="needle" data-testid="tab-needles">Needles</TabsTrigger>
          <TabsTrigger value="insulin" data-testid="tab-insulin">Insulin</TabsTrigger>
          <TabsTrigger value="cgm" data-testid="tab-cgm">CGM/Monitors</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterByType("all").map((supply) => (
              <SupplyCard key={supply.id} {...supply} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="needle" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterByType("needle").map((supply) => (
              <SupplyCard key={supply.id} {...supply} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insulin" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterByType("insulin").map((supply) => (
              <SupplyCard key={supply.id} {...supply} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cgm" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterByType("cgm").map((supply) => (
              <SupplyCard key={supply.id} {...supply} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
