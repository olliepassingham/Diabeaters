import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

function hasSavedCommunityDetails(
  profile: {
    public_handle?: string | null;
    bio?: string | null;
    diabetes_onset_date?: string | null;
  } | null,
  countDiabetesOnset: boolean,
): boolean {
  if (!profile) return false;
  const hasOnset = countDiabetesOnset && !!profile.diabetes_onset_date?.trim();
  return !!(profile.public_handle?.trim() || profile.bio?.trim() || hasOnset);
}

/**
 * Public profile switch + optional handle/bio when on. Shared by Account and Community settings.
 */
export function AccountCommunityProfileFields({
  idPrefix = "comm",
  showAccountLinkInCopy = false,
  variant = "embedded",
  cardId,
  className,
}: AccountCommunityProfileFieldsProps) {
  const { profile, loading, refresh } = useProfile();
  const { toast } = useToast();
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

  /** Only people using the app primarily as someone with diabetes should set or show this. */
  const showOnsetDate = getPrimaryAppRole() === "patient";

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
      const saved = hasSavedCommunityDetails(profile, showOnsetDate);
      setEditing(!(profile.is_public && saved));
    }
  }, [profile, showOnsetDate]);

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
      const saved = hasSavedCommunityDetails(profile, showOnsetDate);
      setEditing(!saved);
    }

    setSavingPublic(true);
    const { error } = await updateProfile({ id: profile.id, is_public: next });
    setSavingPublic(false);

    if (error) {
      setIsPublic(previous);
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
        ? "Public profile is on. You can use the Feed and edit your details below."
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

    let normalizedHandle: string | null;
    try {
      normalizedHandle =
        handleInput.trim() === "" ? null : normalizePublicHandleInput(handleInput);
    } catch (err) {
      setSaving(false);
      toast({
        title: "Invalid handle",
        description: err instanceof Error ? err.message : "Check the handle format.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await updateProfile({
      id: profile.id,
      full_name: nameVal,
      bio: bio.trim() || null,
      public_handle: normalizedHandle,
      is_public: isPublic,
      diabetes_onset_date: showOnsetDate ? onsetDateInput.trim() || null : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    void refresh();
    setEditing(false);
    toast({ title: "Saved", description: "Your profile was updated." });
  }

  const handleSlug = handleInput.replace(/^@/, "").trim().toLowerCase();
  const readOnlyHandleSlug = (profile?.public_handle ?? "").replace(/^@/, "").trim().toLowerCase();
  const livingLine = onsetDateInput.trim() ? formatLivingWithDiabetesLine(onsetDateInput) : null;

  const settingsName = storage.getProfile()?.name?.trim() ?? "";
  const displayNameReadOnly =
    profile?.full_name?.trim() || settingsName || "Your account";

  const formBody = (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          <Label htmlFor={editing ? fullNameId : undefined}>Name</Label>
          <InlineInfoHint
            ariaLabel="About this name"
            content={
              showAccountLinkInCopy
                ? "This is how the app greets you. Your photo is on Account."
                : "This is how the app greets you and, with Public profile on, how you appear in the community."
            }
          />
        </div>
        {editing ? (
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
                    "When on, you can use the Feed. Set a @handle below before you post — it powers mentions and your public link."
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
          {editing ? (
            <>
              <div className="space-y-2">
                <FieldLabelWithInfo
                  htmlFor={handleId}
                  info={
                    <>
                      3–30 characters: lowercase letters, numbers, underscores. Share:{" "}
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
                <Label htmlFor={bioId}>Bio</Label>
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
                    info="Shown on your public feed profile when Public profile is on. You can remove this anytime."
                  >
                    Living with diabetes since
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
                  <p className="text-sm font-medium text-foreground">Living with diabetes since</p>
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
          <div className="flex items-start gap-2">
            <p className="text-sm text-muted-foreground flex-1 min-w-0">
              Turn on Public profile to use the Feed and edit your handle and bio.
            </p>
            <InlineInfoHint
              ariaLabel="More about community profile"
              content="Turn on Public profile to open the Feed and edit your handle and bio."
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
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-[0.9375rem] font-semibold">Profile</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-1.5">
                <span>Your name, visibility in the community, and optional feed details.</span>
                <InlineInfoHint
                  ariaLabel="More about Profile"
                  content="Edit your name, turn Public profile on or off, and when it is on, set your handle and bio."
                />
              </CardDescription>
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
