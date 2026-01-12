import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, ArrowRight, Calendar } from "lucide-react";
import { Link } from "wouter";
import { storage, ScenarioState } from "@/lib/storage";
import { format } from "date-fns";

export function TravelModeWidget() {
  const [scenario, setScenario] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });

  useEffect(() => {
    setScenario(storage.getScenarioState());
  }, []);

  return (
    <Card data-testid="widget-travel-mode">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Travel Mode</CardTitle>
          </div>
          {scenario.travelModeActive && (
            <Badge variant="default">Active</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {scenario.travelModeActive ? (
          <div className="p-3 rounded-lg bg-primary/10">
            {scenario.travelDestination && (
              <p className="text-sm font-medium mb-1">{scenario.travelDestination}</p>
            )}
            {scenario.travelEndDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Until {format(new Date(scenario.travelEndDate), "dd MMM yyyy")}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Planning a trip? Get tailored advice for travelling with diabetes.
          </p>
        )}
        
        <Link href="/scenarios">
          <Button variant="secondary" size="sm" className="w-full" data-testid="button-travel-mode">
            {scenario.travelModeActive ? "Manage Travel" : "Plan a Trip"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
