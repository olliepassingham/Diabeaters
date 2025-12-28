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
  Heart
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
  DirectMessage
} from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";

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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="posts" data-testid="tab-posts">
              <MessageCircle className="h-4 w-4 mr-2" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages">
              <Mail className="h-4 w-4 mr-2" />
              Messages
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
