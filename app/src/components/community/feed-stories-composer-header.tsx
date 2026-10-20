import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { StoryAvatarRing } from "@/components/community/story-avatar-ring";
import {
  pickStoryToOpen,
  storyRingStateForStories,
  type CommunityStoryRow,
} from "@/lib/community/stories-supabase";
import { cn } from "@/lib/utils";

export type FeedStoryStripPerson = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type Props = {
  self: FeedStoryStripPerson | null;
  people: FeedStoryStripPerson[];
  storiesByAuthor: Map<string, CommunityStoryRow[]>;
  loading?: boolean;
  onOpenStory: (authorId: string, story?: CommunityStoryRow) => void;
  onAddStory: () => void;
  composerPreview: string;
  onComposerClick: () => void;
  composerDisabled?: boolean;
  /** Find people and more sit on the quiet prompt row, not on the stories. */
  endActions?: ReactNode;
  className?: string;
};

/** Match a larger story row, closer to a photo-app strip. */
const AVATAR_CLASS = "!h-16 !w-16";
const ITEM_WIDTH = "w-[4.6rem]";
const NAME_CLASS = "w-full truncate text-center text-[11px] font-medium leading-tight text-foreground/80";

function SelfStoryCell({
  self,
  selfStories,
  onOpenStory,
  onAddStory,
}: {
  self: FeedStoryStripPerson;
  selfStories: CommunityStoryRow[];
  onOpenStory: (authorId: string, story?: CommunityStoryRow) => void;
  onAddStory: () => void;
}) {
  const hasStories = selfStories.length > 0;
  const storyToOpen = pickStoryToOpen(selfStories);

  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-0.5", ITEM_WIDTH)}>
      {hasStories && storyToOpen ? (
        <div className="relative">
          <StoryAvatarRing
            state={storyRingStateForStories(selfStories)}
            label={selfStories.every((s) => s.viewed_by_me) ? "Rewatch your stories" : "Your stories"}
            onClick={() => onOpenStory(self.id, storyToOpen)}
          >
            <CommunityAuthorAvatar
              displayName={self.name}
              avatarPath={self.avatar_url}
              size="sm"
              className={AVATAR_CLASS}
            />
          </StoryAvatarRing>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddStory();
            }}
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Add another story"
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAddStory}
          className="relative shrink-0 rounded-full outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Add your story"
        >
          <span className="block rounded-full bg-muted/50 p-[2px] ring-1 ring-border/70">
            <CommunityAuthorAvatar
              displayName={self.name}
              avatarPath={self.avatar_url}
              size="sm"
              className={AVATAR_CLASS}
            />
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </span>
        </button>
      )}
      <span className={NAME_CLASS}>You</span>
    </div>
  );
}

function FeedStoriesStrip({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showEndFade, setShowEndFade] = useState(false);

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    const notAtEnd = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setShowEndFade(hasOverflow && notAtEnd);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFade();
    el.addEventListener("scroll", updateFade, { passive: true });
    const observer = new ResizeObserver(updateFade);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateFade);
      observer.disconnect();
    };
  }, [updateFade, children]);

  return (
    <div className="relative -mx-4 md:-mx-6">
      <div
        ref={scrollRef}
        className="flex gap-3.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden"
        data-testid="feed-stories-strip"
        aria-label="Stories"
      >
        {children}
      </div>
      {showEndFade ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-background via-background/80 to-transparent"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export function FeedStoriesComposerHeader({
  self,
  people,
  storiesByAuthor,
  loading,
  onOpenStory,
  onAddStory,
  composerPreview,
  onComposerClick,
  composerDisabled,
  endActions,
  className,
}: Props) {
  const storyEntries = useMemo(() => {
    const out: { person: FeedStoryStripPerson; stories: CommunityStoryRow[]; story: CommunityStoryRow }[] = [];
    for (const person of people) {
      const stories = storiesByAuthor.get(person.id) ?? [];
      const story = pickStoryToOpen(stories);
      if (story) out.push({ person, stories, story });
    }
    out.sort((a, b) => {
      const aUnseen = a.stories.some((s) => !s.viewed_by_me);
      const bUnseen = b.stories.some((s) => !s.viewed_by_me);
      if (aUnseen !== bUnseen) return aUnseen ? -1 : 1;
      return a.person.name.localeCompare(b.person.name);
    });
    return out;
  }, [people, storiesByAuthor]);

  const selfStories = self ? storiesByAuthor.get(self.id) ?? [] : [];
  const showStoriesRow = Boolean(self) || loading || storyEntries.length > 0;

  return (
    <div className={cn("space-y-1", className)} data-testid="feed-stories-composer-header">
      {showStoriesRow ? (
        <FeedStoriesStrip>
          {self ? (
            <SelfStoryCell
              self={self}
              selfStories={selfStories}
              onOpenStory={onOpenStory}
              onAddStory={onAddStory}
            />
          ) : null}

          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={cn("flex shrink-0 flex-col items-center gap-1", ITEM_WIDTH)}>
                  <div className="h-16 w-16 animate-pulse rounded-full bg-muted/40" />
                  <div className="h-2 w-10 animate-pulse rounded-full bg-muted/30" />
                </div>
              ))
            : storyEntries.map(({ person, stories, story }) => (
                <div key={person.id} className={cn("flex shrink-0 flex-col items-center gap-0.5", ITEM_WIDTH)}>
                  <StoryAvatarRing
                    state={storyRingStateForStories(stories)}
                    onClick={() => onOpenStory(person.id, story)}
                    label={`Watch ${person.name}'s story`}
                  >
                    <CommunityAuthorAvatar
                      displayName={person.name}
                      avatarPath={person.avatar_url}
                      size="sm"
                      className={AVATAR_CLASS}
                    />
                  </StoryAvatarRing>
                  <span className={NAME_CLASS}>{person.name.split(" ")[0]}</span>
                </div>
              ))}
        </FeedStoriesStrip>
      ) : null}

      <div className={cn("flex items-center gap-1", composerDisabled && "opacity-70")}>
        <button
          type="button"
          className="flex h-11 min-w-0 flex-1 items-center rounded-full px-1 text-left outline-none ring-offset-background transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          onClick={onComposerClick}
          disabled={composerDisabled}
          data-testid="feed-composer-mobile-pill"
          aria-haspopup="dialog"
        >
          <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">{composerPreview}</span>
        </button>
        {endActions ? <div className="shrink-0">{endActions}</div> : null}
      </div>
    </div>
  );
}
