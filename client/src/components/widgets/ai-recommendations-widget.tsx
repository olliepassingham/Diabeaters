import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { storage, Supply, ScenarioState } from "@/lib/storage";

interface AIInsight {
  title: string;
  message: string;
  reasoning?: string;
  priority: "info" | "warning" | "tip";
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
    });
  }

  if (scenarioState.sickDayActive) {
    insights.push({
      title: "Sick Day Reminder",
      message: "Check blood glucose more frequently when unwell. Stay hydrated.",
      reasoning: "Illness can affect blood glucose levels unpredictably. More frequent monitoring helps catch issues early.",
      priority: "info",
    });
  }

  if (scenarioState.travelModeActive) {
    insights.push({
      title: "Travel Tip",
      message: "Remember to keep insulin in carry-on luggage and adjust for timezone changes.",
      reasoning: "Checked luggage can be lost or exposed to extreme temperatures. Timezones affect meal and dose timing.",
      priority: "tip",
    });
  }

  if (insights.length === 0 && lowSupplies.length > 0) {
    insights.push({
      title: "Plan Ahead",
      message: `${lowSupplies.length} item${lowSupplies.length > 1 ? "s are" : " is"} running low. Good time to check your pharmacy hours.`,
      reasoning: "Planning restocks before items become critical reduces stress and emergency situations.",
      priority: "tip",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "Looking Good",
      message: "Your supplies are well-stocked and no active scenarios. Keep it up!",
      priority: "info",
    });
  }

  return insights.slice(0, 2);
}

export function AIRecommendationsWidget() {
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
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">AI Insights</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            Not medical advice
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, index) => (
          <div 
            key={index} 
            className={`p-3 rounded-lg ${
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
                <p className="text-sm text-muted-foreground mt-1" data-testid={`text-insight-${index}`}>
                  {insight.message}
                </p>
              </div>
              {insight.reasoning && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
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
            {expanded === insight.title && insight.reasoning && (
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

        <Link href="/advisor">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-ask-ai">
            Ask AI Advisor
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
