import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { FaceLogo } from "@/components/face-logo";
import { cn } from "@/lib/utils";
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

const primaryChoiceClass = cn(
  "pressable group flex w-full items-center gap-3.5 rounded-[1.35rem] border border-border/80 bg-card px-4 py-4 text-left shadow-sm",
  "active:scale-[0.99] hover:border-primary/35 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

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

  const goPatientOnboarding = () => {
    if (alreadySignedIn && user?.id) {
      void (async () => {
        if (await reconcileSignedInWrongPath()) return;
        setLocation("/onboarding");
      })();
      return;
    }
    goCreateAccount();
  };

  const onPatient = () => {
    clearOnboardingAccountPath();
    setOnboardingAccountPath("patient");
    setPrimaryAppRole("patient");
    setPendingPatient();
    goPatientOnboarding();
  };

  const onType2 = () => {
    clearOnboardingAccountPath();
    setOnboardingAccountPath("type2");
    setPrimaryAppRole("patient");
    setPendingPatient();
    goPatientOnboarding();
  };

  const onSupporter = () => {
    clearOnboardingAccountPath();
    setOnboardingAccountPath("supporter");
    setPrimaryAppRole("carer");
    setPendingCarer();
    setLocation(alreadySignedIn ? "/community/setup" : "/signup");
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
    // Scroll the whole welcome flow so Display Zoom / large text can still reach every option.
    <div className="h-dvh max-h-dvh overflow-y-auto overscroll-y-contain bg-background text-foreground [-webkit-overflow-scrolling:touch]">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <div className="flex shrink-0 flex-col items-center gap-3 pt-2 sm:gap-4 sm:pt-4">
          <FaceLogo size={64} />
          <div className="space-y-2 text-center">
            <h1 className="text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Who is this for?
            </h1>
            <p className="text-pretty text-base leading-relaxed text-muted-foreground">
              One choice to get started.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:mt-10">
          <button
            type="button"
            onClick={onPatient}
            className={primaryChoiceClass}
            data-testid="welcome-patient"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground">
              Type 1
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onType2}
            className={primaryChoiceClass}
            data-testid="welcome-type2"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground">
              Type 2
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onSupporter}
            className={primaryChoiceClass}
            data-testid="welcome-supporter"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <HeartHandshake className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug text-foreground">
                I support someone
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                With Type 1
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onCommunityMember}
            className={cn(
              primaryChoiceClass,
              "border-emerald-500/30 hover:border-emerald-500/45",
            )}
            data-testid="welcome-community"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Eye className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug text-foreground">Just exploring</span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                Feed and learning only
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-emerald-700/70 transition-transform group-hover:translate-x-0.5 dark:text-emerald-400/70" aria-hidden />
          </button>
        </div>

        <div className="mt-auto space-y-3 pt-10">
          <Button
            type="button"
            variant="outline"
            className="h-12 min-h-12 w-full rounded-xl text-base font-semibold"
            onClick={() => {
              clearOnboardingAccountPath();
              setLocation("/login");
            }}
            data-testid="welcome-login"
          >
            Already have an account? Log in
          </Button>
        </div>
      </div>
    </div>
  );
}
