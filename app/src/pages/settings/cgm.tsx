import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { Activity, CheckCircle2, CircleOff, Smartphone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { useToast } from "@/hooks/use-toast";
import { healthPlatformCgmAdapter } from "@/lib/cgm/adapters/health-platform";
import {
  DEFAULT_CGM_PREFERENCES,
  readCgmPreferences,
  writeCgmPreferences,
  type CgmPreferences,
} from "@/lib/cgm/preferences";
import { connectHealthPlatformCgm } from "@/lib/cgm/registry";
import { isCapacitorNativeShell } from "@/lib/native-platform";
import { cn } from "@/lib/utils";
import {
  SettingsGroup,
  SettingsGroupLabel,
  SettingsPanel,
  SettingsPanelBody,
  SettingsSubPageShell,
} from "./shared";
import { SettingsCgmInfoDialog } from "./settings-page-info";

type StatusTone = "muted" | "amber" | "green";

function CgmToggleRow({
  id,
  label,
  info,
  checked,
  onCheckedChange,
  disabled,
  testId,
}: {
  id: string;
  label: string;
  info: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3.5 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-0.5">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium text-foreground">
          {label}
        </Label>
        <InlineInfoHint ariaLabel={`About ${label}`} content={info} />
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        data-testid={testId}
        className="shrink-0"
      />
    </div>
  );
}

function getCgmStatus({
  isNative,
  prefs,
  healthAvailable,
  healthReason,
}: {
  isNative: boolean;
  prefs: CgmPreferences;
  healthAvailable: boolean | null;
  healthReason: string | null;
}): { label: string; detail: string; tone: StatusTone } {
  if (!isNative) {
    return {
      label: "Phone app required",
      detail: "Open Diabeaters on iPhone or Android to connect.",
      tone: "muted",
    };
  }
  if (!prefs.prefillEnabled) {
    return {
      label: "Off",
      detail: "Turn on below to offer recent BG in tools.",
      tone: "muted",
    };
  }
  if (!prefs.healthPlatformEnabled) {
    return {
      label: "Almost ready",
      detail: "Enable your health app source, then connect.",
      tone: "amber",
    };
  }
  if (healthAvailable === false) {
    return {
      label: "Unavailable",
      detail: healthReason ?? "Health access is not available on this device.",
      tone: "amber",
    };
  }
  return {
    label: "Ready",
    detail: "Driving and exercise can suggest a recent reading.",
    tone: "green",
  };
}

const STATUS_BADGE_CLASS: Record<StatusTone, string> = {
  muted: "border-border/60 bg-muted/40 text-muted-foreground",
  amber: "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200",
  green: "border-green-300/60 bg-green-50 text-green-800 dark:border-green-700/50 dark:bg-green-950/40 dark:text-green-200",
};

export function SettingsCgmRoute() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<CgmPreferences>(() => readCgmPreferences());
  const [healthAvailable, setHealthAvailable] = useState<boolean | null>(null);
  const [healthReason, setHealthReason] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const isNative = isCapacitorNativeShell();
  const healthLabel = healthPlatformCgmAdapter.label;

  const refreshAvailability = useCallback(async () => {
    const status = await healthPlatformCgmAdapter.isAvailable();
    setHealthAvailable(status.available);
    setHealthReason(status.reason ?? null);
  }, []);

  useEffect(() => {
    void refreshAvailability();
  }, [refreshAvailability]);

  const status = useMemo(
    () => getCgmStatus({ isNative, prefs, healthAvailable, healthReason }),
    [isNative, prefs, healthAvailable, healthReason],
  );

  function updatePrefs(next: CgmPreferences) {
    setPrefs(next);
    writeCgmPreferences(next);
  }

  async function handleConnectHealth() {
    setConnecting(true);
    try {
      const res = await connectHealthPlatformCgm();
      if (!res.ok) {
        toast({ title: "Could not connect", description: res.error, variant: "destructive" });
        return;
      }
      setPrefs(readCgmPreferences());
      toast({ title: "Connected", description: `${healthLabel} can now prefill blood glucose.` });
      void refreshAvailability();
    } finally {
      setConnecting(false);
    }
  }

  const StatusIcon =
    status.tone === "green" ? CheckCircle2 : status.tone === "amber" ? Sparkles : isNative ? Activity : Smartphone;

  return (
    <SettingsSubPageShell
      title="CGM prefill"
      description="Recent BG from your health app."
      actions={<SettingsCgmInfoDialog />}
    >
      <SettingsPanel>
        <SettingsPanelBody className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Activity className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Status</p>
              <Badge variant="outline" className={cn("rounded-full px-2 py-0 text-[11px] font-medium", STATUS_BADGE_CLASS[status.tone])}>
                {status.label}
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{status.detail}</p>
          </div>
          <StatusIcon
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0",
              status.tone === "green" && "text-green-600 dark:text-green-400",
              status.tone === "amber" && "text-amber-600 dark:text-amber-400",
              status.tone === "muted" && "text-muted-foreground/70",
            )}
            aria-hidden
          />
        </SettingsPanelBody>
      </SettingsPanel>

      {!isNative ? (
        <SettingsPanel>
          <SettingsPanelBody className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
              <Smartphone className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">Use the Diabeaters mobile app to connect Apple Health or Health Connect.</p>
          </SettingsPanelBody>
        </SettingsPanel>
      ) : null}

      <div>
        <SettingsGroupLabel>Options</SettingsGroupLabel>
        <SettingsGroup>
          <CgmToggleRow
            id="cgm-prefill-enabled"
            label="Suggest in tools"
            info={<p>Driving, exercise, and other BG fields can offer a recent reading you can tap to apply.</p>}
            checked={prefs.prefillEnabled}
            onCheckedChange={(checked) => updatePrefs({ ...prefs, prefillEnabled: checked })}
            testId="switch-cgm-prefill"
          />
          <CgmToggleRow
            id="cgm-health-enabled"
            label={healthLabel}
            info={
              <p>
                Read blood glucose samples your CGM app already shares with {healthLabel}. Enable sharing in your Dexcom
                or Libre app first.
              </p>
            }
            checked={prefs.healthPlatformEnabled}
            disabled={!prefs.prefillEnabled}
            onCheckedChange={(checked) => updatePrefs({ ...prefs, healthPlatformEnabled: checked })}
            testId="switch-cgm-health"
          />
        </SettingsGroup>
      </div>

      {isNative ? (
        <div>
          <SettingsGroupLabel>Connect</SettingsGroupLabel>
          <SettingsPanel>
            <SettingsPanelBody className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{healthLabel}</p>
                <InlineInfoHint
                  ariaLabel={`How to connect ${healthLabel}`}
                  content={
                    <p>
                      {Capacitor.getPlatform() === "android"
                        ? "In your Libre or Dexcom app, enable Health Connect sharing if available. Install Health Connect from the Play Store if prompted."
                        : "In your Dexcom or Libre app, enable sharing blood glucose to Apple Health. Then return here and tap Connect."}
                    </p>
                  }
                />
              </div>
              {healthAvailable === false && healthReason ? (
                <p className="rounded-lg border border-amber-300/50 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
                  {healthReason}
                </p>
              ) : null}
              <Button
                type="button"
                className="h-10 w-full gap-2 rounded-xl"
                disabled={connecting || !prefs.prefillEnabled}
                onClick={() => void handleConnectHealth()}
                data-testid="button-cgm-connect-health"
              >
                <Activity className="h-4 w-4" aria-hidden />
                {connecting ? "Connecting…" : `Connect ${healthLabel}`}
              </Button>
            </SettingsPanelBody>
          </SettingsPanel>
        </div>
      ) : null}

      <p className="px-0.5 text-center text-[11px] leading-relaxed text-muted-foreground">
        Not a medical device — confirm on your CGM or meter before treating.
      </p>

      <div className="flex justify-center pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => updatePrefs({ ...DEFAULT_CGM_PREFERENCES })}
        >
          <CircleOff className="h-3.5 w-3.5" aria-hidden />
          Reset settings
        </Button>
      </div>
    </SettingsSubPageShell>
  );
}
