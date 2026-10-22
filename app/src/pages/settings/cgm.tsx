import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  dexcomUsernameInputNotice,
  formatDexcomStoredLoginLabel,
  normalizeDexcomUsernameInput,
  shouldEmphasizeDexcomAccountIdAssist,
} from "@/components/cgm-dexcom-login-assist";
import { dexcomAccountPortalUrl, isDexcomAccountId } from "@/lib/cgm/dexcom-share-client";

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
      detail: "Choose your CGM below to connect.",
      tone: "muted",
    };
  }
  if (hasDexcomShareCredentials(prefs)) {
    return {
      label: "Connected",
      detail: "Dexcom Share — near-live glucose in the app.",
      tone: "green",
    };
  }
  if (hasLibreLinkUpCredentials(prefs)) {
    return {
      label: "Connected",
      detail: "LibreLink Up — near-live glucose in the app.",
      tone: "green",
    };
  }
  if (accessGranted === true) {
    return {
      label: "Connected",
      detail: `${healthLabel} — readings may be delayed.`,
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
      label: "Not connected",
      detail: "Pick Dexcom, Libre, or Health below.",
      tone: "amber",
    };
  }
  if (prefs.libreLinkUpEnabled && !hasLibreLinkUpCredentials(prefs)) {
    return {
      label: "Needs setup",
      detail: "Enter LibreLink Up login, then Connect.",
      tone: "amber",
    };
  }
  if (prefs.dexcomShareEnabled) {
    return {
      label: "Needs setup",
      detail: "Paste the portal address and your Clarity password, then Connect.",
      tone: "amber",
    };
  }
  return {
    label: "Needs permission",
    detail: `Tap Connect and allow Blood Glucose in ${healthLabel}.`,
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
    // A pasted address with no account ID in it (e.g. a Clarity link) can
    // never log in — explain that here instead of a failed login attempt.
    const notice = dexcomUsernameInputNotice(dexcomUsername);
    if (notice) {
      setDexcomError(notice);
      setDexcomAssistEmphasize(true);
      return;
    }
    const resolvedUsername = normalizeDexcomUsernameInput(dexcomUsername.trim());
    if (resolvedUsername !== dexcomUsername) setDexcomUsername(resolvedUsername);
    setDexcomConnecting(true);
    setDexcomError(null);
    try {
      const res = await connectDexcomShareCgm({
        username: resolvedUsername,
        password: dexcomPassword,
        server: dexcomServer,
      });
      if (!res.ok) {
        const message = res.error ?? "Could not connect to Dexcom Share.";
        setDexcomError(message);
        if (shouldEmphasizeDexcomAccountIdAssist(message) && !isDexcomAccountId(resolvedUsername)) {
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
      if (shouldEmphasizeDexcomAccountIdAssist(message) && !isDexcomAccountId(resolvedUsername)) {
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

  const selectSource = (value: CgmSourceChoice) => {
    if (value === "dexcom") {
      updatePrefs({
        ...prefs,
        prefillEnabled: true,
        dexcomShareEnabled: true,
        libreLinkUpEnabled: false,
        healthPlatformEnabled: false,
      });
    } else if (value === "libre") {
      updatePrefs({
        ...prefs,
        prefillEnabled: true,
        libreLinkUpEnabled: true,
        dexcomShareEnabled: false,
        healthPlatformEnabled: false,
      });
    } else {
      updatePrefs({
        ...prefs,
        prefillEnabled: true,
        healthPlatformEnabled: true,
        dexcomShareEnabled: false,
        libreLinkUpEnabled: false,
      });
    }
  };

  const anyLiveConnected = dexcomConnected || libreConnected || accessGranted === true;

  return (
    <SettingsSubPageShell
      title="Connect CGM"
      description="Better charts, home glucose, and tool suggestions."
      actions={<SettingsCgmInfoDialog />}
    >
      <SettingsPanel className="bg-gradient-to-b from-muted/30 to-muted/5 dark:from-muted/15 dark:to-muted/5">
        <SettingsPanelBody className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-inner dark:bg-primary/20">
            <StatusIcon
              className={cn(
                "h-5 w-5",
                status.tone === "green" && "text-green-600 dark:text-green-400",
                status.tone === "amber" && "text-amber-600 dark:text-amber-400",
                status.tone === "muted" && "text-primary",
              )}
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Status</p>
              <Badge variant="outline" className={cn("rounded-full px-2 py-0 text-[11px] font-medium", STATUS_BADGE_CLASS[status.tone])}>
                {status.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{status.detail}</p>
          </div>
        </SettingsPanelBody>
      </SettingsPanel>

      {needsAppUpdate && !dexcomConnected && !libreConnected ? (
        <SettingsPanel>
          <SettingsPanelBody className="space-y-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Update Diabeaters</p>
            <p className="text-sm text-muted-foreground">
              Health needs a newer app build. You can still connect Dexcom or Libre below.
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
            <p className="text-sm text-muted-foreground">Open Diabeaters on iPhone or Android to connect.</p>
          </SettingsPanelBody>
        </SettingsPanel>
      ) : null}

      {isNative ? (
        <SettingsPanel>
          <SettingsPanelBody className="space-y-3" data-testid="panel-cgm-source-guide">
            <p className="text-sm font-semibold text-foreground">1. Choose your CGM</p>
            <RadioGroup
              value={selectedCgmSourceChoice(prefs) ?? ""}
              onValueChange={(value) => {
                if (value === "dexcom" || value === "libre" || value === "health") selectSource(value);
              }}
              className="grid gap-2"
            >
              <CgmSourceChoiceCard
                value="dexcom"
                selected={selectedCgmSourceChoice(prefs) === "dexcom"}
                icon={RadioIcon}
                title="Dexcom"
                description="Near-live · best for charts"
                testId="button-cgm-choose-dexcom"
              />
              <CgmSourceChoiceCard
                value="libre"
                selected={selectedCgmSourceChoice(prefs) === "libre"}
                icon={Droplet}
                title="Libre"
                description="Near-live · LibreLink Up login"
                testId="button-cgm-choose-libre"
              />
              <CgmSourceChoiceCard
                value="health"
                selected={selectedCgmSourceChoice(prefs) === "health"}
                icon={HeartPulse}
                title={healthLabel}
                description="Quick · may be delayed"
                testId="button-cgm-choose-health"
              />
            </RadioGroup>
          </SettingsPanelBody>
        </SettingsPanel>
      ) : null}

      {isNative && prefs.dexcomShareEnabled ? (
        <div>
          <SettingsGroupLabel>2. Connect Dexcom</SettingsGroupLabel>
          <SettingsPanel>
            <SettingsPanelBody className="space-y-3">
              {!dexcomConnected ? (
                <DexcomLoginAssist
                  server={dexcomServer}
                  emphasize={dexcomAssistEmphasize}
                  onAccountIdPasted={(id) => {
                    setDexcomUsername(id);
                    setDexcomError(null);
                  }}
                  onAssistError={(message) => setDexcomError(message)}
                />
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="dexcom-username" className="text-sm">
                  {dexcomConnected
                    ? "Linked account"
                    : isDexcomAccountId(dexcomUsername)
                      ? "Account ID"
                      : "Portal address"}
                </Label>
                <Input
                  id="dexcom-username"
                  value={
                    dexcomConnected && isDexcomAccountId(dexcomUsername)
                      ? formatDexcomStoredLoginLabel(dexcomUsername)
                      : dexcomUsername
                  }
                  onChange={(e) => {
                    // Keep the field exactly as typed/pasted. Rewriting it
                    // mid-edit (swapping the address for the account ID)
                    // fights the caret and makes pasting feel broken — the
                    // account ID is extracted when Connect is pressed.
                    setDexcomUsername(e.target.value);
                    setDexcomError(null);
                  }}
                  onBlur={() => setDexcomError(dexcomUsernameInputNotice(dexcomUsername))}
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  className="h-11"
                  disabled={dexcomConnected}
                  placeholder="Paste the copied address here"
                  data-testid="input-dexcom-username"
                />
                {!dexcomConnected ? (
                  <p className="text-xs leading-snug text-muted-foreground">
                    From the top of your browser after signing in — it starts with{" "}
                    {new URL(dexcomAccountPortalUrl(dexcomServer)).host}.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dexcom-password" className="text-sm">
                  Password
                </Label>
                <Input
                  id="dexcom-password"
                  type="password"
                  value={dexcomPassword}
                  onChange={(e) => setDexcomPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11"
                  data-testid="input-dexcom-password"
                />
                <p className="text-xs text-muted-foreground">Same password as Clarity.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dexcom-server" className="text-sm">
                  Region
                </Label>
                <Select
                  value={dexcomServer}
                  onValueChange={(value) => setDexcomServer(value === "us" ? "us" : value === "jp" ? "jp" : "eu")}
                >
                  <SelectTrigger id="dexcom-server" className="h-11 rounded-xl" data-testid="select-dexcom-server">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eu">Europe / UK</SelectItem>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="jp">Japan / Asia-Pacific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dexcomError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {dexcomError}
                </p>
              ) : null}
              <Button
                type="button"
                className="h-11 w-full gap-2 rounded-xl"
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
                  className="h-9 w-full text-sm text-muted-foreground"
                  onClick={() => void handleDisconnectDexcom()}
                  data-testid="button-cgm-disconnect-dexcom"
                >
                  Disconnect
                </Button>
              ) : null}
            </SettingsPanelBody>
          </SettingsPanel>
        </div>
      ) : null}

      {isNative && prefs.libreLinkUpEnabled ? (
        <div>
          <SettingsGroupLabel>2. Connect Libre</SettingsGroupLabel>
          <SettingsPanel>
            <SettingsPanelBody className="space-y-3">
              <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>Open LibreLink Up (follower app)</li>
                <li>Enter that email and password here</li>
              </ol>
              <div className="space-y-1.5">
                <Label htmlFor="libre-email" className="text-sm">
                  Email
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
                  className="h-11"
                  disabled={libreConnected}
                  placeholder="you@email.com"
                  data-testid="input-libre-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="libre-password" className="text-sm">
                  Password
                </Label>
                <Input
                  id="libre-password"
                  type="password"
                  value={librePassword}
                  onChange={(e) => setLibrePassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11"
                  data-testid="input-libre-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="libre-region" className="text-sm">
                  Region
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
                  <SelectTrigger id="libre-region" className="h-11 rounded-xl" data-testid="select-libre-region">
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
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {libreError}
                </p>
              ) : null}
              <Button
                type="button"
                className="h-11 w-full gap-2 rounded-xl"
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
                  className="h-9 w-full text-sm text-muted-foreground"
                  onClick={() => void handleDisconnectLibre()}
                  data-testid="button-cgm-disconnect-libre"
                >
                  Disconnect
                </Button>
              ) : null}
            </SettingsPanelBody>
          </SettingsPanel>
        </div>
      ) : null}

      {isNative && prefs.healthPlatformEnabled ? (
        <div>
          <SettingsGroupLabel>2. Connect {healthLabel}</SettingsGroupLabel>
          <SettingsPanel>
            <SettingsPanelBody className="space-y-3">
              <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>In your CGM app, share glucose to {healthLabel}</li>
                <li>Tap Connect and allow Blood Glucose</li>
              </ol>
              {healthAvailable === false && healthReason ? (
                <p className="rounded-lg border border-amber-300/50 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
                  {healthReason}
                </p>
              ) : null}
              {connectError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {connectError}
                </p>
              ) : null}
              <Button
                type="button"
                className="h-11 w-full gap-2 rounded-xl"
                disabled={connecting || accessGranted === true || (needsAppUpdate && !dexcomConnected && !libreConnected)}
                onClick={() => void handleConnectHealth()}
                data-testid="button-cgm-connect-health"
              >
                <Activity className="h-4 w-4" aria-hidden />
                {connectButtonLabel}
              </Button>
              {connecting ? (
                <p className="text-center text-sm text-muted-foreground">
                  Approve Blood Glucose in the {healthLabel} sheet.
                </p>
              ) : null}
            </SettingsPanelBody>
          </SettingsPanel>
        </div>
      ) : null}

      {anyLiveConnected ? (
        <div>
          <SettingsGroupLabel>Options</SettingsGroupLabel>
          <SettingsGroup>
            <CgmToggleRow
              id="cgm-prefill-enabled"
              label="Suggest in tools"
              info={<p>Offer recent CGM readings in Driving, exercise, and other BG fields.</p>}
              checked={prefs.prefillEnabled}
              onCheckedChange={(checked) => updatePrefs({ ...prefs, prefillEnabled: checked })}
              testId="switch-cgm-prefill"
            />
          </SettingsGroup>
        </div>
      ) : null}

      <div className="flex justify-center pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-sm text-muted-foreground"
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
          Reset
        </Button>
      </div>
    </SettingsSubPageShell>
  );
}
