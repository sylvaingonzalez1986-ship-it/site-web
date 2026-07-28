BEGIN;

CREATE OR REPLACE FUNCTION public.kq_active_season_code()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT season_code
  FROM public.kq_seasons
  WHERE status = 'active'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.kq_active_season_code()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kq_active_season_code()
  TO service_role;

ALTER TABLE public.kq_rank_profiles
  ALTER COLUMN season_code
  SET DEFAULT public.kq_active_season_code();

COMMENT ON FUNCTION public.kq_active_season_code() IS
  'Single source of truth used when a new Placard rank profile joins the active season.';

COMMIT;
