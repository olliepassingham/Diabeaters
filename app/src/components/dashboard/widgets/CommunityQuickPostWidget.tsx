import { Link, useLocation } from "wouter";
import { CardContent } from "@/components/ui/card";
import { FeedComposerSheet } from "@/components/community/feed-composer-sheet";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useFeedComposer } from "@/hooks/use-feed-composer";
import { useOffline } from "@/hooks/use-offline";
import { useAuth } from "@/lib/auth-context";
import { isCommunityEnabled } from "@/lib/flags";
import { useProfile } from "@/lib/profile";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";

export function CommunityQuickPostWidget(_props: DashboardWidgetLayoutProps) {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const isOffline = useOffline();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const composer = useFeedComposer({
    closeSheetOnPost: true,
    suppressPostedToast: true,
    onPosted: () => {
      toast({
        title: "Posted",
        description: "Your post is live on the community feed.",
        action: (
          <ToastAction altText="Open community feed" onClick={() => setLocation("/community")}>
            View feed
          </ToastAction>
        ),
      });
    },
  });

  if (isOffline || !isCommunityEnabled || loading || !profile?.is_public) return null;

  return (
    <WidgetCard
      data-testid="widget-community-quick-post"
      accent="community"
      className="py-0"
    >
      <CardContent className="px-2 py-1 sm:px-3">
        <FeedComposerSheet
          open={composer.sheetOpen}
          onOpenChange={composer.setSheetOpen}
          pillPreview={composer.pillPreview}
          avatarDisplayName={composer.avatarDisplayName}
          avatarPath={composer.avatarPath}
          profileHref={composer.profileHref}
          formBodyProps={composer.formBodyProps}
          onSubmit={composer.handlePost}
          disabled={!user}
          pillTestId="dashboard-feed-composer-pill"
          formTestId="dashboard-feed-composer-form"
          footer={
            !composer.hasFeedHandle ? (
              <p className="mt-2 text-xs text-muted-foreground">
                <Link href="/account#profile" className="font-medium text-primary underline-offset-4 hover:underline">
                  Open Profile
                </Link>{" "}
                to choose your @handle (required to post).
              </p>
            ) : null
          }
        />
      </CardContent>
    </WidgetCard>
  );
}
