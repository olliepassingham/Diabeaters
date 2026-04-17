import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout";

export default function VerifiedReturn() {
  return (
    <PageShell variant="narrow" className="space-y-6 py-6 md:py-10">
      <Card className="dashboard-card-hover bg-white/80 dark:bg-neutral-900/70 border-neutral-200/60 dark:border-neutral-700/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl md:text-3xl font-semibold tracking-tight">
            Email verified
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Your email address is verified. Please return to the Diabeaters app and log in again to continue.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-200">
              <Link href="/login">Go to log in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-200"
            >
              <Link href="/welcome">Back to welcome</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

