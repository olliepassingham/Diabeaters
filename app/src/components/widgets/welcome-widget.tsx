import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Package, Utensils, Dumbbell, LayoutDashboard, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { DIABEATER_ACTIVE_USER_CHANGED_EVENT, isWelcomeStruggleCardDismissed, setWelcomeStruggleCardDismissed } from "@/lib/storage";

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
    iconColor: "text-primary",
    iconBg: "bg-primary/10 ring-1 ring-primary/15",
  },
  meals: {
    icon: Utensils,
    title: "Ready to simplify mealtimes",
    message: "You said meal dosing was tricky. Meal & ratios can suggest insulin from the carb ratios you save — try it with your next meal.",
    cta: "Plan a meal",
    link: "/adviser?tab=meal",
    iconColor: "text-amber-700 dark:text-amber-300",
    iconBg: "bg-amber-500/10 ring-1 ring-amber-500/20",
  },
  exercise: {
    icon: Dumbbell,
    title: "Let's tackle exercise together",
    message: "Exercise throwing your levels off? The Exercise Planner can suggest carb and insulin adjustments for your workout.",
    cta: "Open exercise guide",
    link: "/scenarios/exercise",
    iconColor: "text-emerald-700 dark:text-emerald-300",
    iconBg: "bg-emerald-500/10 ring-1 ring-emerald-500/20",
  },
  overview: {
    icon: LayoutDashboard,
    title: "Your diabetes hub is ready",
    message: "Everything in one place — supplies, meals, exercise, and more. Use Home and Tools along the bottom (or the menu on larger screens), and use the layout control on Home to show what matters most.",
    cta: "Browse tools",
    link: "/tools",
    iconColor: "text-violet-700 dark:text-violet-300",
    iconBg: "bg-violet-500/10 ring-1 ring-violet-500/20",
  },
};

function readShouldShow(): { struggle: string | null } {
  if (isWelcomeStruggleCardDismissed()) return { struggle: null };
  const s = localStorage.getItem("diabeater_onboarding_struggle");
  return { struggle: s };
}

export function shouldOfferWelcomeWidget(): boolean {
  try {
    const { struggle } = readShouldShow();
    return Boolean(struggle && STRUGGLE_CONFIGS[struggle]);
  } catch {
    return false;
  }
}

export function WelcomeWidget() {
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState(false);
  const [struggle, setStruggle] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => {
      const { struggle: s } = readShouldShow();
      if (!s || !STRUGGLE_CONFIGS[s]) {
        setStruggle(null);
        setVisible(false);
        return;
      }
      setStruggle(s);
      setVisible(true);
    };
    apply();
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, apply);
    return () => window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, apply);
  }, []);

  if (!visible || !struggle) return null;

  const config = STRUGGLE_CONFIGS[struggle];
  if (!config) return null;

  const Icon = config.icon;

  const handleDismiss = () => {
    setWelcomeStruggleCardDismissed();
    setVisible(false);
  };

  const handleCta = () => {
    setWelcomeStruggleCardDismissed();
    setVisible(false);
    setLocation(config.link);
  };

  return (
    <Card
      variant="glass-muted"
      className="overflow-hidden !rounded-none !border-0 !bg-transparent !shadow-none !backdrop-blur-none"
      data-testid="widget-welcome"
    >
      <CardContent className="p-4 md:p-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconBg}`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-sm font-semibold tracking-tight">{config.title}</h3>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 -mt-1 -mr-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-200"
                onClick={handleDismiss}
                data-testid="button-dismiss-welcome"
                aria-label="Dismiss welcome"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{config.message}</p>
            <Button size="sm" variant="outline" data-testid="button-welcome-cta" type="button" onClick={handleCta}>
              {config.cta}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
