import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Package, Utensils, Dumbbell, LayoutDashboard, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const DISMISSED_KEY = "diabeater_welcome_dismissed";

interface StruggleConfig {
  icon: typeof Package;
  title: string;
  message: string;
  cta: string;
  link: string;
  iconColor: string;
  iconBg: string;
}

const STRUGGLE_CONFIGS: Record<string, StruggleConfig> = {
  supplies: {
    icon: Package,
    title: "Let's get your supplies sorted",
    message: "You said running out of supplies was your biggest challenge. Your Supply Tracker can predict when things will run low and remind you to reorder.",
    cta: "Open Supply Tracker",
    link: "/supplies",
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  meals: {
    icon: Utensils,
    title: "Ready to simplify mealtimes",
    message: "You said meal dosing was tricky. The Meal Planner can suggest doses based on your ratios — give it a try with your next meal.",
    cta: "Open Meal Planner",
    link: "/adviser?tab=meal",
    iconColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-500/10",
  },
  exercise: {
    icon: Dumbbell,
    title: "Let's tackle exercise together",
    message: "Exercise throwing your levels off? The Exercise Planner can suggest carb and insulin adjustments for your workout.",
    cta: "Open Exercise Planner",
    link: "/adviser?tab=exercise",
    iconColor: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-500/10",
  },
  overview: {
    icon: LayoutDashboard,
    title: "Your diabetes hub is ready",
    message: "Everything in one place — supplies, meals, exercise, and more. Explore the sidebar to find each tool, or customise this dashboard to show what matters most to you.",
    cta: "Explore Features",
    link: "/supplies",
    iconColor: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-500/10",
  },
};

export function WelcomeWidget() {
  const [visible, setVisible] = useState(false);
  const [struggle, setStruggle] = useState<string | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const s = localStorage.getItem("diabeater_onboarding_struggle");
    if (s) {
      setStruggle(s);
      setVisible(true);
    }
  }, []);

  if (!visible || !struggle) return null;

  const config = STRUGGLE_CONFIGS[struggle];
  if (!config) return null;

  const Icon = config.icon;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  };

  return (
    <Card data-testid="widget-welcome">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-full ${config.iconBg} shrink-0`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm">{config.title}</h3>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 -mt-1 -mr-1"
                onClick={handleDismiss}
                data-testid="button-dismiss-welcome"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{config.message}</p>
            <Link href={config.link}>
              <Button size="sm" variant="outline" data-testid="button-welcome-cta">
                {config.cta}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
