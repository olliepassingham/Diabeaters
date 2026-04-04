import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { normalizePublicHandleInput, updateProfile, useProfile } from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function CommunitySettingsPage() {
  const { profile, loading, refresh } = useProfile();
  const { toast } = useToast();
  const [bio, setBio] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? "");
    setHandleInput(profile.public_handle ?? "");
    setIsPublic(profile.is_public);
  }, [profile]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
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
      bio: bio.trim() || null,
      public_handle: normalizedHandle,
      is_public: isPublic,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    void refresh();
    toast({ title: "Saved", description: "Your community profile was updated." });
  }

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Community profile" />
        <p className="text-sm text-muted-foreground">Connect Supabase to edit your community profile.</p>
      </PageShell>
    );
  }

  return (
    <PageShell variant="standard" className="max-w-lg mx-auto space-y-4 pb-24">
      <PageHeader
        leading={<PageBackButton />}
        title="Community profile"
        description="Public name and photo come from your account. Choose a handle, short bio, and whether your profile card is visible to others."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Visibility & identity</CardTitle>
          <CardDescription>
            Emergency and clinical details are never shown on community.{" "}
            <Link href="/account" className="text-primary underline-offset-4 hover:underline">
              Account
            </Link>{" "}
            for photo and display name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="pub">Public profile</Label>
                <p className="text-xs text-muted-foreground">Let signed-in members see your community card.</p>
              </div>
              <Switch id="pub" checked={isPublic} onCheckedChange={setIsPublic} disabled={loading} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="handle">Community handle</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground select-none" aria-hidden>
                  @
                </span>
                <Input
                  id="handle"
                  placeholder="your_handle"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={30}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                3–30 characters: lowercase letters, numbers, underscores. Share:{" "}
                {handleInput.trim() ? (
                  <Link
                    href={`/community/u/${encodeURIComponent(handleInput.replace(/^@/, "").trim())}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    /community/u/{handleInput.replace(/^@/, "").trim().toLowerCase()}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">set a handle for a link</span>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={4}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short intro for the community (not medical advice)."
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={saving || loading}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
