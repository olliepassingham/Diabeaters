-- Add school/college and family-supporter feed categories (mirrors app COMMUNITY_TOPICS).

ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_topic_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_topic_check CHECK (
  topic IN (
    'holidays-travel',
    'sick-days',
    'exercise-activity',
    'food-eating-out',
    'mental-health',
    'tips-what-worked',
    'general-questions',
    'school-college-life',
    'family-supporters'
  )
);
