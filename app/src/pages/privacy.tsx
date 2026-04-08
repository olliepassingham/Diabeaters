import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaceLogo } from "@/components/face-logo";
import { getSupportEmail } from "@/lib/support";

export default function Privacy() {
  const supportEmail = getSupportEmail();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="p-4 border-b">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80">
            <FaceLogo size={40} />
            <span className="font-semibold text-xl">Diabeaters</span>
          </div>
        </Link>
      </header>
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <p>
              Diabeaters is a lifestyle organisation app for people living with Type 1 diabetes.
              This policy describes how we handle your data.
            </p>

            <h2 className="text-base font-semibold mt-6">Data we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Email</strong> – For account creation and sign-in, stored by Supabase Auth.</li>
              <li><strong>Profile name</strong> – Optional, user-supplied for personalisation.</li>
              <li><strong>Supplies data</strong> – Names, quantities and usage you enter. Stored in Supabase, scoped to your account via row-level security (RLS).</li>
              <li>
                <strong>Health-related data you choose to enter</strong> – For example blood glucose units, insulin ratios, correction factors, sick-day notes, or journal entries.
                This may be <strong>special category data</strong> under UK GDPR / EU GDPR Article 9 when it concerns your health.
              </li>
            </ul>

            <h2 className="text-base font-semibold mt-6">Purpose and lawful basis</h2>
            <p>
              Data is used for lifestyle organisation: tracking supplies, routines, preparedness, and optional educational tools you use in the app.
              We do not sell or share your data with third parties for marketing.
            </p>
            <p className="mt-2">
              Where we process health-related information you provide, we rely on your <strong>explicit consent</strong> at sign-up / in-app disclosures and on{" "}
              <strong>performance of a service you request</strong>, as appropriate for an app you choose to use to manage your diabetes-related information.
              Your team remains responsible for medical decisions; the app does not replace them.
            </p>

            <h2 className="text-base font-semibold mt-6">Retention</h2>
            <p>
              Your data remains until you request deletion. Session and auth cookies are used only to keep you signed in.
            </p>

            <h2 className="text-base font-semibold mt-6">Deletion</h2>
            <p>
              To request account and data deletion, contact us at the support email below or use the in-app instructions in Settings.
            </p>

            <h2 className="text-base font-semibold mt-6">Cookies and storage</h2>
            <p>
              We use cookies and session storage only for authentication. No tracking across apps or sites.
            </p>

            <h2 className="text-base font-semibold mt-6">Subprocessors and third parties</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Supabase</strong> – Authentication and database hosting for account data you store in the app. See Supabase&apos;s privacy policy for their processing.
              </li>
              <li>
                <strong>OpenAI</strong> – Used <strong>only</strong> if your deployment enables the optional activity-advice API (<code className="text-xs">ENABLE_ACTIVITY_ADVICE</code>).
                If enabled, limited profile and settings text may be sent to OpenAI to generate educational wording. Not used in the default configuration.
              </li>
              <li>
                <strong>NewsAPI.org</strong> – Used <strong>only</strong> if <code className="text-xs">NEWS_API_KEY</code> is set on the server to fetch headline articles; otherwise the app uses static curated links.
              </li>
            </ul>

            <h2 className="text-base font-semibold mt-6">Contact</h2>
            <p>
              For questions or deletion requests:{" "}
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
              Terms of use
            </h2>
            <p>
              By using Diabeaters you agree to use it as a personal lifestyle aid only. It is not medical advice,
              diagnosis, or treatment. Always follow your healthcare team. The app is provided &quot;as is&quot; without
              warranties; we are not liable for decisions you make based on app content.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
