import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Settings, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { storage, UserSettings, UserProfile, EmergencyContact } from "@/lib/storage";

interface SettingsItem {
  key: string;
  label: string;
  complete: boolean;
}

export function SettingsCompletionWidget() {
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
    { key: "emergencyContact", label: "Emergency Contact", complete: contacts.length > 0 },
  ];

  const completedCount = settingsItems.filter(item => item.complete).length;
  const totalCount = settingsItems.length;
  const completionPercentage = Math.round((completedCount / totalCount) * 100);
  const isComplete = completedCount === totalCount;

  if (isComplete) {
    return (
      <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">Settings Complete</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              All set
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your settings are configured. All features are ready to use.
          </p>
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="mt-2 -ml-2" data-testid="link-settings-complete">
              <Settings className="h-4 w-4 mr-2" />
              Review Settings
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">Complete Your Settings</CardTitle>
          </div>
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
        </div>

        <div className="pt-2">
          <p className="text-sm text-muted-foreground mb-3">
            Complete your settings to unlock accurate recommendations and supply tracking.
          </p>
          <Link href="/settings">
            <Button size="sm" className="w-full" data-testid="button-complete-settings">
              Complete Settings
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
