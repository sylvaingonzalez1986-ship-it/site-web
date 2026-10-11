BEGIN;

SELECT pg_advisory_xact_lock(hashtext('kq_heritage_unique_effect_assignment'));

-- Retire these Heritage partnerships without deleting shop producers, earned
-- cards, reward receipts or the immutable identity of a culture in progress.
UPDATE public.kq_heritage_card_definitions
SET is_active = FALSE, updated_at = now()
WHERE producer_id IN (
  'producer-1773871212890-5816', -- Cannapache
  'producer-1773871368477-5738', -- Cap Estuaire
  'producer-1773872025906-6885'  -- Skud Farm
);

UPDATE public.kq_producer_reward_campaigns
SET status = 'archived', updated_at = now()
WHERE producer_id IN (
  'producer-1773871212890-5816',
  'producer-1773871368477-5738',
  'producer-1773872025906-6885'
) AND status <> 'archived';

-- Neither the editorial RPC nor campaign activation may silently bring a
-- retired partnership back into the playable or claimable catalogue.
ALTER TABLE public.kq_heritage_card_definitions
  ADD CONSTRAINT kq_retired_producer_heritages_inactive CHECK (
    NOT is_active OR producer_id NOT IN (
      'producer-1773871212890-5816',
      'producer-1773871368477-5738',
      'producer-1773872025906-6885'
    )
  );
ALTER TABLE public.kq_producer_reward_campaigns
  ADD CONSTRAINT kq_retired_producer_campaigns_inactive CHECK (
    status <> 'active' OR producer_id NOT IN (
      'producer-1773871212890-5816',
      'producer-1773871368477-5738',
      'producer-1773872025906-6885'
    )
  );

-- Keep allocator defaults, editor previews and persisted card advantages in
-- sync with the game rules. Existing named objects retain their Data API grants.
INSERT INTO public.kq_heritage_effect_catalog (
  effect_code, timing, default_name, default_description, default_drawback, position
) VALUES
  ('root-danger-to-spark', 'once-per-run', 'Racines solides', '+2 XP au départ. En Enracinement, le dé le plus faible devient automatiquement une Étincelle.', 'Automatique à l’Enracinement, une fois par culture. Les Étincelles déjà obtenues sont conservées.', 1),
  ('starting-xp-two', 'passive', 'Réserve du jardinier', '+4 XP au départ pour financer les soins et les cartes de la culture.', 'Les 4 XP sont disponibles dès le départ, sans activation ni dépense de carte.', 2),
  ('opening-hand-reserve', 'once-per-run', 'Main prévoyante', '+2 XP au départ. À la première étape, pioche 8 cartes et compose une main de 5.', 'Échanges gratuits dans la réserve avant le premier lancer. Les cartes échangées sont conservées.', 3),
  ('climate-danger-to-spark', 'once-per-run', 'Climat stable', '+2 XP au départ. Le dé le plus faible devient une Étincelle face au Climat, ou au Séchage si le pouvoir reste disponible.', 'Une activation automatique ; le Séchage sert de relais si aucune Situation Climat ne l’a déclenchée.', 4),
  ('two-extra-redraws', 'passive', 'Second regard', '+2 XP au départ. Accorde deux changements de main supplémentaires par culture.', 'Trois changements de main gratuits au total, à répartir entre les étapes avant leur préparation.', 5),
  ('failure-to-fragile', 'once-per-run', 'Reprise vigoureuse', '+2 XP au départ. Le premier échec devient une réussite, avec ses gains de Qualité et d’XP.', 'Sauvetage automatique une fois par culture. Les réussites déjà obtenues restent intactes.', 6),
  ('neutral-to-spark', 'once-per-run', 'Instinct du cultivateur', '+2 XP au départ. Après un lancer, transforme le dé le plus faible en Étincelle.', 'Une activation après le lancer, sur un Danger, un neutre ou une réussite ordinaire.', 7),
  ('free-pest-mastery', 'once-per-run', 'Bouclier biologique', '+2 XP au départ. Active +2 XP supplémentaires et révèle le ravageur présent, sans frais.', 'Une activation avant ou après le lancer. Les XP sont accordés même sans ravageur caché.', 8),
  ('flower-neutrals-to-success', 'once-per-run', 'Floraison maîtrisée', '+2 XP au départ. En Floraison, transforme tous les Dangers et dés neutres en réussites.', 'Une activation en Floraison. Tous les dés de 1 à 3 passent à 4, les meilleurs restent inchangés.', 9),
  ('drying-lowest-to-spark', 'once-per-run', 'Affinage patient', '+2 XP au départ. Au Séchage, transforme le dé le plus faible en Étincelle.', 'Une activation après le lancer du Séchage. Une Étincelle déjà obtenue reste une Étincelle.', 10),
  ('dangers-to-success', 'once-per-run', 'Héritage de la canopée', '+2 XP au départ. Transforme tous les Dangers d’un lancer, même protégés, en réussites.', 'Une activation après un lancer contenant un Danger. Les protections existantes restent disponibles.', 11),
  ('five-keep-three', 'once-per-run', 'Signature du maître', '+2 XP au départ. Lance cinq dés et conserve les trois meilleurs.', 'À préparer une fois avant le lancer. Les trois meilleures valeurs des cinq dés sont retenues.', 12),
  ('germination-lowest-to-strong', 'once-per-run', 'Élan de semis', '+2 XP au départ. En Germination, améliore le dé le plus faible jusqu’à 5, sans jamais diminuer un dé.', 'Une activation en Germination si un dé vaut moins de 5. Les 5 et les Étincelles sont préservés.', 13),
  ('rooting-pressure-reset', 'once-per-run', 'Racines décompressées', '+2 XP au départ. En Enracinement, ramène la Pression à zéro et améliore le dé le plus faible jusqu’à 4.', 'Une activation après le lancer. La réussite supplémentaire reste disponible même à Pression zéro.', 14),
  ('growth-danger-reroll', 'once-per-run', 'Croissance résiliente', '+2 XP au départ. En Croissance, relance le dé le plus faible : une réussite de 4 minimum est garantie.', 'Une activation sur un dé de 1 à 3. La relance donne 4, 5 ou 6 et ne peut plus échouer.', 15),
  ('flower-success-to-spark', 'once-per-run', 'Pistils étincelants', '+2 XP au départ. En Floraison, les dés 4 et 5 deviennent des Étincelles ; à défaut, le dé le plus faible passe à 6.', 'Une activation après le lancer de Floraison, utile même lorsque le lancer ne contient aucune réussite.', 16),
  ('harvest-theft-shield', 'passive', 'Mémoire du gardien', '+2 XP au départ. Protège intégralement la récolte contre le vol et accorde +1 Qualité à la Récolte.', 'Protection permanente contre le Renard à deux pattes. Le bonus de Récolte est acquis avec tout résultat.', 17),
  ('drying-fragile-to-success', 'once-per-run', 'Dernier affinage', '+2 XP au départ. Au Séchage, transforme un échec ou un résultat Fragile en réussite.', 'Sauvetage automatique au Séchage, avec les gains de réussite. L’affinage en entrepôt continue ensuite.', 18),
  ('first-success-xp-two', 'passive', 'Premier élan', '+2 XP au départ. La première réussite rapporte +3 XP, puis chaque réussite suivante rapporte +1 XP.', 'Les réussites ordinaires et critiques déclenchent ce bonus, à chaque étape de la culture.', 19),
  ('critical-quality-boost', 'passive', 'Exigence du jury', '+2 XP au départ. Chaque réussite gagne +1 Qualité, ou +2 Qualité pour une réussite critique.', 'Bonus automatique cumulable sur toutes les étapes réussies, de la Germination au Séchage.', 20),
  ('calm-target-relief', 'passive', 'Culture zen', '+2 XP au départ. À Pression 0, 1 ou 2, réduit la difficulté de 1, avec un minimum de 1.', 'Allègement automatique à chaque étape tant que la Pression reste au plus à 2.', 21),
  ('first-danger-shield', 'once-per-run', 'Parade ancestrale', '+2 XP au départ. Le premier Danger non protégé devient automatiquement une Étincelle.', 'Une protection automatique qui apporte aussi une réussite et l’XP de l’Étincelle.', 22),
  ('spark-pressure-relief', 'once-per-run', 'Soupape lumineuse', '+2 XP au départ. La première Étincelle obtenue avec une Pression positive fait baisser celle-ci de 2.', 'Le pouvoir reste disponible tant que la Pression est à zéro, puis se déclenche automatiquement.', 23),
  ('fragile-quality-boost', 'passive', 'Art du compromis', '+2 XP au départ. Un résultat Fragile rapporte 3 Qualité ; un échec ne fait plus perdre de Qualité.', 'Bonus automatique à chaque résultat Fragile ou échec, cumulable sur toute la culture.', 24),
  ('flower-lowest-plus-three', 'once-per-run', 'Floraison généreuse', '+2 XP au départ. En Floraison, ajoute +3 au dé le plus faible, sans dépasser 6.', 'Une activation en Floraison. Le plus faible dé progresse et les autres valeurs sont conservées.', 25)
ON CONFLICT (effect_code) DO UPDATE SET
  timing = EXCLUDED.timing,
  default_name = EXCLUDED.default_name,
  default_description = EXCLUDED.default_description,
  default_drawback = EXCLUDED.default_drawback,
  is_active = TRUE,
  updated_at = now();

UPDATE public.kq_heritage_card_definitions definition
SET description = catalog.default_description,
    advantage = catalog.default_description,
    drawback = catalog.default_drawback,
    updated_at = now()
FROM public.kq_heritage_effect_catalog catalog
WHERE definition.effect_code = catalog.effect_code
  AND definition.is_active = TRUE;

-- Match both stable identities. Original Growing already owns HERITAGE-020;
-- replace its auto-assigned mechanic while retaining every owned copy.
WITH editorial(code, producer_id, name, previous_effect, effect_code, image_url) AS (
  VALUES
  ('HERITAGE-001', 'producer-1773873534114-8538', 'Racines solides', 'root-danger-to-spark', 'root-danger-to-spark', '/app/kanab-quest/card-fronts/heritage-001-racines-solides-producer-front-v5.webp'),
  ('HERITAGE-002', 'producer-1773870683520-7273', 'Réserve du jardinier', 'starting-xp-two', 'starting-xp-two', '/app/kanab-quest/card-fronts/heritage-002-reserve-jardinier-producer-front-v5.webp'),
  ('HERITAGE-003', 'producer-1773870509228-7130', 'Main prévoyante', 'opening-hand-reserve', 'opening-hand-reserve', '/app/kanab-quest/card-fronts/heritage-003-main-prevoyante-producer-front-v5.webp'),
  ('HERITAGE-004', 'producer-1771159879557-3228', 'Climat stable', 'climate-danger-to-spark', 'climate-danger-to-spark', '/app/kanab-quest/card-fronts/heritage-004-climat-stable-producer-front-v5.webp'),
  ('HERITAGE-005', 'producer-1773870264609-7958', 'Second regard', 'two-extra-redraws', 'two-extra-redraws', '/app/kanab-quest/card-fronts/heritage-005-second-regard-producer-front-v5.webp'),
  ('HERITAGE-006', 'producer-1773869866555-1494', 'Reprise vigoureuse', 'failure-to-fragile', 'failure-to-fragile', '/app/kanab-quest/card-fronts/heritage-006-reprise-vigoureuse-producer-front-v5.webp'),
  ('HERITAGE-007', 'producer-1773871640332-4267', 'Instinct du cultivateur', 'neutral-to-spark', 'neutral-to-spark', '/app/kanab-quest/card-fronts/heritage-007-instinct-cultivateur-producer-front-v5.webp'),
  ('HERITAGE-008', 'producer-1775332866395-6178', 'Bouclier biologique', 'free-pest-mastery', 'free-pest-mastery', '/app/kanab-quest/card-fronts/heritage-008-bouclier-biologique-producer-front-v5.webp'),
  ('HERITAGE-016', 'producer-1784410504995-5263', 'Sélection du vivant', 'five-keep-three', 'five-keep-three', '/app/kanab-quest/card-fronts/heritage-016-3-feuilles-front-v3.webp'),
  ('HERITAGE-017', 'producer-1787050571187-9641', 'Éveil pyrénéen', 'germination-lowest-to-strong', 'germination-lowest-to-strong', '/app/kanab-quest/card-fronts/heritage-017-kanadea-front-v3.webp'),
  ('HERITAGE-018', 'producer-1787423717166-9078', 'Racines sereines', 'rooting-pressure-reset', 'rooting-pressure-reset', '/app/kanab-quest/card-fronts/heritage-018-buds-of-delight-front-v3.webp'),
  ('HERITAGE-019', 'producer-1790012817375-3215', 'Floraison généreuse', 'flower-lowest-plus-three', 'flower-lowest-plus-three', '/app/kanab-quest/card-fronts/heritage-019-iznofarm-front-v3.webp'),
  ('HERITAGE-020', 'producer-1791486661239-2355', 'Culture originelle', 'growth-danger-reroll', 'calm-target-relief', '/app/kanab-quest/card-fronts/heritage-020-original-growing-front-v1.webp')
)
UPDATE public.kq_heritage_card_definitions definition
SET name = editorial.name,
    timing = catalog.timing,
    effect_code = editorial.effect_code,
    description = catalog.default_description,
    advantage = catalog.default_description,
    drawback = catalog.default_drawback,
    image_url = editorial.image_url,
    updated_at = now()
FROM editorial
JOIN public.kq_heritage_effect_catalog catalog
  ON catalog.effect_code = editorial.effect_code
WHERE definition.code = editorial.code
  AND definition.producer_id = editorial.producer_id
  AND definition.effect_code IN (editorial.previous_effect, editorial.effect_code);

-- Every equipped Heritage grants a guaranteed +2 starting XP. The gardener's
-- reserve grants +4 in total. Patch only this term, preserving the independent
-- Buddie, culture-token and Chanvrier green-thumb validation already deployed.
DO $$
DECLARE
  original TEXT;
  definition TEXT;
  previous_bonus CONSTANT TEXT := 'WHEN ''starting-xp-two'' THEN 2 ELSE 0 END;';
  refreshed_bonus CONSTANT TEXT := 'WHEN ''starting-xp-two'' THEN 4 ELSE 2 END;';
BEGIN
  SELECT pg_get_functiondef(
    'public.rpc_kq_start_run_with_heritage(uuid,text,integer,text[],text[],jsonb,integer,text)'::regprocedure
  ) INTO original;
  IF strpos(original, previous_bonus) = 0 THEN
    RAISE EXCEPTION 'kq_heritage_start_xp_function_drift';
  END IF;
  definition := replace(original, previous_bonus, refreshed_bonus);
  EXECUTE definition;
END;
$$;

COMMIT;
