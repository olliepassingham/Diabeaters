import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaceLogo } from "@/components/face-logo";

export default function Support() {
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
            <CardTitle>Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p>
              Contact us: <em>[support@example.com – replace with your support email]</em>
            </p>

            <h2 className="text-base font-semibold">FAQ</h2>
            <p className="text-xs text-muted-foreground">
              <a href="#login" className="underline">Login</a> · <a href="#password" className="underline">Password</a> · <a href="#deletion" className="underline">Deletion</a>
            </p>
            <div className="space-y-4 text-sm">
              <div id="login">
                <span className="font-medium">Login issues</span>
                <p className="mt-1 text-muted-foreground">
                  Ensure your email and password are correct. If you have forgotten your password, use the reset link on the login screen.
                </p>
              </div>
              <div id="password">
                <span className="font-medium">Resetting your password</span>
                <p className="mt-1 text-muted-foreground">
                  Use the “Forgot password?” link on the login page. You will receive an email with a reset link.
                </p>
              </div>
              <div id="deletion">
                <span className="font-medium">Data deletion</span>
                <p className="mt-1 text-muted-foreground">
                  Email us at the support address above with your account email. We will process deletion requests within a reasonable period.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
