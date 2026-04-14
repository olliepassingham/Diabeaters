import { Card, CardContent } from "@/components/ui/card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { getSupportEmail } from "@/lib/support";

export default function Privacy() {
  const supportEmail = getSupportEmail();

  return (
    <PageShell variant="standard" className="min-h-screen">
      <PageHeader leading={<PageBackButton />} title="Privacy" description="How Diabeaters handles your data." />
      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4 pt-6">
          <p className="text-xs text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          <p>
            Diabeaters is a lifestyle organisation app for people living with Type 1 diabetes. This page explains what
            data we collect, why we collect it, and the choices you have.
          </p>

          <h2 className="text-base font-semibold mt-6">Data we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account email</strong> – used for sign-in and account communication (stored by Supabase Auth).
            </li>
            <li>
              <strong>Profile details</strong> – optional name/avatar and other settings you choose to set.
            </li>
            <li>
              <strong>App data you enter</strong> – for example supplies, routines, ratios, scenario settings, and notes.
            </li>
            <li>
              <strong>Health-related data you choose to enter</strong> – e.g. blood glucose units, insulin ratios,
              correction factors, sick-day notes, or exercise-related entries. This may be <strong>special category
              data</strong> under UK GDPR / EU GDPR Article 9 when it concerns your health.
            </li>
          </ul>

          <h2 className="text-base font-semibold mt-6">Purpose</h2>
          <p>
            We use your data to provide the features you use in the app (tracking, planning, and optional educational
            tools). We do not sell your data or share it for marketing.
          </p>
          <p className="mt-2">
            Where we process health-related information you provide, we do so because you choose to use these tools and
            provide the information. Diabeaters is not medical advice and does not replace your healthcare team.
          </p>

          <h2 className="text-base font-semibold mt-6">Retention</h2>
          <p>Your data is retained until you delete it or request account deletion.</p>

          <h2 className="text-base font-semibold mt-6">Your choices</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Update or delete your data</strong>: use in-app settings where available, or contact support.
            </li>
            <li>
              <strong>Request account deletion</strong>: contact support and include the email address on your account.
            </li>
          </ul>

          <h2 className="text-base font-semibold mt-6">Cookies and storage</h2>
          <p>We use cookies/session storage only for authentication and core app functionality. No cross-site tracking.</p>

          <h2 className="text-base font-semibold mt-6">Service providers</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Supabase</strong> – authentication and database hosting for data you store in the app.
            </li>
            <li>
              <strong>Optional providers</strong> – some deployments may enable optional features (e.g. content generation
              or news fetching). If enabled, only the minimum required data is sent to provide that feature.
            </li>
          </ul>

          <h2 className="text-base font-semibold mt-6">Contact</h2>
          <p>
            For privacy questions or deletion requests:{" "}
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`} className="text-primary underline underline-offset-2">
                {supportEmail}
              </a>
            ) : (
              <span className="text-muted-foreground">
                configure <code className="text-xs">VITE_SUPPORT_EMAIL</code> in your deployment environment
              </span>
            )}
          </p>

          <h2 id="terms" className="text-base font-semibold mt-6 scroll-mt-20">
            Terms of use (summary)
          </h2>
          <p>
            Diabeaters is a personal lifestyle aid. It is not medical advice, diagnosis, or treatment. Always follow your
            healthcare team. The app is provided “as is” without warranties; you remain responsible for decisions you
            make.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
