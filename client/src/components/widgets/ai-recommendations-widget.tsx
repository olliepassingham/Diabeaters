import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { storage, Supply, ScenarioState } from "@/lib/storage";

interface AIInsight {
  title: string;
  message: string;
  reasoning?: string;
  priority: "info" | "warning" | "tip";
  actionLink?: string;
  actionLabel?: string;
}

function generateInsights(supplies: Supply[], scenarioState: ScenarioState): AIInsight[] {
  const insights: AIInsight[] = [];
  const criticalSupplies = supplies.filter(s => storage.getSupplyStatus(s) === "critical");
  const lowSupplies = supplies.filter(s => storage.getSupplyStatus(s) === "low");

  if (criticalSupplies.length > 0) {
    insights.push({
      title: "Restock Soon",
      message: `${criticalSupplies[0].name} will run out in ${storage.getDaysRemaining(criticalSupplies[0])} days. Consider ordering today.`,
      reasoning: "Running out of supplies can be dangerous. Ordering with a buffer ensures you're covered for delays.",
      priority: "warning",
      actionLink: "/supplies",
      actionLabel: "View Supplies",
    });
  }

  if (scenarioState.sickDayActive) {
    insights.push({
      title: "Sick Day Active",
      message: "Check blood glucose more frequently when unwell. Stay hydrated.",
      reasoning: "Illness can affect blood glucose levels unpredictably. More frequent monitoring helps catch issues early.",
      priority: "info",
      actionLink: "/scenarios?tab=sick-day",
      actionLabel: "View Sick Day",
    });
  }

  if (scenarioState.travelModeActive) {
    insights.push({
      title: "Travel Mode Active",
      message: "Remember to keep insulin in carry-on luggage and adjust for timezone changes.",
      reasoning: "Checked luggage can be lost or exposed to extreme temperatures. Timezones affect meal and dose timing.",
      priority: "tip",
      actionLink: "/scenarios?tab=travel",
      actionLabel: "View Travel Plan",
    });
  }

  if (insights.length === 0 && lowSupplies.length > 0) {
    insights.push({
      title: "Plan Ahead",
      message: `${lowSupplies.length} item${lowSupplies.length > 1 ? "s are" : " is"} running low. Good time to check your pharmacy hours.`,
      reasoning: "Planning restocks before items become critical reduces stress and emergency situations.",
      priority: "tip",
      actionLink: "/supplies",
      actionLabel: "View Supplies",
    });
  }

  const hour = new Date().getHours();
  if (hour >= 19 || hour < 6) {
    insights.push({
      title: "Bedtime Check",
      message: "It's evening — a good time to check your glucose before bed for a steady night.",
      reasoning: "Checking blood glucose before sleep helps you spot if you need a snack to prevent overnight lows, or if you're running high and may need a correction.",
      priority: "tip",
      actionLink: "/scenarios?tab=bedtime",
      actionLabel: "Bedtime Check",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "All Clear",
      message: "Your supplies are well-stocked and no active scenarios. Keep it up!",
      priority: "info",
      actionLink: "/advisor",
      actionLabel: "Plan an Activity",
    });
  }

  return insights.slice(0, 2);
}

export function AIRecommendationsWidget({ compact = false }: { compact?: boolean }) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const supplies = storage.getSupplies();
    const scenarioState = storage.getScenarioState();
    setInsights(generateInsights(supplies, scenarioState));
  }, []);

  return (
    <Card data-testid="widget-ai-recommendations">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Status Alerts</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            Not medical advice
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(compact ? insights.slice(0, 1) : insights).map((insight, index) => (
          <div 
            key={index} 
            className={`${compact ? "p-2" : "p-3"} rounded-lg ${
              insight.priority === "warning" 
                ? "bg-yellow-50 dark:bg-yellow-950/30" 
                : insight.priority === "tip"
                ? "bg-blue-50 dark:bg-blue-950/30"
                : "bg-muted/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium text-sm">{insight.title}</p>
                <p className={`${compact ? "text-xs" : "text-sm"} text-muted-foreground mt-1`} data-testid={`text-insight-${index}`}>
                  {compact ? insight.message.slice(0, 60) + (insight.message.length > 60 ? "..." : "") : insight.message}
                </p>
              </div>
              {insight.reasoning && !compact && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setExpanded(expanded === insight.title ? null : insight.title)}
                  data-testid={`button-expand-${index}`}
                >
                  {expanded === insight.title ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {expanded === insight.title && insight.reasoning && !compact && (
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                {insight.reasoning}
              </p>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>Always consult your healthcare team</span>
        </div>

        {insights[0]?.actionLink && (
          <Link href={insights[0].actionLink}>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-status-action">
              {insights[0].actionLabel || "View Details"}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
