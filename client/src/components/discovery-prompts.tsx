import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, Package, Utensils, Dumbbell, Moon, Plane, Calculator, MessageCircle, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useReleaseMode } from "@/lib/release-mode";

const ENGAGEMENT_KEY = "diabeater_feature_engagement";
const DISMISSED_PROMPTS_KEY = "diabeater_dismissed_prompts";
const MIN_ENGAGEMENTS_BEFORE_SUGGESTING = 3;

interface FeaturePrompt {
  id: string;
  feature: string;
  icon: typeof Package;
  title: string;
  message: string;
  cta: string;
  link: string;
  iconColor: string;
  iconBg: string;
  requiresEngagement?: string[];
  beta?: boolean;
}

const PROMPTS: FeaturePrompt[] = [
  {
    id: "discover-supplies",
    feature: "supplies",
    icon: Package,
    title: "Track your supplies",
    message: "The Supply Tracker can predict when you'll run low and remind you to reorder before it's too late.",
    cta: "Try Supply Tracker",
    link: "/supplies",
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  {
    id: "discover-meals",
    feature: "adviser-meal",
    icon: Utensils,
    title: "Get meal dose suggestions",
    message: "The Meal Planner uses your ratios to suggest insulin doses — try it with your next meal.",
    cta: "Try Meal Planner",
    link: "/adviser?tab=meal",
    iconColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-500/10",
    requiresEngagement: ["supplies"],
  },
  {
    id: "discover-exercise",
    feature: "adviser-exercise",
    icon: Dumbbell,
    title: "Plan around exercise",
    message: "The Exercise Planner suggests carb and insulin adjustments so activity doesn't throw your levels off.",
    cta: "Try Exercise Planner",
    link: "/adviser?tab=exercise",
    iconColor: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-500/10",
    requiresEngagement: ["adviser-meal"],
  },
  {
    id: "discover-bedtime",
    feature: "scenarios-bedtime",
    icon: Moon,
    title: "Sleep more confidently",
    message: "The Bedtime Readiness Check takes 30 seconds and helps you feel more confident going to sleep.",
    cta: "Try Bedtime Check",
    link: "/scenarios",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-500/10",
    requiresEngagement: ["supplies", "adviser-meal"],
  },
  {
    id: "discover-ratios",
    feature: "ratios",
    icon: Calculator,
    title: "Review your ratios",
    message: "Not sure about your insulin-to-carb ratios? The Ratio Adviser can help you figure them out.",
    cta: "Check Ratios",
    link: "/ratios",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/10",
    requiresEngagement: ["adviser-meal"],
  },
  {
    id: "discover-coach",
    feature: "ai-coach",
    icon: MessageCircle,
    title: "Chat with your AI Coach",
    message: "Have a question about diabetes management? The AI Coach can give you personalised, safety-first guidance.",
    cta: "Open AI Coach",
    link: "/",
    iconColor: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-500/10",
    requiresEngagement: ["supplies", "adviser-meal"],
    beta: true,
  },
  {
    id: "discover-appointments",
    feature: "appointments",
    icon: Calendar,
    title: "Track your appointments",
    message: "Keep all your diabetes-related appointments in one place — clinic visits, blood tests, and reviews.",
    cta: "Add Appointment",
    link: "/appointments",
    iconColor: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-500/10",
    requiresEngagement: ["supplies"],
  },
];

function getEngagement(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(ENGAGEMENT_KEY) || "{}");
  } catch {
    return {};
  }
}

function getDismissedPrompts(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_PROMPTS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function trackFeatureEngagement(feature: string) {
  const engagement = getEngagement();
  engagement[feature] = (engagement[feature] || 0) + 1;
  localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(engagement));
}

export function DiscoveryPrompt() {
  const [currentPrompt, setCurrentPrompt] = useState<FeaturePrompt | null>(null);
  const { isBetaVisible } = useReleaseMode();

  const findNextPrompt = useCallback(() => {
    const engagement = getEngagement();
    const dismissed = getDismissedPrompts();

    const totalEngagements = Object.values(engagement).reduce((sum, count) => sum + count, 0);
    if (totalEngagements < MIN_ENGAGEMENTS_BEFORE_SUGGESTING) return null;

    for (const prompt of PROMPTS) {
      if (dismissed.includes(prompt.id)) continue;
      if (prompt.beta && !isBetaVisible) continue;

      if ((engagement[prompt.feature] || 0) > 0) continue;

      if (prompt.requiresEngagement) {
        const hasRequired = prompt.requiresEngagement.some(
          (feat) => (engagement[feat] || 0) >= 2
        );
        if (!hasRequired) continue;
      }

      return prompt;
    }
    return null;
  }, [isBetaVisible]);

  useEffect(() => {
    setCurrentPrompt(findNextPrompt());
  }, [findNextPrompt]);

  if (!currentPrompt) return null;

  const Icon = currentPrompt.icon;

  const handleDismiss = () => {
    const dismissed = getDismissedPrompts();
    dismissed.push(currentPrompt.id);
    localStorage.setItem(DISMISSED_PROMPTS_KEY, JSON.stringify(dismissed));
    setCurrentPrompt(null);
  };

  return (
    <Card data-testid="widget-discovery-prompt">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${currentPrompt.iconBg} shrink-0`}>
            <Icon className={`h-4 w-4 ${currentPrompt.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Have you tried?</p>
                <h3 className="font-semibold text-sm">{currentPrompt.title}</h3>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 -mt-1 -mr-1"
                onClick={handleDismiss}
                data-testid="button-dismiss-discovery"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{currentPrompt.message}</p>
            <Link href={currentPrompt.link}>
              <Button size="sm" variant="outline" data-testid="button-discovery-cta">
                {currentPrompt.cta}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
