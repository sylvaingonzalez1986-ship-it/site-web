BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lottery_card_rarity') THEN
    CREATE TYPE public.lottery_card_rarity AS ENUM ('common', 'silver', 'gold', 'epic', 'legendary');
  END IF;
END
$$;

ALTER TABLE public.lottery_game_config
  ADD COLUMN IF NOT EXISTS collection_title TEXT NOT NULL DEFAULT 'Hemp Heroes 2026 Collection',
  ADD COLUMN IF NOT EXISTS silver_weight INTEGER NOT NULL DEFAULT 10 CHECK (silver_weight >= 0),
  ADD COLUMN IF NOT EXISTS gold_weight INTEGER NOT NULL DEFAULT 5 CHECK (gold_weight >= 0),
  ADD COLUMN IF NOT EXISTS legendary_weight INTEGER NOT NULL DEFAULT 1 CHECK (legendary_weight >= 0);

CREATE TABLE IF NOT EXISTS public.lottery_card_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lottery_card_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.lottery_card_collections(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  card_number INTEGER NOT NULL CHECK (card_number > 0),
  name TEXT NOT NULL,
  rarity public.lottery_card_rarity NOT NULL,
  visual_prompt TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_lottery_card_collection_number UNIQUE (collection_id, card_number)
);

CREATE TABLE IF NOT EXISTS public.lottery_card_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL UNIQUE REFERENCES public.lottery_tickets(id) ON DELETE CASCADE,
  card_definition_id UUID NOT NULL REFERENCES public.lottery_card_definitions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lottery_tickets
  ADD COLUMN IF NOT EXISTS card_definition_id UUID REFERENCES public.lottery_card_definitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_rarity public.lottery_card_rarity;

CREATE INDEX IF NOT EXISTS idx_lottery_card_definitions_collection_number
  ON public.lottery_card_definitions(collection_id, card_number);

CREATE INDEX IF NOT EXISTS idx_lottery_card_definitions_rarity
  ON public.lottery_card_definitions(rarity, card_number);

CREATE INDEX IF NOT EXISTS idx_lottery_card_instances_user_created
  ON public.lottery_card_instances(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lottery_card_instances_card
  ON public.lottery_card_instances(card_definition_id);

ALTER TABLE public.lottery_card_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_card_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_card_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lottery_card_collections_read_all ON public.lottery_card_collections;
CREATE POLICY lottery_card_collections_read_all
ON public.lottery_card_collections
FOR SELECT
USING (true);

DROP POLICY IF EXISTS lottery_card_definitions_read_all ON public.lottery_card_definitions;
CREATE POLICY lottery_card_definitions_read_all
ON public.lottery_card_definitions
FOR SELECT
USING (true);

DROP POLICY IF EXISTS lottery_card_instances_user_read_own ON public.lottery_card_instances;
CREATE POLICY lottery_card_instances_user_read_own
ON public.lottery_card_instances
FOR SELECT
USING (auth.uid() = user_id);

INSERT INTO public.lottery_card_collections (code, title, is_active)
VALUES ('HEMP_HEROES_2026', 'Hemp Heroes 2026 Collection', TRUE)
ON CONFLICT (code) DO UPDATE
SET title = EXCLUDED.title,
    is_active = EXCLUDED.is_active,
    updated_at = now();

UPDATE public.lottery_game_config
SET collection_title = 'Hemp Heroes 2026 Collection',
    common_weight = 33,
    silver_weight = 10,
    gold_weight = 5,
    epic_weight = 3,
    legendary_weight = 1,
    updated_at = now()
WHERE id = 1;

WITH base AS (
  SELECT
    id AS collection_id,
    'Style cartoon retro des annees 1930 (Rubber hose animation, facon Cuphead). Personnage anthropomorphe (tete de fleur ou graine de CBD) avec de grands yeux noirs expressifs, un grand sourire, des bras et jambes noirs tres fins. Il porte de gros gants blancs d''ouvrier et de grosses chaussures. Contours noirs tres epais, couleurs en aplats, ombres avec effet retro de trame de points.'::TEXT AS prompt_base
  FROM public.lottery_card_collections
  WHERE code = 'HEMP_HEROES_2026'
),
card_seed AS (
  SELECT *
  FROM (
    VALUES
      (1, 'HH2026-001', 'L''Arbre Mere - Toutes Varietes', 'legendary', 'Il a un corps en forme d''arbre majestueux aux feuilles arc-en-ciel et tient un globe terrestre brillant entre ses mains.', 'La source mythique de tous les cannabinoides. Ce specimen imaginaire contient un spectre complet parfait et concentre l''ADN botanique de toutes les varietes de chanvre existantes.'),
      (2, 'HH2026-002', 'Charlotte''s Web', 'epic', 'Il est assis sur une immense toile d''araignee doree, porte une cape de super-heros et prend une pose heroique.', 'Variete pionniere mondialement connue pour sa richesse en CBD et son role historique aux Etats-Unis dans la democratisation du chanvre bien-etre.'),
      (3, 'HH2026-003', 'Cannatonic', 'epic', 'Il porte une cape majestueuse de grand magicien et jongle habilement avec plusieurs fioles de potions magiques etincelantes.', 'L''une des toutes premieres varietes espagnoles a offrir un ratio CBD:THC de 1:1, celebre pour ses aromes terriens profonds et boises.'),
      (4, 'HH2026-004', 'Harlequin', 'epic', 'Il porte un costume complet de bouffon royal colore et joue d''un grand luth sur une scene theatrale.', 'Souche a dominance sativa extremement reputee pour la constance de ses niveaux de CBD et ses saveurs complexes de mangue douce et de musc.'),
      (5, 'HH2026-005', 'ACDC', 'gold', 'Il porte une veste en cuir, joue d''une guitare electrique crachant des eclairs et crie dans un micro.', 'Phenotype exceptionnel de Cannatonic, cette variete atteint des sommets en concentration de CBD avec un arome distinctif de citronnelle.'),
      (6, 'HH2026-006', 'Sour Space Candy', 'gold', 'Il porte une combinaison spatiale complete, flotte en apesanteur et croque dans un sucre d''orge geant.', 'Croisement entre Sour Tsunami et Early Resin Berry, offrant un profil de saveurs unique rappelant les fruits confits et le diesel.'),
      (7, 'HH2026-007', 'Hawaiian Haze', 'gold', 'Il porte une chemise a fleurs vibrante, un collier de fleurs hawaien et sirote une noix de coco avec une paille.', 'Une variete sativa qui transporte sous les tropiques grace a ses aromes intenses d''ananas, de peche et de fleurs exotiques.'),
      (8, 'HH2026-008', 'Lifter', 'gold', 'Il porte un bandeau de sport sur le front et souleve triomphalement d''enormes halteres de cirque.', 'Connue pour son effet revigorant sur l''esprit, cette souche degage des aromes puissants de poivre noir et de fromage doux.'),
      (9, 'HH2026-009', 'Elektra', 'gold', 'Il porte un masque de super-heros sur les yeux et lance de petits eclairs du bout de ses gants.', 'Nee du croisement entre ACDC et Early Resin Berry, elle brille par ses notes surprenantes de chocolat, de vin rouge et d''agrumes.'),
      (10, 'HH2026-010', 'Suver Haze', 'silver', 'Il porte un chapeau de detective et inspecte meticuleusement une feuille a la loupe.', 'Riche en farnesene et en caryophyllene, cette souche offre des parfums tres epices et relaxants de pomme verte.'),
      (11, 'HH2026-011', 'Cherry Wine', 'silver', 'Il tient elegamment un grand verre de vin rempli d''un jus de cerise petillant.', 'Un croisement complexe offrant des aromes profonds de cerises mures, de fromage et de poivre noir.'),
      (12, 'HH2026-012', 'Ringo''s Gift', 'silver', 'Il tend un magnifique paquet cadeau enrubanne avec un grand sourire joyeux.', 'Nommee en l''honneur du pionnier cannabique Lawrence Ringo, elle se distingue par un parfum rafraichissant de menthe et de terre.'),
      (13, 'HH2026-013', 'Remedy', 'silver', 'Il porte un bandeau d''infirmier vintage et tient un vieux thermometre geant.', 'Dominante indica parfaite pour une utilisation en soiree, caracterisee par de doux aromes de citron et de resine de pin.'),
      (14, 'HH2026-014', 'Sour Tsunami', 'silver', 'Il surfe habilement sur une grande vague d''eau stylisee avec une planche en bois.', 'L''une des toutes premieres varietes stabilisees pour un haut taux de CBD, au gout prononce de diesel et d''agrumes.'),
      (15, 'HH2026-015', 'Harle-Tsu', 'silver', 'Il porte un fin bandeau d''arts martiaux noue autour du front et se tient en garde.', 'Croisement prime alliant merveilleusement la douceur de Harlequin au mordant de Sour Tsunami.'),
      (16, 'HH2026-016', 'Stephen Hawking Kush', 'silver', 'Il porte de petites lunettes rondes, tient une craie et pointe un tableau noir.', 'Variete sedative a dominance indica, offrant des aromes vibrants de fruits rouges, de cerise et de menthe.'),
      (17, 'HH2026-017', 'Pennywise', 'silver', 'Il porte un faux nez rond de clown et tient un ballon baudruche au bout d''une ficelle.', 'Croisement entre Harlequin et Jack the Ripper, cette souche surprend par ses aromes torrefies de cafe et de poivre.'),
      (18, 'HH2026-018', 'Sweet and Sour Widow', 'silver', 'Il porte un elegant voile en dentelle noire facon veuve mysterieuse.', 'Profil terpenique unique et robuste, degageant des notes etonnantes d''oignon frais et de terre humide.'),
      (19, 'HH2026-019', 'Special Sauce', 'silver', 'Il tient une louche degoulinante d''une mysterieuse sauce brillante.', 'Creee en Oregon, celebre pour ses bourgeons resineux et son profil riche en myrcene et farnesene.'),
      (20, 'HH2026-020', 'Strawberry CBD', 'common', 'Il porte un petit panier en osier rempli a ras bord de belles fraises des bois.', 'Souche tres gourmande dont le bouquet aromatique evoque immanquablement la confiture de fraise et les sous-bois.'),
      (21, 'HH2026-021', 'Amnesia Haze CBD', 'common', 'Il fait balancer une montre a gousset de gauche a droite comme pour hypnotiser.', 'Version repensee (sans THC) de la legendaire sativa hollandaise, conservant ses intenses effluves citronnees.'),
      (22, 'HH2026-022', 'White Widow CBD', 'common', 'Il est entierement recouvert de flocons de neige dessines et grelotte dans une grosse echarpe.', 'Une icone celebre pour sa dense couverture de trichomes blancs et son gout boise et epice.'),
      (23, 'HH2026-023', 'Skywalker OG CBD', 'common', 'Il brandit fierement une epee laser brillante facon film de science-fiction.', 'Variete aux notes prononcees de pin, de terre et de carburant, procurant une detente intergalactique profonde.'),
      (24, 'HH2026-024', 'Bubba Kush CBD', 'common', 'Il porte une petite couronne doree sur la tete et un somptueux manteau d''hermine.', 'Souche royale indica particulierement reputee pour ses saveurs sombres et profondes de cafe torrefie.'),
      (25, 'HH2026-025', 'OG Kush CBD', 'common', 'Il porte une grosse chaine en or autour du cou et tient un radiocassette retro sur son epaule.', 'La legende de la cote ouest americaine, croisee pour offrir un pur profil chanvrier citronne et boise.'),
      (26, 'HH2026-026', 'Gelato CBD', 'common', 'Il deguste joyeusement un enorme cornet de glace a trois boules qui fond doucement.', 'Le dessert botanique par excellence, melant des saveurs cremeuses, sucrees et des nuances de fruits des bois.'),
      (27, 'HH2026-027', 'Gorilla Glue CBD', 'common', 'Il a les deux gants lourdement coinces ensemble par de la colle etirable et tire dessus avec effort.', 'Connue pour la production d''une resine extremement collante qui embaume le pin citronne.'),
      (28, 'HH2026-028', 'Blue Dream CBD', 'common', 'Il porte un long bonnet de nuit tombant et enlace affectueusement un petit nuage moelleux.', 'Sativa californienne douce et onirique, exhalant de merveilleux aromes de myrtille fraichement cueillie.'),
      (29, 'HH2026-029', 'Pineapple Express CBD', 'common', 'Il est assis a califourchon sur un ananas monte sur roulettes de train.', 'Un voyage tropical immediat grace a ses terpenes dominants fruites, melant l''ananas sucre au cedre.'),
      (30, 'HH2026-030', 'Lemon Haze CBD', 'common', 'Il presse un citron geant a deux mains, les yeux comiquement plisses par l''acidite.', 'Explosion d''agrumes vifs, cette souche est plebiscitee en journee pour sa fraicheur et sa vivacite.'),
      (31, 'HH2026-031', 'Critical Mass CBD', 'common', 'Il porte un casque de chantier jaune et tient innocemment un gros baton de dynamite factice.', 'Connue pour ses rendements massifs et lourds, exhalant un riche parfum de terre humide.'),
      (32, 'HH2026-032', 'Super Lemon Haze CBD', 'common', 'Il porte une cape flottante arborant un symbole de quartier de citron.', 'Une variante survitaminee en limonene, offrant un gout tres prononce de citronnade acidulee.'),
      (33, 'HH2026-033', 'Skunk CBD', 'common', 'Il porte un masque a gaz vintage autour du cou et arbore une queue de mouffette.', 'Une genetique resolument old-school dont le parfum acre, terreux et piquant reste reconnaissable.'),
      (34, 'HH2026-034', 'Afghan CBD', 'common', 'Il est paisiblement assis en tailleur en levitation au-dessus d''un beau tapis volant.', 'Heritage botanique pur des montagnes de l''Hindu Kush, offrant des notes resineuses et d''encens lourd.'),
      (35, 'HH2026-035', 'Cheese CBD', 'common', 'Il tient un enorme morceau de fromage jaune avec de gros trous facon dessin anime.', 'Genetique d''origine britannique mondialement reconnue pour son parfum tres puissant et muscle de fromage affine.'),
      (36, 'HH2026-036', 'Mango Haze CBD', 'common', 'Il jongle joyeusement avec trois belles mangues bien mures.', 'Une pepite tropicale qui entremele la rondeur de la mangue sucree a une subtile touche epicee.'),
      (37, 'HH2026-037', 'Dinamed CBD', 'common', 'Il tient un grand brin d''ADN scientifique qui brille.', 'Premiere variete pure CBD creee par Dinafem, reconnue pour sa stabilite genetique et son gout d''orange douce.'),
      (38, 'HH2026-038', 'Baox', 'common', 'Il tient un vieux bouclier en bois rustique de guerrier.', 'Croisement entre Hindu Kush et Otto II, c''est une souche robuste aux profils terreux et boises tres marques.'),
      (39, 'HH2026-039', 'Berry Blossom', 'common', 'Il tient un magnifique bouquet de fleurs roses et de petites baies sauvages.', 'Hybride tres floral offrant des notes douces de framboise et de pin apaisant.'),
      (40, 'HH2026-040', 'The Wife', 'common', 'Il porte un tablier a fleurs de grand-mere et tient un rouleau a patisserie.', 'Souche mere mythique dans la creation de nombreuses genetiques CBD, celebre pour ses notes de cerise.'),
      (41, 'HH2026-041', 'Therapy CBD', 'common', 'Il est allonge sur un petit divan de psychotherapeute et prend des notes.', 'Creee pour maximiser le potentiel therapeutique sans psychoactivite, elle offre des aromes de fruits tropicaux.'),
      (42, 'HH2026-042', 'Dancehall', 'common', 'Il porte un pantalon patte d''elephant disco et gratte un vieux tourne-disque.', 'Issue de genetiques espagnoles, elle stimule l''humeur avec son arome piquant de poivre et d''ananas.'),
      (43, 'HH2026-043', 'Frank''s Gift', 'common', 'Il porte un noeud papillon elegant et tend une jolie boite cadeau enrubannee.', 'Phenotype de Skunk Haze offrant des taux de CBD massifs, prisee pour ses effets relaxants corporels.'),
      (44, 'HH2026-044', 'Valentine X', 'common', 'Il a de petites ailes dans le dos et tire une fleche en forme de coeur avec un arc.', 'Nommee en l''honneur de St. Valentine, c''est une variation puissante d''ACDC au profil de pin parfume.'),
      (45, 'HH2026-045', 'Carmagnola', 'common', 'Il fait rouler une grande roue de charrette en bois d''epoque agricole.', 'Variete italienne historique, l''une des plus anciennes lignees de chanvre, avec des notes tres terreuses.'),
      (46, 'HH2026-046', 'Cherry Abacus', 'common', 'Il compte sur un vieux boulier dont les perles sont des cerises rouges.', 'Melange parfait entre la genetique Abacus et des notes fruitees de cerise confite et de cola.'),
      (47, 'HH2026-047', 'Magic Bullet', 'common', 'Il porte un grand chapeau haut-de-forme et en sort une balle de fusil brillante.', 'Variete reputee pour sa croissance rapide et sa forte teneur en myrcene, ideale pour la detente.'),
      (48, 'HH2026-048', 'Otto II', 'common', 'Il tient une enorme cle a molette de mecanicien automobile avec les mains pleines de cambouis.', 'Stabilisee dans le Colorado, elle produit des aromes complexes de poivre noir et de bois de cedre.'),
      (49, 'HH2026-049', 'Swiss Dream CBD', 'common', 'Il souffle de toutes ses forces dans un immense cor des Alpes en bois.', 'Variete suisse tres florale et epicee, garantissant un taux de THC ultra-bas tout en preservant des aromes forts.'),
      (50, 'HH2026-050', 'CB Dream', 'common', 'Il brandit un grand attrape-reves amerindien tresse avec des plumes.', 'Hybride doux aux dominantes indica, apprecie pour combattre le stress grace a son profil de pin et de citron.'),
      (51, 'HH2026-051', 'CBD Kush', 'common', 'Il porte une petite lanterne orientale qui degage une epaisse fumee douce.', 'Fruit d''une collaboration avec CBD Crew, elle croise Kandy Kush pour des saveurs douces et boisees.'),
      (52, 'HH2026-052', 'Diesel CBD', 'common', 'Il s''appuie fierement contre une tres vieille pompe a essence vintage des annees 30.', 'Conserve le parfum acre et carburant caracteristique de sa lignee, pour une detente maximale.')
  ) AS seed(card_number, code, name, rarity, accessory_prompt, description)
)
INSERT INTO public.lottery_card_definitions (
  collection_id,
  code,
  card_number,
  name,
  rarity,
  visual_prompt,
  description,
  image_url,
  is_active
)
SELECT
  base.collection_id,
  seed.code,
  seed.card_number,
  seed.name,
  seed.rarity::public.lottery_card_rarity,
  base.prompt_base || ' Accessoire : ' || seed.accessory_prompt,
  seed.description,
  '',
  TRUE
FROM base
CROSS JOIN card_seed AS seed
ON CONFLICT (code) DO UPDATE
SET card_number = EXCLUDED.card_number,
    name = EXCLUDED.name,
    rarity = EXCLUDED.rarity,
    visual_prompt = EXCLUDED.visual_prompt,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = now();

DELETE FROM public.lottery_card_instances;
DELETE FROM public.lottery_reward_claims;
DELETE FROM public.lottery_reward_lines;
DELETE FROM public.lottery_stickers;

UPDATE public.lottery_tickets
SET status = 'available',
    sticker_id = NULL,
    sticker_rarity = NULL,
    legendary_reward_claim_id = NULL,
    scratched_at = NULL,
    card_definition_id = NULL,
    card_rarity = NULL;

CREATE OR REPLACE FUNCTION public.rpc_scratch_ticket(
  p_ticket_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ticket public.lottery_tickets%ROWTYPE;
  v_config public.lottery_game_config%ROWTYPE;
  v_collection public.lottery_card_collections%ROWTYPE;
  v_card public.lottery_card_definitions%ROWTYPE;
  v_card_instance_id UUID;
  v_roll INTEGER;
  v_total_weight INTEGER;
  v_definition_count INTEGER;
  v_definition_offset INTEGER;
  v_owned_count INTEGER;
  v_unique_owned INTEGER;
  v_total_owned INTEGER;
  v_common_count INTEGER;
  v_silver_count INTEGER;
  v_gold_count INTEGER;
  v_epic_count INTEGER;
  v_legendary_count INTEGER;
BEGIN
  SELECT *
  INTO v_ticket
  FROM public.lottery_tickets
  WHERE id = p_ticket_id
    AND user_id = p_user_id
    AND status = 'available'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_not_found_or_already_scratched';
  END IF;

  SELECT *
  INTO v_config
  FROM public.lottery_game_config
  WHERE id = 1;

  IF NOT FOUND OR v_config.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'lottery_inactive';
  END IF;

  SELECT *
  INTO v_collection
  FROM public.lottery_card_collections
  WHERE is_active = TRUE
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'collection_not_found';
  END IF;

  v_total_weight :=
    COALESCE(v_config.common_weight, 0) +
    COALESCE(v_config.silver_weight, 0) +
    COALESCE(v_config.gold_weight, 0) +
    COALESCE(v_config.epic_weight, 0) +
    COALESCE(v_config.legendary_weight, 0);

  IF v_total_weight <= 0 THEN
    RAISE EXCEPTION 'invalid_card_weight_budget';
  END IF;

  v_roll := public.lottery_secure_random_int(1, v_total_weight);

  IF v_roll <= v_config.common_weight THEN
    SELECT count(*) INTO v_definition_count
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = 'common'
      AND is_active = TRUE;

    v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

    SELECT *
    INTO v_card
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = 'common'
      AND is_active = TRUE
    ORDER BY card_number ASC
    OFFSET v_definition_offset
    LIMIT 1;
  ELSIF v_roll <= v_config.common_weight + v_config.silver_weight THEN
    SELECT count(*) INTO v_definition_count
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = 'silver'
      AND is_active = TRUE;

    v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

    SELECT *
    INTO v_card
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = 'silver'
      AND is_active = TRUE
    ORDER BY card_number ASC
    OFFSET v_definition_offset
    LIMIT 1;
  ELSIF v_roll <= v_config.common_weight + v_config.silver_weight + v_config.gold_weight THEN
    SELECT count(*) INTO v_definition_count
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = 'gold'
      AND is_active = TRUE;

    v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

    SELECT *
    INTO v_card
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = 'gold'
      AND is_active = TRUE
    ORDER BY card_number ASC
    OFFSET v_definition_offset
    LIMIT 1;
  ELSIF v_roll <= v_config.common_weight + v_config.silver_weight + v_config.gold_weight + v_config.epic_weight THEN
    SELECT count(*) INTO v_definition_count
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = 'epic'
      AND is_active = TRUE;

    v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

    SELECT *
    INTO v_card
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = 'epic'
      AND is_active = TRUE
    ORDER BY card_number ASC
    OFFSET v_definition_offset
    LIMIT 1;
  ELSE
    SELECT count(*) INTO v_definition_count
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = 'legendary'
      AND is_active = TRUE;

    v_definition_offset := public.lottery_secure_random_int(0, GREATEST(v_definition_count - 1, 0));

    SELECT *
    INTO v_card
    FROM public.lottery_card_definitions
    WHERE collection_id = v_collection.id
      AND rarity = 'legendary'
      AND is_active = TRUE
    ORDER BY card_number ASC
    OFFSET v_definition_offset
    LIMIT 1;
  END IF;

  IF v_definition_count <= 0 OR v_card.id IS NULL THEN
    RAISE EXCEPTION 'card_definition_not_found_for_rarity';
  END IF;

  INSERT INTO public.lottery_card_instances (
    user_id,
    ticket_id,
    card_definition_id
  )
  VALUES (
    p_user_id,
    v_ticket.id,
    v_card.id
  )
  RETURNING id INTO v_card_instance_id;

  UPDATE public.lottery_tickets
  SET status = 'scratched',
      scratched_at = now(),
      card_definition_id = v_card.id,
      card_rarity = v_card.rarity,
      sticker_id = NULL,
      sticker_rarity = NULL,
      legendary_reward_claim_id = NULL
  WHERE id = v_ticket.id;

  SELECT count(*)
  INTO v_owned_count
  FROM public.lottery_card_instances
  WHERE user_id = p_user_id
    AND card_definition_id = v_card.id;

  SELECT
    count(DISTINCT card_definition_id),
    count(*)
  INTO v_unique_owned, v_total_owned
  FROM public.lottery_card_instances
  WHERE user_id = p_user_id;

  SELECT
    count(*) FILTER (WHERE d.rarity = 'common'),
    count(*) FILTER (WHERE d.rarity = 'silver'),
    count(*) FILTER (WHERE d.rarity = 'gold'),
    count(*) FILTER (WHERE d.rarity = 'epic'),
    count(*) FILTER (WHERE d.rarity = 'legendary')
  INTO
    v_common_count,
    v_silver_count,
    v_gold_count,
    v_epic_count,
    v_legendary_count
  FROM public.lottery_card_instances i
  JOIN public.lottery_card_definitions d ON d.id = i.card_definition_id
  WHERE i.user_id = p_user_id;

  RETURN jsonb_build_object(
    'ticketId', v_ticket.id,
    'ticketNumber', v_ticket.ticket_number,
    'scratchedAt', now(),
    'card', jsonb_build_object(
      'id', v_card.id,
      'definitionId', v_card.id,
      'collectionId', v_collection.id,
      'collectionCode', v_collection.code,
      'collectionTitle', v_collection.title,
      'code', v_card.code,
      'cardNumber', v_card.card_number,
      'name', v_card.name,
      'rarity', v_card.rarity,
      'visualPrompt', v_card.visual_prompt,
      'description', v_card.description,
      'imageUrl', v_card.image_url,
      'ownedCount', v_owned_count
    ),
    'inventory', jsonb_build_object(
      'totalCards', (SELECT count(*) FROM public.lottery_card_definitions WHERE collection_id = v_collection.id),
      'uniqueOwned', COALESCE(v_unique_owned, 0),
      'totalOwnedCopies', COALESCE(v_total_owned, 0),
      'duplicateCopies', GREATEST(COALESCE(v_total_owned, 0) - COALESCE(v_unique_owned, 0), 0),
      'common', COALESCE(v_common_count, 0),
      'silver', COALESCE(v_silver_count, 0),
      'gold', COALESCE(v_gold_count, 0),
      'epic', COALESCE(v_epic_count, 0),
      'legendary', COALESCE(v_legendary_count, 0)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_scratch_ticket(UUID, UUID) TO service_role;

COMMIT;
