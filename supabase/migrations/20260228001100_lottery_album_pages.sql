CREATE TABLE IF NOT EXISTS public.lottery_album_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  collection_title TEXT NOT NULL DEFAULT 'Hemp Farm Tycoon Collection',
  rarity public.lottery_sticker_rarity NOT NULL,
  page_number INTEGER NOT NULL CHECK (page_number BETWEEN 1 AND 999),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lottery_album_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL DEFAULT '',
  series_label TEXT NOT NULL DEFAULT 'Serie 2026',
  card_number INTEGER NOT NULL CHECK (card_number BETWEEN 1 AND 9999),
  rarity public.lottery_sticker_rarity NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lottery_album_page_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.lottery_album_pages(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 1 AND 100),
  card_id UUID REFERENCES public.lottery_album_cards(id) ON DELETE SET NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_lottery_album_page_slot UNIQUE (page_id, slot_index)
);

ALTER TABLE public.lottery_reward_rules
  ADD COLUMN IF NOT EXISTS album_page_id UUID REFERENCES public.lottery_album_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lottery_album_pages_rarity_page
  ON public.lottery_album_pages(rarity, page_number);

CREATE INDEX IF NOT EXISTS idx_lottery_album_cards_rarity_number
  ON public.lottery_album_cards(rarity, card_number);

CREATE INDEX IF NOT EXISTS idx_lottery_album_page_slots_page
  ON public.lottery_album_page_slots(page_id, slot_index);

DROP TRIGGER IF EXISTS trg_touch_lottery_album_pages_updated_at ON public.lottery_album_pages;
CREATE TRIGGER trg_touch_lottery_album_pages_updated_at
BEFORE UPDATE ON public.lottery_album_pages
FOR EACH ROW
EXECUTE FUNCTION public.lottery_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_lottery_album_cards_updated_at ON public.lottery_album_cards;
CREATE TRIGGER trg_touch_lottery_album_cards_updated_at
BEFORE UPDATE ON public.lottery_album_cards
FOR EACH ROW
EXECUTE FUNCTION public.lottery_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_lottery_album_page_slots_updated_at ON public.lottery_album_page_slots;
CREATE TRIGGER trg_touch_lottery_album_page_slots_updated_at
BEFORE UPDATE ON public.lottery_album_page_slots
FOR EACH ROW
EXECUTE FUNCTION public.lottery_touch_updated_at();

ALTER TABLE public.lottery_album_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_album_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_album_page_slots ENABLE ROW LEVEL SECURITY;

WITH seed_pages AS (
  SELECT *
  FROM (
    VALUES
      ('COMMON_PAGE_01', 'Culture & Tracteur', 'Hemp Farm Tycoon Collection', 'common'::public.lottery_sticker_rarity, 1, 'COMMON_DISCOUNT_10', 100),
      ('COMMON_PAGE_02', 'Atelier & Recolte', 'Hemp Farm Tycoon Collection', 'common'::public.lottery_sticker_rarity, 2, 'COMMON_GIFT_1G', 200),
      ('RARE_PAGE_01', 'Selection Premium', 'Hemp Farm Tycoon Collection', 'rare'::public.lottery_sticker_rarity, 1, 'RARE_DISCOUNT_20', 100),
      ('RARE_PAGE_02', 'Extraction Reserve', 'Hemp Farm Tycoon Collection', 'rare'::public.lottery_sticker_rarity, 2, 'RARE_GIFT_10G', 200),
      ('EPIC_PAGE_01', 'Master Harvest', 'Hemp Farm Tycoon Collection', 'epic'::public.lottery_sticker_rarity, 1, 'EPIC_GIFT_50G', 100)
  ) AS seeded(code, title, collection_title, rarity, page_number, reward_code, rule_priority)
),
upserted_pages AS (
  INSERT INTO public.lottery_album_pages (
    code,
    title,
    collection_title,
    rarity,
    page_number,
    is_active
  )
  SELECT
    code,
    title,
    collection_title,
    rarity,
    page_number,
    TRUE
  FROM seed_pages
  ON CONFLICT (code) DO UPDATE
  SET
    title = EXCLUDED.title,
    collection_title = EXCLUDED.collection_title,
    rarity = EXCLUDED.rarity,
    page_number = EXCLUDED.page_number,
    is_active = TRUE,
    archived_at = NULL,
    updated_at = now()
  RETURNING id, code, title, collection_title, rarity, page_number
),
all_seed_pages AS (
  SELECT
    page.id,
    page.code,
    page.title,
    page.collection_title,
    page.rarity,
    page.page_number,
    seeded.reward_code,
    seeded.rule_priority
  FROM public.lottery_album_pages AS page
  JOIN seed_pages AS seeded
    ON seeded.code = page.code
),
generated_cards AS (
  INSERT INTO public.lottery_album_cards (
    code,
    title,
    subtitle,
    image_url,
    series_label,
    card_number,
    rarity,
    is_active
  )
  SELECT
    page.code || '_CARD_' || LPAD(slot.slot_index::TEXT, 2, '0'),
    page.title || ' #' || slot.slot_index,
    CASE slot.slot_index
      WHEN 1 THEN 'Edition fermee'
      WHEN 2 THEN 'Edition route'
      WHEN 3 THEN 'Edition atelier'
      WHEN 4 THEN 'Edition nature'
      WHEN 5 THEN 'Edition champ'
      WHEN 6 THEN 'Edition serres'
      WHEN 7 THEN 'Edition outils'
      WHEN 8 THEN 'Edition reserve'
      WHEN 9 THEN 'Edition equipe'
      ELSE 'Edition finale'
    END,
    '',
    'Serie 2026',
    (page.page_number * 100) + slot.slot_index,
    page.rarity,
    TRUE
  FROM all_seed_pages AS page
  CROSS JOIN generate_series(1, 10) AS slot(slot_index)
  ON CONFLICT (code) DO UPDATE
  SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    series_label = EXCLUDED.series_label,
    card_number = EXCLUDED.card_number,
    rarity = EXCLUDED.rarity,
    is_active = TRUE,
    archived_at = NULL,
    updated_at = now()
  RETURNING id, code
)
INSERT INTO public.lottery_album_page_slots (
  page_id,
  slot_index,
  card_id,
  label
)
SELECT
  page.id,
  slot.slot_index,
  card.id,
  'Case a coller #' || slot.slot_index
FROM all_seed_pages AS page
CROSS JOIN generate_series(1, 10) AS slot(slot_index)
JOIN public.lottery_album_cards AS card
  ON card.code = page.code || '_CARD_' || LPAD(slot.slot_index::TEXT, 2, '0')
ON CONFLICT (page_id, slot_index) DO UPDATE
SET
  card_id = EXCLUDED.card_id,
  label = EXCLUDED.label,
  updated_at = now();

UPDATE public.lottery_reward_rules AS rule
SET
  album_page_id = page.id,
  updated_at = now()
FROM public.lottery_reward_definitions AS reward,
     public.lottery_album_pages AS page
WHERE reward.id = rule.reward_definition_id
  AND page.code = CASE
    WHEN reward.code = 'COMMON_DISCOUNT_10' AND rule.priority = 100 THEN 'COMMON_PAGE_01'
    WHEN reward.code = 'COMMON_GIFT_1G' AND rule.priority = 200 THEN 'COMMON_PAGE_02'
    WHEN reward.code = 'RARE_DISCOUNT_20' AND rule.priority = 100 THEN 'RARE_PAGE_01'
    WHEN reward.code = 'RARE_GIFT_10G' AND rule.priority = 200 THEN 'RARE_PAGE_02'
    WHEN reward.code = 'EPIC_GIFT_50G' AND rule.priority = 100 THEN 'EPIC_PAGE_01'
    ELSE NULL
  END;
