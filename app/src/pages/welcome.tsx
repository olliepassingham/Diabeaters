import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { FaceLogo } from "@/components/face-logo";
import { Card, CardContent } from "@/components/ui/card";
import {
  clearOnboardingAccountPath,
  setActiveAppMode,
  setOnboardingAccountPath,
  setPendingCarer,
  setPendingCommunity,
  setPendingPatient,
  setPrimaryAppRole,
} from "@/lib/carer-session";
import { finalizeCommunityMemberSession } from "@/lib/community-member-session";
import { resolveCommunityMemberLandingPath } from "@/lib/community-landing";
import { useAuth } from "@/lib/auth-context";
import { isUserVerified } from "@/lib/auth";
import { reconcileWrongWelcomePathForSignedInUser } from "@/lib/welcome-path-reconcile";
import { ArrowRight, Eye, HeartHandshake, Users } from "lucide-react";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const alreadySignedIn = Boolean(user?.id && isUserVerified(user));

  async function reconcileSignedInWrongPath(): Promise<boolean> {
    if (!user?.id) return false;
    const result = await reconcileWrongWelcomePathForSignedInUser(user.id);
    if (result.reconciled && result.destination) {
      setLocation(result.destination);
      return true;
    }
    return false;
  }

  /** First-time path → create account. Returning users use the Log in button below. */
  const goCreateAccount = () => setLocation("/signup");

  const onPatient = () => {
    clearOnboardingAccountPath();
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    setPendingPatient();
    if (alreadySignedIn && user?.id) {
      void (async () => {
        if (await reconcileSignedInWrongPath()) return;
        setLocation("/onboarding");
      })();
      return;
    }
    goCreateAccount();
  };

  const onSupporter = () => {
    clearOnboardingAccountPath();
    setOnboardingAccountPath("supporter");
    setPrimaryAppRole("carer");
    setPendingCarer();
    setLocation(alreadySignedIn ? "/carer-setup" : "/signup");
  };

  const onCommunityMember = () => {
    clearOnboardingAccountPath();
    setOnboardingAccountPath("community");
    setPrimaryAppRole("community");
    setPendingCommunity();
    if (alreadySignedIn && user?.id) {
      void (async () => {
        if (await reconcileSignedInWrongPath()) return;
        await finalizeCommunityMemberSession(user.id);
        setActiveAppMode("community");
        setLocation(await resolveCommunityMemberLandingPath(user.id));
      })();
      return;
    }
    goCreateAccount();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <div className="flex flex-col items-center gap-3 pt-2">
          <FaceLogo size={64} />
          <h1 className="text-balance text-center font-display text-3xl font-bold tracking-tight">
            Welcome to Diabeaters
          </h1>
          <p className="max-w-sm text-pretty text-center text-base leading-relaxed text-muted-foreground">
            New here? Pick how you&apos;ll use the app, then create your account.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Get started
          </p>
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <button
                type="button"
                onClick={onPatient}
                className="pressable w-full text-left"
                data-testid="welcome-patient"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-primary/10 p-2.5">
                    <Users className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-foreground">I have Type 1 diabetes</div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Full tools: supplies, meal planner, situation guides, and a personalised dashboard.
                    </p>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <button
                type="button"
                onClick={onSupporter}
                className="pressable w-full text-left"
                data-testid="welcome-supporter"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-blue-500/10 p-2.5 dark:bg-blue-500/20">
                    <HeartHandshake className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-foreground">I’m a supporter</div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Link to someone with Type 1 for read‑only views, alerts, and essentials.
                    </p>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <button
                type="button"
                onClick={onCommunityMember}
                className="pressable w-full text-left"
                data-testid="welcome-community"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-emerald-500/10 p-2.5 dark:bg-emerald-500/20">
                    <Eye className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-foreground">Community Member</div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Learn and explore: education, tips, coach, and the feed.
                    </p>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-auto space-y-3 pt-8">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full rounded-xl text-base font-semibold"
            onClick={() => {
              clearOnboardingAccountPath();
              setLocation("/login");
            }}
            data-testid="welcome-login"
          >
            Already have an account? Log in
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Creating an account takes about a minute.
          </p>
        </div>
      </div>
    </div>
  );
}
