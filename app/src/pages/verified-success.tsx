import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getLinkedPatientForCarer } from "@/lib/carers";
import { hasCarerIntent, hasPendingCarer } from "@/lib/carer-session";
import { PageShell } from "@/components/layout";

const VERIFIED_WELCOME_PENDING_KEY = "diabeater_verified_welcome_pending";

export default function VerifiedSuccess() {
  const { user } = useAuth();
  const [primaryHref, setPrimaryHref] = useState("/");
  const [primaryLabel, setPrimaryLabel] = useState("Go to Dashboard");

  useEffect(() => {
    try {
      localStorage.setItem(VERIFIED_WELCOME_PENDING_KEY, "true");
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      let storedNext = "";
      try {
        storedNext = sessionStorage.getItem("diabeater_post_verify_next") ?? "";
      } catch {
        storedNext = "";
      }
      if (storedNext.startsWith("/") && !storedNext.startsWith("//")) {
        try {
          sessionStorage.removeItem("diabeater_post_verify_next");
        } catch {
          // Ignore
        }
        if (!cancelled) {
          setPrimaryHref(storedNext);
          setPrimaryLabel(
            storedNext === "/carer-setup" ? "Enter invite code" : "Continue",
          );
        }
        return;
      }
      const link = await getLinkedPatientForCarer();
      if (cancelled) return;
      if (link.data) {
        setPrimaryHref("/carer-view");
        setPrimaryLabel("Open Supporter Mode");
        return;
      }
      if (hasCarerIntent() || hasPendingCarer()) {
        setPrimaryHref("/carer-setup");
        setPrimaryLabel("Enter invite code");
        return;
      }
      setPrimaryHref("/");
      setPrimaryLabel("Go to Dashboard");
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <PageShell variant="narrow" className="w-full max-w-md">
          <Card data-testid="verified-success" className="w-full rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                You&apos;re verified
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">You can now use all features.</p>

              <div className="flex flex-col gap-3">
                <Button asChild className="w-full">
                  <Link href={primaryHref}>{primaryLabel}</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/account">Open Account</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </div>
    </div>
  );
}
