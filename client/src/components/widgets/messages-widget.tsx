import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { storage, Conversation } from "@/lib/storage";

export function MessagesWidget({ compact = false }: { compact?: boolean }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    const convs = storage.getConversations();
    setConversations(convs.slice(0, 3));
    setTotalUnread(storage.getTotalUnreadCount());
  }, []);

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-messages">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Messages</CardTitle>
          </div>
          {totalUnread > 0 && (
            <Badge variant="default" data-testid="badge-unread-count">
              {totalUnread} new
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            No messages yet
          </p>
        ) : (
          <div className="space-y-2">
            {(compact ? conversations.slice(0, 2) : conversations).map((conv) => (
              <div 
                key={conv.id} 
                className="p-2 rounded-lg bg-muted/30 flex items-center justify-between"
                data-testid={`message-preview-${conv.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{conv.participantName}</p>
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  )}
                </div>
                {conv.unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-2">{conv.unreadCount}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
        
        <Link href="/community">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-view-messages">
            View All Messages
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
