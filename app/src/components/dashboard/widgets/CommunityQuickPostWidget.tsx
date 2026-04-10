import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Send } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { isCommunityEnabled } from "@/lib/flags";
import { useProfile } from "@/lib/profile";
import {
  DEFAULT_COMMUNITY_TOPIC,
  buildMentionsForPost,
  insertFeedPost,
} from "@/lib/community";
import { ToastAction } from "@/components/ui/toast";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";

const PLACEHOLDER = "What is on your mind?";

export function CommunityQuickPostWidget(_props: DashboardWidgetLayoutProps) {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  if (!isCommunityEnabled || loading || !profile?.is_public) return null;

  const trimmed = text.trim();
  const canPost = trimmed.length > 0 && !posting && Boolean(user);

  async function handlePost() {
    if (!user || !trimmed) {
      toast({
        title: "Add something to post",
        description: "Write a short message first.",
        variant: "destructive",
      });
      return;
    }
    setPosting(true);
    try {
      const mentions = await buildMentionsForPost(text, user.id);
      const res = await insertFeedPost({
        kind: "standard",
        topic: DEFAULT_COMMUNITY_TOPIC,
        body: text,
        mentions,
      });
      if (res.error) {
        toast({
          title: "Could not post",
          description: res.error.message,
          variant: "destructive",
        });
        return;
      }
      setText("");
      toast({
        title: "Posted",
        description: "Your post is live on the community feed.",
        action: (
          <ToastAction altText="Open community feed" onClick={() => setLocation("/community")}>
            View feed
          </ToastAction>
        ),
      });
    } finally {
      setPosting(false);
    }
  }

  return (
    <WidgetCard
      data-testid="widget-community-quick-post"
      className="border-border/60 bg-gradient-to-b from-card to-muted/20 py-0 shadow-sm"
    >
      <CardContent className="px-3 py-3">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void handlePost();
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void handlePost();
              }
            }}
            placeholder={PLACEHOLDER}
            rows={2}
            disabled={posting}
            className="min-h-[4.25rem] resize-none text-sm flex-1 border-muted-foreground/20 bg-background/80 shadow-inner focus-visible:ring-primary/25"
            maxLength={8000}
            data-testid="input-dashboard-quick-post"
            aria-label={PLACEHOLDER}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!canPost}
            className="h-9 shrink-0 gap-1.5 px-4 sm:self-stretch"
            data-testid="button-dashboard-quick-post"
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            Post
          </Button>
        </form>
      </CardContent>
    </WidgetCard>
  );
}
