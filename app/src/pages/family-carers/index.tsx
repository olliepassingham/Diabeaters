import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InfoTooltip } from "@/components/info-tooltip";
import { Users, Copy, UserPlus, Shield, Info, Check, ChevronLeft } from "lucide-react";
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
import { carerScopePresetSummary } from "@/lib/carer-scopes-by-age";
import { getAgeBand } from "@/lib/user-age";
import { getSupabase } from "@/lib/supabase";
import { useProfile } from "@/lib/profile";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";
import { Link, useLocation } from "wouter";
import { PageHeader, PageShell } from "@/components/layout";

function InfoPopoverButton({
  label,
  title,
  children,
  testId,
}: {
  label: string;
  title?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label={label}
          data-testid={testId}
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] space-y-2 p-3 text-sm" align="end" sideOffset={6}>
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  info,
}: {
  icon?: typeof Users;
  title: string;
  info?: ReactNode;
}) {
  return (
    <CardTitle className="flex items-center gap-2 text-lg">
      {Icon ? <Icon className="h-5 w-5 shrink-0 text-primary" /> : null}
      <span className="min-w-0 flex-1">{title}</span>
      {info}
    </CardTitle>
  );
}

const PRIVACY_TOGGLES = [
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
    description:
      "Shared clinic visits in Supporter mode. Supporters can also get reminders the evening before and about 2 hours before (if you allow it in Settings → Notifications).",
    testId: "privacy-toggle-appointments",
  },
  {
    key: "scenarios" as const,
    label: "Travel and sick-day flags",
    description: "High-level status when your project exposes these to linked supporters.",
    testId: "privacy-toggle-scenarios",
  },
  {
    key: "emergency_info" as const,
    label: "Emergency details",
    description: "The contact and notes you save under Account or Settings — only if you want them visible.",
    testId: "privacy-toggle-emergency",
  },
  {
    key: "clinical_settings" as const,
    label: "Clinical basics on their profile",
    descriptionChild:
      "Lets a linked supporter update insulin delivery, total daily dose, and date of birth on the cloud profile. For under-13 accounts this starts on for new links so parents can help — turn it off if you prefer.",
    descriptionDefault:
      "Lets a linked supporter update insulin delivery, total daily dose, and date of birth stored on the person's cloud profile (for multi-device sync). Off by default for new links.",
    testId: "privacy-toggle-clinical-settings",
  },
] as const;

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
  const allOn: CarerScopes = {
    supplies: true,
    appointments: true,
    scenarios: true,
    hypo_alerts: true,
    emergency_info: true,
    clinical_settings: true,
  };
  return links.reduce(
    (acc, l) => ({
      supplies: acc.supplies && l.scopes.supplies,
      appointments: acc.appointments && l.scopes.appointments,
      scenarios: acc.scenarios && l.scopes.scenarios,
      hypo_alerts: acc.hypo_alerts && l.scopes.hypo_alerts,
      emergency_info: acc.emergency_info && l.scopes.emergency_info,
      clinical_settings: acc.clinical_settings && l.scopes.clinical_settings,
    }),
    allOn,
  );
}

export default function FamilyCarersPage() {
  const configured = Boolean(getSupabase());
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { profile: cloudProfile } = useProfile();
  const patientAgeBand = getAgeBand(cloudProfile?.date_of_birth ?? null);
  const scopePresetHint = carerScopePresetSummary(patientAgeBand);
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
        title: "Could not load supporters",
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
      toast({ title: "Supporter removed", description: "They can no longer open your shared view." });
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mr-2"
          aria-label="Back to account"
          onClick={() => setLocation("/account")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2" data-testid="heading-family-carers">
            <Users className="h-7 w-7 text-primary shrink-0" />
            Family &amp; supporters
          </span>
        }
        description="Invite people you trust to a read-only view you control."
        actions={
          <InfoTooltip
            term="Family & supporters"
            explanation="Linked supporters sign in with their own account and only see what you allow. This does not replace advice from your diabetes team."
          />
        }
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

      {configured && patientAgeBand === "child" && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] px-3 py-2.5 text-sm">
          <p className="min-w-0 flex-1 text-foreground">Under-13 accounts use tailored supporter defaults.</p>
          <InfoTooltip
            term="Under-13 supporter defaults"
            explanation={`${scopePresetHint} You can change any toggle below after they link.`}
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <SectionTitle
            title="Linked supporters"
            info={
              <InfoPopoverButton label="About linked supporters" title="Linked supporters">
                <p>Each person signs in with their own Diabeaters account and opens a read-only view of your data.</p>
                <p>Remove someone anytime — they lose access immediately.</p>
              </InfoPopoverButton>
            }
          />
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : links.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="carers-list-empty">
              No one linked yet — generate an invite below.
            </p>
          ) : (
            <ul className="space-y-3" data-testid="supporters-list">
              {links.map((link) => {
                const label =
                  link.carer_full_name?.trim() ||
                  `Linked supporter (${link.carerId.slice(0, 8)}…)`;
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
                    data-testid={`supporter-row-${link.id}`}
                  >
                    <Link
                      href={`/community/profile/${encodeURIComponent(link.carerId)}`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg -m-1 p-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                      aria-label={`View ${label}'s public profile`}
                    >
                      <AvatarBubble label={label} initials={initials} avatarUrl={link.carer_avatar_url ?? null} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          Linked {format(new Date(link.linkedAt), "d MMM yyyy")}
                        </p>
                      </div>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-gray-600"
                      onClick={() => handleRemove(link.id)}
                      aria-label={`Remove ${label} from linked supporters`}
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

      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <SectionTitle
            icon={UserPlus}
            title="Invite someone"
            info={
              <InfoPopoverButton label="How invites work" title="How invites work" testId="invite-how-it-works">
                <ol className="list-decimal space-y-1.5 pl-4">
                  <li>Generate a code and share it privately with one person.</li>
                  <li>
                    They sign in (or create an account) and enter it in{" "}
                    <span className="font-medium text-foreground">Account → Supporter setup</span>.
                  </li>
                  <li>Use the privacy toggles below to limit what they can see.</li>
                </ol>
                <p>Codes expire after 7 days. New links start with all view options on.</p>
                {patientAgeBand === "child" ? (
                  <p>Under-13 accounts also turn on clinical basics by default — you can switch that off after they link.</p>
                ) : null}
                {invites.length > 1 ? (
                  <p>Older unused codes still work until they expire or are used.</p>
                ) : null}
              </InfoPopoverButton>
            }
          />
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={handleGenerateInvite}
            disabled={generating || !configured}
            data-testid="invite-generate"
            aria-label="Generate invite code"
          >
            {generating ? "Generating…" : "Generate invite"}
          </Button>

          {activeInvite && (
            <div className="rounded-xl bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active code</p>
                <p className="text-xs text-muted-foreground">
                  Expires {format(new Date(activeInvite.expiresAt), "d MMM yyyy")}
                </p>
              </div>
              <p className="font-mono text-2xl font-semibold tracking-widest" data-testid="invite-code">
                {activeInvite.code}
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
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <SectionTitle
            icon={Shield}
            title="What supporters can see"
            info={
              <InfoPopoverButton label="About privacy controls" title="Privacy controls">
                <p>Changes apply to everyone you have linked. Per-person controls may follow in a later update.</p>
              </InfoPopoverButton>
            }
          />
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border/60 pt-0">
          {links.length === 0 ? (
            <p className="pb-4 text-sm text-muted-foreground">Link someone first to adjust what they can see.</p>
          ) : null}

          {PRIVACY_TOGGLES.map((item) => {
            const description =
              item.key === "clinical_settings"
                ? patientAgeBand === "child"
                  ? item.descriptionChild
                  : item.descriptionDefault
                : item.description;
            return (
              <div key={item.key} className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <div className="flex min-w-0 flex-1 items-center gap-0.5">
                  <Label htmlFor={item.testId} className="cursor-pointer text-base font-medium leading-tight">
                    {item.label}
                  </Label>
                  <InfoTooltip term={item.label} explanation={description} />
                </div>
                <Switch
                  id={item.testId}
                  checked={displayScopes[item.key]}
                  disabled={links.length === 0 || privacyBusy !== null}
                  onCheckedChange={(on) => applyPrivacyToAll({ [item.key]: on }, item.key)}
                  data-testid={item.testId}
                  aria-label={`Allow supporters to see ${item.label.toLowerCase()}`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <CardTitle className="min-w-0 flex-1 text-base">Support someone else?</CardTitle>
          <InfoTooltip
            term="Supporter setup"
            explanation="If someone shared an invite code with you, open Supporter setup to enter it and link to their account."
          />
        </CardHeader>
        <CardContent className="pt-0">
          <Button variant="outline" className="w-full min-h-11 sm:w-auto" asChild>
            <Link href="/carer-setup" data-testid="link-carer-setup">
              Open Supporter setup
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="surface-card transition-shadow duration-500" key={syncGeneration}>
        <CardHeader className="pb-3">
          <SectionTitle
            title="Your emergency details"
            info={
              <InfoPopoverButton label="About emergency details" title="Emergency details">
                <p>Supporters only see this when the Emergency details toggle is on above.</p>
                <p>Edits here are the same record shown under Account and Settings.</p>
              </InfoPopoverButton>
            }
          />
        </CardHeader>
        <CardContent className="space-y-3 pt-0 text-sm">
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
