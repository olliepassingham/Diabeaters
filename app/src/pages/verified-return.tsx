import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout";
import { isCapacitorNativeShell } from "@/lib/native-platform";

export default function VerifiedReturn() {
  const openedInNativeApp = isCapacitorNativeShell();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <PageShell variant="narrow" className="w-full max-w-md">
          <Card className="w-full rounded-2xl border-border/60 shadow-sm" data-testid="verified-return">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">Email verified</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                {openedInNativeApp
                  ? "Your email is confirmed. Log in with your email and password to continue."
                  : "Your email is confirmed. Open the Diabeaters app on your phone and log in with your email and password."}
              </p>
              {!openedInNativeApp && (
                <p className="text-xs text-muted-foreground">
                  If you signed up on your phone, switch back to the Diabeaters app — you do not need to stay in this browser.
                </p>
              )}

              <div className="flex flex-col gap-3">
                <Button asChild className="w-full">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/welcome">Back to welcome</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </div>
    </div>
  );
}
