-- Allow experience-sharing content notes for peer video / tip posts.

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_content_note_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_content_note_check CHECK (
  content_note IS NULL
  OR content_note IN (
    'hypos-lows',
    'mental-health',
    'eating-body',
    'general-sensitive',
    'experience-sharing'
  )
);

COMMENT ON COLUMN public.community_posts.content_note IS
  'Optional self-labeled note (e.g. hypos, mental health, experience sharing) so readers can reply thoughtfully.';
