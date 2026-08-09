import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, AtSign, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageShell } from "@/components/layout";
import { FaceLogo } from "@/components/face-logo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  isPublicCommunityProfileComplete,
  isPublicHandleAvailable,
  normalizePublicHandleInput,
  PUBLIC_HANDLE_TAKEN_MESSAGE,
  updateProfile,
  useProfile,
} from "@/lib/profile";
import { applyDisplayNameToLocalProfile } from "@/lib/user-display-name";
import { cn } from "@/lib/utils";

/**
 * Focused first-run setup for Community Members: name + @handle (+ public),
 * then enter the Feed. Replaces dumping people into full Account settings.
 */
export default function CommunitySetupPage() {
  const { user } = useAuth();
  const { profile, loading, refresh } = useProfile();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [fullName, setFullName] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [handleAvailability, setHandleAvailability] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  useEffect(() => {
    if (!profile) return;
    if (isPublicCommunityProfileComplete(profile)) {
      setLocation("/community");
    }
  }, [profile, setLocation]);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setHandleInput(profile.public_handle ?? "");
    setBio(profile.bio ?? "");
    setIsPublic(profile.is_public ?? true);
  }, [profile?.id]);

  const savedHandleSlug = (profile?.public_handle ?? "").replace(/^@/, "").trim().toLowerCase();
  const handleSlug = handleInput.replace(/^@/, "").trim().toLowerCase();

  useEffect(() => {
    if (!isPublic) {
      setHandleAvailability("idle");
      return;
    }
    if (!handleSlug) {
      setHandleAvailability("idle");
      return;
    }
    if (handleSlug === savedHandleSlug) {
      setHandleAvailability("available");
      return;
    }

    let cancelled = false;
    setHandleAvailability("checking");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          normalizePublicHandleInput(handleSlug);
        } catch {
          if (!cancelled) setHandleAvailability("invalid");
          return;
        }
        const res = await isPublicHandleAvailable(handleSlug, { excludeUserId: profile?.id });
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
  }, [handleSlug, savedHandleSlug, profile?.id, isPublic]);

  const handleHint = useMemo(() => {
    if (!handleSlug) return "3–30 characters · letters, numbers, underscore";
    if (handleAvailability === "checking") return "Checking availability…";
    if (handleAvailability === "available") return "Looks good";
    if (handleAvailability === "taken") return PUBLIC_HANDLE_TAKEN_MESSAGE;
    if (handleAvailability === "invalid") return "Use 3–30 characters: letters, numbers, underscore";
    return "3–30 characters · letters, numbers, underscore";
  }, [handleSlug, handleAvailability]);

  const canSubmit =
    Boolean(user?.id && profile?.id) &&
    isPublic &&
    fullName.trim().length > 0 &&
    handleSlug.length > 0 &&
    handleAvailability !== "taken" &&
    handleAvailability !== "invalid" &&
    handleAvailability !== "checking" &&
    !saving;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.id || !canSubmit) return;

    let normalizedHandle = "";
    try {
      const normalized = normalizePublicHandleInput(handleSlug);
      if (!normalized) {
        setHandleAvailability("invalid");
        toast({
          title: "Invalid handle",
          description: "Use 3–30 characters: letters, numbers, underscore.",
          variant: "destructive",
        });
        return;
      }
      normalizedHandle = normalized;
    } catch {
      setHandleAvailability("invalid");
      toast({
        title: "Invalid handle",
        description: "Use 3–30 characters: letters, numbers, underscore.",
        variant: "destructive",
      });
      return;
    }

    const nameVal = fullName.trim();
    if (!nameVal) {
      toast({
        title: "Add your name",
        description: "A display name is required for the Feed.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
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

    const { error } = await updateProfile({
      id: profile.id,
      full_name: nameVal,
      bio: bio.trim() || null,
      public_handle: normalizedHandle,
      is_public: true,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }

    applyDisplayNameToLocalProfile(nameVal);
    void refresh();
    toast({
      title: "You're in",
      description: "Your public profile is ready — welcome to the Feed.",
    });
    setLocation("/community");
  }

  if (loading && !profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <PageShell variant="narrow" density="compact" className="space-y-6 pb-10 pt-4">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="relative">
            <div aria-hidden className="absolute inset-0 scale-125 rounded-full bg-primary/15 blur-2xl" />
            <div className="relative rounded-3xl bg-card/80 p-3 shadow-md ring-1 ring-border/60 backdrop-blur-sm">
              <FaceLogo size={56} />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/90">Community Member</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            Set up your public profile
          </h1>
          <p className="mx-auto max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            Choose how you appear on the Feed. You can change this anytime in Account.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-primary/[0.06] to-card/90 shadow-sm ring-1 ring-border/40">
        <div className="border-b border-border/50 px-4 py-3 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
          <div
            className="mt-2 rounded-xl bg-muted/20 px-3.5 py-3.5 ring-1 ring-border/40"
            data-testid="community-setup-preview"
          >
            <p className="text-sm font-semibold text-foreground">{fullName.trim() || "Your name"}</p>
            <p className="mt-0.5 text-sm font-medium text-primary">@{handleSlug || "your_handle"}</p>
            {bio.trim() ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{bio.trim()}</p>
            ) : (
              <p className="mt-2 text-sm italic text-muted-foreground">Bio appears here when you add one</p>
            )}
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-4 py-5 sm:px-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-3">
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor="community-setup-public" className="mb-0 cursor-pointer text-sm font-medium">
                Public on the Feed
              </Label>
              <p className="text-xs text-muted-foreground">Required to post, follow, and message.</p>
            </div>
            <Switch
              id="community-setup-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              data-testid="community-setup-public-switch"
            />
          </div>

          {!isPublic ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
              Turn public on to join the Feed. You can still explore Tools and Coach without it.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="community-setup-name" className="inline-flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              Display name
            </Label>
            <Input
              id="community-setup-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="How you want to appear"
              autoComplete="nickname"
              className="rounded-xl"
              data-testid="community-setup-name"
              required={isPublic}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="community-setup-handle" className="inline-flex items-center gap-1.5">
              <AtSign className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              Handle
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                @
              </span>
              <Input
                id="community-setup-handle"
                value={handleInput.replace(/^@/, "")}
                onChange={(e) => setHandleInput(e.target.value.replace(/^@/, ""))}
                placeholder="your_handle"
                autoComplete="username"
                className="rounded-xl pl-8"
                data-testid="community-setup-handle"
                required={isPublic}
              />
            </div>
            <p
              className={cn(
                "text-xs",
                handleAvailability === "taken" || handleAvailability === "invalid"
                  ? "text-destructive"
                  : handleAvailability === "available"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground",
              )}
            >
              {handleHint}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="community-setup-bio">
              Bio <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="community-setup-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short line about you"
              rows={3}
              className="min-h-[4.5rem] rounded-xl resize-none"
              data-testid="community-setup-bio"
            />
          </div>

          <Button
            type="submit"
            className="min-h-12 w-full rounded-xl text-base font-semibold"
            disabled={!canSubmit}
            data-testid="community-setup-join"
          >
            {saving ? (
              "Saving…"
            ) : (
              <>
                Join the Feed
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </>
            )}
          </Button>

          <div className="flex flex-col items-center gap-2 pt-1">
            <Button asChild type="button" variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="/tools">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Browse tools first
              </Link>
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Photo and other account details are in{" "}
              <Link href="/account" className="font-medium text-primary underline-offset-2 hover:underline">
                Account
              </Link>
              .
            </p>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
