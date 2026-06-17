import { useCallback, useRef } from "react";
import { Disclaimer } from "@/components/disclaimer";
import { InfoTooltip } from "@/components/info-tooltip";
import { APP_VERSION } from "@/lib/app-version";
import { BookOpen, Info, Shield } from "lucide-react";
import { Link } from "wouter";
import {
  SettingsGroup,
  SettingsGroupLabel,
  SettingsHubNavLink,
  SettingsNavRow,
  SettingsPanel,
  SettingsPanelBody,
  SettingsSubPageShell,
} from "./shared";
import { SettingsAboutInfoDialog } from "./settings-page-info";
import { useToast } from "@/hooks/use-toast";
import { isNativeShellForPushTestUi } from "@/lib/native-platform";
import { isProd } from "@/lib/flags";
import { unlockPushTestUi } from "@/lib/push-test-ui-unlock";

export function SettingsAboutRoute() {
  const year = new Date().getFullYear();
  const { toast } = useToast();
  /** Count consecutive taps; reset if the gap since the *previous* tap is too long. */
  const versionTapRef = useRef({ count: 0, lastAt: 0 });

  const onVersionTap = useCallback(() => {
    if (isProd || !isNativeShellForPushTestUi()) return;
    const now = Date.now();
    const maxGapMs = 2500;
    const prev = versionTapRef.current;
    if (prev.lastAt > 0 && now - prev.lastAt > maxGapMs) {
      versionTapRef.current = { count: 0, lastAt: 0 };
    }
    versionTapRef.current.count += 1;
    versionTapRef.current.lastAt = now;
    if (versionTapRef.current.count >= 7) {
      versionTapRef.current = { count: 0, lastAt: 0 };
      unlockPushTestUi();
      toast({
        title: "Push test tools enabled",
        description: "Reloading… Then open Settings → Notifications.",
      });
      window.setTimeout(() => {
        window.location.reload();
      }, 450);
    }
  }, [toast]);

  return (
    <SettingsSubPageShell
      title="About"
      description="Legal, support, and references."
      actions={<SettingsAboutInfoDialog />}
    >
      <div className="space-y-6">
        <div>
          <SettingsGroupLabel>App</SettingsGroupLabel>
          <SettingsPanel>
            <SettingsPanelBody className="space-y-0 p-0">
              <div className="flex items-center justify-between gap-3 px-3.5 py-3.5 sm:px-4">
                <span className="text-sm font-medium text-foreground">Version</span>
                <button
                  type="button"
                  className="min-h-11 rounded-lg px-2 text-sm tabular-nums text-muted-foreground touch-manipulation hover:bg-muted/60 active:bg-muted"
                  data-testid="text-app-version"
                  aria-label={`App version ${APP_VERSION}`}
                  onClick={onVersionTap}
                >
                  {APP_VERSION}
                </button>
              </div>
              <div className="border-t border-border/40 px-3.5 py-3 text-xs text-muted-foreground sm:px-4" data-testid="text-copyright">
                © PassingTime Ltd {year}
              </div>
            </SettingsPanelBody>
          </SettingsPanel>
        </div>

        <div>
          <SettingsGroupLabel>Legal &amp; support</SettingsGroupLabel>
          <SettingsGroup>
            <SettingsNavRow href="/privacy" label="Privacy" />
            <SettingsNavRow href="/privacy#terms" label="Terms" />
            <SettingsNavRow href="/support" label="Support" />
            <SettingsHubNavLink
              href="/medical-sources"
              label="Medical sources"
              description="Third-party references used in the app"
              icon={BookOpen}
              dataTestId="link-medical-sources"
            />
          </SettingsGroup>
        </div>

        <div>
          <SettingsGroupLabel>Safety</SettingsGroupLabel>
          <SettingsPanel>
            <SettingsPanelBody className="flex items-start gap-2 py-4">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <Disclaimer />
                <p className="text-xs text-muted-foreground">
                  Your data stays on this device unless you sign in and use cloud features.
                </p>
              </div>
              <InfoTooltip
                term="Safety & data"
                explanation="Diabeaters offers educational lifestyle support for people living with Type 1 diabetes. It is not a medical device and does not replace care from your qualified healthcare professional. External source links are for general education only and do not imply endorsement."
              />
            </SettingsPanelBody>
          </SettingsPanel>
        </div>

        <p className="flex items-start gap-2 px-0.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Need to move your data? Open{" "}
            <Link href="/settings/usage#settings-backup" className="text-primary underline-offset-2 hover:underline">
              Personal &amp; usage → Backup
            </Link>
            .
          </span>
        </p>
      </div>
    </SettingsSubPageShell>
  );
}
