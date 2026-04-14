import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Copy, UserPlus, Shield, Info, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  createInvite,
  listInvites,
  listCarerLinksForPatient,
  removeCarer,
  updateScopes,
} from "@/lib/carers";
import type { CarerInviteRow, CarerLinkWithProfile, CarerScopes } from "@/lib/carers.types";
import { DEFAULT_CARER_SCOPES } from "@/lib/carers.types";
import { getSupabase } from "@/lib/supabase";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";
import { Link } from "wouter";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";

function AvatarBubble({
  label,
  initials,
  avatarUrl,
}: {
  label: string;
  initials: string;
  avatarUrl: string | null;
}) {
  const { displayUrl } = useResolvedProfileImageUrl(avatarUrl);
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary overflow-hidden"
      aria-label={`${label} avatar`}
    >
      {displayUrl ? <img src={displayUrl} alt="" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}

function aggregateScopes(links: CarerLinkWithProfile[]): CarerScopes {
  if (links.length === 0) return { ...DEFAULT_CARER_SCOPES };
  return links.reduce(
    (acc, l) => ({
      supplies: acc.supplies && l.scopes.supplies,
      appointments: acc.appointments && l.scopes.appointments,
      scenarios: acc.scenarios && l.scopes.scenarios,
      hypo_alerts: acc.hypo_alerts && l.scopes.hypo_alerts,
      emergency_info: acc.emergency_info && l.scopes.emergency_info,
    }),
    { ...DEFAULT_CARER_SCOPES },
  );
}

export default function FamilyCarersPage() {
  const configured = Boolean(getSupabase());
  const { toast } = useToast();
  const { data: emergency, syncGeneration } = useEmergencyProfile();
  const [links, setLinks] = useState<CarerLinkWithProfile[]>([]);
  const [invites, setInvites] = useState<CarerInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [latestCode, setLatestCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [lr, ir] = await Promise.all([listCarerLinksForPatient(), listInvites()]);
    if (lr.error) {
      toast({
        title: "Could not load carers",
        description: lr.error.message,
        variant: "destructive",
      });
      setLinks([]);
    } else {
      setLinks(lr.data ?? []);
    }
    if (ir.error) {
      setInvites([]);
    } else {
      setInvites(ir.data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const displayScopes = aggregateScopes(links);

  const handleGenerateInvite = async () => {
    setGenerating(true);
    const { data, error } = await createInvite();
    setGenerating(false);
    if (error || !data) {
      toast({
        title: "Could not create invite",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    setLatestCode(data);
    toast({
      title: "Invite ready",
      description: "Share this code with someone you trust. It expires in 7 days.",
    });
    await refresh();
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      toast({ title: "Code copied", description: "Send it through a channel you already use with that person." });
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Select and copy the code manually.", variant: "destructive" });
    }
  };

  const handleRemove = async (linkId: string) => {
    const { error } = await removeCarer(linkId);
    if (error) {
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Carer removed", description: "They can no longer open your shared view." });
    await refresh();
  };

  const applyPrivacyToAll = async (patch: Partial<CarerScopes>, key: string) => {
    if (links.length === 0) return;
    setPrivacyBusy(key);
    try {
      for (const link of links) {
        const { error } = await updateScopes(link.id, patch);
        if (error) throw error;
      }
      toast({
        title: "Privacy updated",
        description: "This applies to everyone you have linked for now.",
      });
      await refresh();
    } catch (e) {
      toast({
        title: "Could not update privacy",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setPrivacyBusy(null);
    }
  };

  const activeInvite = latestCode ?? invites[0] ?? null;

  return (
    <PageShell variant="standard" className="max-w-2xl space-y-6">
      <div className="flex items-center">
        <PageBackButton />
      </div>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2" data-testid="heading-family-carers">
            <Users className="h-7 w-7 text-primary shrink-0" />
            Family &amp; Carers
          </span>
        }
        description="Invite someone you trust to follow along. They only see what you allow — nothing here replaces professional care."
      />

      {!configured && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Cloud linking is not configured in this build. Add Supabase environment variables to use invites and shared
            views.
          </AlertDescription>
        </Alert>
      )}

      {/* A) Linked accounts (invite flow) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">People you have linked</CardTitle>
          <CardDescription>They can open a read-only view when they sign in with their own account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : links.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="carers-list-empty">
              No one is linked yet. Generate an invite code below and ask them to enter it in Carer setup (Account →
              Carer setup) on their device.
            </p>
          ) : (
            <ul className="space-y-3" data-testid="carers-list">
              {links.map((link) => {
                const label =
                  link.carer_full_name?.trim() ||
                  `Linked carer (${link.carerId.slice(0, 8)}…)`;
                const initials = label
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <li
                    key={link.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-gray-50/80 p-4 shadow-sm dark:bg-muted/40"
                    data-testid={`carer-row-${link.id}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AvatarBubble label={label} initials={initials} avatarUrl={link.carer_avatar_url ?? null} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          Linked {format(new Date(link.linkedAt), "d MMM yyyy")}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-gray-600"
                      onClick={() => handleRemove(link.id)}
                      aria-label={`Remove ${label} from linked carers`}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* B) Invite */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary shrink-0" />
            Invite someone
          </CardTitle>
          <CardDescription>Codes expire after 7 days. Each successful link starts with every view option on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            onClick={handleGenerateInvite}
            disabled={generating || !configured}
            data-testid="invite-generate"
            aria-label="Generate invite code"
          >
            {generating ? "Generating…" : "Generate invite"}
          </Button>

          {activeInvite && (
            <div className="rounded-xl border-0 bg-gray-50 p-5 space-y-3 shadow-sm dark:bg-muted/30">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Active code</p>
              <p className="font-mono text-2xl font-semibold tracking-widest" data-testid="invite-code">
                {activeInvite.code}
              </p>
              <p className="text-sm text-muted-foreground">
                Expires {format(new Date(activeInvite.expiresAt), "EEEE d MMMM yyyy, HH:mm")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                data-testid="invite-copy"
                onClick={() => handleCopyCode(activeInvite.code)}
                aria-label="Copy invite code"
              >
                {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {codeCopied ? "Copied" : "Copy code"}
              </Button>
            </div>
          )}

          <div className="text-sm text-muted-foreground space-y-2 border-t pt-4">
            <p className="font-medium text-foreground">How it works</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>You generate a code and share it privately with one person.</li>
              <li>They sign in to Diabeaters (or create an account) and enter the code in Carer setup (Account → Carer setup).</li>
              <li>You stay in control: use the toggles below to limit what they can see.</li>
            </ol>
          </div>

          {invites.length > 1 && (
            <div className="text-xs text-muted-foreground">
              You have multiple active codes. Older ones still work until used or expired; you can revoke unused codes
              from the database if needed (see project docs).
            </div>
          )}
        </CardContent>
      </Card>

      {/* C) Privacy */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            What carers can see
          </CardTitle>
          <CardDescription>
            For this MVP, changes apply to <strong className="font-medium">everyone you have linked</strong>. Per-person
            controls can follow in a later update.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">Link someone first — then you can fine-tune what they see.</p>
          ) : null}

          {[
            {
              key: "supplies" as const,
              label: "Supplies",
              description: "Stock levels from your cloud supply list.",
              testId: "privacy-toggle-supplies",
            },
            {
              key: "hypo_alerts" as const,
              label: "Hypo logs",
              description: "Recent low blood sugar logs.",
              testId: "privacy-toggle-hypo-alerts",
            },
            {
              key: "appointments" as const,
              label: "Appointments",
              description: "Shared diary-style visits when cloud appointment sharing is enabled on your project.",
              testId: "privacy-toggle-appointments",
            },
            {
              key: "scenarios" as const,
              label: "Travel and sick-day flags",
              description: "High-level status when your project exposes these to linked carers.",
              testId: "privacy-toggle-scenarios",
            },
            {
              key: "emergency_info" as const,
              label: "Emergency details",
              description: "The contact and notes you save under Account or Settings — only if you want them visible.",
              testId: "privacy-toggle-emergency",
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <Label htmlFor={item.testId} className="text-base font-medium">
                  {item.label}
                </Label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                id={item.testId}
                checked={displayScopes[item.key]}
                disabled={links.length === 0 || privacyBusy !== null}
                onCheckedChange={(on) => applyPrivacyToAll({ [item.key]: on }, item.key)}
                data-testid={item.testId}
                aria-label={`Allow carers to see ${item.label.toLowerCase()}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Support someone else?</CardTitle>
          <CardDescription>
            If you have an invite code from someone you support (their own Diabeaters account), open Carer setup to
            enter it.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button variant="outline" className="w-full min-h-11 sm:w-auto" asChild>
            <Link href="/carer-setup" data-testid="link-carer-setup">
              Carer setup
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Read-only snapshot of the same emergency record edited under Account / Settings (no duplicate form). */}
      <Card className="surface-card transition-shadow duration-500" key={syncGeneration}>
        <CardHeader>
          <CardTitle className="text-lg">Your emergency details</CardTitle>
          <CardDescription>
            Carers only see this when &quot;Emergency details&quot; is on above. Edits are shared everywhere in the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {emergency.contactName || emergency.phone ? (
            <dl className="space-y-2">
              {emergency.contactName ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact</dt>
                  <dd className="font-medium text-foreground">{emergency.contactName}</dd>
                </div>
              ) : null}
              {emergency.relation ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Relationship</dt>
                  <dd>{emergency.relation}</dd>
                </div>
              ) : null}
              {emergency.phone ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary phone</dt>
                  <dd>
                    <a className="text-primary font-medium" href={`tel:${emergency.phone.replace(/\s+/g, "")}`}>
                      {emergency.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {emergency.phoneSecondary ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Secondary phone</dt>
                  <dd>
                    <a className="text-primary font-medium" href={`tel:${emergency.phoneSecondary.replace(/\s+/g, "")}`}>
                      {emergency.phoneSecondary}
                    </a>
                  </dd>
                </div>
              ) : null}
              {emergency.medicalInstructions ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Medical instructions</dt>
                  <dd className="whitespace-pre-wrap text-muted-foreground">{emergency.medicalInstructions}</dd>
                </div>
              ) : null}
              {emergency.notes ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</dt>
                  <dd className="whitespace-pre-wrap text-muted-foreground">{emergency.notes}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-muted-foreground">You have not added emergency contact details yet.</p>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/account#account-emergency">Edit in Account</Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
