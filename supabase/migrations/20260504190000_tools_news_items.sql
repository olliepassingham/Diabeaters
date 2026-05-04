-- Editorial "News & resources" links for the Tools hub (read by the app; maintain via SQL Editor or Dashboard).
-- Published rows are readable with the anon key; writes are via service role / SQL only.

CREATE TABLE IF NOT EXISTS public.tools_news_items (
  id text PRIMARY KEY,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  title text NOT NULL,
  href text NOT NULL,
  description text NOT NULL,
  tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tools_news_items_href_https CHECK (href ~ '^https://')
);

CREATE INDEX IF NOT EXISTS tools_news_items_published_list_idx
  ON public.tools_news_items (is_published, sort_order, published_at DESC);

COMMENT ON TABLE public.tools_news_items IS 'Curated external links under Tools → News & resources. Use stable id (e.g. nhs-type1) for URLs you reference from docs/tests.';

ALTER TABLE public.tools_news_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tools_news_items_select_published
  ON public.tools_news_items
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

GRANT SELECT ON TABLE public.tools_news_items TO anon, authenticated;

-- Initial content (same ids as former static CURATED_RESOURCES). Idempotent per id.
INSERT INTO public.tools_news_items (id, sort_order, is_published, published_at, source, title, href, description, tag)
SELECT v.id, v.sort_order, v.is_published, v.published_at::timestamptz, v.source, v.title, v.href, v.description, v.tag
FROM (
  VALUES
    ('nhs-type1', 10, true, '2026-05-01T12:00:00Z', 'NHS', 'Type 1 diabetes: overview', 'https://www.nhs.uk/conditions/type-1-diabetes/',
     'A plain-English overview of Type 1 diabetes, symptoms, treatment, and day-to-day management.', 'Basics'),
    ('diabetesuk-type1', 20, true, '2026-05-01T12:00:00Z', 'Diabetes UK', 'Type 1 diabetes: information and support', 'https://www.diabetes.org.uk/diabetes-the-basics/type-1',
     'UK-focused guidance and support resources for living with Type 1 diabetes.', 'Support'),
    ('nice-type1', 30, true, '2026-05-01T12:00:00Z', 'NICE', 'Type 1 diabetes in adults: diagnosis and management (NG17)', 'https://www.nice.org.uk/guidance/ng17',
     'UK clinical guidance covering diagnosis, insulin therapy, glucose monitoring, and structured education.', 'Guidance'),
    ('jdrf-uk', 40, true, '2026-05-01T12:00:00Z', 'JDRF', 'Living with Type 1 diabetes', 'https://www.jdrf.org/t1d-resources/living-with-t1d/',
     'Practical resources for day-to-day Type 1 management, technology, and community support.', 'Community'),
    ('beyondtype1', 50, true, '2026-05-01T12:00:00Z', 'Beyond Type 1', 'Type 1 diabetes: getting started', 'https://beyondtype1.org/type-1-diabetes/',
     'Approachable, patient-led learning with explainers, tips, and lived-experience perspectives.', 'Learn'),
    ('ada-diabetes', 60, true, '2026-05-01T12:00:00Z', 'ADA', 'Diabetes basics', 'https://diabetes.org/diabetes',
     'General diabetes education, including Type 1 topics, technology, and guidance to discuss with your care team.', 'Learn')
) AS v(id, sort_order, is_published, published_at, source, title, href, description, tag)
WHERE NOT EXISTS (SELECT 1 FROM public.tools_news_items n WHERE n.id = v.id);
