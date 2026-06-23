BEGIN;

ALTER TABLE public.contest_profile_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_profile_badges_public_read
ON public.contest_profile_badges;

DROP POLICY IF EXISTS contest_profile_badges_user_read_own
ON public.contest_profile_badges;

CREATE POLICY contest_profile_badges_user_read_own
  ON public.contest_profile_badges
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

COMMIT;
