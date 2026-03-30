import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Disclaimer } from "@/components/disclaimer";
import appPackage from "../../../package.json";
import { BookOpen, ExternalLink, Info } from "lucide-react";
import { Link } from "wouter";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { SettingsBackLink, SettingsDataBackupSection, SettingsNavRow } from "./shared";

const SOURCES = [
  {
    category: "General Diabetes Management",
    sources: [
      { org: "International Diabetes Federation (IDF)", title: "IDF Diabetes Atlas", url: "https://diabetesatlas.org/" },
      { org: "NHS UK", title: "Type 1 Diabetes Overview", url: "https://www.nhs.uk/conditions/type-1-diabetes/" },
      { org: "American Diabetes Association (ADA)", title: "Standards of Medical Care in Diabetes", url: "https://diabetes.org/about-diabetes/type-1" },
    ],
  },
  {
    category: "Hypoglycaemia Treatment",
    sources: [
      { org: "Diabetes UK", title: "Hypoglycaemia (Low Blood Sugar) Guidance", url: "https://www.diabetes.org.uk/about-diabetes/hypos" },
      { org: "Mayo Clinic", title: "Hypoglycemia: Symptoms & Treatment", url: "https://www.mayoclinic.org/diseases-conditions/hypoglycemia/symptoms-causes/syc-20373685" },
    ],
  },
  {
    category: "Carbohydrate Counting & Insulin Ratios",
    sources: [
      { org: "NHS", title: "Carb Counting for People with Type 1 Diabetes", url: "https://www.nhs.uk/conditions/type-1-diabetes/understanding-food/" },
      { org: "Diabetes UK", title: "Carbohydrate Counting", url: "https://www.diabetes.org.uk/guide-to-diabetes/enjoy-food/carbohydrates-and-diabetes/carb-counting" },
      { org: "ISPAD", title: "International Society for Pediatric and Adolescent Diabetes Guidelines", url: "https://www.ispad.org/" },
    ],
  },
  {
    category: "Exercise & Insulin Adjustment",
    sources: [
      { org: "JDRF", title: "Exercise and Type 1 Diabetes", url: "https://www.jdrf.org/t1d-resources/living-with-t1d/exercise/" },
      { org: "American Diabetes Association (ADA)", title: "Physical Activity and Diabetes", url: "https://diabetes.org/health-wellness/fitness" },
    ],
  },
];

function SourcesReferencesContent() {
  return (
    <div className="space-y-6" data-testid="sources-content">
      <p className="text-body text-muted-foreground">
        The guidance in this app is informed by the following reputable, publicly accessible sources. This app does not provide medical
        advice — always consult your diabetes team.
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
              <li key={source.title} className="text-body flex items-start gap-2">
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
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="sr-only">Visit {source.org}</span>
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-small text-muted-foreground border-t border-border pt-4">
        These sources are provided for reference only. Diabeaters does not replace professional medical advice. Always follow the guidance
        of your diabetes healthcare team.
      </p>
    </div>
  );
}

type SettingsAboutRouteProps = {
  settingsInfoDialog: ReactNode;
  isCarer: boolean;
};

export function SettingsAboutRoute({ settingsInfoDialog, isCarer }: SettingsAboutRouteProps) {
  return (
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <SettingsBackLink />
      <PageHeader
        className="mb-2"
        title="About"
        description="Version, legal, support, and references."
        actions={settingsInfoDialog}
      />
      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40">
        <CardContent className="pt-6 pb-6 space-y-6">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-body font-medium text-foreground">Version</span>
            <span className="text-small text-muted-foreground tabular-nums" data-testid="text-app-version">
              {appPackage.version}
            </span>
          </div>
          <nav aria-label="Legal and support" className="flex flex-col">
            <SettingsNavRow href="/privacy" label="Privacy" />
            <SettingsNavRow href="/privacy#terms" label="Terms" />
            <SettingsNavRow href="/support" label="Support" />
          </nav>
          <div id="settings-sources" className="scroll-mt-28 border-t border-border pt-6 space-y-3">
            <h3 className="text-h3 font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden />
              Sources &amp; references
            </h3>
            <SourcesReferencesContent />
          </div>
          {!isCarer && <SettingsDataBackupSection />}
          <div className="border-t border-border pt-6">
            <h3 className="text-h3 font-semibold text-foreground mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" aria-hidden />
              Safety &amp; data
            </h3>
            <Disclaimer />
          </div>
          <div className="pt-2">
            <Link href="/account" data-testid="settings-link-account">
              <Button variant="outline" size="sm">
                Open full account settings
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
