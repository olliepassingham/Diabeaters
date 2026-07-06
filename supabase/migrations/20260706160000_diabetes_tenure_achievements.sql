-- Community tenure achievements: longest / shortest reported type 1 diagnosis among public profiles.

CREATE OR REPLACE FUNCTION public.sync_diabetes_tenure_achievements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  min_onset date;
  max_onset date;
  eligible_count int;
BEGIN
  SELECT COUNT(*) INTO eligible_count
  FROM public.profiles
  WHERE diabetes_onset_date IS NOT NULL
    AND diabetes_onset_date <= CURRENT_DATE
    AND is_public = true;

  IF eligible_count < 2 THEN
    DELETE FROM public.user_achievements
    WHERE achievement_id IN ('diabetes_tenure_longest', 'diabetes_tenure_shortest');
    RETURN;
  END IF;

  SELECT MIN(diabetes_onset_date), MAX(diabetes_onset_date)
  INTO min_onset, max_onset
  FROM public.profiles
  WHERE diabetes_onset_date IS NOT NULL
    AND diabetes_onset_date <= CURRENT_DATE
    AND is_public = true;

  IF min_onset IS NULL OR max_onset IS NULL OR min_onset = max_onset THEN
    DELETE FROM public.user_achievements
    WHERE achievement_id IN ('diabetes_tenure_longest', 'diabetes_tenure_shortest');
    RETURN;
  END IF;

  DELETE FROM public.user_achievements ua
  WHERE ua.achievement_id = 'diabetes_tenure_longest'
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = ua.user_id
        AND p.diabetes_onset_date = min_onset
        AND p.is_public = true
    );

  DELETE FROM public.user_achievements ua
  WHERE ua.achievement_id = 'diabetes_tenure_shortest'
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = ua.user_id
        AND p.diabetes_onset_date = max_onset
        AND p.is_public = true
    );

  INSERT INTO public.user_achievements (user_id, achievement_id, earned_at)
  SELECT p.id, 'diabetes_tenure_longest', now()
  FROM public.profiles p
  WHERE p.diabetes_onset_date = min_onset
    AND p.is_public = true
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  INSERT INTO public.user_achievements (user_id, achievement_id, earned_at)
  SELECT p.id, 'diabetes_tenure_shortest', now()
  FROM public.profiles p
  WHERE p.diabetes_onset_date = max_onset
    AND p.is_public = true
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_diabetes_tenure_achievements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_diabetes_tenure_achievements() TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_profiles_sync_tenure_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_diabetes_tenure_achievements();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_tenure_achievements ON public.profiles;
CREATE TRIGGER profiles_sync_tenure_achievements
  AFTER INSERT OR UPDATE OF diabetes_onset_date, is_public OR DELETE
  ON public.profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_profiles_sync_tenure_achievements();

-- Backfill current holders when migration runs.
SELECT public.sync_diabetes_tenure_achievements();

COMMENT ON FUNCTION public.sync_diabetes_tenure_achievements() IS
  'Awards diabetes_tenure_longest / diabetes_tenure_shortest to public profiles with the earliest / latest onset date.';
