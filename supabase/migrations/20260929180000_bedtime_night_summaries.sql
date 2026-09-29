-- Overnight time-in-range for a bedtime night. No glucose points.
-- One row per user and streak day so the percent follows the account.

CREATE TABLE IF NOT EXISTS public.bedtime_night_summaries (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  streak_day date NOT NULL,
  in_range_percent integer NOT NULL,
  had_low boolean NOT NULL DEFAULT false,
  had_high boolean NOT NULL DEFAULT false,
  reading_count integer NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  headline text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, streak_day)
);

ALTER TABLE public.bedtime_night_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bedtime_night_summaries_select_own ON public.bedtime_night_summaries;
CREATE POLICY bedtime_night_summaries_select_own
  ON public.bedtime_night_summaries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS bedtime_night_summaries_insert_own ON public.bedtime_night_summaries;
CREATE POLICY bedtime_night_summaries_insert_own
  ON public.bedtime_night_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS bedtime_night_summaries_update_own ON public.bedtime_night_summaries;
CREATE POLICY bedtime_night_summaries_update_own
  ON public.bedtime_night_summaries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.bedtime_night_summaries TO authenticated;
