import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldLabelWithInfo, InlineInfoHint } from "@/components/ui/field-label-with-info";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  formatLivingWithDiabetesLine,
  normalizePublicHandleInput,
  updateProfile,
  useProfile,
} from "@/lib/profile";
import { getPrimaryAppRole } from "@/lib/carer-session";
import { storage } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";

type AccountCommunityProfileFieldsProps = {
  /** Prefix for form control ids (avoid duplicates if multiple instances ever mount). */
  idPrefix?: string;
  /** Show extra line with link to Account for display name (community settings page). */
  showAccountLinkInCopy?: boolean;
  /** Standalone wraps in a Card with title + Edit; embedded is form only (no Card). */
  variant?: "standalone" | "embedded";
  /** When standalone: element id for deep links (e.g. `profile` for /account#profile). */
  cardId?: string;
  className?: string;
};

/**
 * Public profile is "complete" (read-only / published layout) when name and valid handle are set.
 * Bio and living-with-diabetes date are optional.
 */
function isPublicProfileComplete(profile: {
  full_name?: string | null;
  public_handle?: string | null;
} | null): boolean {
  if (!profile) return false;
  if (!profile.full_name?.trim()) return false;
  try {
    const raw = (profile.public_handle ?? "").replace(/^@/, "").trim();
    const h = normalizePublicHandleInput(raw);
    if (!h) return false;
  } catch {
    return false;
  }
  return true;
}

/**
 * Public profile switch + handle/bio when on. Shared by Account and Community settings.
 */
export function AccountCommunityProfileFields({
  idPrefix = "comm",
  showAccountLinkInCopy = false,
  variant = "embedded",
  cardId,
  className,
}: AccountCommunityProfileFieldsProps) {
  const { user } = useAuth();
  const { profile, loading, refresh } = useProfile();
  const { toast } = useToast();
  const accountEmail = user?.email?.trim() ?? "";
  const reactId = useId();
  const pubId = `${idPrefix}-pub-${reactId}`;
  const handleId = `${idPrefix}-handle-${reactId}`;
  const bioId = `${idPrefix}-bio-${reactId}`;
  const onsetId = `${idPrefix}-onset-${reactId}`;
  const fullNameId = `${idPrefix}-fullname-${reactId}`;

  const [fullNameInput, setFullNameInput] = useState("");
  const [bio, setBio] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [onsetDateInput, setOnsetDateInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPublic, setSavingPublic] = useState(false);
  const [editing, setEditing] = useState(false);
  const profileIdRef = useRef<string | undefined>(undefined);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const clearedStaleDiabetesOnset = useRef(false);

  /**
   * Hide for users who chose supporter-first onboarding only. If primary role was never set (null —
   * common on older installs or when sessionStorage was cleared), still show: default experience is patient.
   */
  const showOnsetDate = getPrimaryAppRole() !== "carer";

  const adjustBioHeight = useCallback(() => {
    const el = bioRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxPx = 200;
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, []);

  useEffect(() => {
    if (!profile) return;
    setFullNameInput(profile.full_name ?? "");
    setBio(profile.bio ?? "");
    setHandleInput(profile.public_handle ?? "");
    setOnsetDateInput(showOnsetDate ? (profile.diabetes_onset_date ?? "") : "");
    setIsPublic(profile.is_public);

    if (profileIdRef.current !== profile.id) {
      profileIdRef.current = profile.id;
      if (!profile.is_public) {
        setEditing(false);
      } else {
        setEditing(!isPublicProfileComplete(profile));
      }
    }
  }, [profile, showOnsetDate]);

  useEffect(() => {
    if (!profile?.is_public) return;
    if (!isPublicProfileComplete(profile)) {
      setEditing(true);
    }
  }, [profile?.is_public, profile?.full_name, profile?.public_handle]);

  useEffect(() => {
    adjustBioHeight();
  }, [bio, adjustBioHeight]);

  /** Supporters may have a legacy value; clear it so public cards do not imply they have diabetes. */
  useEffect(() => {
    if (showOnsetDate || !profile?.id) return;
    if (!profile.diabetes_onset_date?.trim()) return;
    if (clearedStaleDiabetesOnset.current) return;
    clearedStaleDiabetesOnset.current = true;
    void (async () => {
      const { error } = await updateProfile({ id: profile.id, diabetes_onset_date: null });
      if (error) {
        clearedStaleDiabetesOnset.current = false;
        return;
      }
      setOnsetDateInput("");
      void refresh();
    })();
  }, [showOnsetDate, profile?.id, profile?.diabetes_onset_date, refresh]);

  useEffect(() => {
    clearedStaleDiabetesOnset.current = false;
  }, [profile?.id]);

  useEffect(() => {
    if (!isPublic) return;
    const id = requestAnimationFrame(() => adjustBioHeight());
    return () => cancelAnimationFrame(id);
  }, [isPublic, adjustBioHeight]);

  async function persistPublicChange(next: boolean) {
    if (!profile?.id) return;
    const previous = profile.is_public;
    if (next === previous) return;

    setIsPublic(next);
    if (next) {
      setEditing(!isPublicProfileComplete(profile));
    } else {
      setEditing(false);
    }

    setSavingPublic(true);
    const { error } = await updateProfile({ id: profile.id, is_public: next });
    setSavingPublic(false);

    if (error) {
      setIsPublic(previous);
      if (!previous) {
        setEditing(false);
      } else {
        setEditing(!isPublicProfileComplete(profile));
      }
      toast({
        title: "Could not update visibility",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    void refresh();
    toast({
      title: "Saved",
      description: next
        ? "Public profile is on. Add your name, @handle, and other required details, then save."
        : "Public profile is off. The Feed is hidden until you turn this on again.",
    });
  }

  const todayIso = useMemo(() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  async function clearOnsetDate() {
    if (!profile?.id) return;
    const hadServer = !!profile.diabetes_onset_date;
    setOnsetDateInput("");
    if (!hadServer) return;
    setSaving(true);
    const { error } = await updateProfile({ id: profile.id, diabetes_onset_date: null });
    setSaving(false);
    if (error) {
      setOnsetDateInput(profile.diabetes_onset_date ?? "");
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
      return;
    }
    void refresh();
    toast({ title: "Removed", description: "This is no longer shown on your public profile." });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
    const nameVal = fullNameInput.trim() || null;

    if (!isPublic) {
      const { error } = await updateProfile({
        id: profile.id,
        full_name: nameVal,
      });
      setSaving(false);
      if (error) {
        toast({ title: "Could not save", description: error.message, variant: "destructive" });
        return;
      }
      void refresh();
      setEditing(false);
      toast({ title: "Saved", description: "Your name has been updated." });
      return;
    }

    if (!fullNameInput.trim()) {
      setSaving(false);
      toast({
        title: "Missing name",
        description: "Your name is required for a public profile.",
        variant: "destructive",
      });
      return;
    }

    let normalizedHandle: string | null;
    try {
      normalizedHandle =
        handleInput.trim() === ""
          ? null
          : normalizePublicHandleInput(handleInput.replace(/^@/, "").trim());
    } catch (err) {
      setSaving(false);
      toast({
        title: "Invalid handle",
        description: err instanceof Error ? err.message : "Check the handle format.",
        variant: "destructive",
      });
      return;
    }
    if (!normalizedHandle) {
      setSaving(false);
      toast({
        title: "Missing handle",
        description: "Choose a @handle (3–30 characters). It is required for a public profile.",
        variant: "destructive",
      });
      return;
    }

    const onsetVal = showOnsetDate ? onsetDateInput.trim() || null : null;
    const { error } = await updateProfile({
      id: profile.id,
      full_name: nameVal,
      bio: bio.trim() || null,
      public_handle: normalizedHandle,
      is_public: isPublic,
      diabetes_onset_date: onsetVal,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    void refresh();
    const completeAfterSave = isPublicProfileComplete({
      full_name: nameVal,
      public_handle: normalizedHandle,
    });
    setEditing(!completeAfterSave);
    toast({ title: "Saved", description: "Your profile was updated." });
  }

  const handleSlug = handleInput.replace(/^@/, "").trim().toLowerCase();
  const readOnlyHandleSlug = (profile?.public_handle ?? "").replace(/^@/, "").trim().toLowerCase();
  const livingLine = onsetDateInput.trim() ? formatLivingWithDiabetesLine(onsetDateInput) : null;

  const settingsName = storage.getProfile()?.name?.trim() ?? "";
  const displayNameReadOnly =
    profile?.full_name?.trim() || settingsName || "Your account";

  const readOnlyPublicSummary = Boolean(isPublic && profile && isPublicProfileComplete(profile) && !editing);
  const showNameInput = !isPublic ? editing : !readOnlyPublicSummary;

  const formBody = (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          <Label htmlFor={showNameInput ? fullNameId : undefined}>Name</Label>
          <InlineInfoHint
            ariaLabel="About this name"
            content={
              showAccountLinkInCopy
                ? "This is how the app greets you. Your photo is on Account."
                : "This is how the app greets you and, with Public profile on, how you appear in the community."
            }
          />
        </div>
        {showNameInput ? (
          <Input
            id={fullNameId}
            value={fullNameInput}
            onChange={(e) => setFullNameInput(e.target.value)}
            autoComplete="name"
            placeholder="Your name"
            disabled={loading || savingPublic}
            data-testid="account-profile-display-name-input"
          />
        ) : (
          <p
            className="text-sm font-medium text-foreground truncate"
            data-testid="account-profile-display-name-readonly"
          >
            {displayNameReadOnly}
          </p>
        )}
        {accountEmail ? (
          <p className="text-sm text-muted-foreground break-all" data-testid="account-profile-email-readonly">
            {accountEmail}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-border/60">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1">
              <Label htmlFor={pubId}>Public profile</Label>
              <InlineInfoHint
                ariaLabel="About public profile"
                content={
                  showAccountLinkInCopy ? (
                    <>
                      Let signed-in members see your community card. Photo and name are on{" "}
                      <Link href="/account#profile" className="text-primary underline-offset-4 hover:underline">
                        Account
                      </Link>
                      .
                    </>
                  ) : (
                    "When on, add your name and @handle to finish your profile. Bio and diagnosis date are optional."
                  )
                }
              />
            </div>
          </div>
          <Switch
            id={pubId}
            checked={isPublic}
            onCheckedChange={(checked) => void persistPublicChange(checked)}
            disabled={loading || saving || savingPublic}
            data-testid="account-community-public-switch"
          />
        </div>
        {savingPublic ? (
          <p className="px-3 pb-2 text-xs text-muted-foreground" aria-live="polite">
            Saving…
          </p>
        ) : null}
      </div>

      {isPublic ? (
        <>
          {!readOnlyPublicSummary ? (
            <>
              <div className="space-y-2">
                <FieldLabelWithInfo
                  htmlFor={handleId}
                  info={
                    <>
                      Required. 3–30 characters: lowercase letters, numbers, underscores. Share:{" "}
                      {handleInput.trim() ? (
                        <Link
                          href={`/community/u/${encodeURIComponent(handleSlug)}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          /community/u/{handleSlug}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">set a handle for a link</span>
                      )}
                    </>
                  }
                >
                  Feed handle
                </FieldLabelWithInfo>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground select-none" aria-hidden>
                    @
                  </span>
                  <Input
                    id={handleId}
                    placeholder="your_handle"
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={30}
                    disabled={loading || savingPublic}
                    data-testid="account-community-handle-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={bioId}>
                  Bio <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  ref={bioRef}
                  id={bioId}
                  rows={1}
                  maxLength={500}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short intro for the feed (not medical advice)."
                  disabled={loading || savingPublic}
                  data-testid="account-community-bio-input"
                  className="min-h-[2.75rem] max-h-[200px] resize-none overflow-y-auto py-2"
                />
              </div>

              {showOnsetDate ? (
                <div className="space-y-2">
                  <FieldLabelWithInfo
                    htmlFor={onsetId}
                    info="Optional. Shown on your community card when set. You can change or remove it anytime."
                  >
                    Living with diabetes since{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </FieldLabelWithInfo>
                  <Input
                    id={onsetId}
                    type="date"
                    min="1900-01-01"
                    max={todayIso}
                    value={onsetDateInput}
                    onChange={(e) => setOnsetDateInput(e.target.value)}
                    disabled={loading || saving || savingPublic}
                    data-testid="account-community-onset-input"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {livingLine ? (
                      <span className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="account-community-onset-line">
                        <Clock3 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span>{livingLine}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground" data-testid="account-community-onset-empty">
                        —
                      </span>
                    )}
                    {onsetDateInput.trim() ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => void clearOnsetDate()}
                        disabled={saving || loading || savingPublic}
                        data-testid="account-community-onset-remove"
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <Button type="submit" disabled={saving || loading || savingPublic} data-testid="account-community-save">
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {showOnsetDate ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Living with diabetes since{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </p>
                  {livingLine ? (
                    <p className="text-sm text-muted-foreground" data-testid="account-community-onset-highlight">
                      {livingLine}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="account-community-onset-empty">
                      —
                    </p>
                  )}
                </div>
              ) : null}
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Feed handle</p>
                {readOnlyHandleSlug ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">@</span>
                    <Link
                      href={`/community/u/${encodeURIComponent(readOnlyHandleSlug)}`}
                      className="text-primary font-medium underline-offset-4 hover:underline"
                      data-testid="account-community-handle-readonly"
                    >
                      {readOnlyHandleSlug}
                    </Link>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="account-community-handle-empty">
                    No handle yet
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Bio</p>
                {profile?.bio?.trim() ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="account-community-bio-readonly">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="account-community-bio-empty">
                    No bio yet
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-start">
            <InlineInfoHint
              ariaLabel="About Public profile"
              content={
                <>
                  Turn on Public profile to use the Feed. You will add your name and @handle to publish your card. Bio
                  and diagnosis date are optional.
                </>
              }
            />
          </div>
          {editing ? (
            <Button type="submit" disabled={saving || loading || savingPublic} data-testid="account-community-save">
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </div>
      )}
    </>
  );

  const embeddedEditRow =
    variant === "embedded" && !editing ? (
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          disabled={savingPublic}
          data-testid="account-community-edit"
        >
          Edit
        </Button>
      </div>
    ) : null;

  const form = (
    <form onSubmit={onSubmit} className="space-y-4">
      {embeddedEditRow}
      {formBody}
    </form>
  );

  if (variant === "standalone") {
    return (
      <Card
        id={cardId}
        className={cn(
          "animate-fade-in-up rounded-2xl border-border/60 shadow-sm overflow-hidden scroll-mt-24",
          className,
        )}
      >
        <CardHeader className="pb-2 space-y-0">
          <div className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0 flex flex-wrap items-center gap-1.5">
              <CardTitle className="text-[0.9375rem] font-semibold">Profile</CardTitle>
              <InlineInfoHint
                ariaLabel="About Profile"
                content={
                  <>
                    <p className="mb-2 last:mb-0">
                      With Public profile on, your community card is complete when your name and @handle are saved. Bio
                      and diagnosis date are optional.
                    </p>
                    <p className="mb-0">
                      Turn Public profile on to use the Feed. Until name and handle are saved, you stay in the editor.
                    </p>
                  </>
                }
              />
            </div>
            {!editing ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setEditing(true)}
                disabled={savingPublic}
                data-testid="account-community-edit"
              >
                Edit
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">{form}</CardContent>
      </Card>
    );
  }

  return <div className={className}>{form}</div>;
}
