import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageCircle, 
  Plus, 
  ArrowLeft, 
  Flag, 
  Clock, 
  User, 
  Users,
  Plane,
  Thermometer,
  Dumbbell,
  Utensils,
  Brain,
  Lightbulb,
  HelpCircle,
  Send,
  Mail,
  UserPlus,
  UserMinus,
  Heart,
  Play,
  ExternalLink,
  Film,
  Star,
  CalendarDays,
  MapPin,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  storage, 
  CommunityPost, 
  CommunityReply, 
  COMMUNITY_TOPICS, 
  CommunityTopicId,
  UserProfile,
  Conversation,
  DirectMessage,
  CommunityReel,
  ReelPlatform,
  DiabetesEvent
} from "@/lib/storage";
import { format, formatDistanceToNow } from "date-fns";

const TOPIC_ICONS: Record<CommunityTopicId, typeof Plane> = {
  "holidays-travel": Plane,
  "sick-days": Thermometer,
  "exercise-activity": Dumbbell,
  "food-eating-out": Utensils,
  "mental-health": Brain,
  "tips-what-worked": Lightbulb,
  "general-questions": HelpCircle,
};

function TopicBadge({ topic }: { topic: CommunityTopicId }) {
  const topicData = COMMUNITY_TOPICS.find(t => t.id === topic);
  const Icon = TOPIC_ICONS[topic];
  
  return (
    <Badge variant="secondary" className="gap-1">
      <Icon className="h-3 w-3" />
      {topicData?.label || topic}
    </Badge>
  );
}

function UserActions({ 
  userName, 
  isAnonymous,
  onMessage,
  currentUserName,
}: { 
  userName?: string;
  isAnonymous: boolean;
  onMessage: (name: string) => void;
  currentUserName?: string;
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userName && !isAnonymous) {
      setIsFollowing(storage.isFollowing(userName));
    }
  }, [userName, isAnonymous]);

  if (isAnonymous || !userName) return null;
  if (userName === currentUserName) return null;

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFollowing) {
      storage.unfollowUser(userName);
      setIsFollowing(false);
      toast({ title: `Unfollowed ${userName}` });
    } else {
      storage.followUser(userName);
      setIsFollowing(true);
      toast({ title: `Now following ${userName}` });
    }
  };

  const handleMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMessage(userName);
  };

  return (
    <div className="flex items-center gap-1">
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 px-2"
        onClick={handleMessage}
        data-testid={`button-dm-${userName}`}
      >
        <Mail className="h-3 w-3" />
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className={`h-7 px-2 ${isFollowing ? "text-primary" : ""}`}
        onClick={handleFollow}
        data-testid={`button-follow-${userName}`}
      >
        {isFollowing ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function PostCard({ 
  post, 
  onClick,
  onMessage,
  currentUserName,
}: { 
  post: CommunityPost; 
  onClick: () => void;
  onMessage: (name: string) => void;
  currentUserName?: string;
}) {
  return (
    <Card 
      className="cursor-pointer hover-elevate transition-all" 
      onClick={onClick}
      data-testid={`card-post-${post.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <TopicBadge topic={post.topic} />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </div>
        </div>
        
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{post.title}</h3>
        
        {post.content && (
          <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
            {post.content}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>{post.isAnonymous ? "Anonymous" : (post.authorName || "Someone")}</span>
            </div>
            <UserActions 
              userName={post.authorName} 
              isAnonymous={post.isAnonymous}
              onMessage={onMessage}
              currentUserName={currentUserName}
            />
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <span>{post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReplyCard({ 
  reply, 
  onReport,
  onMessage,
  currentUserName,
}: { 
  reply: CommunityReply; 
  onReport: () => void;
  onMessage: (name: string) => void;
  currentUserName?: string;
}) {
  return (
    <div className="p-4 bg-muted/30 rounded-lg" data-testid={`reply-${reply.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className={reply.isAnonymous ? "text-muted-foreground" : ""}>
            {reply.isAnonymous ? "Anonymous" : (reply.authorName || "Someone")}
          </span>
          <UserActions 
            userName={reply.authorName} 
            isAnonymous={reply.isAnonymous}
            onMessage={onMessage}
            currentUserName={currentUserName}
          />
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground text-xs">
            {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-muted-foreground"
          onClick={onReport}
          data-testid={`button-report-reply-${reply.id}`}
        >
          <Flag className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-sm">{reply.content}</p>
    </div>
  );
}

function ConversationItem({ 
  conversation, 
  onClick,
  isActive,
}: { 
  conversation: Conversation; 
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <div 
      className={`p-3 rounded-lg cursor-pointer hover-elevate transition-all ${isActive ? "bg-primary/10" : "bg-muted/30"}`}
      onClick={onClick}
      data-testid={`conversation-${conversation.id}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{conversation.participantName}</span>
        {conversation.unreadCount > 0 && (
          <Badge variant="default" className="h-5 min-w-5 justify-center">
            {conversation.unreadCount}
          </Badge>
        )}
      </div>
      {conversation.lastMessage && (
        <p className="text-sm text-muted-foreground line-clamp-1">
          {conversation.lastMessage}
        </p>
      )}
      {conversation.lastMessageAt && (
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

function MessagesView({ 
  currentUserName,
  initialRecipient,
  onClearRecipient,
}: { 
  currentUserName?: string;
  initialRecipient?: string;
  onClearRecipient: () => void;
}) {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (initialRecipient && currentUserName) {
      const conv = storage.getOrCreateConversation(initialRecipient);
      setSelectedConversation(conv);
      setMessages(storage.getMessages(conv.id));
      loadConversations();
      onClearRecipient();
    }
  }, [initialRecipient, currentUserName]);

  useEffect(() => {
    if (selectedConversation) {
      setMessages(storage.getMessages(selectedConversation.id));
      storage.markConversationRead(selectedConversation.id);
      loadConversations();
    }
  }, [selectedConversation]);

  const loadConversations = () => {
    setConversations(storage.getConversations());
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation || !currentUserName) return;
    
    storage.sendMessage(selectedConversation.id, newMessage.trim(), currentUserName);
    setNewMessage("");
    setMessages(storage.getMessages(selectedConversation.id));
    loadConversations();
  };

  if (!currentUserName) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">Set up your profile</h3>
          <p className="text-muted-foreground">
            To send and receive messages, please complete your profile in Settings with your name.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (selectedConversation) {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedConversation(null)}
          data-testid="button-back-to-inbox"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inbox
        </Button>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedConversation.participantName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] mb-4">
              <div className="space-y-3 pr-4">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={`p-3 rounded-lg max-w-[80%] ${
                        msg.senderName === currentUserName 
                          ? "bg-primary text-primary-foreground ml-auto" 
                          : "bg-muted"
                      }`}
                      data-testid={`message-${msg.id}`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-xs mt-1 ${
                        msg.senderName === currentUserName 
                          ? "text-primary-foreground/70" 
                          : "text-muted-foreground"
                      }`}>
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                data-testid="input-message"
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">No messages yet</h3>
            <p className="text-muted-foreground">
              When you message someone from the community, your conversations will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            onClick={() => setSelectedConversation(conv)}
            isActive={false}
          />
        ))
      )}
    </div>
  );
}

const PLATFORM_COLORS: Record<ReelPlatform, string> = {
  tiktok: "bg-black text-white",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  youtube: "bg-red-600 text-white",
};

const PLATFORM_LABELS: Record<ReelPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

function ReelCard({ reel }: { reel: CommunityReel }) {
  const handleWatch = () => {
    window.open(reel.sourceUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Card 
      className="overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary/50"
      onClick={handleWatch}
      data-testid={`reel-${reel.id}`}
    >
      <div className="relative aspect-[9/16] bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <Play className="h-8 w-8 text-primary ml-1" />
          </div>
          <h3 className="font-semibold text-lg line-clamp-2 mb-2">{reel.title}</h3>
          {reel.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {reel.description}
            </p>
          )}
        </div>
        
        {reel.isFeatured && (
          <div className="absolute top-3 left-3">
            <Badge className="gap-1 bg-yellow-500 text-yellow-950">
              <Star className="h-3 w-3" />
              Featured
            </Badge>
          </div>
        )}
        
        <div className="absolute top-3 right-3">
          <Badge className={PLATFORM_COLORS[reel.platform]}>
            {PLATFORM_LABELS[reel.platform]}
          </Badge>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-medium">{reel.creatorHandle}</span>
            <ExternalLink className="h-4 w-4 text-white/70" />
          </div>
        </div>
      </div>
      
      {reel.tags && reel.tags.length > 0 && (
        <div className="p-3 flex flex-wrap gap-1">
          {reel.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

function ReelsView() {
  const [reels, setReels] = useState<CommunityReel[]>([]);

  useEffect(() => {
    setReels(storage.getCommunityReels());
  }, []);

  if (reels.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Film className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">No reels yet</h3>
          <p className="text-muted-foreground">
            Check back soon for curated diabetes tips and experiences from the community.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Curated clips from diabetes creators. Tap to watch on their platform.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {reels.map((reel) => (
          <ReelCard key={reel.id} reel={reel} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-4">
        Videos are not medical advice. Always consult your healthcare team.
      </p>
    </div>
  );
}

const EVENT_TYPE_CONFIG: Record<DiabetesEvent["eventType"], { label: string; color: string }> = {
  meetup: { label: "Meetup", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  walk: { label: "Charity Walk", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  awareness: { label: "Awareness", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  conference: { label: "Conference", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  support_group: { label: "Support Group", color: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300" },
  other: { label: "Event", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

function EventsView() {
  const [events, setEvents] = useState<DiabetesEvent[]>([]);

  useEffect(() => {
    setEvents(storage.getUpcomingEvents());
  }, []);

  const handleToggleInterest = (id: string) => {
    storage.toggleEventInterest(id);
    setEvents(storage.getUpcomingEvents());
  };

  const handleOpenEvent = (url?: string) => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">No upcoming events</h3>
          <p className="text-muted-foreground">
            Check back soon for diabetes meetups, walks, and awareness events.
          </p>
        </CardContent>
      </Card>
    );
  }

  const interestedEvents = events.filter(e => e.isInterested);
  const otherEvents = events.filter(e => !e.isInterested);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Discover diabetes meetups, charity walks, and awareness events near you.
      </p>

      {interestedEvents.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Interested ({interestedEvents.length})
          </h3>
          {interestedEvents.map((event) => (
            <EventCard 
              key={event.id} 
              event={event} 
              onToggleInterest={handleToggleInterest}
              onOpenEvent={handleOpenEvent}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {interestedEvents.length > 0 && otherEvents.length > 0 && (
          <h3 className="font-medium text-sm text-muted-foreground">Other Events</h3>
        )}
        {otherEvents.map((event) => (
          <EventCard 
            key={event.id} 
            event={event} 
            onToggleInterest={handleToggleInterest}
            onOpenEvent={handleOpenEvent}
          />
        ))}
      </div>
    </div>
  );
}

function EventCard({ 
  event, 
  onToggleInterest, 
  onOpenEvent 
}: { 
  event: DiabetesEvent; 
  onToggleInterest: (id: string) => void;
  onOpenEvent: (url?: string) => void;
}) {
  const config = EVENT_TYPE_CONFIG[event.eventType];
  const eventDate = new Date(event.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Card className="overflow-hidden" data-testid={`event-card-${event.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-sm">{event.title}</span>
              <Badge variant="outline" className={`text-xs ${config.color}`}>
                {config.label}
              </Badge>
              {daysUntil <= 7 && daysUntil >= 0 && (
                <Badge variant="secondary" className="text-xs">
                  {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {format(eventDate, "d MMM yyyy")}
              </span>
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.location}
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant={event.isInterested ? "default" : "outline"}
                size="sm"
                onClick={() => onToggleInterest(event.id)}
                className="h-7 text-xs"
                data-testid={`button-interest-${event.id}`}
              >
                <Heart className={`h-3 w-3 mr-1 ${event.isInterested ? "fill-current" : ""}`} />
                {event.isInterested ? "Interested" : "I'm Interested"}
              </Button>
              {event.eventUrl && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onOpenEvent(event.eventUrl)}
                  className="h-7 text-xs"
                  data-testid={`button-open-event-${event.id}`}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  More
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Community() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("posts");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<CommunityTopicId | "all" | "following">("all");
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messageRecipient, setMessageRecipient] = useState<string | undefined>();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostTopic, setNewPostTopic] = useState<CommunityTopicId>("general-questions");
  const [newPostAnonymous, setNewPostAnonymous] = useState(true);
  
  const [newReplyContent, setNewReplyContent] = useState("");
  const [newReplyAnonymous, setNewReplyAnonymous] = useState(true);

  useEffect(() => {
    loadPosts();
    setProfile(storage.getProfile());
  }, []);

  useEffect(() => {
    loadPosts();
  }, [selectedTopic]);

  useEffect(() => {
    if (selectedPost) {
      setReplies(storage.getCommunityReplies(selectedPost.id));
    }
  }, [selectedPost]);

  const loadPosts = () => {
    if (selectedTopic === "following") {
      setPosts(storage.getPostsFromFollowed());
    } else {
      const topic = selectedTopic === "all" ? undefined : selectedTopic;
      setPosts(storage.getCommunityPosts(topic));
    }
  };

  const handleCreatePost = () => {
    if (!newPostTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your post.",
        variant: "destructive",
      });
      return;
    }

    storage.addCommunityPost({
      title: newPostTitle.trim(),
      content: newPostContent.trim() || undefined,
      topic: newPostTopic,
      authorName: newPostAnonymous ? undefined : profile?.name,
      isAnonymous: newPostAnonymous,
    });

    setNewPostTitle("");
    setNewPostContent("");
    setNewPostTopic("general-questions");
    setNewPostAnonymous(true);
    setCreateDialogOpen(false);
    loadPosts();

    toast({
      title: "Post created",
      description: "Your question has been shared with the community.",
    });
  };

  const handleCreateReply = () => {
    if (!newReplyContent.trim() || !selectedPost) return;

    storage.addCommunityReply({
      postId: selectedPost.id,
      content: newReplyContent.trim(),
      authorName: newReplyAnonymous ? undefined : profile?.name,
      isAnonymous: newReplyAnonymous,
    });

    setNewReplyContent("");
    setReplies(storage.getCommunityReplies(selectedPost.id));
    
    const updatedPost = storage.getCommunityPost(selectedPost.id);
    if (updatedPost) {
      setSelectedPost(updatedPost);
    }
    loadPosts();

    toast({
      title: "Reply posted",
      description: "Your reply has been added.",
    });
  };

  const handleReportPost = (postId: string) => {
    storage.reportCommunityPost(postId);
    toast({
      title: "Post reported",
      description: "Thank you for helping keep our community safe.",
    });
  };

  const handleReportReply = (replyId: string) => {
    storage.reportCommunityReply(replyId);
    toast({
      title: "Reply reported",
      description: "Thank you for helping keep our community safe.",
    });
  };

  const handleOpenMessage = (userName: string) => {
    setMessageRecipient(userName);
    setActiveTab("messages");
  };

  if (selectedPost) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-4">
          <Button 
            variant="ghost" 
            className="mb-4"
            onClick={() => setSelectedPost(null)}
            data-testid="button-back-to-list"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Community
          </Button>

          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between gap-2 mb-2">
                <TopicBadge topic={selectedPost.topic} />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleReportPost(selectedPost.id)}
                  data-testid="button-report-post"
                >
                  <Flag className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-xl">{selectedPost.title}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{selectedPost.isAnonymous ? "Anonymous" : (selectedPost.authorName || "Someone")}</span>
                <UserActions 
                  userName={selectedPost.authorName} 
                  isAnonymous={selectedPost.isAnonymous}
                  onMessage={handleOpenMessage}
                  currentUserName={profile?.name}
                />
                <span>·</span>
                {formatDistanceToNow(new Date(selectedPost.createdAt), { addSuffix: true })}
              </CardDescription>
            </CardHeader>
            {selectedPost.content && (
              <CardContent>
                <p className="whitespace-pre-wrap">{selectedPost.content}</p>
              </CardContent>
            )}
          </Card>

          <div className="mb-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
            </h3>

            {replies.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                No replies yet. Be the first to share your experience!
              </p>
            ) : (
              <div className="space-y-3">
                {replies.map((reply) => (
                  <ReplyCard 
                    key={reply.id} 
                    reply={reply} 
                    onReport={() => handleReportReply(reply.id)}
                    onMessage={handleOpenMessage}
                    currentUserName={profile?.name}
                  />
                ))}
              </div>
            )}
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <Textarea
                  placeholder="Share your experience or advice..."
                  value={newReplyContent}
                  onChange={(e) => setNewReplyContent(e.target.value)}
                  className="min-h-[100px]"
                  data-testid="input-reply-content"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="reply-anonymous"
                      checked={newReplyAnonymous}
                      onCheckedChange={setNewReplyAnonymous}
                      data-testid="switch-reply-anonymous"
                    />
                    <Label htmlFor="reply-anonymous" className="text-sm">
                      Post anonymously
                    </Label>
                  </div>
                  <Button 
                    onClick={handleCreateReply}
                    disabled={!newReplyContent.trim()}
                    data-testid="button-submit-reply"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Community posts are based on personal experience and are not medical advice.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Community
            </h1>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-post">
                  <Plus className="h-4 w-4 mr-2" />
                  Ask Question
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Ask the Community</DialogTitle>
                  <DialogDescription>
                    Share a question or start a discussion. You're not alone in this!
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="post-title">Question or Title</Label>
                    <Input
                      id="post-title"
                      placeholder="What would you like to ask?"
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      data-testid="input-post-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-content">More Details (optional)</Label>
                    <Textarea
                      id="post-content"
                      placeholder="Add any extra context..."
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="min-h-[100px]"
                      data-testid="input-post-content"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-topic">Topic</Label>
                    <Select value={newPostTopic} onValueChange={(v) => setNewPostTopic(v as CommunityTopicId)}>
                      <SelectTrigger data-testid="select-post-topic">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMUNITY_TOPICS.map((topic) => {
                          const Icon = TOPIC_ICONS[topic.id];
                          return (
                            <SelectItem key={topic.id} value={topic.id}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {topic.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="post-anonymous"
                      checked={newPostAnonymous}
                      onCheckedChange={setNewPostAnonymous}
                      data-testid="switch-post-anonymous"
                    />
                    <Label htmlFor="post-anonymous">Post anonymously</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreatePost} data-testid="button-submit-post">
                    Post Question
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-muted-foreground">
            A group of people who get it. Share experiences, ask questions, support each other.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="posts" data-testid="tab-posts">
              <MessageCircle className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Posts</span>
            </TabsTrigger>
            <TabsTrigger value="events" data-testid="tab-events">
              <CalendarDays className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Events</span>
            </TabsTrigger>
            <TabsTrigger value="reels" data-testid="tab-reels">
              <Film className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Reels</span>
            </TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages">
              <Mail className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            <div className="mb-4">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-2 pb-2">
                  <Button
                    variant={selectedTopic === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTopic("all")}
                    data-testid="filter-all"
                  >
                    All
                  </Button>
                  <Button
                    variant={selectedTopic === "following" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTopic("following")}
                    className="gap-1"
                    data-testid="filter-following"
                  >
                    <Heart className="h-4 w-4" />
                    Following
                  </Button>
                  {COMMUNITY_TOPICS.map((topic) => {
                    const Icon = TOPIC_ICONS[topic.id];
                    return (
                      <Button
                        key={topic.id}
                        variant={selectedTopic === topic.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTopic(topic.id)}
                        className="gap-1"
                        data-testid={`filter-${topic.id}`}
                      >
                        <Icon className="h-4 w-4" />
                        {topic.label}
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {posts.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  {selectedTopic === "following" ? (
                    <>
                      <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold text-lg mb-2">No posts from followed users</h3>
                      <p className="text-muted-foreground mb-4">
                        Follow community members to see their posts here.
                      </p>
                    </>
                  ) : (
                    <>
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold text-lg mb-2">No posts yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Be the first to start a conversation!
                      </p>
                      <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Ask a Question
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    onClick={() => setSelectedPost(post)}
                    onMessage={handleOpenMessage}
                    currentUserName={profile?.name}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <EventsView />
          </TabsContent>

          <TabsContent value="reels" className="mt-4">
            <ReelsView />
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <MessagesView 
              currentUserName={profile?.name}
              initialRecipient={messageRecipient}
              onClearRecipient={() => setMessageRecipient(undefined)}
            />
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Community posts are based on personal experience and are not medical advice.
        </p>
      </div>
    </div>
  );
}
