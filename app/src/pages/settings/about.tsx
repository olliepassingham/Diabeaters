import type { ReactNode } from "react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Disclaimer } from "@/components/disclaimer";
import appPackage from "../../../package.json";
import { BookOpen, ExternalLink, Info } from "lucide-react";
import { Link } from "wouter";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { PushTestUnlockCallout } from "@/components/push-test-unlock-callout";
import { SettingsBackLink, SettingsNavRow } from "./shared";
import { useToast } from "@/hooks/use-toast";
import { isIosShellForPushTestUi } from "@/lib/ios-user-agent";
import { unlockPushTestUi } from "@/lib/push-test-ui-unlock";

const SOURCES = [
  {
    category: "General Diabetes Management",
    sources: [
      { org: "International Diabetes Federation (IDF)", title: "IDF Diabetes Atlas", url: "https://diabetesatlas.org/" },
      { org: "NHS UK", title: "Type 1 Diabetes Overview", url: "https://www.nhs.uk/conditions/type-1-diabetes/" },
      { org: "American Diabetes Association (ADA)", title: "Type 1 Diabetes (US)", url: "https://diabetes.org/about-diabetes/type-1" },
    ],
  },
  {
    category: "Hypoglycaemia Treatment",
    sources: [
      { org: "Diabetes UK", title: "Hypoglycaemia (Low Blood Sugar) Guidance", url: "https://www.diabetes.org.uk/about-diabetes/hypos" },
      {
        org: "Mayo Clinic",
        title: "Hypoglycemia — symptoms and causes (general health reference)",
        url: "https://www.mayoclinic.org/diseases-conditions/hypoglycemia/symptoms-causes/syc-20373685",
      },
    ],
  },
  {
    category: "Carbohydrate Counting & Insulin Ratios",
    sources: [
      { org: "NHS", title: "Carb Counting for People with Type 1 Diabetes", url: "https://www.nhs.uk/conditions/type-1-diabetes/understanding-food/" },
      { org: "Diabetes UK", title: "Carbohydrate Counting", url: "https://www.diabetes.org.uk/guide-to-diabetes/enjoy-food/carbohydrates-and-diabetes/carb-counting" },
      {
        org: "ISPAD",
        title: "International Society for Pediatric and Adolescent Diabetes (resources hub)",
        url: "https://www.ispad.org/",
      },
    ],
  },
  {
    category: "Exercise & Insulin Adjustment",
    sources: [
      { org: "JDRF", title: "Exercise and Type 1 Diabetes", url: "https://www.jdrf.org/t1d-resources/living-with-t1d/exercise/" },
      { org: "American Diabetes Association (ADA)", title: "Physical Activity and Diabetes (US)", url: "https://diabetes.org/health-wellness/fitness" },
    ],
  },
];

function MedicalInformationLead() {
  return (
    <div
      className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2 text-body text-muted-foreground"
      data-testid="sources-medical-information-lead"
    >
      <h4 className="text-sm font-semibold text-foreground">Medical information</h4>
      <p>
        Diabeaters offers educational lifestyle support for people living with Type 1 diabetes. It is not a medical device and does not
        replace care from your qualified healthcare professional.
      </p>
      <p>
        Listing organisations below does not imply endorsement, partnership, or approval of this app, or that in-app content matches
        those organisations&apos; current clinical protocols.
      </p>
      <p>
        Third-party pages may change or move; links are provided in good faith. Some entries are general health references rather than
        diabetes-specific authority sites. Clinical practice varies by region; resources from different countries are included for general
        education only.
      </p>
    </div>
  );
}

function SourcesReferencesContent() {
  return (
    <div className="space-y-6" data-testid="sources-content">
      <MedicalInformationLead />
      <p className="text-body text-muted-foreground">
        The sections below point to publicly accessible materials that may help you explore topics covered in the app. They do not
        constitute medical advice — always consult your diabetes team for treatment decisions.
      </p>
      {SOURCES.map((section) => (
        <div key={section.category} className="space-y-2">
          <h3
            className="text-h3 font-semibold text-foreground"
            data-testid={`sources-heading-${section.category.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {section.category}
          </h3>
          <ul className="space-y-1.5">
            {section.sources.map((source) => (
              <li key={`${source.org}-${source.title}`} className="text-body flex items-start gap-2">
                <span className="text-muted-foreground shrink-0 mt-0.5">-</span>
                <span>
                  <span className="font-medium">{source.org}</span>
                  <span className="text-muted-foreground"> — {source.title}</span>
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 ml-1.5 text-primary hover:underline"
                      data-testid={`link-source-${source.org.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                      aria-label={`${source.org}: ${source.title} (opens in new tab)`}
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-small text-muted-foreground border-t border-border pt-4">
        Reference only. Diabeaters does not warrant the accuracy, completeness, or currency of external sites. Nothing here replaces
        professional medical advice — always follow your diabetes healthcare team.
      </p>
    </div>
  );
}

type SettingsAboutRouteProps = {
  settingsInfoDialog: ReactNode;
};

export function SettingsAboutRoute({ settingsInfoDialog }: SettingsAboutRouteProps) {
  const year = new Date().getFullYear();
  const { toast } = useToast();
  /** Count consecutive taps; reset if the gap since the *previous* tap is too long. */
  const versionTapRef = useRef({ count: 0, lastAt: 0 });

  const onVersionTap = useCallback(() => {
    if (!isIosShellForPushTestUi()) return;
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
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <SettingsBackLink />
      <PageHeader
        className="mb-2"
        title="About"
        description="Version, legal, support, and third-party references."
        actions={settingsInfoDialog}
      />
      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40">
        <CardContent className="pt-6 pb-6 space-y-6">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-body font-medium text-foreground">Version</span>
            <button
              type="button"
              className="text-small text-muted-foreground tabular-nums rounded-md px-2 py-1 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-end touch-manipulation hover:bg-muted/60 active:bg-muted"
              data-testid="text-app-version"
              aria-label={`App version ${appPackage.version}`}
              onClick={onVersionTap}
            >
              {appPackage.version}
            </button>
          </div>
          <PushTestUnlockCallout className="-mt-1" />
          <nav aria-label="Legal and support" className="flex flex-col">
            <SettingsNavRow href="/privacy" label="Privacy" />
            <SettingsNavRow href="/privacy#terms" label="Terms" />
            <SettingsNavRow href="/support" label="Support" />
          </nav>
          <div className="text-xs text-muted-foreground border-t border-border pt-4">
            <p data-testid="text-copyright">
              © PassingTime Ltd {year} ·{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy
              </Link>{" "}
              ·{" "}
              <Link href="/privacy#terms" className="underline underline-offset-2 hover:text-foreground">
                Terms
              </Link>{" "}
              ·{" "}
              <Link href="/support" className="underline underline-offset-2 hover:text-foreground">
                Support
              </Link>{" "}
              ·{" "}
              <Link href="/medical-sources" className="underline underline-offset-2 hover:text-foreground">
                Sources
              </Link>
            </p>
          </div>
          <div id="settings-sources" className="scroll-mt-28 border-t border-border pt-6 space-y-3">
            <h3 className="text-h3 font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden />
              Sources &amp; references
            </h3>
            <SourcesReferencesContent />
          </div>
          <div className="border-t border-border pt-6">
            <h3 className="text-h3 font-semibold text-foreground mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" aria-hidden />
              Safety &amp; data
            </h3>
            <Disclaimer />
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 sm:items-center">
            <Link href="/account" data-testid="settings-link-account">
              <Button variant="outline" size="sm">
                Open full account settings
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              <Link href="/settings/usage#settings-backup" className="text-primary underline-offset-2 hover:underline">
                Export or import app data
              </Link>{" "}
              (at the bottom of Personal information and usage).
            </p>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
