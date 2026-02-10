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
    <Card data-testid="widget-community">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Community</CardTitle>
          </div>
          <Link href="/community">
            <Button variant="ghost" size="sm" data-testid="button-view-community">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
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
