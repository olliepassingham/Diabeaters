import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Activity, CheckCircle2, CircleOff, Droplet, HeartPulse, Radio as RadioIcon, Smartphone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { useToast } from "@/hooks/use-toast";
import { healthPlatformCgmAdapter } from "@/lib/cgm/adapters/health-platform";
import {
  DEFAULT_CGM_PREFERENCES,
  hasDexcomShareCredentials,
  hasLibreLinkUpCredentials,
  hasLiveCgmCredentials,
  readCgmPreferences,
  writeCgmPreferences,
  type CgmPreferences,
  type DexcomShareServer,
  type LibreLinkUpRegion,
} from "@/lib/cgm/preferences";
import {
  connectDexcomShareCgm,
  connectHealthPlatformCgm,
  connectLibreLinkUpCgm,
  disconnectDexcomShareCgm,
  disconnectLibreLinkUpCgm,
  getHealthPlatformAccessStatus,
} from "@/lib/cgm/registry";
import { probeHealthNativeBridge, type HealthNativeProbe } from "@/lib/cgm/health-native-probe";
import { getDevicePlatform, healthPlatformLabel, isAndroidDevice, isCapacitorNativeShell, isIosDevice } from "@/lib/native-platform";
import { cn } from "@/lib/utils";
import {
  SettingsGroup,
  SettingsGroupLabel,
  SettingsPanel,
  SettingsPanelBody,
  SettingsSubPageShell,
} from "./shared";
import { SettingsCgmInfoDialog } from "./settings-page-info";
import {
  DexcomLoginAssist,
  formatDexcomStoredLoginLabel,
  normalizeDexcomUsernameInput,
  shouldEmphasizeDexcomAccountIdAssist,
} from "@/components/cgm-dexcom-login-assist";
import { isDexcomAccountId } from "@/lib/cgm/dexcom-share-client";

type StatusTone = "muted" | "amber" | "green";

type CgmSourceChoice = "dexcom" | "libre" | "health";

function selectedCgmSourceChoice(prefs: CgmPreferences): CgmSourceChoice | undefined {
  if (prefs.dexcomShareEnabled) return "dexcom";
  if (prefs.libreLinkUpEnabled) return "libre";
  if (prefs.healthPlatformEnabled) return "health";
  return undefined;
}

function CgmSourceChoiceCard({
  value,
  selected,
  icon: Icon,
  title,
  description,
  testId,
}: {
  value: CgmSourceChoice;
  selected: boolean;
  icon: typeof Activity;
  title: string;
  description: ReactNode;
  testId: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors outline-none focus-within:ring-2 focus-within:ring-primary/30",
        selected
          ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
          : "border-border/50 bg-muted/10 hover:border-primary/35",
      )}
    >
      <RadioGroupItem value={value} id={`cgm-choice-${value}`} className="mt-1 shrink-0" data-testid={testId} />
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
          selected ? "bg-primary/15 text-primary ring-primary/25" : "bg-muted/60 text-muted-foreground ring-border/40",
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5 pt-0.5">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

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
  accessGranted,
  nativeProbe,
  healthLabel,
}: {
  isNative: boolean;
  prefs: CgmPreferences;
  healthAvailable: boolean | null;
  healthReason: string | null;
  accessGranted: boolean | null;
  nativeProbe: HealthNativeProbe | null;
  healthLabel: string;
}): { label: string; detail: string; tone: StatusTone } {
  if (!isNative) {
    return {
      label: "Phone app required",
      detail: "Open Diabeaters on iPhone or Android to connect.",
      tone: "muted",
    };
  }
  if (nativeProbe?.status === "plugin_missing" && !hasLiveCgmCredentials(prefs)) {
    return {
      label: "App update required",
      detail: isAndroidDevice()
        ? "Install the latest Diabeaters Android build with Health Connect support."
        : "Install the latest Diabeaters iPhone build with Apple Health support.",
      tone: "amber",
    };
  }
  if (!prefs.prefillEnabled) {
    return {
      label: "Off",
      detail: "Turn on below to offer recent BG in tools.",
      tone: "muted",
    };
  }
  if (hasDexcomShareCredentials(prefs)) {
    return {
      label: "Connected",
      detail: "Dexcom Share can prefill near-live readings in Driving and exercise.",
      tone: "green",
    };
  }
  if (hasLibreLinkUpCredentials(prefs)) {
    return {
      label: "Connected",
      detail: "LibreLink Up can prefill near-live readings in Driving and exercise.",
      tone: "green",
    };
  }
  if (accessGranted === true) {
    return {
      label: "Connected",
      detail: `${healthLabel} can suggest a recent reading (may be delayed vs your CGM app).`,
      tone: "green",
    };
  }
  if (healthAvailable === false && !prefs.dexcomShareEnabled) {
    return {
      label: "Unavailable",
      detail: healthReason ?? "Health access is not available on this device.",
      tone: "amber",
    };
  }
  if (!prefs.healthPlatformEnabled && !prefs.dexcomShareEnabled && !prefs.libreLinkUpEnabled) {
    return {
      label: "Almost ready",
      detail: `Enable Dexcom Share, LibreLink Up, or ${healthLabel} below, then connect.`,
      tone: "amber",
    };
  }
  if (prefs.libreLinkUpEnabled && !hasLibreLinkUpCredentials(prefs)) {
    return {
      label: "Needs setup",
      detail: "Enter your LibreLink Up login and tap Connect LibreLink Up.",
      tone: "amber",
    };
  }
  if (prefs.dexcomShareEnabled) {
    return {
      label: "Needs setup",
      detail: "Paste your Dexcom account ID (or try email), then tap Connect Dexcom Share.",
      tone: "amber",
    };
  }
  return {
    label: "Needs permission",
    detail: "Tap Connect and allow blood glucose read access.",
    tone: "amber",
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
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);
  const [nativeProbe, setNativeProbe] = useState<HealthNativeProbe | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [dexcomConnecting, setDexcomConnecting] = useState(false);
  const [dexcomError, setDexcomError] = useState<string | null>(null);
  const [dexcomUsername, setDexcomUsername] = useState(() => readCgmPreferences().dexcomShareUsername ?? "");
  const [dexcomPassword, setDexcomPassword] = useState(() => readCgmPreferences().dexcomSharePassword ?? "");
  const [dexcomServer, setDexcomServer] = useState<DexcomShareServer>(
    () => readCgmPreferences().dexcomShareServer ?? "eu",
  );
  const [nativeBuildLabel, setNativeBuildLabel] = useState<string | null>(null);
  const healthAuthAvailable = isIosDevice() && Capacitor.isPluginAvailable("HealthAuthorization");
  const devicePlatform = getDevicePlatform();

  const isNative = isCapacitorNativeShell();
  const healthLabel = useMemo(() => healthPlatformLabel(), [devicePlatform]);
  const needsAppUpdate = nativeProbe?.status === "plugin_missing";
  const dexcomConnected = hasDexcomShareCredentials(prefs);
  const libreConnected = hasLibreLinkUpCredentials(prefs);
  const [libreConnecting, setLibreConnecting] = useState(false);
  const [libreError, setLibreError] = useState<string | null>(null);
  const [libreEmail, setLibreEmail] = useState(() => readCgmPreferences().libreLinkUpEmail ?? "");
  const [librePassword, setLibrePassword] = useState(() => readCgmPreferences().libreLinkUpPassword ?? "");
  const [libreRegion, setLibreRegion] = useState<LibreLinkUpRegion>(
    () => readCgmPreferences().libreLinkUpRegion ?? "eu",
  );
  const [dexcomAssistEmphasize, setDexcomAssistEmphasize] = useState(false);

  useEffect(() => {
    if (!isCapacitorNativeShell()) return;
    void CapacitorApp.getInfo()
      .then((info) => {
        const version = info.version?.trim() || "?";
        const build = info.build?.trim();
        setNativeBuildLabel(build ? `${version} (${build})` : version);
      })
      .catch(() => undefined);
  }, []);

  const runDiagnostics = useCallback(async () => {
    if (!isCapacitorNativeShell()) {
      setNativeProbe({
        status: "plugin_missing",
        message: "CGM prefill requires the Diabeaters iPhone or Android app.",
      });
      setHealthAvailable(false);
      setAccessGranted(false);
      return;
    }

    if (isIosDevice()) {
      if (!Capacitor.isPluginAvailable("HealthAuthorization")) {
        setNativeProbe({
          status: "plugin_missing",
          message: "Health permission bridge missing. Install TestFlight 1.0.13+.",
        });
        setHealthAvailable(false);
        setHealthReason("Install the newest TestFlight build (1.0.13+).");
        setAccessGranted(false);
        return;
      }
      try {
        const { HealthAuthorization } = await import("@/lib/cgm/health-authorization-native");
        const probe = await HealthAuthorization.probe();
        if (!probe.available) {
          setNativeProbe({ status: "health_unavailable", reason: "Apple Health is not available on this device." });
          setHealthAvailable(false);
          setHealthReason("Apple Health is not available on this device.");
          setAccessGranted(false);
          return;
        }
        setNativeProbe({ status: "ready", pluginVersion: "HealthAuthorization" });
        setHealthAvailable(true);
        setHealthReason(null);
        const access = await getHealthPlatformAccessStatus();
        setAccessGranted(access.granted);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Health bridge failed.";
        setNativeProbe({ status: "plugin_missing", message });
        setHealthAvailable(false);
        setHealthReason(message);
        setAccessGranted(false);
      }
      return;
    }

    const probe = await probeHealthNativeBridge();
    setNativeProbe(probe);

    if (probe.status === "plugin_missing") {
      setHealthAvailable(false);
      setHealthReason(probe.message);
      setAccessGranted(false);
      return;
    }

    if (probe.status === "health_unavailable") {
      setHealthAvailable(false);
      setHealthReason(probe.reason ?? null);
      setAccessGranted(false);
      return;
    }

    setHealthAvailable(true);
    setHealthReason(null);
    const access = await getHealthPlatformAccessStatus();
    setAccessGranted(access.granted);
  }, []);

  useEffect(() => {
    void runDiagnostics();
  }, [runDiagnostics]);

  const status = useMemo(
    () => getCgmStatus({ isNative, prefs, healthAvailable, healthReason, accessGranted, nativeProbe, healthLabel }),
    [isNative, prefs, healthAvailable, healthReason, accessGranted, nativeProbe, healthLabel],
  );

  function updatePrefs(next: CgmPreferences) {
    setPrefs(next);
    writeCgmPreferences(next);
  }

  async function handleConnectHealth() {
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await connectHealthPlatformCgm();
      await runDiagnostics();
      if (!res.ok) {
        const message = res.error ?? "Permission was not granted.";
        setConnectError(message);
        toast({ title: "Could not connect", description: message, variant: "destructive" });
        return;
      }
      setConnectError(null);
      setPrefs(readCgmPreferences());
      toast({ title: "Connected", description: `${healthLabel} can now prefill blood glucose.` });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Permission request failed.";
      setConnectError(message);
      toast({ title: "Could not connect", description: message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  }

  async function handleConnectDexcom() {
    setDexcomConnecting(true);
    setDexcomError(null);
    try {
      const res = await connectDexcomShareCgm({
        username: dexcomUsername,
        password: dexcomPassword,
        server: dexcomServer,
      });
      if (!res.ok) {
        const message = res.error ?? "Could not connect to Dexcom Share.";
        setDexcomError(message);
        if (shouldEmphasizeDexcomAccountIdAssist(message) && !isDexcomAccountId(dexcomUsername)) {
          setDexcomAssistEmphasize(true);
        }
        toast({ title: "Dexcom Share failed", description: message, variant: "destructive" });
        return;
      }
      setDexcomError(null);
      setDexcomAssistEmphasize(false);
      const next = readCgmPreferences();
      setPrefs(next);
      setDexcomUsername(next.dexcomShareUsername ?? "");
      setDexcomPassword(next.dexcomSharePassword ?? "");
      toast({
        title: "Dexcom Share connected",
        description: res.sampleMgDl
          ? `Latest reading about ${res.sampleMgDl} mg/dL. Driving and exercise can prefill now.`
          : "Driving and exercise can prefill near-live readings.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Dexcom Share connection failed.";
      setDexcomError(message);
      if (shouldEmphasizeDexcomAccountIdAssist(message) && !isDexcomAccountId(dexcomUsername)) {
        setDexcomAssistEmphasize(true);
      }
      toast({ title: "Dexcom Share failed", description: message, variant: "destructive" });
    } finally {
      setDexcomConnecting(false);
    }
  }

  async function handleDisconnectDexcom() {
    await disconnectDexcomShareCgm();
    setDexcomPassword("");
    setDexcomError(null);
    setDexcomAssistEmphasize(false);
    setPrefs(readCgmPreferences());
    toast({ title: "Dexcom Share disconnected" });
  }

  async function handleConnectLibre() {
    setLibreConnecting(true);
    setLibreError(null);
    try {
      const res = await connectLibreLinkUpCgm({
        email: libreEmail,
        password: librePassword,
        region: libreRegion,
      });
      if (!res.ok) {
        const message = res.error ?? "Could not connect to LibreLink Up.";
        setLibreError(message);
        toast({ title: "LibreLink Up failed", description: message, variant: "destructive" });
        return;
      }
      setLibreError(null);
      const next = readCgmPreferences();
      setPrefs(next);
      setLibreEmail(next.libreLinkUpEmail ?? "");
      setLibrePassword(next.libreLinkUpPassword ?? "");
      toast({
        title: "LibreLink Up connected",
        description: res.sampleMgDl
          ? `Latest reading about ${res.sampleMgDl} mg/dL. Driving and exercise can prefill now.`
          : "Driving and exercise can prefill near-live readings.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "LibreLink Up connection failed.";
      setLibreError(message);
      toast({ title: "LibreLink Up failed", description: message, variant: "destructive" });
    } finally {
      setLibreConnecting(false);
    }
  }

  async function handleDisconnectLibre() {
    await disconnectLibreLinkUpCgm();
    setLibrePassword("");
    setLibreError(null);
    setPrefs(readCgmPreferences());
    toast({ title: "LibreLink Up disconnected" });
  }

  const connectButtonLabel = accessGranted
    ? `Connected to ${healthLabel}`
    : connecting
      ? "Waiting for permission…"
      : `Connect ${healthLabel}`;

  const dexcomButtonLabel = dexcomConnected
    ? "Connected to Dexcom Share"
    : dexcomConnecting
      ? "Connecting to Dexcom…"
      : "Connect Dexcom Share";

  const libreButtonLabel = libreConnected
    ? "Connected to LibreLink Up"
    : libreConnecting
      ? "Connecting to LibreLink Up…"
      : "Connect LibreLink Up";

  const StatusIcon =
    status.tone === "green" ? CheckCircle2 : status.tone === "amber" ? Sparkles : isNative ? Activity : Smartphone;

  return (
    <SettingsSubPageShell
      title="CGM prefill"
      description="Near-live Dexcom Share or LibreLink Up, or delayed Apple Health / Health Connect."
      actions={<SettingsCgmInfoDialog />}
    >
      <SettingsPanel className="bg-gradient-to-b from-muted/30 to-muted/5 dark:from-muted/15 dark:to-muted/5">
        <SettingsPanelBody className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-inner dark:bg-primary/20">
            <Activity className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Status</p>
              <Badge variant="outline" className={cn("rounded-full px-2 py-0 text-[11px] font-medium", STATUS_BADGE_CLASS[status.tone])}>
                {status.label}
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{status.detail}</p>
            {isNative ? (
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground" data-testid="text-cgm-build-diag">
                Build {nativeBuildLabel ?? "…"} on{" "}
                {devicePlatform === "android" ? "Android" : devicePlatform === "ios" ? "iPhone" : "web"}.
                {isIosDevice() ? (
                  <>
                    {" "}
                    Health bridge: {healthAuthAvailable ? "ready" : "missing — install newest TestFlight build"}.
                  </>
                ) : isAndroidDevice() ? (
                  <> Health Connect via Capacitor plugin.</>
                ) : null}
              </p>
            ) : null}
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

      {needsAppUpdate && !dexcomConnected && !libreConnected ? (
        <SettingsPanel>
          <SettingsPanelBody className="space-y-2">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Update the Diabeaters app</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {nativeProbe?.status === "plugin_missing"
                ? nativeProbe.message
                : "Apple Health support is not in this app build."}{" "}
              You can still use Dexcom Share or LibreLink Up below for near-live readings.
            </p>
          </SettingsPanelBody>
        </SettingsPanel>
      ) : null}

      {!isNative ? (
        <SettingsPanel>
          <SettingsPanelBody className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
              <Smartphone className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              Use the Diabeaters mobile app to connect Dexcom Share, LibreLink Up, or{" "}
              {isAndroidDevice() ? "Health Connect" : isIosDevice() ? "Apple Health" : "Apple Health / Health Connect"}.
            </p>
          </SettingsPanelBody>
        </SettingsPanel>
      ) : null}

      {isNative && prefs.prefillEnabled ? (
        <SettingsPanel>
          <SettingsPanelBody className="space-y-3" data-testid="panel-cgm-source-guide">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Which CGM do you use?</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Pick one to open the right setup below. You can change this later.
              </p>
            </div>
            <RadioGroup
              value={selectedCgmSourceChoice(prefs) ?? ""}
              onValueChange={(value) => {
                if (value === "dexcom") {
                  updatePrefs({ ...prefs, dexcomShareEnabled: true, libreLinkUpEnabled: false, healthPlatformEnabled: false });
                } else if (value === "libre") {
                  updatePrefs({ ...prefs, libreLinkUpEnabled: true, dexcomShareEnabled: false, healthPlatformEnabled: false });
                } else if (value === "health") {
                  updatePrefs({ ...prefs, healthPlatformEnabled: true, dexcomShareEnabled: false, libreLinkUpEnabled: false });
                }
              }}
              className="grid gap-2"
            >
              <CgmSourceChoiceCard
                value="dexcom"
                selected={selectedCgmSourceChoice(prefs) === "dexcom"}
                icon={RadioIcon}
                title="Dexcom"
                description="Near-live Share — best for charts, overnight review, and supporter live BG. Account ID usually works better than email."
                testId="button-cgm-choose-dexcom"
              />
              <CgmSourceChoiceCard
                value="libre"
                selected={selectedCgmSourceChoice(prefs) === "libre"}
                icon={Droplet}
                title="Libre"
                description="Near-live via LibreLink Up (follower / care-partner login — not the patient LibreLink app alone)."
                testId="button-cgm-choose-libre"
              />
              <CgmSourceChoiceCard
                value="health"
                selected={selectedCgmSourceChoice(prefs) === "health"}
                icon={HeartPulse}
                title={`Just ${healthLabel} for now`}
                description="Easiest — one OS permission, no Share login. Readings are often delayed; not ideal for live charts."
                testId="button-cgm-choose-health"
              />
            </RadioGroup>
            {(dexcomConnected || libreConnected || accessGranted) ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Already connected. If both Share/Libre and {healthLabel} are on, Diabeaters uses the freshest reading.
              </p>
            ) : null}
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
            id="cgm-dexcom-enabled"
            label="Dexcom Share"
            info={
              <p>
                Near-live readings via Dexcom&apos;s Share service. Use your Dexcom app login (not a Follower account).
                Share must be on in the Dexcom app. Credentials stay on this device except during an active exercise
                session with low-glucose alerts enabled — then they are sent encrypted to our server for background
                polling and deleted when the session ends.
              </p>
            }
            checked={Boolean(prefs.dexcomShareEnabled)}
            disabled={!prefs.prefillEnabled}
            onCheckedChange={(checked) => updatePrefs({ ...prefs, dexcomShareEnabled: checked })}
            testId="switch-cgm-dexcom"
          />
          <CgmToggleRow
            id="cgm-libre-enabled"
            label="LibreLink Up"
            info={
              <p>
                Near-live readings via LibreLink Up (care-partner / follower app). Use the login for the account that
                follows their sensor — not the LibreLink patient app unless linked. Credentials stay on this device only.
              </p>
            }
            checked={Boolean(prefs.libreLinkUpEnabled)}
            disabled={!prefs.prefillEnabled}
            onCheckedChange={(checked) => updatePrefs({ ...prefs, libreLinkUpEnabled: checked })}
            testId="switch-cgm-libre"
          />
          {isNative ? (
            <CgmToggleRow
              id="cgm-health-enabled"
              label={healthLabel}
              info={
                <p>
                  Optional fallback: read blood glucose your CGM app shares with {healthLabel}. Often delayed vs your CGM
                  app — no trend arrows, charts, or supporter live BG. Use Dexcom Share or LibreLink Up above for those.
                  Does not require storing extra credentials in Diabeaters.
                </p>
              }
              checked={prefs.healthPlatformEnabled}
              disabled={!prefs.prefillEnabled}
              onCheckedChange={(checked) => updatePrefs({ ...prefs, healthPlatformEnabled: checked })}
              testId="switch-cgm-health"
            />
          ) : null}
        </SettingsGroup>
      </div>

      {isNative && prefs.prefillEnabled && prefs.dexcomShareEnabled ? (
        <div>
          <SettingsGroupLabel>Dexcom Share</SettingsGroupLabel>
          <SettingsPanel>
            <SettingsPanelBody className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Use your <span className="font-medium text-foreground">Dexcom G7/G6 or Clarity</span> account — not
                Dexcom Follow. Share must be on in the Dexcom app. UK/EU: region Europe.
              </p>

              {!dexcomConnected ? (
                <DexcomLoginAssist
                  server={dexcomServer}
                  emphasize={dexcomAssistEmphasize}
                  onAccountIdPasted={(id) => {
                    setDexcomUsername(id);
                    setDexcomError(null);
                    setDexcomAssistEmphasize(false);
                  }}
                  onAssistError={(message) => setDexcomError(message)}
                />
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="dexcom-username" className="text-xs text-muted-foreground">
                  {dexcomConnected
                    ? "Linked account"
                    : isDexcomAccountId(dexcomUsername)
                      ? "Account ID"
                      : "Account ID, portal link, or email"}
                </Label>
                <Input
                  id="dexcom-username"
                  value={
                    dexcomConnected && isDexcomAccountId(dexcomUsername)
                      ? formatDexcomStoredLoginLabel(dexcomUsername)
                      : dexcomUsername
                  }
                  onChange={(e) => {
                    setDexcomUsername(normalizeDexcomUsernameInput(e.target.value));
                    setDexcomError(null);
                    setDexcomAssistEmphasize(false);
                  }}
                  autoComplete="username"
                  className="h-10"
                  disabled={dexcomConnected}
                  placeholder="Paste portal link or account ID"
                  data-testid="input-dexcom-username"
                />
                {dexcomConnected && isDexcomAccountId(dexcomUsername) ? (
                  <p className="text-[11px] text-muted-foreground">
                    Your Dexcom account ID is saved — you won&apos;t need to look it up again.
                  </p>
                ) : !dexcomConnected ? (
                  <p className="text-[11px] text-muted-foreground">
                    Email or phone sometimes works — if Connect fails, use the account ID steps above.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dexcom-password" className="text-xs text-muted-foreground">
                  Dexcom app / Clarity password
                </Label>
                <Input
                  id="dexcom-password"
                  type="password"
                  value={dexcomPassword}
                  onChange={(e) => setDexcomPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-10"
                  data-testid="input-dexcom-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dexcom-server" className="text-xs text-muted-foreground">
                  Dexcom region
                </Label>
                <Select
                  value={dexcomServer}
                  onValueChange={(value) => setDexcomServer(value === "us" ? "us" : value === "jp" ? "jp" : "eu")}
                >
                  <SelectTrigger id="dexcom-server" className="h-10 rounded-xl" data-testid="select-dexcom-server">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eu">Europe / UK (shareous1)</SelectItem>
                    <SelectItem value="us">United States (share2)</SelectItem>
                    <SelectItem value="jp">Japan / Asia-Pacific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dexcomError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
                  {dexcomError}
                </p>
              ) : null}
              <Button
                type="button"
                className="h-10 w-full gap-2 rounded-xl"
                disabled={dexcomConnecting || dexcomConnected}
                onClick={() => void handleConnectDexcom()}
                data-testid="button-cgm-connect-dexcom"
              >
                <Activity className="h-4 w-4" aria-hidden />
                {dexcomButtonLabel}
              </Button>
              {dexcomConnected ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full text-xs text-muted-foreground"
                  onClick={() => void handleDisconnectDexcom()}
                  data-testid="button-cgm-disconnect-dexcom"
                >
                  Disconnect Dexcom Share
                </Button>
              ) : null}
            </SettingsPanelBody>
          </SettingsPanel>
        </div>
      ) : null}

      {isNative && prefs.prefillEnabled && prefs.libreLinkUpEnabled ? (
        <div>
          <SettingsGroupLabel>LibreLink Up</SettingsGroupLabel>
          <SettingsPanel>
            <SettingsPanelBody className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Use your <span className="font-medium text-foreground">LibreLink Up</span> email and password — the
                care-partner / follower app that follows their sensor, not the LibreLink patient app login on its own.
                Ask them to invite you (or follow them) in LibreLink Up first. UK/EU: region Europe.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="libre-email" className="text-xs text-muted-foreground">
                  LibreLink Up email
                </Label>
                <Input
                  id="libre-email"
                  type="email"
                  value={libreEmail}
                  onChange={(e) => {
                    setLibreEmail(e.target.value);
                    setLibreError(null);
                  }}
                  autoComplete="username"
                  className="h-10"
                  disabled={libreConnected}
                  placeholder="you@email.com"
                  data-testid="input-libre-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="libre-password" className="text-xs text-muted-foreground">
                  LibreLink Up password
                </Label>
                <Input
                  id="libre-password"
                  type="password"
                  value={librePassword}
                  onChange={(e) => setLibrePassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-10"
                  data-testid="input-libre-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="libre-region" className="text-xs text-muted-foreground">
                  Libre region
                </Label>
                <Select
                  value={libreRegion}
                  onValueChange={(value) =>
                    setLibreRegion(
                      value === "us" || value === "global" || value === "de" || value === "ap" || value === "au"
                        ? value
                        : "eu",
                    )
                  }
                >
                  <SelectTrigger id="libre-region" className="h-10 rounded-xl" data-testid="select-libre-region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eu">Europe / UK</SelectItem>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="de">Germany</SelectItem>
                    <SelectItem value="ap">Asia-Pacific</SelectItem>
                    <SelectItem value="au">Australia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {libreError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
                  {libreError}
                </p>
              ) : null}
              <Button
                type="button"
                className="h-10 w-full gap-2 rounded-xl"
                disabled={libreConnecting || libreConnected}
                onClick={() => void handleConnectLibre()}
                data-testid="button-cgm-connect-libre"
              >
                <Activity className="h-4 w-4" aria-hidden />
                {libreButtonLabel}
              </Button>
              {libreConnected ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full text-xs text-muted-foreground"
                  onClick={() => void handleDisconnectLibre()}
                  data-testid="button-cgm-disconnect-libre"
                >
                  Disconnect LibreLink Up
                </Button>
              ) : null}
            </SettingsPanelBody>
          </SettingsPanel>
        </div>
      ) : null}

      {isNative && prefs.prefillEnabled && prefs.healthPlatformEnabled ? (
        <div>
          <SettingsGroupLabel>{healthLabel}</SettingsGroupLabel>
          <SettingsPanel>
            <SettingsPanelBody className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Fallback only — readings are often delayed and won&apos;t power trend charts or supporter live BG. Enable
                sharing in your CGM app first, then connect here for OS read permission (no Share/Libre login stored).
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{healthLabel}</p>
                <InlineInfoHint
                  ariaLabel={`How to connect ${healthLabel}`}
                  content={
                    <p>
                      {isAndroidDevice()
                        ? "In your Libre or Dexcom app, enable Health Connect sharing if available. Install Health Connect from the Play Store if prompted."
                        : "In your Dexcom or Libre app, enable sharing blood glucose to Apple Health. Often delayed — use Dexcom Share or LibreLink Up for near-live features."}
                    </p>
                  }
                />
              </div>
              {healthAvailable === false && healthReason ? (
                <p className="rounded-lg border border-amber-300/50 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
                  {healthReason}
                </p>
              ) : null}
              {connectError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
                  {connectError}
                </p>
              ) : null}
              <Button
                type="button"
                className="h-10 w-full gap-2 rounded-xl"
                disabled={connecting || accessGranted === true || (needsAppUpdate && !dexcomConnected && !libreConnected)}
                onClick={() => void handleConnectHealth()}
                data-testid="button-cgm-connect-health"
              >
                <Activity className="h-4 w-4" aria-hidden />
                {connectButtonLabel}
              </Button>
              {connecting ? (
                <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                  Approve <span className="font-medium text-foreground">Blood Glucose</span> in the {healthLabel} sheet.
                </p>
              ) : null}
            </SettingsPanelBody>
          </SettingsPanel>
        </div>
      ) : null}

      <p className="px-0.5 text-center text-[11px] leading-relaxed text-muted-foreground">
        Not a medical device — confirm on your CGM or meter before treating. Dexcom Share and LibreLink Up use unofficial
        APIs and may stop working if those services change.
      </p>

      <div className="flex justify-center pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => {
            void disconnectDexcomShareCgm();
            void disconnectLibreLinkUpCgm();
            setDexcomUsername("");
            setDexcomPassword("");
            setLibreEmail("");
            setLibrePassword("");
            updatePrefs({ ...DEFAULT_CGM_PREFERENCES });
          }}
        >
          <CircleOff className="h-3.5 w-3.5" aria-hidden />
          Reset settings
        </Button>
      </div>
    </SettingsSubPageShell>
  );
}
