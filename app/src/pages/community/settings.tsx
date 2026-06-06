import { AccountCommunityProfileFields } from "@/components/account-community-profile-fields";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { isSupabaseConfigured } from "@/lib/supabase";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";

export default function CommunitySettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Community profile" />
        <p className="text-sm text-muted-foreground">Connect Supabase to edit your profile.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="standard"
      className="max-w-lg mx-auto space-y-4 pb-4"
    >
      <PageHeader
        leading={<PageBackButton />}
        title="Community profile"
        description={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>Your name and photo are managed on Account.</span>
            <InlineInfoHint
              ariaLabel="Where to edit profile"
              content="The same options are on Account under Community profile."
            />
          </span>
        }
      />

      <AccountCommunityProfileFields variant="standalone" idPrefix="cs" showAccountLinkInCopy />
    </PageShell>
  );
}
