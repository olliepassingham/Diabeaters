-- Feed UX: optional sensitive-topic flair + per-image alt text (accessibility).

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS content_note text NULL;

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_content_note_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_content_note_check CHECK (
  content_note IS NULL
  OR content_note IN (
    'hypos-lows',
    'mental-health',
    'eating-body',
    'general-sensitive'
  )
);

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS image_alt_texts jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.community_posts.content_note IS
  'Optional self-labeled note (e.g. hypos, mental health) so readers can reply thoughtfully.';
COMMENT ON COLUMN public.community_posts.image_alt_texts IS
  'JSON array of short alt strings, parallel to image_urls (same length after insert).';
