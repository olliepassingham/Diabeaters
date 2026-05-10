import { Card, CardContent } from "@/components/ui/card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { getSupportEmail } from "@/lib/support";
import { Link } from "wouter";

export default function Support() {
  const supportEmail = getSupportEmail();
  return (
    <PageShell
      variant="standard"
      className="relative z-[1] min-h-dvh bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-foreground sm:px-0"
    >
      <PageHeader
        leading={<PageBackButton />}
        title="Support"
        description="Contact options, troubleshooting, and frequently asked questions."
      />
      <Card className="surface-solid border-border/60 shadow-sm ring-0">
        <CardContent className="space-y-8 pt-6 text-sm leading-relaxed text-foreground sm:text-[0.9375rem] sm:leading-relaxed">
          <section className="space-y-3">
            <p className="text-muted-foreground">
              If you’re having trouble signing in, syncing, or using a tool, the fastest fix is often below. If not,
              contact support and tell us what you were doing and what you expected to happen.
            </p>
            <p>
              <span className="font-medium text-foreground">Contact</span>
              <span className="text-muted-foreground"> · </span>
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={`mailto:${supportEmail}`}
              >
                {supportEmail}
              </a>
            </p>
            <p className="text-xs text-muted-foreground">
              See also{" "}
              <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2 hover:text-foreground">
                Privacy
              </Link>
              .
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Troubleshooting</h2>
            <div className="space-y-5 text-sm">
              <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 px-3 py-3 dark:bg-muted/5">
                <p className="font-medium text-foreground">White screen / app not loading</p>
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-muted-foreground/80">
                  <li>Pull to refresh or fully close and reopen the app.</li>
                  <li>If you’re on web: hard refresh, and ensure only one dev server is running.</li>
                  <li>Try switching networks (Wi‑Fi ↔ mobile data) if you suspect a captive portal/VPN issue.</li>
                </ul>
              </div>
              <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 px-3 py-3 dark:bg-muted/5">
                <p className="font-medium text-foreground">Login issues</p>
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-muted-foreground/80">
                  <li>Double-check email spelling and password manager autofill.</li>
                  <li>Use “Forgot password?” to reset if needed.</li>
                  <li>If you don’t get the email, check spam/junk and try again after a few minutes.</li>
                </ul>
              </div>
              <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 px-3 py-3 dark:bg-muted/5">
                <p className="font-medium text-foreground">Data not syncing</p>
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-muted-foreground/80">
                  <li>Check that you’re signed in and online.</li>
                  <li>Open the page again to trigger a refresh.</li>
                  <li>If the issue persists, contact support with the feature area (Supplies/Routines/Community).</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">FAQ</h2>
            <div className="space-y-5 text-sm">
              <div id="password" className="space-y-1.5">
                <span className="font-medium text-foreground">Resetting your password</span>
                <p className="text-muted-foreground">
                  Use the “Forgot password?” link on the login page. You’ll receive an email with a reset link.
                </p>
              </div>
              <div id="deletion" className="space-y-1.5">
                <span className="font-medium text-foreground">Account / data deletion</span>
                <p className="text-muted-foreground">
                  Email us at{" "}
                  <a className="font-medium text-primary underline-offset-4 hover:underline" href={`mailto:${supportEmail}`}>
                    {supportEmail}
                  </a>{" "}
                  from the email on your account. We’ll process deletion requests within a reasonable period.
                </p>
              </div>
              <div id="medical" className="space-y-1.5">
                <span className="font-medium text-foreground">Is this medical advice?</span>
                <p className="text-muted-foreground">
                  No. Diabeaters is educational and organizational. Always follow your healthcare team.
                </p>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </PageShell>
  );
}
