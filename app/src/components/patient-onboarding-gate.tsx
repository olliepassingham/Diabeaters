import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getProfile } from "@/lib/profile";
import { hasCarerIntent, hasPendingCarer } from "@/lib/carer-session";
import Onboarding from "@/pages/onboarding";
import { getPostOnboardingPath } from "@/lib/onboarding-routes";

const ONBOARDING_LS = "diabeater_onboarding_completed";

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
      if (isCarer || hasCarerIntent() || hasPendingCarer()) {
        setLocation("/carer-setup");
        return;
      }
      const { profile } = await getProfile(user.id);
      if (cancelled) return;
      const done =
        profile?.onboarding_complete === true ||
        (typeof localStorage !== "undefined" && localStorage.getItem(ONBOARDING_LS) === "true");
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
