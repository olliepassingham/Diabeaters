import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader, PageShell } from "@/components/layout";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode, setActiveAppMode, type ActiveAppMode } from "@/lib/carer-session";

export default function ModeChooserPage() {
  const [location, setLocation] = useLocation();
  const { isCarer: hasCarerLink, loading } = useLinkedCarer();
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
    if (mode === "carer") return "Carer mode";
    if (mode === "patient") return "User mode";
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
        description="If you support someone as a carer, you can switch between your own tools and their read-only view."
      />

      <Card className="shadow-sm border-border/60 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Current: {currentLabel}</CardTitle>
          <CardDescription>Pick one for this session. You can switch later from Account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full min-h-11" onClick={() => pick("patient")} data-testid="button-mode-patient">
            User mode
          </Button>
          <Button
            className="w-full min-h-11"
            variant={canChooseCarer ? "outline" : "secondary"}
            disabled={!canChooseCarer}
            onClick={() => pick("carer")}
            data-testid="button-mode-carer"
          >
            Carer mode
          </Button>
          {!canChooseCarer && (
            <Alert>
              <AlertDescription>
                This account is not linked as a carer yet. If you have an invite code, go to{" "}
                <Link href="/carer-setup" className="font-medium underline underline-offset-4">
                  Carer setup
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

