BEGIN;

-- ============================================================
-- Social Missions: customers earn packs by completing tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS public.social_missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'star',
  reward_type TEXT NOT NULL DEFAULT 'packs' CHECK (reward_type IN ('packs', 'points')),
  reward_amount INTEGER NOT NULL DEFAULT 1 CHECK (reward_amount > 0 AND reward_amount <= 1000),
  max_completions_per_user INTEGER NOT NULL DEFAULT 1 CHECK (max_completions_per_user > 0),
  requires_proof BOOLEAN NOT NULL DEFAULT true,
  proof_instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_missions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active missions
DROP POLICY IF EXISTS social_missions_read_active ON public.social_missions;
CREATE POLICY social_missions_read_active
ON public.social_missions
FOR SELECT
TO authenticated
USING (is_active = true);

-- Seed missions
INSERT INTO public.social_missions (slug, title, description, icon, reward_type, reward_amount, max_completions_per_user, requires_proof, proof_instructions, sort_order)
VALUES
  ('follow-instagram', 'Suivre sur Instagram', 'Abonne-toi à notre compte Instagram @leschanvriersbretons', 'instagram', 'packs', 1, 1, true, 'Envoie une capture d''écran montrant que tu es abonné(e) à notre compte Instagram.', 10),
  ('follow-facebook', 'Suivre sur Facebook', 'Abonne-toi à notre page Facebook Les Chanvriers Bretons', 'facebook', 'packs', 1, 1, true, 'Envoie une capture d''écran montrant que tu suis notre page Facebook.', 20),
  ('follow-tiktok', 'Suivre sur TikTok', 'Abonne-toi à notre compte TikTok @leschanvriersbretons', 'tiktok', 'packs', 1, 1, true, 'Envoie une capture d''écran montrant que tu es abonné(e) à notre compte TikTok.', 30),
  ('post-story', 'Poster une story', 'Poste une story en mentionnant notre compte avec un screenshot du site', 'camera', 'packs', 10, 1, true, 'Poste une story sur Instagram/TikTok en mentionnant @leschanvriersbretons avec une capture d''écran de notre site. Envoie-nous le screenshot de ta story.', 40)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- Social Mission Submissions: user proof + admin validation
-- ============================================================

CREATE TABLE IF NOT EXISTS public.social_mission_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.social_missions(id) ON DELETE CASCADE,
  proof_url TEXT,
  proof_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  reward_granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_mission_submissions_user
ON public.social_mission_submissions (user_id);

CREATE INDEX IF NOT EXISTS idx_social_mission_submissions_status
ON public.social_mission_submissions (status);

CREATE INDEX IF NOT EXISTS idx_social_mission_submissions_mission
ON public.social_mission_submissions (mission_id);

ALTER TABLE public.social_mission_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_mission_submissions_read_own ON public.social_mission_submissions;
CREATE POLICY social_mission_submissions_read_own
ON public.social_mission_submissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());


-- ============================================================
-- Referral Pending Rewards: parrain chooses 50pts OR 5 packs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referral_pending_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'chosen_points', 'chosen_packs')),
  points_amount INTEGER NOT NULL DEFAULT 50,
  packs_amount INTEGER NOT NULL DEFAULT 5,
  chosen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referee_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_pending_rewards_referrer
ON public.referral_pending_rewards (referrer_id);

ALTER TABLE public.referral_pending_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_pending_read_own ON public.referral_pending_rewards;
CREATE POLICY referral_pending_read_own
ON public.referral_pending_rewards
FOR SELECT
TO authenticated
USING (referrer_id = auth.uid());

COMMIT;
