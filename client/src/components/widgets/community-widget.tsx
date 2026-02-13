import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, MessageCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { storage, CommunityPost } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";

export function CommunityWidget({ compact = false }: { compact?: boolean }) {
  const [recentPosts, setRecentPosts] = useState<CommunityPost[]>([]);

  useEffect(() => {
    const posts = storage.getCommunityPosts();
    setRecentPosts(posts.slice(0, 3));
  }, []);

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-community">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/community">
            <div className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className={compact ? "text-base" : "text-lg"}>Community</CardTitle>
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-normal no-default-hover-elevate no-default-active-elevate">Beta</Badge>
            </div>
          </Link>
        </div>
        {!compact && <CardDescription>Connect with others who understand</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {recentPosts.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">No posts yet. Be the first to start a conversation!</p>
            <Link href="/community">
              <Button size="sm" data-testid="button-ask-question">
                Ask a Question
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {(compact ? recentPosts.slice(0, 2) : recentPosts).map((post) => (
              <Link key={post.id} href="/community">
                <div 
                  className="p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer transition-all"
                  data-testid={`community-post-preview-${post.id}`}
                >
                  <p className="font-medium text-sm line-clamp-1 mb-1">{post.title}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="h-3 w-3" />
                      {post.replyCount}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/community">
              <Button variant="outline" size="sm" className="w-full" data-testid="button-join-discussion">
                Join the Discussion
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
