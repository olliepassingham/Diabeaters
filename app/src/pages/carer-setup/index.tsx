import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  redeemInvite,
  fetchPatientProfileForCarer,
  getLinkedPatientForCarer,
} from "@/lib/carers";
import { getSupabase } from "@/lib/supabase";
import {
  clearCarerIntent,
  clearPendingCarer,
  hasPendingCarer,
  getPrimaryAppRole,
  setActiveAppMode,
  setCarerLinkedBannerMessage,
  markCarerLinkJustCompleted,
  setPrimaryAppRole,
} from "@/lib/carer-session";
// Note: we intentionally avoid PageBackButton (history.back) here; we need a safe fallback.
import { ChevronLeft, Info } from "lucide-react";

function emitCarerLinkUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent("diabeater:carer-link-updated"));
  } catch {
    // ignore
  }
}

export default function CarerSetupPage() {
  const { user, loading: authLoading } = useAuth();
  const configured = Boolean(getSupabase());
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  /** Drop stale carer intent from older builds that set it on every visit; keep Welcome "carer" signup (pending) intact. */
  useEffect(() => {
    if (!user) return;
    if (hasPendingCarer()) return;
    clearCarerIntent();
  }, [user]);

  const handleBack = () => {
    // When Supporter setup is opened from inside the app (e.g. Account → Manage supporters),
    // a stale carer intent can leave the /family-carers gate rendering null on history back (white screen).
    // Explicitly clear intent and return to a safe destination.
    if (!user) {
      setLocation("/welcome");
      return;
    }
    if (hasPendingCarer()) {
      setLocation("/welcome");
      return;
    }
    clearCarerIntent();
    setCode("");
    setLocation("/family-carers");
  };

  async function handleRedeem(e: FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast({
        title: "Not configured",
        description: "Supabase is not available in this build.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    const { data, error } = await redeemInvite(code);
    setBusy(false);
    if (error || !data) {
      // If the link was created but the invite is now marked used (or duplicate link),
      // send the supporter straight into Supporter Mode.
      const msg = (error?.message ?? "").toLowerCase();
      const mightBeAlreadyLinked =
        msg.includes("already linked") ||
        msg.includes("already used") ||
        msg.includes("duplicate") ||
        msg.includes("used");
      if (mightBeAlreadyLinked) {
        const link = await getLinkedPatientForCarer();
        if (link.data?.patientId) {
          clearPendingCarer();
          clearCarerIntent();
          if (getPrimaryAppRole() == null) setPrimaryAppRole("carer");
          setActiveAppMode("carer");
          markCarerLinkJustCompleted();
          emitCarerLinkUpdated();
          setCode("");
          toast({
            title: "Linked already",
            description: "You're already linked. Opening Supporter Mode.",
          });
          setLocation("/carer-view");
          return;
        }
      }
      toast({
        title: "Could not redeem invite",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    const prof = await fetchPatientProfileForCarer(data.patientId);
    const name =
      prof.data?.full_name?.trim() ||
      "the person you support";
    setCarerLinkedBannerMessage(name);
    try {
      localStorage.setItem("diabeater_carer_onboarded", "true");
    } catch {
      // Ignore
    }
    clearPendingCarer();
    clearCarerIntent();
    if (getPrimaryAppRole() == null) {
      setPrimaryAppRole("carer");
    }
    setActiveAppMode("carer");
    markCarerLinkJustCompleted();
    emitCarerLinkUpdated();
    setCode("");
    toast({
      title: "Linked successfully",
      description: `You're now linked to ${name}. Open Supporter Mode to see their read-only information.`,
    });
    setLocation("/carer-view");
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm bg-background">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background text-foreground">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Family &amp; Supporter Access</CardTitle>
            <CardDescription>
              If you are supporting someone using Diabeaters, sign in or create an account, then enter the invite code
              they shared with you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" asChild>
              <Link href="/login?next=/carer-setup">Log in</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/signup?next=/carer-setup">Create an account</Link>
            </Button>
            <p className="text-xs text-muted-foreground text-center pt-2">
              <Link href="/login">
                <span className="underline cursor-pointer">Back to standard sign-in</span>
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-background text-foreground">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center -ml-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mr-2"
            aria-label="Go back"
            onClick={handleBack}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Family &amp; Supporter Access</CardTitle>
            <CardDescription>
              If you are supporting someone using Diabeaters, enter the invite code they shared with you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!configured && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>Cloud linking is not configured in this build.</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleRedeem} className="space-y-4" data-testid="carer-setup-redeem-form">
              <div className="space-y-2">
                <Label htmlFor="carer-setup-code">Invite code</Label>
                <Input
                  id="carer-setup-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AB12CD34"
                  autoComplete="off"
                  className="font-mono tracking-wider"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || !code.trim() || !configured}>
                {busy ? "Redeeming…" : "Redeem invite"}
              </Button>
            </form>
            <p className="text-xs text-center text-muted-foreground">
              After redeeming you will open read-only Supporter Mode for that person.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
