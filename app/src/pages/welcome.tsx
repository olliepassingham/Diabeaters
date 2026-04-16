import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { FaceLogo } from "@/components/face-logo";
import { setPendingCarer, setPendingPatient, setPrimaryAppRole } from "@/lib/carer-session";
import { useAuth } from "@/lib/auth-context";
import { isUserVerified } from "@/lib/auth";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const alreadySignedIn = Boolean(user?.id && isUserVerified(user));

  const onPatient = () => {
    setPrimaryAppRole("patient");
    setPendingPatient();
    setLocation(alreadySignedIn ? "/onboarding" : "/login");
  };

  const onSupporter = () => {
    setPrimaryAppRole("carer");
    setPendingCarer();
    setLocation(alreadySignedIn ? "/carer-setup" : "/login");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-background text-foreground">
      <div className="flex flex-col items-center gap-3 mb-10">
        <FaceLogo size={56} />
        <h1 className="text-2xl font-semibold tracking-tight text-center">Welcome to Diabeaters</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Tell us how you will use the app so we can show you the right next step.
        </p>
      </div>
      <div className="w-full max-w-md flex flex-col gap-4">
        <Button
          size="lg"
          className="w-full h-auto min-h-14 py-4 text-base font-medium"
          onClick={onPatient}
          data-testid="welcome-patient"
        >
          I have Type 1 Diabetes
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full h-auto min-h-14 py-4 text-base font-medium"
          onClick={onSupporter}
          data-testid="welcome-supporter"
        >
          I am a Family Member / Supporter
        </Button>
      </div>
    </div>
  );
}
