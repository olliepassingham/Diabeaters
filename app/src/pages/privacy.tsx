import { Card, CardContent } from "@/components/ui/card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { getSupportEmail } from "@/lib/support";

export default function Privacy() {
  const supportEmail = getSupportEmail();

  return (
    <PageShell
      variant="standard"
      className="relative z-[1] min-h-dvh bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-foreground sm:px-0"
    >
      <PageHeader leading={<PageBackButton />} title="Privacy" description="How Diabeaters handles your data." />
      <Card className="surface-solid border-border/60 shadow-sm ring-0">
        <CardContent className="max-w-none space-y-5 pt-6 text-sm leading-relaxed text-foreground sm:text-[0.9375rem] sm:leading-relaxed">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
          <p>
            Diabeaters is a lifestyle organisation app for people living with Type 1 diabetes. This page explains what
            data we collect, why we collect it, and the choices you have.
          </p>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Data we collect</h2>
            <ul className="list-disc space-y-3 pl-5 marker:text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">Account email</span>
                <span className="text-muted-foreground"> — </span>
                used for sign-in and account communication (stored by Supabase Auth).
              </li>
              <li>
                <span className="font-semibold text-foreground">Profile details</span>
                <span className="text-muted-foreground"> — </span>
                optional name/avatar and other settings you choose to set.
              </li>
              <li>
                <span className="font-semibold text-foreground">App data you enter</span>
                <span className="text-muted-foreground"> — </span>
                for example supplies, routines, ratios, scenario settings, and notes.
              </li>
              <li>
                <span className="font-semibold text-foreground">Health-related data you choose to enter</span>
                <span className="text-muted-foreground"> — </span>
                e.g. blood glucose units, insulin ratios, correction factors, sick-day notes, or exercise-related entries.
                This may be <span className="font-semibold text-foreground">special category data</span> under UK GDPR /
                EU GDPR Article 9 when it concerns your health.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Purpose</h2>
            <p>
              We use your data to provide the features you use in the app (tracking, planning, and optional educational
              tools). We do not sell your data or share it for marketing.
            </p>
            <p>
              Where we process health-related information you provide, we do so because you choose to use these tools and
              provide the information. Diabeaters is not medical advice and does not replace your healthcare team.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Retention</h2>
            <p>Your data is retained until you delete it or request account deletion.</p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Your choices</h2>
            <ul className="list-disc space-y-3 pl-5 marker:text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">Update or delete your data</span>
                <span className="text-muted-foreground">: </span>
                use in-app settings where available, or contact support.
              </li>
              <li>
                <span className="font-semibold text-foreground">Request account deletion</span>
                <span className="text-muted-foreground">: </span>
                contact support and include the email address on your account.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Cookies and storage</h2>
            <p>We use cookies/session storage only for authentication and core app functionality. No cross-site tracking.</p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Service providers</h2>
            <ul className="list-disc space-y-3 pl-5 marker:text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">Supabase</span>
                <span className="text-muted-foreground"> — </span>
                authentication and database hosting for data you store in the app.
              </li>
              <li>
                <span className="font-semibold text-foreground">Optional providers</span>
                <span className="text-muted-foreground"> — </span>
                some deployments may enable optional features (e.g. content generation or news fetching). If enabled,
                only the minimum required data is sent to provide that feature.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Contact</h2>
            <p>
              For privacy questions or deletion requests:{" "}
              {supportEmail ? (
                <a href={`mailto:${supportEmail}`} className="font-medium text-primary underline underline-offset-2">
                  {supportEmail}
                </a>
              ) : (
                <span className="text-muted-foreground">
                  configure <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">VITE_SUPPORT_EMAIL</code> in
                  your deployment environment
                </span>
              )}
            </p>
          </section>

          <section id="terms" className="scroll-mt-20 space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Terms of use (summary)</h2>
            <p>
              Diabeaters is a personal lifestyle aid. It is not medical advice, diagnosis, or treatment. Always follow your
              healthcare team. The app is provided “as is” without warranties; you remain responsible for decisions you
              make.
            </p>
          </section>
        </CardContent>
      </Card>
    </PageShell>
  );
}
