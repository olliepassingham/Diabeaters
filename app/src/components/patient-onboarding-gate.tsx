import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getProfile } from "@/lib/profile";
import {
  getOnboardingAccountPath,
  getPrimaryAppRole,
  hasCarerIntent,
  hasPendingCarer,
  onboardingAccountPathFromUserMetadata,
  setActiveAppMode,
} from "@/lib/carer-session";
import Onboarding from "@/pages/onboarding";
import { getPostOnboardingPath } from "@/lib/onboarding-routes";
import { getCommunityMemberLandingPath } from "@/lib/community-landing";
import {
  ensureCommunityMemberSessionReady,
  resolvesAsCommunityMemberAccount,
  shouldUseCommunityMemberSession,
} from "@/lib/community-member-session";
import { isPatientUpgradeOnboarding } from "@/lib/patient-upgrade-onboarding";
import { reconcileWrongWelcomePathForSignedInUser } from "@/lib/welcome-path-reconcile";

type PatientOnboardingGateProps = {
  onPatientComplete: () => void;
};

export function PatientOnboardingGate({ onPatientComplete }: PatientOnboardingGateProps) {
  const { user, loading: authLoading } = useAuth();
  const { isCarer, loading: carerLoading } = useLinkedCarer();
  const [, setLocation] = useLocation();
  const [ready, setReady] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (authLoading || carerLoading) return;
      if (!user?.id) {
        setLocation("/welcome");
        return;
      }

      const upgradeWizard = isPatientUpgradeOnboarding(
        typeof window !== "undefined" ? window.location.search : "",
      );
      if (upgradeWizard) {
        setShowWizard(true);
        setReady(true);
        return;
      }

      const accountPath = getOnboardingAccountPath();
      const shouldSkipPatientOnboardingForCarerFlow =
        accountPath !== "both" && (isCarer || hasCarerIntent() || hasPendingCarer());

      if (shouldSkipPatientOnboardingForCarerFlow) {
        setLocation("/carer-setup");
        return;
      }

      const { profile } = await getProfile(user.id);
      if (cancelled) return;

      // Durable signup-time signal — catches accounts whose session storage was lost
      // between choosing Community Member on /welcome and finishing email verification.
      const metadataAccountPath = onboardingAccountPathFromUserMetadata(user);

      if (
        resolvesAsCommunityMemberAccount({
          profile,
          linkedCarer: isCarer,
          primaryAppRole: getPrimaryAppRole(),
          metadataAccountPath,
        }) ||
        shouldUseCommunityMemberSession(profile, metadataAccountPath) ||
        accountPath === "community" ||
        metadataAccountPath === "community"
      ) {
        await ensureCommunityMemberSessionReady(user.id, { metadataAccountPath });
        setActiveAppMode("community");
        setLocation(getCommunityMemberLandingPath());
        return;
      }

      if (getPrimaryAppRole() === null) {
        setLocation("/welcome");
        return;
      }
      const wrongPath = await reconcileWrongWelcomePathForSignedInUser(user.id);
      if (cancelled) return;
      if (wrongPath.reconciled && wrongPath.destination) {
        setLocation(wrongPath.destination);
        return;
      }

      const done =
        profile?.onboarding_complete === true ||
        (typeof localStorage !== "undefined" && localStorage.getItem("diabeater_onboarding_completed") === "true");
      if (done) {
        setLocation("/");
        return;
      }
      setShowWizard(true);
      setReady(true);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, carerLoading, user?.id, isCarer, setLocation]);

  if (authLoading || carerLoading || !ready || !showWizard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <Onboarding
      onComplete={(pathOverride) => {
        onPatientComplete();
        const struggle = localStorage.getItem("diabeater_onboarding_struggle");
        setLocation(pathOverride ?? getPostOnboardingPath(struggle));
      }}
    />
  );
}
