import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { storage } from "@/lib/storage";
import { useLocation } from "wouter";

export function MessagesIcon() {
  const [, setLocation] = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnread = () => {
      setUnreadCount(storage.getTotalUnreadCount());
    };
    
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="relative" 
      onClick={() => setLocation("/community?tab=messages")}
      data-testid="button-messages"
    >
      <Mail className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge 
          variant="default" 
          className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
