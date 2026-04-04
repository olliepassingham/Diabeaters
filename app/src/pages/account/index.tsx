import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { isUserVerified } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import {
  fetchPatientProfileForCarer,
  listLinkedPatientsForCarer,
  normaliseScopes,
  useLinkedPatient,
} from "@/lib/carers";
import { upsertProfile, updateProfile, useProfile } from "@/lib/profile";
import { getSupabase } from "@/lib/supabase";
import { uploadProfileAvatar } from "@/lib/storage-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";
import { useToast } from "@/hooks/use-toast";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { SettingsEmergencySection } from "@/pages/settings/shared";
import { storage } from "@/lib/storage";
import type { LinkedPatientWithProfile } from "@/lib/carers.types";
import { getActiveCarerPatientId, setActiveCarerPatientId } from "@/lib/carer-session";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Eye, Phone } from "lucide-react";
import heic2any from "heic2any";

const SUPPORT_EMAIL = "support@yourdomain.com";

function getInitial(email: string): string {
  const first = email.trim().charAt(0).toUpperCase();
  return first || "?";
}

export default function Account() {
  const { user } = useAuth();
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const { data: linkedPatient } = useLinkedPatient();
  const isCarer = !!linkedPatient;
  const { profile, loading: profileLoading, refresh } = useProfile();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const {
    displayUrl: avatarDisplayUrl,
    resolveError: avatarResolveError,
    isPending: avatarUrlPending,
  } = useResolvedProfileImageUrl(avatarPath);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const avatarLoadErrorToastShown = useRef(false);

  useEffect(() => {
    avatarLoadErrorToastShown.current = false;
  }, [avatarPath]);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkedPatients, setLinkedPatients] = useState<LinkedPatientWithProfile[]>([]);
  const [activePatientId, setActivePatientIdState] = useState<string | null>(null);
  const [patientProfile, setPatientProfile] = useState<Awaited<ReturnType<typeof fetchPatientProfileForCarer>>["data"]>(null);
  const [patientLoadError, setPatientLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || profileLoading) return;
    if (profile) {
      setAvatarPath(profile.avatar_url ?? null);
    } else {
      void upsertProfile({ id: user.id }).then(({ error }) => {
        if (!error) void refresh();
      });
    }
  }, [user?.id, profile, profileLoading, refresh]);

  useEffect(() => {
    setAvatarImgFailed(false);
  }, [avatarPath, avatarDisplayUrl]);

  const showAvatarLoadErrorToast = useCallback(
    (description: string) => {
      toast({
        title: "Photo can't be displayed",
        description,
        variant: "destructive",
      });
    },
    [toast],
  );

  useEffect(() => {
    if (!avatarPath?.trim()) {
      return;
    }
    if (avatarUrlPending || avatarDisplayUrl) {
      return;
    }
    if (avatarResolveError && !avatarLoadErrorToastShown.current) {
      avatarLoadErrorToastShown.current = true;
      showAvatarLoadErrorToast(
        `${avatarResolveError} Check Storage policies for bucket "profile_pictures" (authenticated SELECT).`,
      );
    }
  }, [
    avatarPath,
    avatarDisplayUrl,
    avatarResolveError,
    avatarUrlPending,
    showAvatarLoadErrorToast,
  ]);

  useEffect(() => {
    if (!user) return;
    if (!isCarer) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#account-emergency") return;
    setLocation("/settings/emergency");
  }, [user, isCarer, setLocation]);

  if (!user) return null;

  const verified = isUserVerified(user);
  const email = user.email ?? "";
  const initial = getInitial(email);
  const userId = user.id;

  async function handleSignOut() {
    const supabase = getSupabase();
    if (!supabase) {
      toast({
        title: "Could not sign out",
        description: "Auth is not configured on this build.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Could not sign out", description: error.message, variant: "destructive" });
      return;
    }
    setLocation("/login");
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadSubmitting(true);
    let toUpload: File = file;
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif");
    if (isHeic) {
      try {
        const converted = (await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        })) as Blob | Blob[];
        const blob = Array.isArray(converted) ? converted[0] : converted;
        if (!blob) throw new Error("No image data returned");

        const base = file.name.replace(/\.(heic|heif)$/i, "") || "avatar";
        toUpload = new File([blob], `${base}.jpg`, { type: "image/jpeg" });
      } catch (err) {
        setUploadSubmitting(false);
        toast({
          title: "Upload failed",
          description:
            err instanceof Error
              ? `Could not convert HEIC photo to JPEG. ${err.message}`
              : "Could not convert HEIC photo to JPEG.",
          variant: "destructive",
        });
        return;
      }
    }

    const uploadResult = await uploadProfileAvatar(toUpload);
    if (uploadResult.error) {
      setUploadSubmitting(false);
      toast({
        title: "Upload failed",
        description: uploadResult.error.message,
        variant: "destructive",
      });
      return;
    }
    const path = uploadResult.path;
    if (!path) {
      setUploadSubmitting(false);
      toast({
        title: "Upload failed",
        description: "No path returned.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await updateProfile({ id: userId, avatar_url: path });
    setUploadSubmitting(false);
    if (error) {
      toast({
        title: "Profile update failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setAvatarPath(path);
    void refresh();
    toast({ title: "Avatar updated", description: "Your photo has been saved." });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const settingsName = storage.getProfile()?.name?.trim() ?? "";
  const displayName = profile?.full_name?.trim() || settingsName || "Your account";
  const nameForInitials = profile?.full_name?.trim() || settingsName;
  const showAvatarImage = Boolean(avatarDisplayUrl && !avatarImgFailed);

  const activeLink = useMemo(
    () => linkedPatients.find((p) => p.patientId === activePatientId) ?? null,
    [linkedPatients, activePatientId],
  );

  const patientOptions = useMemo(
    () =>
      linkedPatients.map((p) => ({
        id: p.patientId,
        label: p.patient_full_name?.trim() || "Supported person",
      })),
    [linkedPatients],
  );

  const canSeePatientEmergency = useMemo(() => {
    if (!activeLink) return false;
    const scopes = normaliseScopes(activeLink.scopes);
    return Boolean(scopes.emergency_info);
  }, [activeLink]);

  useEffect(() => {
    if (!isCarer) return;
    let active = true;
    (async () => {
      setPatientLoadError(null);
      const { data, error } = await listLinkedPatientsForCarer();
      if (!active) return;
      if (error) {
        setLinkedPatients([]);
        setActivePatientIdState(null);
        setPatientProfile(null);
        setPatientLoadError(error.message);
        return;
      }
      const rows = data ?? [];
      setLinkedPatients(rows);
      if (rows.length === 0) {
        setActivePatientIdState(null);
        setPatientProfile(null);
        return;
      }
      const remembered = getActiveCarerPatientId();
      const picked =
        (remembered && rows.some((r) => r.patientId === remembered) && remembered) ||
        rows[0]!.patientId;
      setActiveCarerPatientId(picked);
      setActivePatientIdState(picked);
    })();
    return () => {
      active = false;
    };
  }, [isCarer]);

  useEffect(() => {
    if (!isCarer) return;
    if (!activeLink) return;
    let active = true;
    (async () => {
      setPatientLoadError(null);
      setPatientProfile(null);
      if (!canSeePatientEmergency) return;
      const res = await fetchPatientProfileForCarer(activeLink.patientId);
      if (!active) return;
      if (res.error) {
        setPatientLoadError(res.error.message);
        setPatientProfile(null);
        return;
      }
      setPatientProfile(res.data);
    })();
    return () => {
      active = false;
    };
  }, [isCarer, activeLink, canSeePatientEmergency]);

  const onPatientChange = (patientId: string) => {
    setActiveCarerPatientId(patientId);
    setActivePatientIdState(patientId);
  };

  return (
    <PageShell variant="narrow" className="md:max-w-2xl space-y-6 py-4 md:py-8">
      <PageHeader
        leading={<PageBackButton />}
        title="Account"
        description={
          isCarer
            ? "Your account, plus a read-only snapshot of the person you support."
            : "Your profile, emergency details, and sign-in options."
        }
        className="max-w-xl"
      />
      <Card className="animate-fade-in-up rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div
              className="mx-auto flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/80 dark:bg-muted/50 avatar-hover-scale sm:mx-0 sm:h-24 sm:w-24"
              data-testid={showAvatarImage ? "avatar-preview" : "avatar-placeholder"}
              {...(!showAvatarImage && {
                role: "img" as const,
                "aria-label": "No avatar",
              })}
            >
              {showAvatarImage ? (
                <img
                  src={avatarDisplayUrl!}
                  alt="Profile avatar"
                  className="w-full h-full object-cover"
                  data-testid="avatar-img"
                  onError={() => setAvatarImgFailed(true)}
                />
              ) : (
                <span className="text-xl font-medium text-muted-foreground sm:text-2xl" aria-hidden>
                  {nameForInitials
                    ? nameForInitials
                        .split(/\s+/)
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : initial}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{displayName}</h1>
              <p className="text-sm text-muted-foreground break-all">{email}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <span
                  data-testid={verified ? "status-verified" : "status-unverified"}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    verified
                      ? "text-green-700 bg-green-50 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800/50"
                      : "text-muted-foreground bg-muted/60 dark:bg-muted/40 border-border dark:border-border"
                  }`}
                >
                  {verified ? "Verified" : "Unverified"}
                </span>
              </div>
              <div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto pb-0.5 pt-2 [-webkit-overflow-scrolling:touch] sm:justify-start [&_a]:shrink-0 [&_button]:shrink-0">
                {hasCarerLink && (
                  <Button variant="outline" size="sm" className="min-h-11" asChild>
                    <Link href="/mode" data-testid="link-switch-mode">
                      Switch mode
                    </Link>
                  </Button>
                )}
                {isCarer && (
                  <Button variant="outline" size="sm" className="min-h-11" asChild>
                    <Link href="/carer-view" data-testid="link-back-to-carer-view">
                      Back to Carer View
                    </Link>
                  </Button>
                )}
                {!isCarer && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      id="avatar-file"
                      onChange={handleAvatarUpload}
                      disabled={uploadSubmitting}
                      aria-label="Choose profile photo"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadSubmitting}
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      data-testid="avatar-upload"
                    >
                      {uploadSubmitting ? "Uploading…" : "Upload new photo"}
                    </Button>
                  </>
                )}
                {!isCarer && (
                  <Button variant="outline" size="sm" className="min-h-11" asChild>
                    <Link href="/family-carers" data-testid="link-manage-carers">
                      Manage carers
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="min-h-11" asChild>
                  <Link href="/settings" data-testid="link-account-settings">
                    Settings
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!verified && (
        <Alert
          data-testid="banner-unverified"
          className="border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/20 dark:border-amber-500/30 animate-fade-in-up"
        >
          <AlertDescription>
            Your email is not verified. Please verify to secure all features.{" "}
            <Button variant="outline" size="sm" className="mt-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" asChild>
              <Link href="/check-email">Go to check email</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isCarer && (
        <Card
          id="account-emergency"
          className="animate-fade-in-up scroll-mt-24 rounded-2xl border-border/60 shadow-sm ring-1 ring-border/40"
        >
          <CardContent className="p-6 space-y-4">
            <SettingsEmergencySection variant="embedded" />
          </CardContent>
        </Card>
      )}

      {isCarer && (
        <Card
          className="animate-fade-in-up rounded-2xl border-border/60 shadow-sm overflow-hidden"
          data-testid="carer-account-supported-person"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Supported person
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {patientLoadError ? (
              <Alert variant="destructive">
                <AlertDescription>{patientLoadError}</AlertDescription>
              </Alert>
            ) : null}

            {patientOptions.length > 1 && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">You’re viewing</p>
                  <p className="text-xs text-muted-foreground">Switch which person you’re supporting.</p>
                </div>
                <div className="w-56 shrink-0">
                  <Select value={activePatientId ?? undefined} onValueChange={onPatientChange}>
                    <SelectTrigger aria-label="Select supported person">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {patientOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {activeLink && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  Viewing:{" "}
                  <span className="ml-1 font-medium">
                    {activeLink.patient_full_name?.trim() || "Supported person"}
                  </span>
                </Badge>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/carer-view">Open full Carer View</Link>
                </Button>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <p className="font-medium">Emergency details</p>
                </div>
                <Badge variant="secondary">Read only</Badge>
              </div>

              {!activeLink ? (
                <p className="text-sm text-muted-foreground">No supported person selected.</p>
              ) : !canSeePatientEmergency ? (
                <p className="text-sm text-muted-foreground">
                  Emergency details are not shared for this person.
                </p>
              ) : patientLoadError ? (
                <p className="text-sm text-muted-foreground">Could not load emergency details.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {patientProfile?.emergency_contact_name ? (
                    <p>
                      <span className="text-muted-foreground">Name: </span>
                      {patientProfile.emergency_contact_name}
                    </p>
                  ) : null}
                  {patientProfile?.emergency_contact_phone ? (
                    <p>
                      <a
                        href={`tel:${patientProfile.emergency_contact_phone.replace(/\s+/g, "")}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        aria-label={`Call ${patientProfile.emergency_contact_phone}`}
                      >
                        {patientProfile.emergency_contact_phone}
                      </a>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">No phone number saved.</p>
                  )}
                  {patientProfile?.emergency_notes ? (
                    <p className="text-muted-foreground whitespace-pre-wrap">{patientProfile.emergency_notes}</p>
                  ) : null}
                  {!patientProfile?.emergency_contact_name &&
                    !patientProfile?.emergency_contact_phone &&
                    !patientProfile?.emergency_notes && (
                      <p className="text-muted-foreground">They have not added emergency details yet.</p>
                    )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="animate-fade-in-up rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            size="default"
            className="min-h-11 w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleSignOut}
            data-testid="btn-sign-out"
          >
            Sign out
          </Button>
          <Button
            variant="outline"
            size="default"
            className="min-h-11 w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            asChild
          >
            <Link href="/reset-request" data-testid="btn-reset-password">
              Reset password
            </Link>
          </Button>

          <Button variant="ghost" size="default" className="min-h-11 w-full sm:w-auto text-muted-foreground hover:text-destructive" asChild>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`}
              data-testid="account-delete-link"
            >
              Request account deletion
            </a>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
