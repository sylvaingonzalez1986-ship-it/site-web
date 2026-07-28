BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_heritage_fragment_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kq_heritage_fragment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draw_id UUID UNIQUE REFERENCES public.kq_heritage_draws(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  reason TEXT NOT NULL CHECK (reason IN ('duplicate_common', 'duplicate_rare', 'duplicate_epic', 'craft_common', 'craft_rare')),
  reward_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (amount > 0 AND draw_id IS NOT NULL AND reason LIKE 'duplicate_%' AND reward_key IS NULL)
    OR
    (amount < 0 AND draw_id IS NULL AND reason LIKE 'craft_%' AND reward_key IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_kq_heritage_fragment_ledger_user_created
  ON public.kq_heritage_fragment_ledger(user_id, created_at DESC);

ALTER TABLE public.kq_heritage_fragment_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_heritage_fragment_ledger ENABLE ROW LEVEL SECURITY;

WITH inserted AS (
  INSERT INTO public.kq_heritage_fragment_ledger(user_id, draw_id, amount, reason)
  SELECT
    draw.user_id,
    draw.id,
    CASE draw.rarity WHEN 'common' THEN 1 WHEN 'rare' THEN 3 ELSE 8 END,
    CASE draw.rarity WHEN 'common' THEN 'duplicate_common' WHEN 'rare' THEN 'duplicate_rare' ELSE 'duplicate_epic' END
  FROM public.kq_heritage_draws draw
  WHERE draw.was_duplicate = TRUE
  ON CONFLICT (draw_id) DO NOTHING
  RETURNING user_id, amount
), totals AS (
  SELECT user_id, SUM(amount)::INTEGER AS amount
  FROM inserted
  GROUP BY user_id
)
INSERT INTO public.kq_heritage_fragment_wallets(user_id, balance)
SELECT user_id, amount FROM totals
ON CONFLICT (user_id) DO UPDATE SET
  balance = public.kq_heritage_fragment_wallets.balance + EXCLUDED.balance,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.kq_credit_heritage_duplicate_fragments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount INTEGER;
BEGIN
  IF NEW.was_duplicate IS DISTINCT FROM TRUE THEN RETURN NEW; END IF;

  v_amount := CASE NEW.rarity
    WHEN 'common' THEN 1
    WHEN 'rare' THEN 3
    WHEN 'epic' THEN 8
    ELSE 0
  END;
  IF v_amount <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.kq_heritage_fragment_ledger(user_id, draw_id, amount, reason)
  VALUES (
    NEW.user_id,
    NEW.id,
    v_amount,
    CASE NEW.rarity
      WHEN 'common' THEN 'duplicate_common'
      WHEN 'rare' THEN 'duplicate_rare'
      ELSE 'duplicate_epic'
    END
  )
  ON CONFLICT (draw_id) DO NOTHING;

  IF FOUND THEN
    INSERT INTO public.kq_heritage_fragment_wallets(user_id, balance)
    VALUES (NEW.user_id, v_amount)
    ON CONFLICT (user_id) DO UPDATE SET
      balance = public.kq_heritage_fragment_wallets.balance + EXCLUDED.balance,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kq_credit_heritage_duplicate_fragments
  ON public.kq_heritage_draws;
CREATE TRIGGER trg_kq_credit_heritage_duplicate_fragments
AFTER INSERT ON public.kq_heritage_draws
FOR EACH ROW
EXECUTE FUNCTION public.kq_credit_heritage_duplicate_fragments();

REVOKE ALL ON FUNCTION public.kq_credit_heritage_duplicate_fragments()
  FROM PUBLIC, anon, authenticated;

COMMIT;
