BEGIN;

CREATE TABLE IF NOT EXISTS public.referral_reward_settings (
  id TEXT PRIMARY KEY,
  points_amount INTEGER NOT NULL CHECK (points_amount > 0 AND points_amount <= 100000),
  packs_amount INTEGER NOT NULL CHECK (packs_amount > 0 AND packs_amount <= 100000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_reward_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.referral_reward_settings (id, points_amount, packs_amount)
VALUES ('default', 50, 5)
ON CONFLICT (id) DO NOTHING;

COMMIT;
