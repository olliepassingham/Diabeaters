import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { fetchPatientProfileForCarer } from "@/lib/carers";
import { getSupabase } from "@/lib/supabase";
import { profileQueryKey, updateProfile, useProfile } from "@/lib/profile";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getPrimaryAppRole, hasPendingCarer } from "@/lib/carer-session";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { User, Mail, Users, Save, Settings, ChevronLeft } from "lucide-react";

/**
 * Dedicated screen for supporters to set their display name and see sign-in details.
 * Supporter-only accounts have no patient profile flow, so this is the primary place to enter a name.
 */
export default function SupporterProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { linked, loading: linkLoading } = useLinkedCarer();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile: cloudProfile, refresh } = useProfile();
  const [displayName, setDisplayName] = useState("");
  const [supportedName, setSupportedName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fromCloud = cloudProfile?.full_name?.trim();
    const fromMeta =
      typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    setDisplayName((prev) => {
      if (prev.trim()) return prev;
      if (fromCloud) return fromCloud;
      if (fromMeta) return fromMeta;
      return "";
    });
  }, [cloudProfile?.full_name, user?.user_metadata]);

  useEffect(() => {
    if (!linked?.patientId) return;
    let cancelled = false;
    void (async () => {
      const prof = await fetchPatientProfileForCarer(linked.patientId);
      if (cancelled) return;
      const n = prof.data?.full_name?.trim() || null;
      setSupportedName(n);
    })();
    return () => {
      cancelled = true;
    };
  }, [linked?.patientId]);

  const email = user?.email?.trim() || "";
  const primaryRole = getPrimaryAppRole();
  const loading = authLoading || linkLoading;

  const handleSave = async () => {
    if (!user?.id || !getSupabase()) {
      toast({
        title: "Cannot save",
        description: "Sign in again or check your connection.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await updateProfile({
      id: user.id,
      full_name: displayName.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({
        title: "Could not save",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
    void refresh();
    toast({
      title: "Saved",
      description: "Your supporter name has been updated.",
    });
  };

  if (!authLoading && !user) {
    return <Redirect to="/welcome" replace />;
  }

  if (!loading && user && !linked) {
    if (getPrimaryAppRole() === "carer" || hasPendingCarer()) {
      return <Redirect to="/carer-setup" replace />;
    }
    return <Redirect to="/" replace />;
  }

  if (loading || !linked) {
    return (
      <PageShell variant="standard" className="relative flex min-h-[40vh] items-center justify-center bg-muted/20">
        <FaceLogoWatermark />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageShell>
    );
  }

  return (
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <div className="flex items-center -ml-2">
        <Button variant="ghost" size="icon" className="mr-2 shrink-0" asChild aria-label="Back to Supporter Mode">
          <Link href="/carer-view">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
      </div>
      <PageHeader
        className="mb-2"
        title="Supporter profile"
        description="How you appear to the person you support, and how you sign in."
      />

      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-h3 font-semibold">Your name</CardTitle>
          </div>
          <CardDescription>
            This is saved to your Diabeaters profile and may appear in Family &amp; supporters lists and notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supporter-display-name">Display name</Label>
            <Input
              id="supporter-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sam Taylor"
              autoComplete="name"
              data-testid="supporter-profile-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supporter-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
              Email
            </Label>
            <Input
              id="supporter-email"
              value={email}
              readOnly
              disabled
              className="bg-muted/50 text-muted-foreground"
              data-testid="supporter-profile-email"
            />
            <p className="text-xs text-muted-foreground">
              To change your sign-in email, use your provider (Apple, Google, etc.) or contact support.
            </p>
          </div>
          {primaryRole === "carer" ? (
            <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              You registered as a <span className="font-medium text-foreground">supporter</span>. Diabetes tracking and
              clinical tools belong to the person you support; this screen is where you set how your own name appears.
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="min-h-11" asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving} className="min-h-11" data-testid="supporter-profile-save">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving…" : "Save name"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-h3 font-semibold">Supporting</CardTitle>
          </div>
          <CardDescription>Read-only access through Diabeaters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Linked to: </span>
            <span className="font-medium text-foreground">{supportedName ?? "Linked person"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            To change or remove this link, ask them to update Family &amp; supporters on their device.
          </p>
          <Button variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" asChild>
            <Link href="/carer-view" data-testid="supporter-profile-open-mode">
              Open Supporter Mode
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40">
        <CardHeader>
          <CardTitle className="text-base font-semibold">More</CardTitle>
          <CardDescription>Sign out, password, and account deletion.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="min-h-11 w-full sm:w-auto" asChild>
            <Link href="/account" data-testid="supporter-profile-full-account">
              Account &amp; security
            </Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
