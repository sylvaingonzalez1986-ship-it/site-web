BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_heritage_effect_catalog (
  effect_code TEXT PRIMARY KEY,
  timing TEXT NOT NULL CHECK (timing IN ('passive', 'once-per-run')),
  default_name TEXT NOT NULL,
  default_description TEXT NOT NULL,
  default_drawback TEXT NOT NULL,
  position INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kq_heritage_effect_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_heritage_effect_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kq_heritage_effect_catalog TO service_role;

INSERT INTO public.kq_heritage_effect_catalog(
  effect_code, timing, default_name, default_description, default_drawback, position
) VALUES
  ('root-danger-to-spark', 'once-per-run', 'Racines solides', 'Le premier Danger en Enracinement devient une Étincelle.', 'Ne se déclenche qu’en Enracinement et une seule fois.', 1),
  ('starting-xp-two', 'passive', 'Réserve du jardinier', 'Commence chaque culture avec 2 XP supplémentaires.', 'N’améliore directement aucun lancer de dés.', 2),
  ('opening-hand-reserve', 'once-per-run', 'Main prévoyante', 'À la première étape, pioche 8 cartes et compose une main de 5.', 'La réserve disparaît après le premier lancer de la culture.', 3),
  ('climate-danger-to-spark', 'once-per-run', 'Climat stable', 'Le premier Danger d’une situation Climat devient une Étincelle.', 'Ne se déclenche que face à une Situation Climat.', 4),
  ('two-extra-redraws', 'passive', 'Second regard', 'Accorde deux changements de main supplémentaires par culture.', 'Change la main, sans garantir de meilleurs dés ni rendre d’XP.', 5),
  ('failure-to-fragile', 'once-per-run', 'Reprise vigoureuse', 'Le premier échec de la culture devient un résultat Fragile.', 'Le résultat sauvé reste Fragile et le pouvoir est ensuite consommé.', 6),
  ('neutral-to-spark', 'once-per-run', 'Instinct du cultivateur', 'Après un lancer, transforme un dé neutre en Étincelle.', 'Exige un dé neutre après le lancer et ne transforme qu’un seul dé.', 7),
  ('free-pest-mastery', 'once-per-run', 'Bouclier biologique', 'Révèle gratuitement le premier ravageur et accorde 2 XP.', 'Reste sans effet pendant les étapes dépourvues de ravageur caché.', 8),
  ('flower-neutrals-to-success', 'once-per-run', 'Floraison maîtrisée', 'Pendant la Floraison, transforme tous les dés neutres en réussites.', 'Réservé à la Floraison et exige au moins un dé neutre.', 9),
  ('drying-lowest-to-spark', 'once-per-run', 'Affinage patient', 'À la dernière étape, transforme le dé le plus faible en Étincelle.', 'Réservé à la dernière étape de Séchage & affinage.', 10),
  ('dangers-to-success', 'once-per-run', 'Héritage de la canopée', 'Transforme tous les Dangers d’un lancer en réussites.', 'Doit être activé après un lancer contenant un Danger non protégé.', 11),
  ('five-keep-three', 'once-per-run', 'Signature du maître', 'Lance cinq dés et conserve les trois meilleurs.', 'Doit être armé avant le lancer et ne fonctionne qu’une fois.', 12),
  ('germination-lowest-to-strong', 'once-per-run', 'Élan de semis', 'En Germination, transforme le dé le plus faible en réussite forte.', 'Réservé à la Germination ; le dé transformé devient 5, jamais une Étincelle.', 13),
  ('rooting-pressure-reset', 'once-per-run', 'Racines décompressées', 'En Enracinement, ramène immédiatement la Pression à zéro après le lancer.', 'Ne modifie aucun dé et exige une Pression déjà supérieure à zéro.', 14),
  ('growth-danger-reroll', 'once-per-run', 'Croissance résiliente', 'En Croissance, relance un Danger non protégé.', 'La relance peut produire un nouveau Danger et reste limitée à la Croissance.', 15),
  ('flower-success-to-spark', 'once-per-run', 'Pistils étincelants', 'En Floraison, transforme une réussite ordinaire en Étincelle.', 'Exige un dé 4 ou 5 : ce pouvoir ne sauve pas un lancer sans réussite.', 16),
  ('harvest-theft-shield', 'passive', 'Mémoire du gardien', 'Annule toute perte de récolte lors du Renard à deux pattes.', 'N’apporte aucun bonus hors de la Situation de vol de production.', 17),
  ('drying-fragile-to-success', 'once-per-run', 'Dernier affinage', 'Au Séchage & affinage, transforme un résultat Fragile en réussite.', 'Ne corrige ni un échec complet ni une autre étape de la culture.', 18),
  ('first-success-xp-two', 'passive', 'Premier élan', 'La première réussite ou réussite critique de la culture rapporte 2 XP supplémentaires.', 'Le bonus ne s’applique qu’au premier résultat réussi, même tardif.', 19),
  ('critical-quality-boost', 'passive', 'Exigence du jury', 'Chaque réussite critique rapporte 1 point de Qualité supplémentaire.', 'N’apporte rien aux réussites ordinaires, résultats Fragiles ou échecs.', 20),
  ('calm-target-relief', 'passive', 'Culture zen', 'À Pression zéro, réduit de 1 la difficulté de la Situation, sans descendre sous 1.', 'Le bonus disparaît dès que la Pression monte au-dessus de zéro.', 21),
  ('first-danger-shield', 'once-per-run', 'Parade ancestrale', 'Annule automatiquement le premier Danger non protégé d’un lancer.', 'Le Danger est seulement annulé : il ne devient ni réussite ni Étincelle.', 22),
  ('spark-pressure-relief', 'once-per-run', 'Soupape lumineuse', 'La première Étincelle obtenue ramène la Pression deux niveaux plus bas.', 'Exige une Étincelle et une Pression positive ; ne modifie pas le résultat des dés.', 23),
  ('fragile-quality-boost', 'passive', 'Art du compromis', 'Un résultat Fragile rapporte 2 points de Qualité au lieu de 1.', 'N’améliore jamais un échec et ne rapporte aucun XP supplémentaire.', 24)
ON CONFLICT (effect_code) DO UPDATE SET
  timing = EXCLUDED.timing,
  default_name = EXCLUDED.default_name,
  default_description = EXCLUDED.default_description,
  default_drawback = EXCLUDED.default_drawback,
  position = EXCLUDED.position,
  is_active = TRUE,
  updated_at = now();

-- Preserve editorial text, but replace the former identical generic drawback.
UPDATE public.kq_heritage_card_definitions definition
SET drawback = catalog.default_drawback,
    updated_at = now()
FROM public.kq_heritage_effect_catalog catalog
WHERE definition.effect_code = catalog.effect_code
  AND BTRIM(COALESCE(definition.drawback, '')) IN (
    '',
    'Une seule carte Héritage peut être équipée par culture.'
  );

-- Reassign active duplicates to unused supported powers. An overflow card stays
-- attached to its producer but becomes editorially pending instead of silently
-- sharing another producer's mechanic.
DO $$
DECLARE
  v_duplicate RECORD;
  v_effect public.kq_heritage_effect_catalog%ROWTYPE;
BEGIN
  FOR v_duplicate IN
    WITH ranked AS (
      SELECT definition.code,
             row_number() OVER (PARTITION BY definition.effect_code ORDER BY definition.code) AS usage_rank
      FROM public.kq_heritage_card_definitions definition
      WHERE definition.producer_id IS NOT NULL
        AND definition.is_active = TRUE
    )
    SELECT code FROM ranked WHERE usage_rank > 1 ORDER BY code
  LOOP
    SELECT catalog.* INTO v_effect
    FROM public.kq_heritage_effect_catalog catalog
    WHERE catalog.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1
        FROM public.kq_heritage_card_definitions definition
        WHERE definition.effect_code = catalog.effect_code
          AND definition.producer_id IS NOT NULL
          AND definition.is_active = TRUE
      )
    ORDER BY catalog.position
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.kq_heritage_card_definitions
      SET timing = v_effect.timing,
          effect_code = v_effect.effect_code,
          description = v_effect.default_description,
          advantage = v_effect.default_description,
          drawback = v_effect.default_drawback,
          updated_at = now()
      WHERE code = v_duplicate.code;
    ELSE
      UPDATE public.kq_heritage_card_definitions
      SET is_active = FALSE,
          effect_code = 'pending-editorial-' || code,
          description = 'Pouvoir unique à attribuer depuis le catalogue éditorial.',
          advantage = 'Carte créée et conservée en attente d’un pouvoir unique.',
          drawback = 'Inactive tant qu’aucune mécanique distincte n’est disponible.',
          updated_at = now()
      WHERE code = v_duplicate.code;
    END IF;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_active_heritage_effect
  ON public.kq_heritage_card_definitions(effect_code)
  WHERE producer_id IS NOT NULL AND is_active = TRUE;

CREATE OR REPLACE FUNCTION public.kq_ensure_producer_heritage(p_producer_id TEXT)
RETURNS public.kq_heritage_card_definitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producer public.producers%ROWTYPE;
  v_definition public.kq_heritage_card_definitions%ROWTYPE;
  v_effect public.kq_heritage_effect_catalog%ROWTYPE;
  v_number BIGINT;
  v_code TEXT;
  v_has_effect BOOLEAN;
BEGIN
  -- Serialize producer-card creation so two concurrent producer inserts cannot
  -- select the same still-unused mechanic before the unique index is checked.
  PERFORM pg_advisory_xact_lock(hashtext('kq_heritage_unique_effect_assignment'));

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

  SELECT catalog.* INTO v_effect
  FROM public.kq_heritage_effect_catalog catalog
  WHERE catalog.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM public.kq_heritage_card_definitions definition
      WHERE definition.effect_code = catalog.effect_code
        AND definition.producer_id IS NOT NULL
        AND definition.is_active = TRUE
    )
  ORDER BY catalog.position
  LIMIT 1;
  v_has_effect := FOUND;

  LOOP
    v_number := nextval('public.kq_heritage_card_number_seq');
    v_code := 'HERITAGE-' || lpad(v_number::TEXT, 3, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.kq_heritage_card_definitions WHERE code = v_code
    );
  END LOOP;

  IF v_has_effect THEN
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
      v_effect.default_drawback,
      v_producer.id,
      v_producer.name,
      COALESCE(v_producer.image, ''),
      TRUE
    ) RETURNING * INTO v_definition;
  ELSE
    INSERT INTO public.kq_heritage_card_definitions(
      code, name, rarity, timing, effect_code, description, image_url,
      is_active, advantage, drawback, producer_id, producer_name,
      producer_image, auto_managed
    ) VALUES (
      v_code,
      LEFT('Héritage de ' || v_producer.name, 120),
      'common',
      'passive',
      'pending-editorial-' || v_code,
      'Pouvoir unique à attribuer depuis le catalogue éditorial.',
      COALESCE(v_producer.image, ''),
      FALSE,
      'Carte créée et conservée en attente d’un pouvoir unique.',
      'Inactive tant qu’aucune mécanique distincte n’est disponible.',
      v_producer.id,
      v_producer.name,
      COALESCE(v_producer.image, ''),
      TRUE
    ) RETURNING * INTO v_definition;
  END IF;

  RETURN v_definition;
END;
$$;
REVOKE ALL ON FUNCTION public.kq_ensure_producer_heritage(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kq_ensure_producer_heritage(TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_update_heritage_card_editorial(
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
    OR NOT EXISTS (
      SELECT 1 FROM public.kq_heritage_effect_catalog catalog
      WHERE catalog.effect_code = p_effect_code
        AND catalog.timing = p_timing
        AND catalog.is_active = TRUE
    )
    OR char_length(BTRIM(p_advantage)) NOT BETWEEN 3 AND 500
    OR char_length(BTRIM(p_description)) NOT BETWEEN 10 AND 500
    OR char_length(p_image_url) > 2000
    OR char_length(p_drawback) > 500 THEN
    RAISE EXCEPTION 'kq_heritage_card_invalid';
  END IF;

  IF p_is_active AND EXISTS (
    SELECT 1
    FROM public.kq_heritage_card_definitions definition
    WHERE definition.code <> p_code
      AND definition.producer_id IS NOT NULL
      AND definition.is_active = TRUE
      AND definition.effect_code = p_effect_code
  ) THEN
    RAISE EXCEPTION 'kq_heritage_effect_already_used';
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

COMMIT;
