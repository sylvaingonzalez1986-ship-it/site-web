BEGIN;

-- One producer in the platform catalogue owns one Heritage definition. Cards
-- are archived when their producer disappears, but existing player draws stay
-- immutable and keep the producer snapshot used when the card was created.
ALTER TABLE public.kq_heritage_card_definitions
  DROP CONSTRAINT IF EXISTS kq_heritage_card_definitions_code_check;
ALTER TABLE public.kq_heritage_card_definitions
  ADD CONSTRAINT kq_heritage_card_definitions_code_check
  CHECK (code ~ '^HERITAGE-[0-9]{3,6}$');
ALTER TABLE public.kq_heritage_card_definitions
  DROP CONSTRAINT IF EXISTS kq_heritage_card_definitions_name_key;
ALTER TABLE public.kq_heritage_card_definitions
  DROP CONSTRAINT IF EXISTS kq_heritage_card_definitions_effect_code_key;

ALTER TABLE public.kq_heritage_card_definitions
  ADD COLUMN IF NOT EXISTS producer_id TEXT,
  ADD COLUMN IF NOT EXISTS producer_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS producer_image TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS auto_managed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.kq_heritage_card_definitions
  DROP CONSTRAINT IF EXISTS kq_heritage_card_definitions_producer_id_fkey;
ALTER TABLE public.kq_heritage_card_definitions
  ADD CONSTRAINT kq_heritage_card_definitions_producer_id_fkey
  FOREIGN KEY (producer_id) REFERENCES public.producers(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_heritage_definition_producer
  ON public.kq_heritage_card_definitions(producer_id)
  WHERE producer_id IS NOT NULL;

-- Preserve the associations already configured by hand.
WITH active_links AS (
  SELECT DISTINCT ON (campaign.heritage_code)
    campaign.heritage_code,
    campaign.producer_id,
    producer.name,
    producer.image
  FROM public.kq_producer_reward_campaigns campaign
  JOIN public.producers producer ON producer.id = campaign.producer_id
  WHERE campaign.status = 'active'
  ORDER BY campaign.heritage_code, campaign.version DESC
)
UPDATE public.kq_heritage_card_definitions definition
SET producer_id = active_links.producer_id,
    producer_name = active_links.name,
    producer_image = active_links.image,
    auto_managed = TRUE,
    is_active = TRUE,
    updated_at = now()
FROM active_links
WHERE definition.code = active_links.heritage_code
  AND definition.producer_id IS NULL;

-- Old generic cards without a producer are retained for past draws only.
UPDATE public.kq_heritage_card_definitions
SET is_active = FALSE, updated_at = now()
WHERE producer_id IS NULL;

CREATE SEQUENCE IF NOT EXISTS public.kq_heritage_card_number_seq;
SELECT setval(
  'public.kq_heritage_card_number_seq',
  GREATEST(
    12,
    COALESCE((
      SELECT MAX(substring(code FROM '([0-9]+)$')::BIGINT)
      FROM public.kq_heritage_card_definitions
      WHERE code ~ '^HERITAGE-[0-9]+$'
    ), 0)
  ),
  TRUE
);

CREATE OR REPLACE FUNCTION public.kq_ensure_producer_heritage(p_producer_id TEXT)
RETURNS public.kq_heritage_card_definitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producer public.producers%ROWTYPE;
  v_definition public.kq_heritage_card_definitions%ROWTYPE;
  v_number BIGINT;
  v_code TEXT;
  v_effect RECORD;
BEGIN
  SELECT * INTO v_producer FROM public.producers WHERE id = p_producer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_unknown_producer'; END IF;

  SELECT * INTO v_definition
  FROM public.kq_heritage_card_definitions
  WHERE producer_id = v_producer.id
  FOR UPDATE;
  IF FOUND THEN
    UPDATE public.kq_heritage_card_definitions
    SET producer_name = v_producer.name,
        producer_image = v_producer.image,
        updated_at = now()
    WHERE code = v_definition.code
    RETURNING * INTO v_definition;
    RETURN v_definition;
  END IF;

  -- Prefer an unused mechanic. Once every mechanic is represented, reuse the
  -- least represented one; editorial can then choose another supported effect.
  WITH effects(position, effect_code, timing, default_name, default_description) AS (
    VALUES
      (1, 'root-danger-to-spark', 'once-per-run', 'Racines solides', 'Le premier Danger en Enracinement devient une Étincelle.'),
      (2, 'starting-xp-two', 'passive', 'Réserve du jardinier', 'Commence chaque culture avec 2 XP supplémentaires.'),
      (3, 'opening-hand-reserve', 'once-per-run', 'Main prévoyante', 'À la première étape, pioche 8 cartes et compose une main de 5.'),
      (4, 'climate-danger-to-spark', 'once-per-run', 'Climat stable', 'Le premier Danger d’une situation Climat devient une Étincelle.'),
      (5, 'two-extra-redraws', 'passive', 'Second regard', 'Accorde deux changements de main supplémentaires par culture.'),
      (6, 'failure-to-fragile', 'once-per-run', 'Reprise vigoureuse', 'Le premier échec de la culture devient un résultat Fragile.'),
      (7, 'neutral-to-spark', 'once-per-run', 'Instinct du cultivateur', 'Après un lancer, transforme un dé neutre en Étincelle.'),
      (8, 'free-pest-mastery', 'once-per-run', 'Bouclier biologique', 'Révèle gratuitement le premier ravageur et accorde 2 XP.'),
      (9, 'flower-neutrals-to-success', 'once-per-run', 'Floraison maîtrisée', 'Pendant la Floraison, transforme tous les dés neutres en réussites.'),
      (10, 'drying-lowest-to-spark', 'once-per-run', 'Affinage patient', 'À la dernière étape, transforme le dé le plus faible en Étincelle.'),
      (11, 'dangers-to-success', 'once-per-run', 'Héritage de la canopée', 'Transforme tous les Dangers d’un lancer en réussites.'),
      (12, 'five-keep-three', 'once-per-run', 'Signature du maître', 'Lance cinq dés et conserve les trois meilleurs.')
  )
  SELECT effects.*, COUNT(definition.code) AS usage_count
  INTO v_effect
  FROM effects
  LEFT JOIN public.kq_heritage_card_definitions definition
    ON definition.effect_code = effects.effect_code
    AND definition.producer_id IS NOT NULL
    AND definition.is_active = TRUE
  GROUP BY effects.position, effects.effect_code, effects.timing, effects.default_name, effects.default_description
  ORDER BY COUNT(definition.code), effects.position
  LIMIT 1;

  LOOP
    v_number := nextval('public.kq_heritage_card_number_seq');
    v_code := 'HERITAGE-' || lpad(v_number::TEXT, 3, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.kq_heritage_card_definitions WHERE code = v_code
    );
  END LOOP;

  INSERT INTO public.kq_heritage_card_definitions(
    code, name, rarity, timing, effect_code, description, image_url,
    is_active, advantage, drawback, producer_id, producer_name,
    producer_image, auto_managed
  ) VALUES (
    v_code,
    LEFT('Héritage de ' || v_producer.name, 120),
    'common',
    v_effect.timing,
    v_effect.effect_code,
    v_effect.default_description,
    COALESCE(v_producer.image, ''),
    TRUE,
    v_effect.default_description,
    'Une seule carte Héritage peut être équipée par culture.',
    v_producer.id,
    v_producer.name,
    COALESCE(v_producer.image, ''),
    TRUE
  ) RETURNING * INTO v_definition;
  RETURN v_definition;
END;
$$;
REVOKE ALL ON FUNCTION public.kq_ensure_producer_heritage(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kq_ensure_producer_heritage(TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.kq_sync_producer_heritage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.kq_ensure_producer_heritage(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.kq_sync_producer_heritage()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kq_sync_producer_heritage ON public.producers;
CREATE TRIGGER trg_kq_sync_producer_heritage
AFTER INSERT OR UPDATE OF name, image ON public.producers
FOR EACH ROW EXECUTE FUNCTION public.kq_sync_producer_heritage();

CREATE OR REPLACE FUNCTION public.kq_archive_producer_heritage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.kq_heritage_card_definitions
  SET is_active = FALSE, updated_at = now()
  WHERE producer_id = OLD.id;
  UPDATE public.kq_producer_reward_campaigns
  SET status = 'archived', updated_at = now()
  WHERE producer_id = OLD.id AND status <> 'archived';
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.kq_archive_producer_heritage()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kq_archive_producer_heritage ON public.producers;
CREATE TRIGGER trg_kq_archive_producer_heritage
BEFORE DELETE ON public.producers
FOR EACH ROW EXECUTE FUNCTION public.kq_archive_producer_heritage();

-- Historic rewards keep their producer label through the definition snapshot,
-- while producer rows can now be removed from the platform catalogue.
ALTER TABLE public.kq_producer_reward_campaigns
  DROP CONSTRAINT IF EXISTS kq_producer_reward_campaigns_producer_id_fkey;
ALTER TABLE public.kq_producer_reward_campaigns ALTER COLUMN producer_id DROP NOT NULL;
ALTER TABLE public.kq_producer_reward_campaigns
  ADD CONSTRAINT kq_producer_reward_campaigns_producer_id_fkey
  FOREIGN KEY (producer_id) REFERENCES public.producers(id) ON DELETE SET NULL;

ALTER TABLE public.kq_notebook_flower_reward_grants
  DROP CONSTRAINT IF EXISTS kq_notebook_flower_reward_grants_producer_id_fkey;
ALTER TABLE public.kq_notebook_flower_reward_grants ALTER COLUMN producer_id DROP NOT NULL;
ALTER TABLE public.kq_notebook_flower_reward_grants
  ADD CONSTRAINT kq_notebook_flower_reward_grants_producer_id_fkey
  FOREIGN KEY (producer_id) REFERENCES public.producers(id) ON DELETE SET NULL;

ALTER TABLE public.kq_producer_heritage_reward_grants
  DROP CONSTRAINT IF EXISTS kq_producer_heritage_reward_grants_producer_id_fkey;
ALTER TABLE public.kq_producer_heritage_reward_grants ALTER COLUMN producer_id DROP NOT NULL;
ALTER TABLE public.kq_producer_heritage_reward_grants
  ADD CONSTRAINT kq_producer_heritage_reward_grants_producer_id_fkey
  FOREIGN KEY (producer_id) REFERENCES public.producers(id) ON DELETE SET NULL;

DO $$
DECLARE v_producer RECORD;
BEGIN
  FOR v_producer IN SELECT id FROM public.producers ORDER BY position, id LOOP
    PERFORM public.kq_ensure_producer_heritage(v_producer.id);
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_kq_update_heritage_card_editorial(
  TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT
);
CREATE FUNCTION public.rpc_kq_update_heritage_card_editorial(
  p_code TEXT,
  p_name TEXT,
  p_timing TEXT,
  p_effect_code TEXT,
  p_description TEXT,
  p_image_url TEXT,
  p_is_active BOOLEAN,
  p_advantage TEXT,
  p_drawback TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_code !~ '^HERITAGE-[0-9]{3,6}$'
    OR char_length(BTRIM(p_name)) NOT BETWEEN 3 AND 120
    OR p_timing NOT IN ('passive', 'once-per-run')
    OR p_effect_code NOT IN (
      'root-danger-to-spark', 'starting-xp-two', 'opening-hand-reserve',
      'climate-danger-to-spark', 'two-extra-redraws', 'failure-to-fragile',
      'neutral-to-spark', 'free-pest-mastery', 'flower-neutrals-to-success',
      'drying-lowest-to-spark', 'dangers-to-success', 'five-keep-three'
    )
    OR char_length(BTRIM(p_advantage)) NOT BETWEEN 3 AND 500
    OR char_length(BTRIM(p_description)) NOT BETWEEN 10 AND 500
    OR char_length(p_image_url) > 2000
    OR char_length(p_drawback) > 500 THEN
    RAISE EXCEPTION 'kq_heritage_card_invalid';
  END IF;

  UPDATE public.kq_heritage_card_definitions
  SET name = BTRIM(p_name),
      timing = p_timing,
      effect_code = p_effect_code,
      description = BTRIM(p_description),
      image_url = BTRIM(p_image_url),
      is_active = p_is_active AND producer_id IS NOT NULL,
      advantage = BTRIM(p_advantage),
      drawback = BTRIM(p_drawback),
      updated_at = now()
  WHERE code = p_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_card_not_found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_update_heritage_card_editorial(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_update_heritage_card_editorial(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_craft_heritage_card(
  p_user_id UUID,
  p_card_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.kq_heritage_card_definitions%ROWTYPE;
  v_cost CONSTANT INTEGER := 5;
  v_balance INTEGER;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_craft_key TEXT;
BEGIN
  IF p_user_id IS NULL OR p_card_code !~ '^HERITAGE-[0-9]{3,6}$' THEN
    RAISE EXCEPTION 'kq_heritage_invalid_craft';
  END IF;
  SELECT * INTO v_card FROM public.kq_heritage_card_definitions
  WHERE code = p_card_code AND is_active = TRUE AND producer_id IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_collection_inactive'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.kq_heritage_draws
    WHERE user_id = p_user_id AND card_code = p_card_code
  ) THEN
    RAISE EXCEPTION 'kq_heritage_already_owned';
  END IF;
  INSERT INTO public.kq_heritage_fragment_wallets(user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.kq_heritage_fragment_wallets
  WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance < v_cost THEN RAISE EXCEPTION 'kq_heritage_fragments_insufficient'; END IF;
  v_craft_key := 'craft:' || p_user_id::TEXT || ':' || p_card_code;
  UPDATE public.kq_heritage_fragment_wallets
  SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id RETURNING balance INTO v_balance;
  INSERT INTO public.kq_heritage_fragment_ledger(user_id, amount, reason, reward_key)
  VALUES (p_user_id, -v_cost, 'craft_common', v_craft_key);
  INSERT INTO public.kq_heritage_draws(
    user_id, order_item_id, unit_index, card_code, rarity, seed,
    was_duplicate, source, craft_key
  ) VALUES (
    p_user_id, NULL, NULL, v_card.code, 'common', 0,
    FALSE, 'craft', v_craft_key
  ) RETURNING * INTO v_draw;
  RETURN jsonb_build_object('draw', to_jsonb(v_draw), 'fragmentBalance', v_balance);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_craft_heritage_card(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_craft_heritage_card(UUID, TEXT)
  TO service_role;

-- The campaign may only use the card generated for that producer.
CREATE OR REPLACE FUNCTION public.rpc_kq_configure_producer_reward_campaign(
  p_producer_id TEXT,
  p_heritage_code TEXT,
  p_entry_ids TEXT[],
  p_activate BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.kq_producer_reward_campaigns%ROWTYPE;
  v_definition public.kq_heritage_card_definitions%ROWTYPE;
  v_version INTEGER;
  v_entry_id TEXT;
BEGIN
  IF COALESCE(BTRIM(p_producer_id), '') = '' OR COALESCE(array_length(p_entry_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'kq_producer_campaign_invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('producer-campaign:' || p_producer_id, 0));
  SELECT * INTO v_definition
  FROM public.kq_ensure_producer_heritage(p_producer_id);
  IF p_heritage_code IS DISTINCT FROM v_definition.code THEN
    RAISE EXCEPTION 'kq_producer_campaign_wrong_heritage';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_entry_ids) requested(entry_id)
    LEFT JOIN public.contest_entries entry ON entry.id = requested.entry_id
    WHERE entry.id IS NULL OR entry.producer_id IS DISTINCT FROM p_producer_id OR entry.is_published = FALSE
  ) THEN
    RAISE EXCEPTION 'kq_producer_campaign_invalid_entry';
  END IF;

  SELECT * INTO v_campaign FROM public.kq_producer_reward_campaigns
  WHERE producer_id = p_producer_id AND status = 'draft'
  ORDER BY version DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
    FROM public.kq_producer_reward_campaigns WHERE producer_id = p_producer_id;
    INSERT INTO public.kq_producer_reward_campaigns(producer_id, heritage_code, version)
    VALUES (p_producer_id, v_definition.code, v_version) RETURNING * INTO v_campaign;
  ELSE
    UPDATE public.kq_producer_reward_campaigns
    SET heritage_code = v_definition.code, updated_at = now()
    WHERE id = v_campaign.id RETURNING * INTO v_campaign;
  END IF;

  DELETE FROM public.kq_producer_reward_entries WHERE campaign_id = v_campaign.id;
  FOREACH v_entry_id IN ARRAY p_entry_ids LOOP
    INSERT INTO public.kq_producer_reward_entries(campaign_id, entry_id, position)
    VALUES (v_campaign.id, v_entry_id, array_position(p_entry_ids, v_entry_id));
  END LOOP;

  IF p_activate THEN
    UPDATE public.kq_producer_reward_campaigns SET status = 'archived', updated_at = now()
    WHERE producer_id = p_producer_id AND status = 'active';
    UPDATE public.kq_heritage_card_definitions SET is_active = TRUE, updated_at = now()
    WHERE code = v_definition.code;
    UPDATE public.kq_producer_reward_campaigns SET status = 'active', updated_at = now()
    WHERE id = v_campaign.id RETURNING * INTO v_campaign;
  END IF;

  RETURN jsonb_build_object(
    'id', v_campaign.id, 'producerId', v_campaign.producer_id,
    'heritageCode', v_campaign.heritage_code, 'version', v_campaign.version,
    'status', v_campaign.status, 'entryIds', to_jsonb(p_entry_ids)
  );
END;
$$;

-- Dynamic definitions carry their mechanic in the signed initial state. The
-- server verifies it against the catalogue before the atomic burn begins.
CREATE OR REPLACE FUNCTION public.rpc_kq_start_run_with_heritage(
  p_user_id UUID,
  p_buddie_code TEXT,
  p_seed INTEGER,
  p_deck_codes TEXT[],
  p_scenario_codes TEXT[],
  p_initial_state JSONB,
  p_culture_tokens INTEGER DEFAULT 0,
  p_heritage_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_definition public.kq_heritage_card_definitions%ROWTYPE;
  v_state_for_start JSONB := p_initial_state;
  v_buddie_number INTEGER;
  v_buddie_xp INTEGER := 0;
  v_heritage_xp INTEGER := 0;
  v_base_xp INTEGER;
  v_expected_xp INTEGER;
  v_result JSONB;
  v_run_id UUID;
  v_run public.kq_runs%ROWTYPE;
BEGIN
  IF p_heritage_code IS NULL THEN
    IF p_initial_state ? 'heritageCode' OR p_initial_state ? 'heritageEffect' THEN
      RAISE EXCEPTION 'kq_heritage_state_mismatch';
    END IF;
  ELSE
    IF p_heritage_code !~ '^HERITAGE-[0-9]{3,6}$'
      OR COALESCE(p_initial_state->>'heritageCode', '') <> p_heritage_code THEN
      RAISE EXCEPTION 'kq_heritage_state_mismatch';
    END IF;
    SELECT * INTO v_definition FROM public.kq_heritage_card_definitions
    WHERE code = p_heritage_code AND is_active = TRUE AND producer_id IS NOT NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_inactive'; END IF;
    IF COALESCE(p_initial_state->>'heritageName', '') <> v_definition.name
      OR COALESCE(p_initial_state->>'heritageTiming', '') <> v_definition.timing
      OR COALESCE(p_initial_state->>'heritageEffect', '') <> v_definition.effect_code
      OR COALESCE(p_initial_state->>'heritageProducerName', '') <> v_definition.producer_name
      OR COALESCE(p_initial_state->>'heritageImageUrl', '') <> v_definition.image_url THEN
      RAISE EXCEPTION 'kq_heritage_state_mismatch';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.kq_heritage_draws
      WHERE user_id = p_user_id AND card_code = p_heritage_code
    ) THEN
      RAISE EXCEPTION 'kq_heritage_not_owned';
    END IF;
    IF COALESCE((p_initial_state->>'heritageUsed')::BOOLEAN, TRUE) <> FALSE
      OR COALESCE((p_initial_state->>'heritageArmed')::BOOLEAN, TRUE) <> FALSE THEN
      RAISE EXCEPTION 'kq_heritage_state_mismatch';
    END IF;
    v_heritage_xp := CASE v_definition.effect_code
      WHEN 'starting-xp-two' THEN 2 ELSE 0 END;
  END IF;

  IF p_buddie_code ~ '^HH2026-[0-9]{3}$' THEN
    v_buddie_number := RIGHT(p_buddie_code, 3)::INTEGER;
    v_buddie_xp := CASE
      WHEN v_buddie_number = 1 THEN 4
      WHEN v_buddie_number BETWEEN 2 AND 4 THEN 3
      WHEN v_buddie_number BETWEEN 5 AND 9 THEN 2
      WHEN v_buddie_number BETWEEN 10 AND 19 THEN 1
      ELSE 0 END;
  END IF;
  v_base_xp := 1 + p_culture_tokens;
  v_expected_xp := v_base_xp + v_buddie_xp + v_heritage_xp;
  IF COALESCE((p_initial_state->>'xp')::INTEGER, -1) <> v_expected_xp THEN
    RAISE EXCEPTION 'kq_heritage_state_mismatch';
  END IF;
  IF v_buddie_xp > 0 OR v_heritage_xp > 0 THEN
    v_state_for_start := jsonb_set(p_initial_state, '{xp}', to_jsonb(v_base_xp), FALSE);
  END IF;
  v_result := public.rpc_kq_start_run(
    p_user_id, p_buddie_code, p_seed, p_deck_codes, p_scenario_codes,
    v_state_for_start, p_culture_tokens
  );
  v_run_id := (v_result->'run'->>'id')::UUID;
  UPDATE public.kq_runs
  SET state = p_initial_state, heritage_code = p_heritage_code, updated_at = now()
  WHERE id = v_run_id AND user_id = p_user_id
  RETURNING * INTO v_run;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_run_not_found'; END IF;
  RETURN jsonb_set(v_result, '{run}', to_jsonb(v_run), FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.kq_protect_run_heritage_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.state->'heritageCode' IS DISTINCT FROM OLD.state->'heritageCode'
    OR NEW.state->'heritageName' IS DISTINCT FROM OLD.state->'heritageName'
    OR NEW.state->'heritageTiming' IS DISTINCT FROM OLD.state->'heritageTiming'
    OR NEW.state->'heritageEffect' IS DISTINCT FROM OLD.state->'heritageEffect'
    OR NEW.state->'heritageProducerName' IS DISTINCT FROM OLD.state->'heritageProducerName'
    OR NEW.state->'heritageImageUrl' IS DISTINCT FROM OLD.state->'heritageImageUrl' THEN
    RAISE EXCEPTION 'kq_heritage_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.kq_protect_run_heritage_identity()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kq_protect_run_heritage_identity ON public.kq_runs;
CREATE TRIGGER trg_kq_protect_run_heritage_identity
BEFORE UPDATE OF state ON public.kq_runs
FOR EACH ROW EXECUTE FUNCTION public.kq_protect_run_heritage_identity();

COMMIT;
