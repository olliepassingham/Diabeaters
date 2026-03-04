import { useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const VERIFIED_WELCOME_PENDING_KEY = "diabeater_verified_welcome_pending";

export default function VerifiedSuccess() {
  useEffect(() => {
    try {
      localStorage.setItem(VERIFIED_WELCOME_PENDING_KEY, "true");
    } catch {
      // Ignore
    }
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 py-10 md:py-14">
      <Card data-testid="verified-success" className="dashboard-card-hover bg-white/80 dark:bg-neutral-900/70 border-neutral-200/60 dark:border-neutral-700/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl md:text-3xl font-semibold tracking-tight">
            You&apos;re verified ✅
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            You can now use all features.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-200">
              <Link href="/">Go to Dashboard</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-200"
            >
              <Link href="/account">Open Account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

