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
import { getCommunityMemberLandingPath } from "@/lib/community-landing";
import { finalizeCommunityMemberSession } from "@/lib/community-member-session";
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
    setLocation("/login");
  };

  const onSupporter = () => {
    clearOnboardingAccountPath();
    setOnboardingAccountPath("supporter");
    setPrimaryAppRole("carer");
    setPendingCarer();
    setLocation(alreadySignedIn ? "/carer-setup" : "/login");
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
        setLocation(getCommunityMemberLandingPath());
      })();
      return;
    }
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <div className="flex flex-col items-center gap-3 pt-2">
          <FaceLogo size={56} />
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-center">Welcome to Diabeaters</h1>
          <p className="text-pretty text-sm text-muted-foreground text-center max-w-sm">
            Choose a path. You can change later.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
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
                  <div className="mt-0.5 rounded-xl bg-blue-500/10 p-2.5">
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
                  <div className="mt-0.5 rounded-xl bg-emerald-500/10 p-2.5">
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

        <div className="mt-auto pt-8">
          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/login")}
          >
            Already have an account? Log in
          </Button>
        </div>
      </div>
    </div>
  );
}
