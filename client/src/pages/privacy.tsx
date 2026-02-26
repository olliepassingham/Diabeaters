import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaceLogo } from "@/components/face-logo";

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col">
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
            </ul>

            <h2 className="text-base font-semibold mt-6">Purpose</h2>
            <p>
              Data is used solely for lifestyle organisation: tracking supplies, routines, and preparedness.
              We do not sell or share your data with third parties for marketing.
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

            <h2 className="text-base font-semibold mt-6">Third parties</h2>
            <p>
              Supabase provides auth and database hosting. Their privacy policy applies to data processed by their services.
            </p>

            <h2 className="text-base font-semibold mt-6">Contact</h2>
            <p>
              For questions or deletion requests: <em>[Contact email – replace with your support address]</em>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
