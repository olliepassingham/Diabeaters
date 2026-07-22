import { useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { storage, DIABEATER_SETTINGS_CHANGED_EVENT, UserSettings, UserProfile } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { pumpSetupCompletion } from "@/lib/pump-supplies";
import { hasConfiguredTdd } from "@/lib/tdd";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";

interface SettingsItem {
  key: string;
  label: string;
  complete: boolean;
}

export function SettingsCompletionWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const { data: emergency } = useEmergencyProfile();

  const load = () => {
    try {
      setSettings(storage.getSettings?.() ?? {});
      setProfile(storage.getProfile?.() ?? null);
      setError(null);
    } catch {
      setError("Could not load settings status.");
      setSettings({});
      setProfile(null);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, load);
    return () => window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, load);
  }, []);

  if (error) {
    return (
      <WidgetCard
        variant="glass-muted"
        className="ring-1 ring-amber-200/80 dark:ring-amber-800/60"
        data-testid="widget-settings-completion"
      >
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Settings progress</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:px-6 md:pb-6">
          <p className="text-base text-gray-700 dark:text-muted-foreground">{error}</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (settings === null || profile === undefined) {
    return (
      <WidgetCard variant="glass-muted" data-testid="widget-settings-completion">
        <CardContent className="p-4 md:p-6">
          <p className="text-base text-gray-700 dark:text-muted-foreground">Loading…</p>
        </CardContent>
      </WidgetCard>
    );
  }

  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);
  const pumpSetup = pumpSetupCompletion(profile, storage.getSupplies());

  const settingsItems: SettingsItem[] = [
    { key: "tdd", label: "Total daily dose", complete: hasConfiguredTdd(settings) },
    { key: "carbRatio", label: "Carb ratios", complete: !!(settings.breakfastRatio || settings.lunchRatio) },
    { key: "correctionFactor", label: "Correction factor", complete: !!settings.correctionFactor },
    { key: "targetRange", label: "Target BG range", complete: !!(settings.targetBgLow && settings.targetBgHigh) },
    ...(isPumpUser
      ? [
          { key: "pumpIntervals", label: "Site & reservoir intervals", complete: pumpSetup.siteInterval && pumpSetup.reservoirCapacity },
          { key: "pumpSupplies", label: "Infusion sets & reservoirs tracked", complete: pumpSetup.tracksSets && pumpSetup.tracksReservoirs },
          { key: "pumpBackup", label: "Backup pens for pump failure", complete: pumpSetup.tracksBackup },
        ]
      : []),
  ];

  const hasEmergencyContact = Boolean(emergency.contactName?.trim() && emergency.phone?.trim());
  const completedCount = settingsItems.filter((item) => item.complete).length;
  const totalCount = settingsItems.length;
  const completionPercentage = Math.round((completedCount / totalCount) * 100);
  const isComplete = completedCount === totalCount;

  if (isComplete) {
    return null;
  }

  return (
    <WidgetCard
      variant="glass-muted"
      className="ring-1 ring-amber-200/70 bg-amber-50/40 dark:ring-amber-800/60 dark:bg-amber-950/20"
      data-testid="widget-settings-completion"
    >
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/settings">
            <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer min-w-0">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <CardTitle className="text-h3 text-foreground">Complete your settings</CardTitle>
            </div>
          </Link>
          <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            {completedCount}/{totalCount}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 uppercase tracking-wide mt-1">Profile & safety</p>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 md:px-6 md:pb-6">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500 uppercase tracking-wide">Setup progress</span>
            <span className="font-semibold text-gray-900 dark:text-foreground">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {!compact && (
          <div className="space-y-2">
            {settingsItems.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-base text-gray-700">
                {item.complete ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-amber-400 dark:border-amber-600 shrink-0" />
                )}
                <span className={item.complete ? "text-gray-500" : "font-medium text-gray-900 dark:text-foreground"}>{item.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-base text-gray-700">
              {hasEmergencyContact ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-gray-300 shrink-0" />
              )}
              <span className="text-gray-500">
                Emergency details <span className="text-sm normal-case">(optional)</span>
              </span>
            </div>
          </div>
        )}

        <div className={compact ? "" : "pt-1"}>
          {!compact && (
            <p className="text-base text-gray-700 dark:text-muted-foreground mb-3">
              Complete your settings to unlock accurate recommendations and supply tracking.
            </p>
          )}
          <Link href="/settings">
            <Button size="sm" className="w-full" data-testid="button-complete-settings">
              {compact ? "Complete" : "Complete settings"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </WidgetCard>
  );
}
