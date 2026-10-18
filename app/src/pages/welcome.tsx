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
import { ArrowRight, Eye, HeartHandshake, Sparkles, Users } from "lucide-react";

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

  const onBoth = () => {
    clearOnboardingAccountPath();
    setOnboardingAccountPath("both");
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
              Pick the option that matches you — Type 1 and Type 2 are different homes.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:mt-10">
          <button
            type="button"
            onClick={onPatient}
            className={cn(
              "pressable group flex w-full items-start gap-3.5 rounded-[1.35rem] border border-primary/25 bg-gradient-to-b from-primary/[0.10] via-card to-card px-4 py-3.5 text-left shadow-sm sm:items-center sm:py-4",
              "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="welcome-patient"
          >
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary sm:mt-0 sm:h-12 sm:w-12">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug text-foreground">For me — Type 1</span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                Insulin tools, meals, hypos, travel
              </span>
            </span>
            <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-primary/70 transition-transform group-hover:translate-x-0.5 sm:mt-0" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onType2}
            className={cn(
              "pressable group flex w-full items-start gap-3.5 rounded-[1.35rem] border border-teal-500/25 bg-gradient-to-b from-teal-500/[0.08] via-card to-card px-4 py-3.5 text-left shadow-sm sm:items-center sm:py-4",
              "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="welcome-type2"
          >
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-700 dark:text-teal-300 sm:mt-0 sm:h-12 sm:w-12">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug text-foreground">For me — Type 2</span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                Glucose, learning, community — not insulin dosing
              </span>
            </span>
            <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-teal-700/70 transition-transform group-hover:translate-x-0.5 dark:text-teal-300/70 sm:mt-0" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onSupporter}
            className={cn(
              "pressable group flex w-full items-start gap-3 rounded-[1.35rem] border border-border/70 bg-card/60 px-4 py-3.5 text-left sm:items-center",
              "active:scale-[0.99] hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="welcome-supporter"
          >
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 sm:mt-0 sm:h-11 sm:w-11">
              <HeartHandshake className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-snug text-foreground">
                I support someone with Type 1
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                See what they share — Type 1 only, not Type 2
              </span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 sm:mt-0" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onCommunityMember}
            className={cn(
              "pressable group flex w-full items-start gap-3 rounded-[1.35rem] border border-border/70 bg-card/60 px-4 py-3.5 text-left sm:items-center",
              "active:scale-[0.99] hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="welcome-community"
          >
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 sm:mt-0 sm:h-11 sm:w-11">
              <Eye className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-snug text-foreground">Just exploring / community</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground sm:text-sm">
                Feed and learning without a clinical home
              </span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 sm:mt-0" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onBoth}
            className={cn(
              "pressable group flex w-full items-start gap-3 rounded-[1.25rem] border border-dashed border-border/80 bg-transparent px-4 py-3 text-left sm:items-center",
              "active:scale-[0.99] hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="welcome-both"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground sm:mt-0">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-snug text-foreground">
                Type 1 and I support someone
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                Your Type 1 tools + link a supporter later
              </span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 sm:mt-0" aria-hidden />
          </button>
        </div>

        <p className="mt-5 px-1 text-center text-xs leading-relaxed text-muted-foreground" data-testid="welcome-not-sure">
          Not sure? Type 1 day to day → <span className="font-medium text-foreground">For me — Type 1</span>.
          Type 2 → <span className="font-medium text-foreground">For me — Type 2</span>.
          Only helping someone with Type 1 → supporter.
        </p>

        <div className="mt-auto space-y-3 pt-8">
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
