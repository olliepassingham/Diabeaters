import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Syringe, Droplet, Activity, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface SupplyCardProps {
  id: string;
  name: string;
  type: "needle" | "insulin" | "cgm";
  currentQuantity: number;
  dailyUsage: number;
  lowThreshold?: number;
}

const supplyIcons = {
  needle: Syringe,
  insulin: Droplet,
  cgm: Activity,
};

export function SupplyCard({
  id,
  name,
  type,
  currentQuantity,
  dailyUsage,
  lowThreshold = 7,
}: SupplyCardProps) {
  const [quantity, setQuantity] = useState(currentQuantity);
  const Icon = supplyIcons[type];
  const daysRemaining = Math.floor(quantity / dailyUsage);
  const isLow = daysRemaining <= lowThreshold;
  const isCritical = daysRemaining <= 3;
  const progressValue = Math.min((daysRemaining / (lowThreshold * 2)) * 100, 100);

  const handleIncrement = () => {
    setQuantity(prev => prev + 1);
    console.log(`Increased ${name} quantity to ${quantity + 1}`);
  };

  const handleDecrement = () => {
    if (quantity > 0) {
      setQuantity(prev => prev - 1);
      console.log(`Decreased ${name} quantity to ${quantity - 1}`);
    }
  };

  return (
    <Card data-testid={`card-supply-${id}`} className={isCritical ? "border-destructive" : isLow ? "border-yellow-500" : ""}>
      {(isLow || isCritical) && (
        <div className={`px-4 py-2 text-sm font-medium ${isCritical ? "bg-destructive text-destructive-foreground" : "bg-yellow-500 text-white"}`}>
          {isCritical ? "Critical: Reorder immediately" : "Low stock: Reorder soon"}
        </div>
      )}
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <Badge variant="secondary" className="mt-1 text-xs">
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Supply</span>
            <span className="font-semibold" data-testid={`text-quantity-${id}`}>{quantity} units</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Daily Usage</span>
            <span>{dailyUsage} units/day</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Days Remaining</span>
            <span className={`font-semibold ${isCritical ? "text-destructive" : isLow ? "text-yellow-600 dark:text-yellow-500" : ""}`} data-testid={`text-days-${id}`}>
              ~{daysRemaining} days
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={progressValue} className="h-2" />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleDecrement}
            data-testid={`button-decrease-${id}`}
          >
            <Minus className="h-4 w-4 mr-1" />
            Use
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleIncrement}
            data-testid={`button-increase-${id}`}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
