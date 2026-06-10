import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader, PageShell } from "@/components/layout";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode, isCarerSessionMode, isCommunityOnlyAccount, isSupporterOnlyAccount, setActiveAppMode, type ActiveAppMode } from "@/lib/carer-session";
import { getCommunityMemberLandingPath } from "@/lib/community-landing";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import { ArrowRight, Eye, User as UserIcon } from "lucide-react";

export default function ModeChooserPage() {
  const [location, setLocation] = useLocation();
  const { isCarer: hasCarerLink, loading } = useLinkedCarer();

  useEffect(() => {
    if (isSupporterOnlyAccount()) {
      setLocation("/carer-view");
      return;
    }
    if (isCommunityOnlyAccount()) {
      setLocation(getCommunityMemberLandingPath());
    }
  }, [setLocation]);

  useEffect(() => {
    if (isCommunityAccountProfile(storage.getProfile())) {
      setLocation(getCommunityMemberLandingPath());
    }
  }, [setLocation]);
  const [mode, setMode] = useState<ActiveAppMode | null>(() => {
    try {
      return getActiveAppMode();
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: ActiveAppMode | null }>;
      setMode(ce.detail?.mode ?? null);
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  const currentLabel = useMemo(() => {
    if (mode === "carer") return "Supporter Mode";
    if (mode === "patient") return "User Mode";
    return "Not set";
  }, [mode]);

  const canChooseCarer = hasCarerLink;

  const pick = (next: ActiveAppMode) => {
    setActiveAppMode(next);
    setLocation(next === "carer" ? "/carer-view" : "/");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-sm text-muted-foreground" aria-busy="true">
        Loading…
      </div>
    );
  }

  return (
    <PageShell variant="narrow" className="space-y-6 py-4 md:py-8">
      <PageHeader
        title="Choose your mode"
        description="Pick what this session should show. If your account supports someone, you can swap anytime from Account."
      />

      <Card className="shadow-sm border-border/60 rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Current: {currentLabel}</CardTitle>
          <CardDescription>Tap a card to switch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            type="button"
            onClick={() => pick("patient")}
            data-testid="button-mode-patient"
            className="pressable w-full rounded-2xl border border-border/60 bg-background/60 p-4 text-left shadow-sm hover-elevate"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-primary/10 p-2.5">
                <UserIcon className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-foreground">User Mode</div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Your own dashboard, supplies, situation guides, and tools.</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => pick("carer")}
            disabled={!canChooseCarer}
            data-testid="button-mode-carer"
            className="pressable w-full rounded-2xl border border-border/60 bg-background/60 p-4 text-left shadow-sm hover-elevate disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-blue-500/10 p-2.5">
                <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-foreground">Supporter Mode</div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Read-only views for the person you support.</p>
              </div>
            </div>
          </button>

          {!canChooseCarer && (
            <Alert className="rounded-2xl border-border/60">
              <AlertDescription>
                This account isn’t linked to support someone yet. If you have an invite code, go to{" "}
                <Link href="/carer-setup" className="font-medium underline underline-offset-4">
                  Supporter setup
                </Link>
                .
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Button variant="ghost" asChild className="w-full">
        <Link href={location.startsWith("/carer") ? "/carer-view" : "/"}>Back</Link>
      </Button>
    </PageShell>
  );
}

