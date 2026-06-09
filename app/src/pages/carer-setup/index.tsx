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
import { markSupporterPushPromptPending } from "@/lib/supporter-push-prompt";
import { markSupporterCarerOnboarded } from "@/lib/supporter-profile-prompt";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// Note: we intentionally avoid PageBackButton (history.back) here; we need a safe fallback.
import { Bell, ChevronDown, ChevronLeft, Eye, Info, Link2, Users } from "lucide-react";

const PATIENT_INVITE_INSTRUCTIONS = `To link me as your supporter in Diabeaters:
1. Open Account → Family & supporters
2. Tap Generate invite
3. Send me the code (it expires in 7 days)`;

function SupporterHowToGetCodeList() {
  return (
    <ol className="list-decimal space-y-2.5 pl-4 text-sm leading-relaxed text-muted-foreground">
      <li>
        Ask them to open{" "}
        <span className="font-medium text-foreground">Account → Family &amp; supporters</span> in Diabeaters on their
        device.
      </li>
      <li>
        They tap <span className="font-medium text-foreground">Generate invite</span> and send you the code by text,
        WhatsApp, or another private message. Codes expire after 7 days.
      </li>
      <li>
        Enter the code here and tap <span className="font-medium text-foreground">Redeem invite</span>.
      </li>
    </ol>
  );
}

function SupporterAfterLinkList() {
  return (
    <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
      <li className="flex gap-2">
        <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
        <span>
          <span className="font-medium text-foreground">Read-only Supporter Mode</span> — dashboard essentials they choose
          to share.
        </span>
      </li>
      <li className="flex gap-2">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
        <span>Optional alerts for hypos, appointments, and supplies when they allow it.</span>
      </li>
      <li className="flex gap-2">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
        <span>Switch between your own account and Supporter Mode anytime from the app menu.</span>
      </li>
    </ul>
  );
}

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
  const [howToOpen, setHowToOpen] = useState(() => hasPendingCarer());

  async function copyPatientInstructions() {
    try {
      await navigator.clipboard.writeText(PATIENT_INVITE_INSTRUCTIONS);
      toast({
        title: "Instructions copied",
        description: "Paste into a message to the person you support.",
      });
    } catch {
      toast({
        title: "Could not copy",
        description: "Select and copy the steps manually.",
        variant: "destructive",
      });
    }
  }

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
    markSupporterCarerOnboarded();
    clearPendingCarer();
    clearCarerIntent();
    if (getPrimaryAppRole() == null) {
      setPrimaryAppRole("carer");
    }
    setActiveAppMode("carer");
    markCarerLinkJustCompleted();
    markSupporterPushPromptPending();
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
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <Card className="w-full rounded-2xl border-border/60 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Users className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl">Family &amp; Supporter Access</CardTitle>
              </div>
            </div>
            <CardDescription>
              Link to someone with Type 1 diabetes using a private invite code from their Diabeaters account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3 space-y-2">
              <p className="text-sm font-medium text-foreground">How linking works</p>
              <SupporterHowToGetCodeList />
            </div>
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-8 sm:py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <div className="w-full space-y-4">
          <div className="flex items-center -ml-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mr-2 rounded-xl"
              aria-label="Go back"
              onClick={handleBack}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
          <Card className="w-full rounded-2xl border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Family &amp; Supporter Access</CardTitle>
              <CardDescription>
                Enter the invite code from the person you support. They generate it in their Diabeaters app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!configured && (
                <Alert className="rounded-2xl border-border/60">
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

              <Collapsible open={howToOpen} onOpenChange={setHowToOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-between gap-2 rounded-xl px-3 py-2.5 text-left font-normal"
                    data-testid="carer-setup-how-to-toggle"
                  >
                    <span className="text-sm font-medium text-foreground">Don&apos;t have a code yet?</span>
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", howToOpen && "rotate-180")}
                      aria-hidden
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-1">
                  <SupporterHowToGetCodeList />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => void copyPatientInstructions()}
                    data-testid="carer-setup-copy-instructions"
                  >
                    Copy instructions to send them
                  </Button>
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-2 border-t border-border/50 pt-4">
                <p className="text-sm font-medium text-foreground">After you link</p>
                <SupporterAfterLinkList />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
