BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_season_reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_code TEXT NOT NULL,
  tier_code TEXT NOT NULL CHECK (tier_code IN ('champion', 'podium', 'finalist', 'participant')),
  min_rank INTEGER NOT NULL CHECK (min_rank >= 1),
  max_rank INTEGER CHECK (max_rank IS NULL OR max_rank >= min_rank),
  min_battles INTEGER NOT NULL DEFAULT 3 CHECK (min_battles >= 0),
  reward_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_code, tier_code)
);

CREATE TABLE IF NOT EXISTS public.kq_season_reward_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_code TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tier_code TEXT NOT NULL CHECK (tier_code IN ('champion', 'podium', 'finalist', 'participant')),
  final_rank INTEGER NOT NULL CHECK (final_rank >= 1),
  final_rating INTEGER NOT NULL,
  final_season_points INTEGER NOT NULL CHECK (final_season_points >= 0),
  reward_payload JSONB NOT NULL,
  grant_key TEXT NOT NULL UNIQUE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_code, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kq_season_reward_grants_season_rank
  ON public.kq_season_reward_grants(season_code, final_rank);

INSERT INTO public.kq_season_reward_rules (
  season_code, tier_code, min_rank, max_rank, min_battles, reward_payload, is_active
) VALUES
  ('KQ-2026-S1', 'champion', 1, 1, 3, '{"title":"Maître du Placard","frame":"or","ribbon":"Champion S1","supportBoosters":3,"heritageFragments":12,"specialInvite":true}'::JSONB, FALSE),
  ('KQ-2026-S1', 'podium', 2, 3, 3, '{"title":"Cultivateur d’élite","frame":"argent-bronze","ribbon":"Podium S1","supportBoosters":2,"heritageFragments":8,"specialInvite":true}'::JSONB, FALSE),
  ('KQ-2026-S1', 'finalist', 4, 10, 3, '{"title":"Finaliste du Placard","frame":"saison","ribbon":"Finaliste S1","supportBoosters":1,"heritageFragments":3,"specialInvite":false}'::JSONB, FALSE),
  ('KQ-2026-S1', 'participant', 11, NULL, 3, '{"title":"Cultivateur de saison","frame":null,"ribbon":"Saison complète","supportBoosters":0,"heritageFragments":1,"specialInvite":false}'::JSONB, FALSE)
ON CONFLICT (season_code, tier_code) DO UPDATE SET
  min_rank = EXCLUDED.min_rank,
  max_rank = EXCLUDED.max_rank,
  min_battles = EXCLUDED.min_battles,
  reward_payload = EXCLUDED.reward_payload,
  is_active = FALSE,
  updated_at = now();

ALTER TABLE public.kq_season_reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_season_reward_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kq_season_reward_rules, public.kq_season_reward_grants
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.kq_season_reward_rules IS
  'Dormant Placard season reward policy. No client grant path exists before coordinated launch.';
COMMENT ON TABLE public.kq_season_reward_grants IS
  'Immutable idempotent receipts for future Placard season closure; currently never written.';

COMMIT;
