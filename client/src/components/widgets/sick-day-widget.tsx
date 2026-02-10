import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Thermometer, ArrowRight, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { storage, ScenarioState } from "@/lib/storage";

export function SickDayWidget({ compact = false }: { compact?: boolean }) {
  const [scenario, setScenario] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });

  useEffect(() => {
    setScenario(storage.getScenarioState());
  }, []);

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "severe": return "destructive";
      case "moderate": return "default";
      default: return "secondary";
    }
  };

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-sick-day">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Sick Day Mode</CardTitle>
          </div>
          {scenario.sickDayActive && (
            <Badge variant={getSeverityColor(scenario.sickDaySeverity) as any}>
              {scenario.sickDaySeverity || "Active"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {scenario.sickDayActive ? (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Sick day guidance active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Remember to check blood glucose more frequently
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Feeling unwell? Get guidance on managing your diabetes when sick.
          </p>
        )}
        
        <Link href="/scenarios">
          <Button variant="secondary" size="sm" className="w-full" data-testid="button-sick-day-mode">
            {scenario.sickDayActive ? "View Guidance" : "Start Sick Day Mode"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
