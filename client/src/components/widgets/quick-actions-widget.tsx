import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Dumbbell, Thermometer, Plane, Users, Calculator } from "lucide-react";
import { Link } from "wouter";

interface QuickAction {
  icon: typeof Package;
  label: string;
  href: string;
  color: string;
  testId: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: Package, label: "Supplies", href: "/supplies", color: "text-blue-600", testId: "action-supplies" },
  { icon: Dumbbell, label: "Activity", href: "/advisor", color: "text-green-600", testId: "action-activity" },
  { icon: Thermometer, label: "Sick Day", href: "/sick-day", color: "text-orange-600", testId: "action-sick-day" },
  { icon: Plane, label: "Travel", href: "/travel", color: "text-purple-600", testId: "action-travel" },
  { icon: Calculator, label: "Ratios", href: "/advisor", color: "text-teal-600", testId: "action-ratios" },
  { icon: Users, label: "Community", href: "/community", color: "text-indigo-600", testId: "action-community" },
];

export function QuickActionsWidget() {
  return (
    <Card data-testid="widget-quick-actions">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.label} href={action.href}>
              <Button
                variant="ghost"
                className="w-full h-auto flex-col py-3 gap-1 hover-elevate"
                data-testid={action.testId}
              >
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs font-normal">{action.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
