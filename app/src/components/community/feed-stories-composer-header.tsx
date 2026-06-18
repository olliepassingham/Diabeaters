import { useMemo, type FormEvent, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { StoryAvatarRing } from "@/components/community/story-avatar-ring";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  storyRingStateForRow,
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
  storiesByAuthor: Map<string, CommunityStoryRow>;
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
  headerActions?: ReactNode;
  className?: string;
};

const AVATAR_CLASS = "!h-10 !w-10";
const ITEM_WIDTH = "w-12";

function SelfStoryCell({
  self,
  selfStory,
  onOpenStory,
  onAddStory,
}: {
  self: FeedStoryStripPerson;
  selfStory?: CommunityStoryRow;
  onOpenStory: (authorId: string, story?: CommunityStoryRow) => void;
  onAddStory: () => void;
}) {
  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-1", ITEM_WIDTH)}>
      {selfStory ? (
        <StoryAvatarRing
          state={storyRingStateForRow(selfStory)}
          label={selfStory.viewed_by_me ? "Rewatch your story" : "Your story"}
          onClick={() => onOpenStory(self.id, selfStory)}
          subtle
        >
          <CommunityAuthorAvatar
            displayName={self.name}
            avatarPath={self.avatar_url}
            size="sm"
            className={AVATAR_CLASS}
          />
        </StoryAvatarRing>
      ) : (
        <button
          type="button"
          onClick={onAddStory}
          className="relative shrink-0 rounded-full outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Add your story"
        >
          <span className="block rounded-full border border-dashed border-border/45 p-[1.5px]">
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
      <span className="w-full truncate text-center text-[9px] text-muted-foreground/80">You</span>
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
  headerActions,
  className,
}: Props) {
  const storyEntries = useMemo(() => {
    const out: { person: FeedStoryStripPerson; story: CommunityStoryRow }[] = [];
    for (const person of people) {
      const story = storiesByAuthor.get(person.id);
      if (story) out.push({ person, story });
    }
    out.sort((a, b) => {
      if (a.story.viewed_by_me !== b.story.viewed_by_me) {
        return a.story.viewed_by_me ? 1 : -1;
      }
      return a.person.name.localeCompare(b.person.name);
    });
    return out;
  }, [people, storiesByAuthor]);

  const selfStory = self ? storiesByAuthor.get(self.id) : undefined;
  const showStoriesRow = Boolean(self) || loading || storyEntries.length > 0;

  const composerTrigger = (
    <button
      type="button"
      className="flex w-full min-h-[2.75rem] items-center gap-2.5 px-3.5 py-2.5 text-left outline-none ring-offset-background transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={isMobile ? onComposerClick : undefined}
      disabled={composerDisabled}
      data-testid={isMobile ? "feed-composer-mobile-pill" : "feed-composer-trigger"}
      aria-haspopup={isMobile ? "dialog" : undefined}
      aria-expanded={!isMobile ? composerExpanded : undefined}
    >
      <CommunityAuthorAvatar
        displayName={avatarDisplayName}
        avatarPath={avatarPath}
        size="sm"
        profileHref={profileHref}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{composerPreview}</span>
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
      {showStoriesRow || headerActions ? (
        <div className="flex items-start gap-2">
          {showStoriesRow ? (
            <div
              className="min-w-0 flex-1 -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              data-testid="feed-stories-strip"
              aria-label="Stories"
            >
              {self ? (
                <SelfStoryCell
                  self={self}
                  selfStory={selfStory}
                  onOpenStory={onOpenStory}
                  onAddStory={onAddStory}
                />
              ) : null}

              {loading
                ? Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted/25" />
                  ))
                : storyEntries.map(({ person, story }) => (
                    <div key={person.id} className={cn("flex shrink-0 flex-col items-center gap-1", ITEM_WIDTH)}>
                      <StoryAvatarRing
                        state={storyRingStateForRow(story)}
                        onClick={() => onOpenStory(person.id, story)}
                        label={`Watch ${person.name}'s story`}
                        subtle
                      >
                        <CommunityAuthorAvatar
                          displayName={person.name}
                          avatarPath={person.avatar_url}
                          size="sm"
                          className={AVATAR_CLASS}
                        />
                      </StoryAvatarRing>
                      <span className="w-full truncate text-center text-[9px] text-muted-foreground/70">
                        {person.name.split(" ")[0]}
                      </span>
                    </div>
                  ))}
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          {headerActions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-0.5">{headerActions}</div> : null}
        </div>
      ) : null}

      <section
        className={cn(
          "overflow-hidden rounded-2xl border border-border/45 bg-card/90 shadow-sm ring-1 ring-border/25 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80",
          composerDisabled && "opacity-90",
        )}
      >
        {isMobile ? (
          composerTrigger
        ) : (
          <Collapsible open={composerExpanded} onOpenChange={onComposerExpandedChange}>
            <CollapsibleTrigger asChild>{composerTrigger}</CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="border-t border-border/20 px-3.5 pb-3.5 pt-3">{composerForm}</div>
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
