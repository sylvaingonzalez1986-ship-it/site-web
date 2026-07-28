BEGIN;

-- Ten of the fifteen tasting missions feed the Placard economy.
INSERT INTO public.kq_notebook_reward_rules(
  badge_code, support_boosters, culture_tokens, is_active, updated_at
)
VALUES
  ('premier-carnet', 1, 0, FALSE, now()),
  ('gouteur-regulier', 1, 2, FALSE, now()),
  ('premiere-piste', 1, 0, FALSE, now()),
  ('combo-aromatique', 1, 1, FALSE, now()),
  ('nez-absolu', 2, 1, FALSE, now()),
  ('expert-outdoor', 1, 1, FALSE, now()),
  ('expert-greenhouse', 1, 1, FALSE, now()),
  ('expert-indoor', 1, 1, FALSE, now()),
  ('critique-utile', 0, 1, FALSE, now()),
  ('validateur-serieux', 0, 1, FALSE, now())
ON CONFLICT (badge_code) DO UPDATE SET
  support_boosters = EXCLUDED.support_boosters,
  culture_tokens = EXCLUDED.culture_tokens,
  is_active = FALSE,
  updated_at = now();

-- Five major missions remain in the classic Kanab Quest/Buddies economy.
UPDATE public.kq_notebook_reward_rules
SET is_active = FALSE, updated_at = now()
WHERE badge_code IN (
  'marathon-des-lots', 'nez-divin', 'tour-de-saison', 'plume-dor', 'voix-respectee'
);

-- Unclaimed rewards are redirected; historical claimed booster grants are immutable.
UPDATE public.contest_profile_badges profile_badge
SET reward_pack_count = 0
FROM public.contest_badges badge
WHERE profile_badge.badge_id = badge.id
  AND profile_badge.reward_claimed_at IS NULL
  AND badge.code IN (
    'premier-carnet', 'gouteur-regulier', 'premiere-piste', 'combo-aromatique',
    'nez-absolu', 'expert-outdoor', 'expert-greenhouse', 'expert-indoor',
    'critique-utile', 'validateur-serieux'
  );

COMMIT;
