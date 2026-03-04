import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { storage, UserSettings, UserProfile, EmergencyContact } from "@/lib/storage";

interface SettingsItem {
  key: string;
  label: string;
  complete: boolean;
}

export function SettingsCompletionWidget({ compact = false }: { compact?: boolean }) {
  const [settings, setSettings] = useState<UserSettings>({});
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  useEffect(() => {
    setSettings(storage.getSettings());
    setProfile(storage.getProfile());
    setContacts(storage.getEmergencyContacts());
  }, []);

  const settingsItems: SettingsItem[] = [
    { key: "tdd", label: "Total Daily Dose", complete: !!settings.tdd },
    { key: "carbRatio", label: "Carb Ratios", complete: !!(settings.breakfastRatio || settings.lunchRatio) },
    { key: "correctionFactor", label: "Correction Factor", complete: !!settings.correctionFactor },
    { key: "targetRange", label: "Target BG Range", complete: !!(settings.targetBgLow && settings.targetBgHigh) },
  ];

  const hasEmergencyContact = contacts.length > 0;

  const completedCount = settingsItems.filter(item => item.complete).length;
  const totalCount = settingsItems.length;
  const completionPercentage = Math.round((completedCount / totalCount) * 100);
  const isComplete = completedCount === totalCount;

  if (isComplete) {
    return null;
  }

  return (
    <Card className={`border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 ${compact ? "flex flex-col overflow-hidden" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Link href="/settings">
            <div className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">Complete Your Settings</CardTitle>
            </div>
          </Link>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {completedCount}/{totalCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Setup progress</span>
            <span className="font-medium">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {!compact && (
          <div className="space-y-2">
            {settingsItems.map((item) => (
              <div 
                key={item.key} 
                className="flex items-center gap-2 text-sm"
              >
                {item.complete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-amber-400" />
                )}
                <span className={item.complete ? "text-muted-foreground" : "font-medium"}>
                  {item.label}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm">
              {hasEmergencyContact ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
              )}
              <span className="text-muted-foreground">
                Emergency Contact <span className="text-xs">(optional)</span>
              </span>
            </div>
          </div>
        )}

        <div className={compact ? "" : "pt-2"}>
          {!compact && (
            <p className="text-sm text-muted-foreground mb-3">
              Complete your settings to unlock accurate recommendations and supply tracking.
            </p>
          )}
          <Link href="/settings">
            <Button size="sm" className="w-full" data-testid="button-complete-settings">
              {compact ? "Complete" : "Complete Settings"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
