import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ProfileCommunityPreview,
  ProfileFormCard,
  ProfileFormInset,
  ProfileFormStack,
  ProfileReadOnlyRow,
  ProfileStatusPill,
  ProfileToggleRow,
} from "@/components/profile/profile-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldLabelWithInfo, InlineInfoHint } from "@/components/ui/field-label-with-info";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  formatLivingWithDiabetesLine,
  isPublicHandleAvailable,
  isPublicCommunityProfileComplete,
  normalizePublicHandleInput,
  PUBLIC_HANDLE_TAKEN_MESSAGE,
  updateProfile,
  useProfile,
} from "@/lib/profile";
import { getPrimaryAppRole } from "@/lib/carer-session";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { useAuth } from "@/lib/auth-context";
import { applyDisplayNameToLocalProfile } from "@/lib/user-display-name";

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
  const { isCarer: hasCarerLink } = useLinkedCarer();
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
  const [savingSupportedBadge, setSavingSupportedBadge] = useState(false);
  const [editing, setEditing] = useState(false);
  const [handleAvailability, setHandleAvailability] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
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
        setEditing(!isPublicCommunityProfileComplete(profile));
      }
    }
  }, [profile, showOnsetDate]);

  useEffect(() => {
    if (!profile?.is_public) return;
    if (!isPublicCommunityProfileComplete(profile)) {
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

  const savedHandleSlug = (profile?.public_handle ?? "").replace(/^@/, "").trim().toLowerCase();

  useEffect(() => {
    if (!isPublic || !editing) {
      setHandleAvailability("idle");
      return;
    }
    const slug = handleInput.replace(/^@/, "").trim().toLowerCase();
    if (!slug) {
      setHandleAvailability("idle");
      return;
    }
    if (slug === savedHandleSlug) {
      setHandleAvailability("available");
      return;
    }

    let cancelled = false;
    setHandleAvailability("checking");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          normalizePublicHandleInput(slug);
        } catch {
          if (!cancelled) setHandleAvailability("invalid");
          return;
        }
        const res = await isPublicHandleAvailable(slug, { excludeUserId: profile?.id });
        if (cancelled) return;
        if (res.error && !res.available) {
          setHandleAvailability("invalid");
          return;
        }
        setHandleAvailability(res.available ? "available" : "taken");
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [handleInput, savedHandleSlug, profile?.id, isPublic, editing]);

  const resetFromProfile = useCallback(() => {
    if (!profile) return;
    setFullNameInput(profile.full_name ?? "");
    setBio(profile.bio ?? "");
    setHandleInput(profile.public_handle ?? "");
    setOnsetDateInput(showOnsetDate ? (profile.diabetes_onset_date ?? "") : "");
    setIsPublic(profile.is_public);
    setEditing(!profile.is_public ? false : !isPublicCommunityProfileComplete(profile));
  }, [profile, showOnsetDate]);

  async function persistPublicChange(next: boolean) {
    if (!profile?.id) return;
    const previous = profile.is_public;
    if (next === previous) return;

    setIsPublic(next);
    if (next) {
      setEditing(!isPublicCommunityProfileComplete(profile));
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
        setEditing(!isPublicCommunityProfileComplete(profile));
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

  async function persistShowSupportedOnProfile(next: boolean) {
    if (!profile?.id) return;
    const previous = profile.show_supported_person_on_profile === true;
    if (next === previous) return;

    setSavingSupportedBadge(true);
    const { error } = await updateProfile({
      id: profile.id,
      show_supported_person_on_profile: next,
    });
    setSavingSupportedBadge(false);

    if (error) {
      toast({
        title: "Could not save",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    void refresh();
    toast({
      title: "Saved",
      description: next
        ? "Your public profile can show who you support when they allow it and their profile is public."
        : "Who you support is hidden from your public profile.",
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
      if (nameVal) applyDisplayNameToLocalProfile(nameVal);
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

    if (normalizedHandle !== savedHandleSlug) {
      const availability = await isPublicHandleAvailable(normalizedHandle, {
        excludeUserId: profile.id,
      });
      if (!availability.available) {
        setSaving(false);
        setHandleAvailability("taken");
        toast({
          title: "Handle taken",
          description: PUBLIC_HANDLE_TAKEN_MESSAGE,
          variant: "destructive",
        });
        return;
      }
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
    if (nameVal) applyDisplayNameToLocalProfile(nameVal);
    void refresh();
    const completeAfterSave = isPublicCommunityProfileComplete({
      full_name: nameVal,
      public_handle: normalizedHandle,
      is_public: isPublic,
    });
    setEditing(!completeAfterSave);
    toast({ title: "Saved", description: "Your profile was updated." });
  }

  const handleSlug = handleInput.replace(/^@/, "").trim().toLowerCase();
  const readOnlyHandleSlug = savedHandleSlug;
  const livingLine = onsetDateInput.trim() ? formatLivingWithDiabetesLine(onsetDateInput) : null;
  const handleSaveBlocked =
    isPublic &&
    editing &&
    handleSlug.length > 0 &&
    handleSlug !== savedHandleSlug &&
    (handleAvailability === "taken" ||
      handleAvailability === "checking" ||
      handleAvailability === "invalid");

  const readOnlyPublicSummary = Boolean(profile && isPublicCommunityProfileComplete(profile) && !editing);
  const showNameInput = editing && (!readOnlyPublicSummary || !isPublic);

  const publicToggle = (
    <ProfileToggleRow
      label={
        <span className="inline-flex items-center gap-1">
          <Label htmlFor={pubId} className="mb-0 cursor-pointer text-sm font-medium">
            Public profile
          </Label>
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
        </span>
      }
      description="Visible to signed-in members on the Feed."
      control={
        <Switch
          id={pubId}
          checked={isPublic}
          onCheckedChange={(checked) => void persistPublicChange(checked)}
          disabled={loading || saving || savingPublic}
          data-testid="account-community-public-switch"
        />
      }
      footer={
        savingPublic ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Saving…
          </p>
        ) : undefined
      }
    />
  );

  const showSupportedOnProfile = profile?.show_supported_person_on_profile === true;

  const supportedPersonToggle = hasCarerLink ? (
    <ProfileToggleRow
      label={
        <span className="inline-flex items-center gap-1">
          <Label htmlFor={`${idPrefix}-show-supported`} className="mb-0 cursor-pointer text-sm font-medium">
            Show who I support
          </Label>
          <InlineInfoHint
            ariaLabel="About showing who you support"
            content="Adds a small badge on your public profile. Only appears when the person you support allows it under Family & supporters and their profile is public."
          />
        </span>
      }
      description="Optional — helps others understand your community context."
      control={
        <Switch
          id={`${idPrefix}-show-supported`}
          checked={showSupportedOnProfile}
          onCheckedChange={(checked) => void persistShowSupportedOnProfile(checked)}
          disabled={loading || savingSupportedBadge || !isPublic}
          data-testid="account-show-supported-person-switch"
        />
      }
      footer={
        savingSupportedBadge ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Saving…
          </p>
        ) : !isPublic ? (
          <p className="text-xs text-muted-foreground">Turn on your public profile first.</p>
        ) : undefined
      }
    />
  ) : null;

  const editFields = (
    <div className="space-y-4">
      {showNameInput ? (
        <div className="space-y-2">
          <div className="flex items-center gap-0.5">
            <Label htmlFor={fullNameId} className="text-xs font-medium text-muted-foreground">
              Display name
            </Label>
            <InlineInfoHint
              ariaLabel="About display name"
              content={
                showAccountLinkInCopy
                  ? "Shown in the app and on your photo in Account."
                  : "Used in the app and on your public profile when Feed visibility is on."
              }
            />
          </div>
          <Input
            id={fullNameId}
            value={fullNameInput}
            onChange={(e) => setFullNameInput(e.target.value)}
            autoComplete="name"
            placeholder="Your name"
            disabled={loading || savingPublic}
            className="h-10 rounded-xl border-border/60 bg-background/80"
            data-testid="account-profile-display-name-input"
          />
          {accountEmail ? (
            <p className="text-xs text-muted-foreground break-all" data-testid="account-profile-email-readonly">
              {accountEmail}
            </p>
          ) : null}
        </div>
      ) : null}

      {isPublic ? (
        <>
          <div className="space-y-2">
            <FieldLabelWithInfo
              htmlFor={handleId}
              info={
                <>
                  Required and unique across Diabeaters. 3–30 characters: lowercase letters, numbers, underscores. Share:{" "}
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
            <div className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 focus-within:ring-2 focus-within:ring-ring">
              <span className="text-sm font-medium text-muted-foreground select-none" aria-hidden>
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
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                data-testid="account-community-handle-input"
                aria-invalid={handleAvailability === "taken" || handleAvailability === "invalid"}
                aria-describedby={`${handleId}-status`}
              />
            </div>
            <p
              id={`${handleId}-status`}
              className={cn(
                "text-xs",
                handleAvailability === "taken" || handleAvailability === "invalid"
                  ? "text-destructive"
                  : handleAvailability === "available" && handleSlug && handleSlug !== savedHandleSlug
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
              aria-live="polite"
              data-testid="account-community-handle-status"
            >
              {handleAvailability === "checking"
                ? "Checking availability…"
                : handleAvailability === "taken"
                  ? PUBLIC_HANDLE_TAKEN_MESSAGE
                  : handleAvailability === "invalid"
                    ? "Use 3–30 characters: letters, numbers, underscores only."
                    : handleAvailability === "available" && handleSlug && handleSlug !== savedHandleSlug
                      ? "This handle is available."
                      : "Handles are unique — you will need a different one if it is already in use."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={bioId} className="text-xs font-medium text-muted-foreground">
              Bio <span className="font-normal">(optional)</span>
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
              className="min-h-[2.75rem] max-h-[200px] resize-none overflow-y-auto rounded-xl border-border/60 bg-background/80 py-2"
            />
          </div>

          {showOnsetDate ? (
            <div className="space-y-2 border-t border-border/40 pt-3">
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
                className="h-10 rounded-xl border-border/60 bg-background/80"
                data-testid="account-community-onset-input"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {livingLine ? (
                  <span
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                    data-testid="account-community-onset-line"
                  >
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <span>{livingLine}</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground" data-testid="account-community-onset-empty">
                    Not set
                  </span>
                )}
                {onsetDateInput.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs"
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

          <Button
            type="submit"
            className="h-11 w-full rounded-xl font-medium"
            disabled={saving || loading || savingPublic || handleSaveBlocked}
            data-testid="account-community-save"
          >
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Turn on <span className="font-medium text-foreground">Public profile</span> to use the Feed and choose your
            @handle. Bio and diagnosis date are optional.
          </p>
          {showNameInput ? (
            <Button
              type="submit"
              className="h-11 w-full rounded-xl"
              disabled={saving || loading || savingPublic}
              data-testid="account-community-save"
            >
              {saving ? "Saving…" : "Save name"}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );

  const formBody = (
    <>
      {readOnlyPublicSummary ? (
        <ProfileCommunityPreview
          handleSlug={readOnlyHandleSlug || null}
          bio={profile?.bio}
          livingWithLine={livingLine}
          showOnset={showOnsetDate}
          onAddBio={() => setEditing(true)}
        />
      ) : editing ? (
        editFields
      ) : isPublic ? (
        <ProfileFormInset>
          <ProfileFormStack>
            {showOnsetDate ? (
              <ProfileReadOnlyRow label="Diabetes journey">
                {livingLine ? (
                  <span className="inline-flex items-center gap-2" data-testid="account-community-onset-highlight">
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    {livingLine}
                  </span>
                ) : (
                  <span className="text-muted-foreground" data-testid="account-community-onset-empty">
                    Not set
                  </span>
                )}
              </ProfileReadOnlyRow>
            ) : null}
            <ProfileReadOnlyRow label="Feed handle">
              {readOnlyHandleSlug ? (
                <Link
                  href={`/community/u/${encodeURIComponent(readOnlyHandleSlug)}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  data-testid="account-community-handle-readonly"
                >
                  @{readOnlyHandleSlug}
                </Link>
              ) : (
                <span className="text-muted-foreground" data-testid="account-community-handle-empty">
                  No handle yet
                </span>
              )}
            </ProfileReadOnlyRow>
            <ProfileReadOnlyRow label="Bio">
              {profile?.bio?.trim() ? (
                <span className="whitespace-pre-wrap text-foreground/90" data-testid="account-community-bio-readonly">
                  {profile.bio}
                </span>
              ) : (
                <span className="italic text-muted-foreground" data-testid="account-community-bio-empty">
                  No bio yet
                </span>
              )}
            </ProfileReadOnlyRow>
          </ProfileFormStack>
        </ProfileFormInset>
      ) : (
        editFields
      )}

      <div className={cn(readOnlyPublicSummary || editing || isPublic ? "border-t border-border/40 pt-4 space-y-4" : "pt-1 space-y-4")}>
        {publicToggle}
        {supportedPersonToggle}
      </div>
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
    const profileComplete = profile ? isPublicCommunityProfileComplete(profile) : false;
    const statusLine = !isPublic
      ? "Private — turn on to join the Feed"
      : profileComplete && !editing
        ? "Visible on the Feed"
        : "Add your name and @handle to finish setup";

    return (
      <ProfileFormCard id={cardId} className={className} testId="account-profile-card">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-semibold tracking-tight text-foreground">Community profile</h2>
                <ProfileStatusPill isPublic={isPublic} complete={profileComplete} />
                <InlineInfoHint
                  ariaLabel="About community profile"
                  content={
                    <>
                      <p className="mb-2 last:mb-0">
                        With Public profile on, your community card is complete when your name and @handle are saved. Bio
                        and diagnosis date are optional.
                      </p>
                      <p className="mb-0">Your photo and sign-in email are managed in the hero card above.</p>
                    </>
                  }
                />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{statusLine}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => {
                    resetFromProfile();
                  }}
                  disabled={saving || savingPublic}
                >
                  Cancel
                </Button>
              ) : null}
              {!editing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-border/60 bg-background/70 text-xs shadow-sm"
                  onClick={() => setEditing(true)}
                  disabled={savingPublic}
                  data-testid="account-community-edit"
                >
                  Edit
                </Button>
              ) : null}
            </div>
          </div>
          {form}
        </div>
      </ProfileFormCard>
    );
  }

  return <div className={className}>{form}</div>;
}
