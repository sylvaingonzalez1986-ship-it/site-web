-- Reviews describe a particular product and season. Editorial changes remain
-- possible, but a lot with reviews cannot be reassigned to a different identity.
CREATE OR REPLACE FUNCTION public.guard_contest_entry_review_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.season_id IS DISTINCT FROM OLD.season_id)
     AND EXISTS (SELECT 1 FROM public.contest_reviews WHERE entry_id = OLD.id) THEN
    RAISE EXCEPTION 'Ce lot possède déjà des avis. Crée un nouveau lot pour changer de produit ou de saison.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- This shared lock serializes review creation with changes to its parent lot.
-- Checking the season after acquiring the lock also rejects a stale submission.
CREATE OR REPLACE FUNCTION public.guard_contest_review_entry_season()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry_season public.contest_entries.season_id%TYPE;
BEGIN
  SELECT season_id INTO entry_season
  FROM public.contest_entries WHERE id = NEW.entry_id FOR SHARE;
  IF NOT FOUND OR NEW.season_id IS DISTINCT FROM entry_season THEN
    RAISE EXCEPTION 'Le lot a changé. Recharge le carnet avant de soumettre ton avis.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contest_entry_review_identity_guard ON public.contest_entries;
CREATE TRIGGER contest_entry_review_identity_guard
BEFORE UPDATE OF product_id, season_id ON public.contest_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_contest_entry_review_identity();

DROP TRIGGER IF EXISTS contest_review_entry_season_guard ON public.contest_reviews;
CREATE TRIGGER contest_review_entry_season_guard
BEFORE INSERT OR UPDATE OF entry_id, season_id ON public.contest_reviews
FOR EACH ROW EXECUTE FUNCTION public.guard_contest_review_entry_season();

-- Trigger helpers are not callable through the Data API, even by service_role.
REVOKE ALL ON FUNCTION public.guard_contest_entry_review_identity() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_contest_review_entry_season() FROM PUBLIC, anon, authenticated, service_role;
