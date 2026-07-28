-- Kanab Quest game foundation.
-- The new collection stays inactive until the admin-only game backend is enabled.

BEGIN;

DO $$ BEGIN
  CREATE TYPE public.kq_run_status AS ENUM ('active', 'completed', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.kq_flower_status AS ENUM ('available', 'locked', 'burned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.kq_battle_status AS ENUM ('locked', 'verdict');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.lottery_card_collections (code, title, is_active)
VALUES ('BOTTE_DU_CHANVRIER_2026', 'La Botte du Chanvrier', FALSE)
ON CONFLICT (code) DO UPDATE
SET title = EXCLUDED.title, is_active = EXCLUDED.is_active, updated_at = now();

WITH collection AS (
  SELECT id FROM public.lottery_card_collections WHERE code = 'BOTTE_DU_CHANVRIER_2026'
), cards(card_number, code, name, rarity, description) AS (
  VALUES
    (1, 'BOTTE-001', 'Terreau universel', 'common', 'Relance un dé neutre sur une Situation Racines.'),
    (2, 'BOTTE-002', 'Chrysope affamée', 'silver', 'Transforme un dé faible en réussite contre pucerons ou thrips.'),
    (3, 'BOTTE-003', 'Petit ventilateur', 'common', 'Annule un Danger sur une Situation Climat ou Séchage.'),
    (4, 'BOTTE-004', 'Loupe d''inspection', 'common', 'Identifie un ravageur et ouvre la réserve de cartes PBI.'),
    (5, 'BOTTE-005', 'Arrosage mesuré', 'common', 'Relance un dé neutre sur une Situation Eau ou Racines.'),
    (6, 'BOTTE-006', 'Deuxième chance', 'gold', 'Relance les deux dés les plus faibles.'),
    (7, 'BOTTE-007', 'Fibre de coco', 'silver', 'Relance un dé neutre sur une Situation Eau.'),
    (8, 'BOTTE-008', 'Mélange drainant', 'silver', 'Relance un dé neutre sur une Situation Eau ou Séchage.'),
    (9, 'BOTTE-009', 'Terre vivante', 'gold', 'Relance un dé neutre sur une Situation Racines ou Ravageur.'),
    (10, 'BOTTE-010', 'Coccinelle à sept points', 'gold', 'Transforme un dé faible en réussite forte contre les pucerons.'),
    (11, 'BOTTE-011', 'Amblyseius swirskii', 'silver', 'Transforme un dé faible en réussite contre acariens ou thrips.'),
    (12, 'BOTTE-012', 'Aphidius colemani', 'silver', 'Transforme un dé faible contre les pucerons et offre un bonus d''XP.'),
    (13, 'BOTTE-013', 'Pot en tissu', 'common', 'Relance un dé neutre sur une Situation Racines ou Eau.'),
    (14, 'BOTTE-014', 'Hygromètre vintage', 'silver', 'Annule un Danger sur une Situation Eau, Climat ou Séchage.'),
    (15, 'BOTTE-015', 'Palissage doux', 'silver', 'Transforme un dé neutre en réussite pendant la Floraison.'),
    (16, 'BOTTE-016', 'Séchage patient', 'gold', 'Transforme un dé neutre en réussite pendant le Séchage.'),
    (17, 'BOTTE-017', 'Main verte', 'common', 'Lance quatre dés et conserve les trois meilleurs.'),
    (18, 'BOTTE-018', 'Coup de pouce', 'silver', 'Transforme un 3 en réussite après le lancer.')
)
INSERT INTO public.lottery_card_definitions (
  collection_id, code, card_number, name, rarity, description, visual_prompt, image_url, is_active
)
SELECT collection.id, cards.code, cards.card_number, cards.name,
  cards.rarity::public.lottery_card_rarity, cards.description, '', '', FALSE
FROM collection CROSS JOIN cards
ON CONFLICT (code) DO UPDATE SET
  collection_id = EXCLUDED.collection_id,
  card_number = EXCLUDED.card_number,
  name = EXCLUDED.name,
  rarity = EXCLUDED.rarity,
  description = EXCLUDED.description,
  is_active = FALSE,
  updated_at = now();

WITH collection AS (
  SELECT id FROM public.lottery_card_collections WHERE code = 'BOTTE_DU_CHANVRIER_2026'
), cards(card_number, code, name, rarity, description) AS (
  VALUES
    (19, 'BOTTE-019', 'Perlite horticole', 'common', 'Relance un dé neutre sur une Situation Racines ou Eau.'),
    (20, 'BOTTE-020', 'Biochar', 'silver', 'Relance un dé neutre sur une Situation Racines ou Séchage.'),
    (21, 'BOTTE-021', 'Compost mûr', 'gold', 'Relance un dé neutre sur une Situation Racines ou Ravageur.'),
    (22, 'BOTTE-022', 'Phytoseiulus persimilis', 'gold', 'Transforme un dé faible en réussite forte contre les acariens.'),
    (23, 'BOTTE-023', 'Orius laevigatus', 'silver', 'Transforme un dé faible en réussite contre les thrips.'),
    (24, 'BOTTE-024', 'Tensiomètre', 'common', 'Annule un Danger sur une Situation Eau.'),
    (25, 'BOTTE-025', 'Filet anti-insectes', 'silver', 'Annule un Danger sur une Situation Ravageur.'),
    (26, 'BOTTE-026', 'Brasseur d''air', 'common', 'Annule un Danger sur une Situation Climat ou Séchage.'),
    (27, 'BOTTE-027', 'Timer mécanique', 'silver', 'Transforme un dé neutre en réussite sur une Situation Floraison.'),
    (28, 'BOTTE-028', 'Taille apicale', 'silver', 'Transforme un dé neutre en réussite sur une Situation Floraison.'),
    (29, 'BOTTE-029', 'Effeuillage mesuré', 'common', 'Relance un dé neutre sur une Situation Floraison ou Climat.'),
    (30, 'BOTTE-030', 'Affinage en bocal', 'gold', 'Transforme un dé neutre en réussite pendant le Séchage.'),
    (31, 'BOTTE-031', 'Drainage contrôlé', 'common', 'Relance un dé neutre sur une Situation Eau ou Racines.'),
    (32, 'BOTTE-032', 'Carnet du jardinier', 'gold', 'Lance quatre dés et conserve les trois meilleurs.'),
    (33, 'BOTTE-033', 'Observation matinale', 'common', 'Transforme un 3 en réussite après le lancer.'),
    (34, 'BOTTE-034', 'Retour au calme', 'gold', 'Relance les deux dés les plus faibles.'),
    (35, 'BOTTE-035', 'Quarantaine préventive', 'silver', 'Annule un Danger sur une Situation Ravageur.'),
    (36, 'BOTTE-036', 'Bac de rétention', 'common', 'Annule un Danger sur une Situation Eau.')
)
INSERT INTO public.lottery_card_definitions (collection_id, code, card_number, name, rarity, description, visual_prompt, image_url, is_active)
SELECT collection.id, cards.code, cards.card_number, cards.name, cards.rarity::public.lottery_card_rarity, cards.description, '', '', FALSE
FROM collection CROSS JOIN cards
ON CONFLICT (code) DO UPDATE SET collection_id = EXCLUDED.collection_id, card_number = EXCLUDED.card_number,
  name = EXCLUDED.name, rarity = EXCLUDED.rarity, description = EXCLUDED.description, is_active = FALSE, updated_at = now();

CREATE TABLE IF NOT EXISTS public.kq_support_card_rules (
  card_definition_id UUID PRIMARY KEY REFERENCES public.lottery_card_definitions(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('substrate', 'pbi', 'equipment', 'know-how', 'luck')),
  timing TEXT NOT NULL CHECK (timing IN ('passive', 'before-roll', 'after-roll')),
  effect TEXT NOT NULL DEFAULT 'reroll-neutral' CHECK (effect IN ('reroll-neutral', 'pbi-success', 'pbi-strong-success', 'pbi-success-xp', 'cancel-danger', 'reveal-pest', 'reroll-two-low', 'neutral-to-success', 'four-keep-three', 'three-to-success')),
  xp_cost SMALLINT NOT NULL CHECK (xp_cost BETWEEN 0 AND 9),
  tags TEXT[] NOT NULL DEFAULT '{}',
  targets TEXT[] NOT NULL DEFAULT '{}',
  rules_version SMALLINT NOT NULL DEFAULT 1 CHECK (rules_version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

WITH rules(code, category, timing, xp_cost, tags, targets) AS (
  VALUES
    ('BOTTE-001', 'substrate', 'passive', 0, ARRAY['roots'], ARRAY[]::TEXT[]),
    ('BOTTE-002', 'pbi', 'after-roll', 2, ARRAY['pest'], ARRAY['aphids','thrips']),
    ('BOTTE-003', 'equipment', 'before-roll', 1, ARRAY['climate','drying'], ARRAY[]::TEXT[]),
    ('BOTTE-004', 'equipment', 'before-roll', 1, ARRAY['pest'], ARRAY[]::TEXT[]),
    ('BOTTE-005', 'know-how', 'before-roll', 1, ARRAY['water','roots'], ARRAY[]::TEXT[]),
    ('BOTTE-006', 'luck', 'after-roll', 2, ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
    ('BOTTE-007', 'substrate', 'passive', 0, ARRAY['water'], ARRAY[]::TEXT[]),
    ('BOTTE-008', 'substrate', 'passive', 0, ARRAY['water','drying'], ARRAY[]::TEXT[]),
    ('BOTTE-009', 'substrate', 'passive', 0, ARRAY['roots','pest'], ARRAY[]::TEXT[]),
    ('BOTTE-010', 'pbi', 'after-roll', 3, ARRAY['pest'], ARRAY['aphids']),
    ('BOTTE-011', 'pbi', 'after-roll', 2, ARRAY['pest'], ARRAY['mites','thrips']),
    ('BOTTE-012', 'pbi', 'after-roll', 2, ARRAY['pest'], ARRAY['aphids']),
    ('BOTTE-013', 'equipment', 'before-roll', 1, ARRAY['roots','water'], ARRAY[]::TEXT[]),
    ('BOTTE-014', 'equipment', 'before-roll', 2, ARRAY['water','climate','drying'], ARRAY[]::TEXT[]),
    ('BOTTE-015', 'know-how', 'before-roll', 2, ARRAY['flower'], ARRAY[]::TEXT[]),
    ('BOTTE-016', 'know-how', 'before-roll', 2, ARRAY['drying'], ARRAY[]::TEXT[]),
    ('BOTTE-017', 'luck', 'before-roll', 1, ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
    ('BOTTE-018', 'luck', 'after-roll', 1, ARRAY[]::TEXT[], ARRAY[]::TEXT[])
)
INSERT INTO public.kq_support_card_rules (card_definition_id, category, timing, xp_cost, tags, targets)
SELECT definition.id, rules.category, rules.timing, rules.xp_cost, rules.tags, rules.targets
FROM rules JOIN public.lottery_card_definitions definition ON definition.code = rules.code
ON CONFLICT (card_definition_id) DO UPDATE SET
  category = EXCLUDED.category, timing = EXCLUDED.timing, xp_cost = EXCLUDED.xp_cost,
  tags = EXCLUDED.tags, targets = EXCLUDED.targets, updated_at = now();

WITH rules(code, category, timing, xp_cost, tags, targets) AS (
  VALUES
    ('BOTTE-019', 'substrate', 'passive', 0, ARRAY['roots','water'], ARRAY[]::TEXT[]),
    ('BOTTE-020', 'substrate', 'passive', 0, ARRAY['roots','drying'], ARRAY[]::TEXT[]),
    ('BOTTE-021', 'substrate', 'passive', 0, ARRAY['roots','pest'], ARRAY[]::TEXT[]),
    ('BOTTE-022', 'pbi', 'after-roll', 3, ARRAY['pest'], ARRAY['mites']),
    ('BOTTE-023', 'pbi', 'after-roll', 2, ARRAY['pest'], ARRAY['thrips']),
    ('BOTTE-024', 'equipment', 'before-roll', 1, ARRAY['water'], ARRAY[]::TEXT[]),
    ('BOTTE-025', 'equipment', 'before-roll', 2, ARRAY['pest'], ARRAY[]::TEXT[]),
    ('BOTTE-026', 'equipment', 'before-roll', 1, ARRAY['climate','drying'], ARRAY[]::TEXT[]),
    ('BOTTE-027', 'equipment', 'before-roll', 2, ARRAY['flower'], ARRAY[]::TEXT[]),
    ('BOTTE-028', 'know-how', 'before-roll', 2, ARRAY['flower'], ARRAY[]::TEXT[]),
    ('BOTTE-029', 'know-how', 'before-roll', 1, ARRAY['flower','climate'], ARRAY[]::TEXT[]),
    ('BOTTE-030', 'know-how', 'before-roll', 2, ARRAY['drying'], ARRAY[]::TEXT[]),
    ('BOTTE-031', 'know-how', 'before-roll', 1, ARRAY['water','roots'], ARRAY[]::TEXT[]),
    ('BOTTE-032', 'luck', 'before-roll', 2, ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
    ('BOTTE-033', 'luck', 'after-roll', 1, ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
    ('BOTTE-034', 'luck', 'after-roll', 2, ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
    ('BOTTE-035', 'equipment', 'before-roll', 2, ARRAY['pest'], ARRAY[]::TEXT[]),
    ('BOTTE-036', 'equipment', 'before-roll', 1, ARRAY['water'], ARRAY[]::TEXT[])
)
INSERT INTO public.kq_support_card_rules (card_definition_id, category, timing, xp_cost, tags, targets)
SELECT definition.id, rules.category, rules.timing, rules.xp_cost, rules.tags, rules.targets
FROM rules JOIN public.lottery_card_definitions definition ON definition.code = rules.code
ON CONFLICT (card_definition_id) DO UPDATE SET category = EXCLUDED.category, timing = EXCLUDED.timing,
  xp_cost = EXCLUDED.xp_cost, tags = EXCLUDED.tags, targets = EXCLUDED.targets, updated_at = now();

UPDATE public.kq_support_card_rules AS rule SET effect = CASE definition.code
  WHEN 'BOTTE-002' THEN 'pbi-success'
  WHEN 'BOTTE-003' THEN 'cancel-danger'
  WHEN 'BOTTE-004' THEN 'reveal-pest'
  WHEN 'BOTTE-006' THEN 'reroll-two-low'
  WHEN 'BOTTE-010' THEN 'pbi-strong-success'
  WHEN 'BOTTE-011' THEN 'pbi-success'
  WHEN 'BOTTE-012' THEN 'pbi-success-xp'
  WHEN 'BOTTE-014' THEN 'cancel-danger'
  WHEN 'BOTTE-015' THEN 'neutral-to-success'
  WHEN 'BOTTE-016' THEN 'neutral-to-success'
  WHEN 'BOTTE-017' THEN 'four-keep-three'
  WHEN 'BOTTE-018' THEN 'three-to-success'
  WHEN 'BOTTE-022' THEN 'pbi-strong-success'
  WHEN 'BOTTE-023' THEN 'pbi-success'
  WHEN 'BOTTE-024' THEN 'cancel-danger'
  WHEN 'BOTTE-025' THEN 'cancel-danger'
  WHEN 'BOTTE-026' THEN 'cancel-danger'
  WHEN 'BOTTE-027' THEN 'neutral-to-success'
  WHEN 'BOTTE-028' THEN 'neutral-to-success'
  WHEN 'BOTTE-030' THEN 'neutral-to-success'
  WHEN 'BOTTE-032' THEN 'four-keep-three'
  WHEN 'BOTTE-033' THEN 'three-to-success'
  WHEN 'BOTTE-034' THEN 'reroll-two-low'
  WHEN 'BOTTE-035' THEN 'cancel-danger'
  WHEN 'BOTTE-036' THEN 'cancel-danger'
  ELSE 'reroll-neutral'
END
FROM public.lottery_card_definitions AS definition
WHERE definition.id = rule.card_definition_id AND definition.code LIKE 'BOTTE-%';

-- Existing Kanab Quest packs use slots 1..3. Optional La Botte boosters use
-- slots 4..6 on the same ticket, preserving the original three-card draw.
ALTER TABLE public.lottery_card_instances DROP CONSTRAINT IF EXISTS lottery_card_instances_pack_slot_check;
ALTER TABLE public.lottery_card_instances ADD CONSTRAINT lottery_card_instances_pack_slot_check
  CHECK (pack_slot BETWEEN 1 AND 6);

CREATE TABLE IF NOT EXISTS public.kq_support_booster_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID UNIQUE REFERENCES public.lottery_tickets(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'ticket' CHECK (source IN ('ticket', 'arena_streak')),
  reward_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'opened')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ,
  CHECK (
    (source = 'ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR
    (source = 'arena_streak' AND ticket_id IS NULL AND reward_key IS NOT NULL)
  ),
  CHECK ((status = 'opened') = (opened_at IS NOT NULL))
);

ALTER TABLE public.lottery_card_instances ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE public.lottery_card_instances
  ADD COLUMN IF NOT EXISTS kq_support_entitlement_id UUID
  REFERENCES public.kq_support_booster_entitlements(id) ON DELETE CASCADE;
ALTER TABLE public.lottery_card_instances
  ADD CONSTRAINT lottery_card_instances_source_required
  CHECK (ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_support_instance_slot
  ON public.lottery_card_instances(kq_support_entitlement_id, pack_slot)
  WHERE kq_support_entitlement_id IS NOT NULL;

ALTER TABLE public.kq_support_booster_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY kq_support_boosters_read_own ON public.kq_support_booster_entitlements
  FOR SELECT USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.kq_support_booster_entitlements FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_kq_open_support_booster(
  p_entitlement_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entitlement public.kq_support_booster_entitlements%ROWTYPE;
  v_collection_id UUID;
  v_card public.lottery_card_definitions%ROWTYPE;
  v_rarity public.lottery_card_rarity;
  v_roll INTEGER;
  v_count INTEGER;
  v_offset INTEGER;
  v_slot INTEGER;
  v_cards JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO v_entitlement FROM public.kq_support_booster_entitlements
  WHERE id = p_entitlement_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_entitlement.status <> 'available' THEN RAISE EXCEPTION 'Support booster unavailable'; END IF;

  SELECT id INTO v_collection_id FROM public.lottery_card_collections
  WHERE code = 'BOTTE_DU_CHANVRIER_2026' AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Support collection unavailable'; END IF;

  FOR v_slot IN 4..6 LOOP
    IF v_slot = 4 THEN
      v_rarity := 'common';
    ELSE
      v_roll := public.lottery_secure_random_int(1, 100);
      v_rarity := CASE WHEN v_roll <= 70 THEN 'common'::public.lottery_card_rarity
        WHEN v_roll <= 94 THEN 'silver'::public.lottery_card_rarity
        ELSE 'gold'::public.lottery_card_rarity END;
    END IF;

    SELECT count(*) INTO v_count FROM public.lottery_card_definitions
    WHERE collection_id = v_collection_id AND rarity = v_rarity AND is_active = TRUE;
    IF v_count = 0 THEN RAISE EXCEPTION 'Support rarity unavailable'; END IF;
    v_offset := public.lottery_secure_random_int(0, v_count - 1);
    SELECT * INTO v_card FROM public.lottery_card_definitions
    WHERE collection_id = v_collection_id AND rarity = v_rarity AND is_active = TRUE
    ORDER BY card_number OFFSET v_offset LIMIT 1;

    INSERT INTO public.lottery_card_instances (
      user_id, ticket_id, kq_support_entitlement_id, pack_slot, card_definition_id
    )
    VALUES (p_user_id, v_entitlement.ticket_id, v_entitlement.id, v_slot, v_card.id);
    v_cards := v_cards || jsonb_build_array(jsonb_build_object(
      'code', v_card.code, 'name', v_card.name, 'rarity', v_card.rarity,
      'packSlot', v_slot, 'imageUrl', v_card.image_url
    ));
  END LOOP;

  UPDATE public.kq_support_booster_entitlements
  SET status = 'opened', opened_at = now() WHERE id = v_entitlement.id;
  RETURN jsonb_build_object('entitlementId', v_entitlement.id, 'cards', v_cards, 'openedAt', now());
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_open_support_booster(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_open_support_booster(UUID, UUID) TO service_role;

CREATE TABLE IF NOT EXISTS public.kq_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buddie_card_definition_id UUID NOT NULL REFERENCES public.lottery_card_definitions(id) ON DELETE RESTRICT,
  seed INTEGER NOT NULL CHECK (seed BETWEEN 0 AND 99999),
  rules_version SMALLINT NOT NULL DEFAULT 1 CHECK (rules_version > 0),
  status public.kq_run_status NOT NULL DEFAULT 'active',
  deck_codes TEXT[] NOT NULL,
  scenario_codes TEXT[] NOT NULL,
  challenge_day DATE NOT NULL DEFAULT (timezone('Europe/Paris', now()))::date,
  state JSONB NOT NULL DEFAULT '{}'::JSONB,
  integrity_code TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(deck_codes) >= 1),
  CHECK (cardinality(scenario_codes) = 6),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_one_active_run_per_user
  ON public.kq_runs(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_kq_runs_user_recent ON public.kq_runs(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.kq_card_burn_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.kq_runs(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_instance_id UUID NOT NULL UNIQUE,
  card_definition_id UUID NOT NULL REFERENCES public.lottery_card_definitions(id) ON DELETE RESTRICT,
  card_code TEXT NOT NULL,
  stage_index SMALLINT NOT NULL CHECK (stage_index BETWEEN 0 AND 5),
  use_kind TEXT NOT NULL CHECK (use_kind IN ('substrate', 'support', 'pbi')),
  burned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kq_card_burns_user_recent
  ON public.kq_card_burn_receipts(user_id, burned_at DESC);
CREATE INDEX IF NOT EXISTS idx_kq_card_burns_run
  ON public.kq_card_burn_receipts(run_id, stage_index);

CREATE TABLE IF NOT EXISTS public.kq_flowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE REFERENCES public.kq_runs(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variety_code TEXT NOT NULL,
  variety_name TEXT NOT NULL,
  quality SMALLINT NOT NULL CHECK (quality BETWEEN -6 AND 30),
  traits TEXT[] NOT NULL DEFAULT '{}',
  combos TEXT[] NOT NULL DEFAULT '{}',
  battle_stats JSONB NOT NULL DEFAULT '{}'::JSONB,
  status public.kq_flower_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  burned_at TIMESTAMPTZ,
  CHECK (
    (status = 'available' AND locked_at IS NULL AND burned_at IS NULL) OR
    (status = 'locked' AND locked_at IS NOT NULL AND burned_at IS NULL) OR
    (status = 'burned' AND locked_at IS NOT NULL AND burned_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_kq_flowers_matchmaking
  ON public.kq_flowers(status, quality, created_at) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_kq_flowers_owner_recent ON public.kq_flowers(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.kq_battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_one_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  player_two_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  flower_one_id UUID NOT NULL REFERENCES public.kq_flowers(id) ON DELETE RESTRICT,
  flower_two_id UUID NOT NULL REFERENCES public.kq_flowers(id) ON DELETE RESTRICT,
  status public.kq_battle_status NOT NULL DEFAULT 'locked',
  seed INTEGER NOT NULL,
  rounds JSONB NOT NULL DEFAULT '[]'::JSONB,
  winner_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verdict_at TIMESTAMPTZ,
  CHECK (player_one_id <> player_two_id),
  CHECK (flower_one_id <> flower_two_id),
  CHECK (winner_id IS NULL OR winner_id IN (player_one_id, player_two_id)),
  CHECK ((status = 'verdict') = (verdict_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_locked_flower_one
  ON public.kq_battles(flower_one_id) WHERE status = 'locked';
CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_locked_flower_two
  ON public.kq_battles(flower_two_id) WHERE status = 'locked';
CREATE INDEX IF NOT EXISTS idx_kq_battles_player_one_recent ON public.kq_battles(player_one_id, locked_at DESC);
CREATE INDEX IF NOT EXISTS idx_kq_battles_player_two_recent ON public.kq_battles(player_two_id, locked_at DESC);

CREATE TABLE IF NOT EXISTS public.kq_rank_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  season_code TEXT NOT NULL DEFAULT 'KQ-2026-S1',
  rating INTEGER NOT NULL DEFAULT 1000 CHECK (rating BETWEEN 0 AND 100000),
  season_points INTEGER NOT NULL DEFAULT 0 CHECK (season_points >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  burned_flowers INTEGER NOT NULL DEFAULT 0 CHECK (burned_flowers >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kq_rank_season_order
  ON public.kq_rank_profiles(season_code, rating DESC, season_points DESC);

CREATE OR REPLACE FUNCTION public.rpc_kq_grant_streak_booster(p_user_id UUID)
RETURNS public.kq_support_booster_entitlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.kq_rank_profiles%ROWTYPE;
  v_entitlement public.kq_support_booster_entitlements%ROWTYPE;
  v_reward_key TEXT;
BEGIN
  SELECT * INTO v_profile FROM public.kq_rank_profiles
  WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.streak <= 0 OR v_profile.streak % 3 <> 0 THEN
    RAISE EXCEPTION 'Streak booster unavailable';
  END IF;
  v_reward_key := p_user_id::TEXT || ':streak:' || v_profile.wins::TEXT || ':' || v_profile.streak::TEXT;
  INSERT INTO public.kq_support_booster_entitlements (user_id, source, reward_key)
  VALUES (p_user_id, 'arena_streak', v_reward_key)
  ON CONFLICT (reward_key) DO UPDATE SET reward_key = EXCLUDED.reward_key
  RETURNING * INTO v_entitlement;
  RETURN v_entitlement;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_streak_booster(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_streak_booster(UUID) TO service_role;

CREATE TABLE IF NOT EXISTS public.kq_daily_challenge_claims (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_day DATE NOT NULL,
  challenge_code TEXT NOT NULL CHECK (challenge_code IN (
    'steady-grower', 'spark-hunter', 'green-streak', 'biocontrol', 'clean-sweep',
    'no-failure', 'critical-touch', 'jury-edge', 'comeback'
  )),
  battle_id UUID NOT NULL REFERENCES public.kq_battles(id) ON DELETE RESTRICT,
  points SMALLINT NOT NULL CHECK (points BETWEEN 1 AND 25),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_day, challenge_code)
);

CREATE INDEX IF NOT EXISTS idx_kq_challenge_claims_user_recent
  ON public.kq_daily_challenge_claims(user_id, challenge_day DESC);

CREATE TABLE IF NOT EXISTS public.kq_leaderboard_snapshots (
  snapshot_date DATE NOT NULL,
  season_code TEXT NOT NULL,
  leaderboard JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, season_code)
);

CREATE OR REPLACE FUNCTION public.rpc_kq_refresh_daily_leaderboard(p_season_code TEXT)
RETURNS public.kq_leaderboard_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot public.kq_leaderboard_snapshots%ROWTYPE;
  v_leaderboard JSONB;
  v_snapshot_date DATE := (timezone('Europe/Paris', now()))::date;
BEGIN
  SELECT * INTO v_snapshot FROM public.kq_leaderboard_snapshots
  WHERE snapshot_date = v_snapshot_date AND season_code = p_season_code;
  IF FOUND THEN RETURN v_snapshot; END IF;

  WITH ranked AS (
    SELECT user_id, rating, season_points, wins, losses, streak, burned_flowers,
      row_number() OVER (ORDER BY rating DESC, season_points DESC, wins DESC, user_id) AS rank
    FROM public.kq_rank_profiles
    WHERE season_code = p_season_code
    ORDER BY rating DESC, season_points DESC, wins DESC, user_id
    LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'rank', rank, 'userId', user_id, 'rating', rating, 'seasonPoints', season_points,
    'wins', wins, 'losses', losses, 'streak', streak, 'burnedFlowers', burned_flowers
  ) ORDER BY rank), '[]'::JSONB)
  INTO v_leaderboard FROM ranked;

  INSERT INTO public.kq_leaderboard_snapshots (snapshot_date, season_code, leaderboard)
  VALUES (v_snapshot_date, p_season_code, v_leaderboard)
  ON CONFLICT (snapshot_date, season_code) DO NOTHING
  RETURNING * INTO v_snapshot;

  IF v_snapshot.snapshot_date IS NULL THEN
    SELECT * INTO v_snapshot FROM public.kq_leaderboard_snapshots
    WHERE snapshot_date = v_snapshot_date AND season_code = p_season_code;
  END IF;
  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_refresh_daily_leaderboard(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_refresh_daily_leaderboard(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_claim_daily_challenges(
  p_user_id UUID,
  p_battle_id UUID,
  p_challenge_day DATE,
  p_challenge_codes TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_day DATE;
  v_awarded INTEGER := 0;
  v_rotation TEXT[] := ARRAY[
    'steady-grower', 'spark-hunter', 'green-streak', 'biocontrol', 'clean-sweep',
    'no-failure', 'critical-touch', 'jury-edge', 'comeback'
  ];
  v_start INTEGER;
  v_daily_codes TEXT[];
BEGIN
  SELECT r.challenge_day INTO v_run_day
  FROM public.kq_battles b
  JOIN public.kq_flowers f ON f.id = CASE
    WHEN b.player_one_id = p_user_id THEN b.flower_one_id
    WHEN b.player_two_id = p_user_id THEN b.flower_two_id
    ELSE NULL
  END
  JOIN public.kq_runs r ON r.id = f.run_id
  WHERE b.id = p_battle_id AND b.status = 'verdict';

  IF v_run_day IS NULL OR v_run_day <> p_challenge_day THEN
    RAISE EXCEPTION 'Challenge claim does not match the completed run';
  END IF;

  v_start := to_char(p_challenge_day, 'YYYYMMDD')::INTEGER % cardinality(v_rotation);
  v_daily_codes := ARRAY[
    v_rotation[v_start + 1],
    v_rotation[((v_start + 4) % cardinality(v_rotation)) + 1],
    v_rotation[((v_start + 8) % cardinality(v_rotation)) + 1]
  ];

  WITH requested AS (
    SELECT DISTINCT code FROM unnest(p_challenge_codes) AS code
  ), inserted AS (
    INSERT INTO public.kq_daily_challenge_claims (
      user_id, challenge_day, challenge_code, battle_id, points
    )
    SELECT p_user_id, p_challenge_day, code, p_battle_id, CASE code
      WHEN 'steady-grower' THEN 8 WHEN 'spark-hunter' THEN 10 WHEN 'green-streak' THEN 8
      WHEN 'biocontrol' THEN 12 WHEN 'clean-sweep' THEN 15 WHEN 'no-failure' THEN 12
      WHEN 'critical-touch' THEN 10 WHEN 'jury-edge' THEN 9 WHEN 'comeback' THEN 11
    END
    FROM requested
    WHERE code = ANY(v_daily_codes)
    ON CONFLICT (user_id, challenge_day, challenge_code) DO NOTHING
    RETURNING points
  )
  SELECT COALESCE(sum(points), 0)::INTEGER INTO v_awarded FROM inserted;

  INSERT INTO public.kq_rank_profiles (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.kq_rank_profiles
  SET season_points = season_points + v_awarded, updated_at = now()
  WHERE user_id = p_user_id AND v_awarded > 0;
  RETURN v_awarded;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_claim_daily_challenges(UUID, UUID, DATE, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_claim_daily_challenges(UUID, UUID, DATE, TEXT[]) TO service_role;

ALTER TABLE public.kq_support_card_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_card_burn_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_flowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_rank_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_daily_challenge_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY kq_rules_read ON public.kq_support_card_rules FOR SELECT USING (true);
CREATE POLICY kq_runs_read_own ON public.kq_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY kq_card_burns_read_own ON public.kq_card_burn_receipts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY kq_flowers_read_own ON public.kq_flowers FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY kq_battles_read_participant ON public.kq_battles FOR SELECT
  USING (auth.uid() = player_one_id OR auth.uid() = player_two_id);
CREATE POLICY kq_rank_profiles_read ON public.kq_rank_profiles FOR SELECT USING (true);
CREATE POLICY kq_challenge_claims_read_own ON public.kq_daily_challenge_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY kq_leaderboard_snapshots_read ON public.kq_leaderboard_snapshots FOR SELECT USING (true);

-- Mutations deliberately remain service-role only. Game results and burns must be
-- validated by a server route; clients cannot award themselves XP or ranking points.
REVOKE INSERT, UPDATE, DELETE ON public.kq_runs, public.kq_card_burn_receipts, public.kq_flowers, public.kq_battles,
  public.kq_rank_profiles, public.kq_daily_challenge_claims, public.kq_leaderboard_snapshots FROM anon, authenticated;
REVOKE ALL ON public.kq_support_card_rules, public.kq_support_booster_entitlements, public.kq_runs,
  public.kq_card_burn_receipts, public.kq_flowers, public.kq_battles, public.kq_rank_profiles,
  public.kq_daily_challenge_claims, public.kq_leaderboard_snapshots FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_kq_burn_support_card(
  p_run_id UUID,
  p_card_instance_id UUID,
  p_stage_index SMALLINT,
  p_use_kind TEXT
)
RETURNS public.kq_card_burn_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.kq_runs%ROWTYPE;
  v_instance public.lottery_card_instances%ROWTYPE;
  v_definition public.lottery_card_definitions%ROWTYPE;
  v_receipt public.kq_card_burn_receipts%ROWTYPE;
BEGIN
  IF p_stage_index NOT BETWEEN 0 AND 5 OR p_use_kind NOT IN ('substrate', 'support', 'pbi') THEN
    RAISE EXCEPTION 'Invalid card use';
  END IF;

  SELECT * INTO v_run FROM public.kq_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.status <> 'active' THEN RAISE EXCEPTION 'Run unavailable'; END IF;

  SELECT * INTO v_instance FROM public.lottery_card_instances
  WHERE id = p_card_instance_id AND user_id = v_run.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card copy unavailable'; END IF;

  SELECT * INTO v_definition FROM public.lottery_card_definitions
  WHERE id = v_instance.card_definition_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card definition unavailable'; END IF;

  IF p_use_kind <> 'pbi' AND NOT (v_definition.code = ANY(v_run.deck_codes)) THEN
    RAISE EXCEPTION 'Card is not in this run deck';
  END IF;

  IF p_use_kind = 'pbi' AND NOT EXISTS (
    SELECT 1 FROM public.kq_support_card_rules
    WHERE card_definition_id = v_definition.id AND category = 'pbi'
  ) THEN RAISE EXCEPTION 'Card is not a PBI'; END IF;
  IF p_use_kind <> 'pbi' AND EXISTS (
    SELECT 1 FROM public.kq_support_card_rules
    WHERE card_definition_id = v_definition.id AND category = 'pbi'
  ) THEN RAISE EXCEPTION 'PBI use kind required'; END IF;
  IF p_use_kind = 'substrate' AND NOT EXISTS (
    SELECT 1 FROM public.kq_support_card_rules
    WHERE card_definition_id = v_definition.id AND category = 'substrate'
  ) THEN RAISE EXCEPTION 'Card is not a substrate'; END IF;

  DELETE FROM public.lottery_card_instances WHERE id = v_instance.id;

  INSERT INTO public.kq_card_burn_receipts (
    run_id, user_id, card_instance_id, card_definition_id, card_code, stage_index, use_kind
  ) VALUES (
    v_run.id, v_run.user_id, v_instance.id, v_definition.id, v_definition.code, p_stage_index, p_use_kind
  ) RETURNING * INTO v_receipt;

  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_burn_support_card(UUID, UUID, SMALLINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_burn_support_card(UUID, UUID, SMALLINT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_lock_battle(
  p_flower_one_id UUID,
  p_flower_two_id UUID,
  p_seed INTEGER
)
RETURNS public.kq_battles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flower_one public.kq_flowers%ROWTYPE;
  v_flower_two public.kq_flowers%ROWTYPE;
  v_battle public.kq_battles%ROWTYPE;
  v_locked_count INTEGER;
BEGIN
  IF p_flower_one_id = p_flower_two_id THEN RAISE EXCEPTION 'Two distinct flowers are required'; END IF;

  SELECT * INTO v_flower_one FROM public.kq_flowers WHERE id = p_flower_one_id FOR UPDATE;
  SELECT * INTO v_flower_two FROM public.kq_flowers WHERE id = p_flower_two_id FOR UPDATE;
  IF NOT FOUND OR v_flower_one.id IS NULL OR v_flower_two.id IS NULL THEN RAISE EXCEPTION 'Flower unavailable'; END IF;
  IF v_flower_one.owner_id = v_flower_two.owner_id THEN RAISE EXCEPTION 'Players must be distinct'; END IF;
  IF v_flower_one.status <> 'available' OR v_flower_two.status <> 'available' THEN RAISE EXCEPTION 'Flower already used'; END IF;

  UPDATE public.kq_flowers SET status = 'locked', locked_at = now()
  WHERE id IN (p_flower_one_id, p_flower_two_id) AND status = 'available';
  GET DIAGNOSTICS v_locked_count = ROW_COUNT;
  IF v_locked_count <> 2 THEN RAISE EXCEPTION 'Could not lock both flowers'; END IF;

  INSERT INTO public.kq_battles (
    player_one_id, player_two_id, flower_one_id, flower_two_id, seed
  ) VALUES (
    v_flower_one.owner_id, v_flower_two.owner_id, v_flower_one.id, v_flower_two.id, p_seed
  ) RETURNING * INTO v_battle;
  RETURN v_battle;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_lock_battle(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_lock_battle(UUID, UUID, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_battle(
  p_battle_id UUID,
  p_rounds JSONB,
  p_winner_id UUID
)
RETURNS public.kq_battles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.kq_battles%ROWTYPE;
  v_burned_count INTEGER;
  v_rating_one INTEGER;
  v_rating_two INTEGER;
  v_expected_one NUMERIC;
  v_delta_one INTEGER;
  v_delta_two INTEGER;
  v_winner_streak INTEGER;
  v_streak_entitlement public.kq_support_booster_entitlements%ROWTYPE;
BEGIN
  SELECT * INTO v_battle FROM public.kq_battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND OR v_battle.status <> 'locked' THEN
    RAISE EXCEPTION 'Battle unavailable';
  END IF;
  IF p_winner_id NOT IN (v_battle.player_one_id, v_battle.player_two_id) THEN
    RAISE EXCEPTION 'Invalid winner';
  END IF;
  IF jsonb_typeof(p_rounds) <> 'array' OR jsonb_array_length(p_rounds) <> 3 THEN
    RAISE EXCEPTION 'A verdict requires exactly three rounds';
  END IF;

  UPDATE public.kq_flowers
  SET status = 'burned', burned_at = now()
  WHERE id IN (v_battle.flower_one_id, v_battle.flower_two_id) AND status = 'locked';
  GET DIAGNOSTICS v_burned_count = ROW_COUNT;
  IF v_burned_count <> 2 THEN RAISE EXCEPTION 'Both flowers must be locked'; END IF;

  UPDATE public.kq_battles SET status = 'verdict', rounds = p_rounds,
    winner_id = p_winner_id, verdict_at = now()
  WHERE id = p_battle_id RETURNING * INTO v_battle;

  INSERT INTO public.kq_rank_profiles (user_id) VALUES (v_battle.player_one_id), (v_battle.player_two_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT rating INTO v_rating_one FROM public.kq_rank_profiles
  WHERE user_id = v_battle.player_one_id FOR UPDATE;
  SELECT rating INTO v_rating_two FROM public.kq_rank_profiles
  WHERE user_id = v_battle.player_two_id FOR UPDATE;
  v_expected_one := 1.0 / (1.0 + power(10.0, (v_rating_two - v_rating_one)::NUMERIC / 400.0));
  v_delta_one := round(24.0 * (
    CASE WHEN v_battle.player_one_id = p_winner_id THEN 1.0 ELSE 0.0 END - v_expected_one
  ));
  v_delta_two := round(24.0 * (
    CASE WHEN v_battle.player_two_id = p_winner_id THEN 1.0 ELSE 0.0 END - (1.0 - v_expected_one)
  ));

  UPDATE public.kq_rank_profiles SET
    rating = GREATEST(0, rating + CASE
      WHEN user_id = v_battle.player_one_id THEN v_delta_one ELSE v_delta_two END),
    season_points = season_points + CASE
      WHEN user_id = p_winner_id THEN 25 + LEAST(10, streak * 2) ELSE 8 END,
    wins = wins + CASE WHEN user_id = p_winner_id THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN user_id = p_winner_id THEN 0 ELSE 1 END,
    streak = CASE WHEN user_id = p_winner_id THEN streak + 1 ELSE 0 END,
    burned_flowers = burned_flowers + 1,
    updated_at = now()
  WHERE user_id IN (v_battle.player_one_id, v_battle.player_two_id);

  SELECT streak INTO v_winner_streak FROM public.kq_rank_profiles
  WHERE user_id = p_winner_id;
  IF v_winner_streak > 0 AND v_winner_streak % 3 = 0 THEN
    v_streak_entitlement := public.rpc_kq_grant_streak_booster(p_winner_id);
    IF v_streak_entitlement.status = 'available' THEN
      PERFORM public.rpc_kq_open_support_booster(v_streak_entitlement.id, p_winner_id);
    END IF;
  END IF;

  RETURN v_battle;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_finalize_battle(UUID, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_finalize_battle(UUID, JSONB, UUID) TO service_role;

COMMIT;
