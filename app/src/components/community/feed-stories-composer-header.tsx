import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { StoryAvatarRing } from "@/components/community/story-avatar-ring";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  avatarDisplayName: string;
  avatarPath: string | null;
  profileHref?: string;
  onComposerClick: () => void;
  composerDisabled?: boolean;
  isMobile: boolean;
  composerExpanded?: boolean;
  onComposerExpandedChange?: (open: boolean) => void;
  composerForm?: ReactNode;
  className?: string;
};

/** Match feed post author avatars (`feed-post-card` uses `!h-9 !w-9`). */
const AVATAR_CLASS = "!h-9 !w-9";
const ITEM_WIDTH = "w-11";
const NAME_CLASS = "w-full truncate text-center text-[9px] leading-none text-muted-foreground/70";

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
            compact
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
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Add another story"
          >
            <Plus className="h-2 w-2" strokeWidth={3} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAddStory}
          className="relative shrink-0 rounded-full outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Add your story"
        >
          <span className="block rounded-full border border-dashed border-border/45 p-px">
            <CommunityAuthorAvatar
              displayName={self.name}
              avatarPath={self.avatar_url}
              size="sm"
              className={AVATAR_CLASS}
            />
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
            <Plus className="h-2 w-2" strokeWidth={3} />
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
    <div className="relative -mx-1">
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto px-0.5 py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
  avatarDisplayName,
  avatarPath,
  profileHref,
  onComposerClick,
  composerDisabled,
  isMobile,
  composerExpanded,
  onComposerExpandedChange,
  composerForm,
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
  const hideComposerAvatar = showStoriesRow && Boolean(self);

  const composerTrigger = (
    <button
      type="button"
      className={cn(
        "flex w-full min-h-[3rem] items-center gap-2.5 text-left outline-none ring-offset-background transition-colors hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        hideComposerAvatar ? "px-4 py-3" : "px-3.5 py-3",
      )}
      onClick={isMobile ? onComposerClick : undefined}
      disabled={composerDisabled}
      data-testid={isMobile ? "feed-composer-mobile-pill" : "feed-composer-trigger"}
      aria-haspopup={isMobile ? "dialog" : undefined}
      aria-expanded={!isMobile ? composerExpanded : undefined}
    >
      {!hideComposerAvatar ? (
        <CommunityAuthorAvatar
          displayName={avatarDisplayName}
          avatarPath={avatarPath}
          size="sm"
          profileHref={profileHref}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">{composerPreview}</span>
      {!isMobile ? (
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            composerExpanded && "rotate-180",
          )}
          aria-hidden
        />
      ) : null}
    </button>
  );

  return (
    <div className={cn("space-y-2", className)} data-testid="feed-stories-composer-header">
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
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted/25" />
              ))
            : storyEntries.map(({ person, stories, story }) => (
                <div key={person.id} className={cn("flex shrink-0 flex-col items-center gap-0.5", ITEM_WIDTH)}>
                  <StoryAvatarRing
                    state={storyRingStateForStories(stories)}
                    onClick={() => onOpenStory(person.id, story)}
                    label={`Watch ${person.name}'s story`}
                    compact
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

      <section
        className={cn(
          "overflow-hidden rounded-2xl border border-border/50 bg-card/95 shadow-sm ring-1 ring-border/30 backdrop-blur-xl supports-[backdrop-filter]:bg-card/85",
          composerDisabled && "opacity-90",
        )}
      >
        {isMobile ? (
          composerTrigger
        ) : (
          <Collapsible open={composerExpanded} onOpenChange={onComposerExpandedChange}>
            <CollapsibleTrigger asChild>{composerTrigger}</CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="border-t border-border/25 px-3.5 pb-3.5 pt-3">{composerForm}</div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </section>
    </div>
  );
}

export type FeedStoriesComposerHeaderFormProps = {
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
};

export function FeedStoriesComposerHeaderForm({ onSubmit, children }: FeedStoriesComposerHeaderFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 text-foreground" data-testid="feed-composer-form">
      {children}
    </form>
  );
}
