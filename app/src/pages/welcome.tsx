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
        <div className="flex flex-col items-center gap-4 pt-4">
          <FaceLogo size={72} />
          <div className="space-y-2 text-center">
            <h1 className="text-balance font-display text-4xl font-bold tracking-tight">
              Who is this for?
            </h1>
            <p className="text-pretty text-base leading-relaxed text-muted-foreground">
              Choose one to get started — you can change later in Account.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onPatient}
            className={cn(
              "pressable group flex min-h-[5.5rem] w-full items-center gap-3.5 rounded-[1.35rem] border border-primary/25 bg-gradient-to-b from-primary/[0.10] via-card to-card px-4 py-4 text-left shadow-sm",
              "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="welcome-patient"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Users className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-foreground">For me (Type 1)</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Your dashboard, meals, travel, hypos
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-primary/70 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onSupporter}
            className={cn(
              "pressable group flex min-h-14 w-full items-center gap-3 rounded-[1.35rem] border border-border/70 bg-card/60 px-4 py-3.5 text-left",
              "active:scale-[0.99] hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="welcome-supporter"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <HeartHandshake className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">For someone I support</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                You&apos;ll need their invite code
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onCommunityMember}
            className={cn(
              "pressable group flex min-h-14 w-full items-center gap-3 rounded-[1.35rem] border border-border/70 bg-card/60 px-4 py-3.5 text-left",
              "active:scale-[0.99] hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="welcome-community"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Eye className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">Just exploring / community</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Feed and learning — not full clinical tools
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onBoth}
            className={cn(
              "pressable group flex min-h-12 w-full items-center gap-3 rounded-[1.25rem] border border-dashed border-border/80 bg-transparent px-4 py-3 text-left",
              "active:scale-[0.99] hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="welcome-both"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">Both — Type 1 and I support someone</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Start with your tools; link a supporter later
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
          </button>
        </div>

        <p className="mt-5 px-1 text-center text-xs leading-relaxed text-muted-foreground" data-testid="welcome-not-sure">
          Not sure? If you live with Type 1 day to day, choose <span className="font-medium text-foreground">For me</span>.
          If you only help someone else, choose supporter.
        </p>

        <div className="mt-auto space-y-3 pt-8">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl text-base font-semibold"
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
