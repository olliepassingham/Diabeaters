import { Card, CardContent } from "@/components/ui/card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { getSupportEmail } from "@/lib/support";
import { Link } from "wouter";

export default function Support() {
  const supportEmail = getSupportEmail();
  return (
    <PageShell variant="standard" className="min-h-screen">
      <PageHeader
        leading={<PageBackButton />}
        title="Support"
        description="Contact options, troubleshooting, and frequently asked questions."
      />
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              If you’re having trouble signing in, syncing, or using a tool, the fastest fix is often below. If not,
              contact support and tell us what you were doing and what you expected to happen.
            </p>
            <p className="text-sm">
              {supportEmail ? (
                <>
                  Contact:{" "}
                  <a
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    href={`mailto:${supportEmail}`}
                  >
                    {supportEmail}
                  </a>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {import.meta.env.DEV ? (
                    <>
                      Contact email is not set. Add <code className="text-xs">VITE_SUPPORT_EMAIL=your@email.com</code> to{" "}
                      <code className="text-xs">.env.local</code> (repo root) and restart the dev server.
                    </>
                  ) : (
                    <>
                      A public support email appears here in a fully configured build. For urgent help, use the same
                      channel you use for other Diabeaters support.
                    </>
                  )}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              See also{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy
              </Link>
              .
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold">Troubleshooting</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium">White screen / app not loading</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Pull to refresh or fully close and reopen the app.</li>
                  <li>If you’re on web: hard refresh, and ensure only one dev server is running.</li>
                  <li>Try switching networks (Wi‑Fi ↔ mobile data) if you suspect a captive portal/VPN issue.</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Login issues</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Double-check email spelling and password manager autofill.</li>
                  <li>Use “Forgot password?” to reset if needed.</li>
                  <li>If you don’t get the email, check spam/junk and try again after a few minutes.</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Data not syncing</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Check that you’re signed in and online.</li>
                  <li>Open the page again to trigger a refresh.</li>
                  <li>If the issue persists, contact support with the feature area (Supplies/Routines/Community).</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold">FAQ</h2>
            <div className="space-y-4 text-sm">
              <div id="password">
                <span className="font-medium">Resetting your password</span>
                <p className="mt-1 text-muted-foreground">
                  Use the “Forgot password?” link on the login page. You’ll receive an email with a reset link.
                </p>
              </div>
              <div id="deletion">
                <span className="font-medium">Account / data deletion</span>
                <p className="mt-1 text-muted-foreground">
                  {supportEmail ? (
                    <>
                      Email us at the address above from the email on your account. We’ll process deletion requests within
                      a reasonable period.
                    </>
                  ) : (
                    <>
                      Contact support with the email used for your account. We’ll process deletion requests within a
                      reasonable period.
                    </>
                  )}
                </p>
              </div>
              <div id="medical">
                <span className="font-medium">Is this medical advice?</span>
                <p className="mt-1 text-muted-foreground">
                  No. Diabeaters is educational and organizational. Always follow your healthcare team.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
