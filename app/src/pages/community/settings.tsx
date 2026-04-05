import { AccountCommunityProfileFields } from "@/components/account-community-profile-fields";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function CommunitySettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Feed profile" />
        <p className="text-sm text-muted-foreground">Connect Supabase to edit your feed profile.</p>
      </PageShell>
    );
  }

  return (
    <PageShell variant="standard" className="max-w-lg mx-auto space-y-4 pb-24">
      <PageHeader
        leading={<PageBackButton />}
        title="Feed profile"
        description="Public name and photo come from your account. The same options are on Account."
      />

      <AccountCommunityProfileFields variant="standalone" idPrefix="cs" showAccountLinkInCopy />
    </PageShell>
  );
}
