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
import { Separator } from "@/components/ui/separator";
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
  Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  storage, 
  CommunityPost, 
  CommunityReply, 
  COMMUNITY_TOPICS, 
  CommunityTopicId,
  UserProfile
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

function PostCard({ 
  post, 
  onClick 
}: { 
  post: CommunityPost; 
  onClick: () => void;
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
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {post.isAnonymous ? (
              <>
                <User className="h-4 w-4" />
                <span>Anonymous</span>
              </>
            ) : (
              <>
                <User className="h-4 w-4" />
                <span>{post.authorName || "Someone"}</span>
              </>
            )}
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

function ReplyCard({ reply, onReport }: { reply: CommunityReply; onReport: () => void }) {
  return (
    <div className="p-4 bg-muted/30 rounded-lg" data-testid={`reply-${reply.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          {reply.isAnonymous ? (
            <>
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Anonymous</span>
            </>
          ) : (
            <>
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{reply.authorName || "Someone"}</span>
            </>
          )}
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

export default function Community() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<CommunityTopicId | "all">("all");
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
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
    const topic = selectedTopic === "all" ? undefined : selectedTopic;
    setPosts(storage.getCommunityPosts(topic));
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
                {selectedPost.isAnonymous ? (
                  <>
                    <User className="h-4 w-4" />
                    Anonymous
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4" />
                    {selectedPost.authorName || "Someone"}
                  </>
                )}
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
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">No posts yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to start a conversation!
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ask a Question
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                onClick={() => setSelectedPost(post)}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-6">
          Community posts are based on personal experience and are not medical advice.
        </p>
      </div>
    </div>
  );
}
