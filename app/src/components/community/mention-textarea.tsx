import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";

import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Textarea } from "@/components/ui/textarea";
import { getActiveMentionAtCursor, insertMentionAtCursor } from "@/lib/mention-text";
import { searchProfilesByHandlePrefix } from "@/lib/profile";
import { cn } from "@/lib/utils";

export type MentionSuggestion = {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
};

type MentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  currentUserId?: string | null;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  id?: string;
  /** Optional ref to the underlying textarea (e.g. focus after opening comments). */
  textareaRef?: Ref<HTMLTextAreaElement | null>;
  /** Hide the helper line under the field (e.g. compact comment box). */
  hideHint?: boolean;
  /** Grow height with content (capped by maxGrowPx). */
  autoGrow?: boolean;
  /** Max height in px when autoGrow is on. Default 160. */
  maxGrowPx?: number;
  /**
   * Skip the glass field chrome — use inside a parent composer shell
   * (comment bar, reply strip) so you don't get a box-in-a-box.
   */
  bare?: boolean;
};

export function MentionTextarea({
  value,
  onChange,
  currentUserId,
  disabled,
  placeholder,
  rows = 3,
  maxLength = 8000,
  className,
  id,
  textareaRef: externalTextareaRef,
  hideHint = false,
  autoGrow = false,
  maxGrowPx = 160,
  bare = false,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const syncAutoGrow = useCallback(() => {
    if (!autoGrow) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const contentHeight = el.scrollHeight;
    el.style.height = `${Math.min(contentHeight, maxGrowPx)}px`;
    el.style.overflowY = contentHeight > maxGrowPx ? "auto" : "hidden";
  }, [autoGrow, maxGrowPx]);

  useLayoutEffect(() => {
    syncAutoGrow();
  }, [value, syncAutoGrow]);

  const refreshSuggestions = useCallback(
    (text: string, cursor: number) => {
      const active = getActiveMentionAtCursor(text, cursor);
      if (!active) {
        setMentionStart(null);
        setSuggestions([]);
        setSuggestLoading(false);
        return;
      }
      setMentionStart(active.start);
      if (!active.query) {
        setSuggestions([]);
        setSuggestLoading(false);
        return;
      }
      setSuggestLoading(true);
      void searchProfilesByHandlePrefix(active.query, 8).then((res) => {
        setSuggestLoading(false);
        if (res.error) {
          setSuggestions([]);
          return;
        }
        const mapped = (res.data ?? [])
          .filter((p) => p.is_public !== false)
          .filter((p) => p.id !== currentUserId)
          .map((p) => ({
            id: p.id,
            name: p.full_name?.trim() || p.id.slice(0, 8),
            handle: (p.public_handle ?? "").trim().toLowerCase(),
            avatar_url: p.avatar_url ?? null,
          }))
          .filter((p) => Boolean(p.handle));
        setSuggestions(mapped);
      });
    },
    [currentUserId],
  );

  const applySuggestion = useCallback(
    (handle: string) => {
      const el = textareaRef.current;
      const cursor = el?.selectionStart ?? value.length;
      const start = mentionStart ?? cursor;
      const next = insertMentionAtCursor(value, start, cursor, handle);
      onChange(next.text);
      setMentionStart(null);
      setSuggestions([]);
      window.requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(next.cursor, next.cursor);
        syncAutoGrow();
      });
    },
    [mentionStart, onChange, syncAutoGrow, value],
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || mentionStart == null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMentionStart(null);
        setSuggestions([]);
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [mentionStart]);

  return (
    <div className="relative space-y-1.5">
      <Textarea
        ref={(el) => {
          textareaRef.current = el;
          if (typeof externalTextareaRef === "function") externalTextareaRef(el);
          else if (externalTextareaRef && "current" in externalTextareaRef) {
            (externalTextareaRef as { current: HTMLTextAreaElement | null }).current = el;
          }
          if (el && autoGrow) {
            window.requestAnimationFrame(syncAutoGrow);
          }
        }}
        id={id}
        value={value}
        onChange={(e) => {
          const v = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
          onChange(v);
          refreshSuggestions(v, e.target.selectionStart ?? v.length);
        }}
        onClick={(e) => refreshSuggestions(value, e.currentTarget.selectionStart ?? value.length)}
        onKeyUp={(e) => refreshSuggestions(value, e.currentTarget.selectionStart ?? value.length)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          "w-full rounded-xl text-base leading-relaxed",
          bare ? "surface-field-bare px-0 py-2.5" : "surface-field",
          autoGrow ? "min-h-0 overflow-hidden" : "min-h-[5.5rem]",
          className,
        )}
        aria-autocomplete="list"
        aria-controls={mentionStart != null ? "mention-suggestions" : undefined}
      />
      {mentionStart != null ? (
        <div
          id="mention-suggestions"
          className="rounded-lg border border-border/50 bg-muted/20 p-2 dark:bg-muted/15"
          role="listbox"
        >
          {suggestLoading ? <p className="px-1 text-xs text-muted-foreground">Searching handles…</p> : null}
          {!suggestLoading && suggestions.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              {getActiveMentionAtCursor(value, textareaRef.current?.selectionStart ?? value.length)?.query
                ? "No public handles match. They need a @handle in profile settings."
                : "Keep typing after @ to search handles."}
            </p>
          ) : null}
          <ul className="space-y-1">
            {suggestions.map((p) => (
              <li key={p.id} role="option">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md border border-border/40 bg-card/80 px-2 py-1.5 text-left hover:bg-muted/50 dark:bg-card/60"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(p.handle);
                  }}
                >
                  <CommunityAuthorAvatar
                    displayName={p.name}
                    avatarPath={p.avatar_url}
                    size="sm"
                    profileHref={`/community/profile/${encodeURIComponent(p.id)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{p.name}</p>
                    <p className="truncate text-[11px] text-primary">@{p.handle}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hideHint ? null : (
        <p className="text-[11px] text-muted-foreground">Type @ then pick a handle to mention someone.</p>
      )}
    </div>
  );
}
