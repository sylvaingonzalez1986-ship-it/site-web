BEGIN;

ALTER TABLE public.lottery_card_collections
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';

ALTER TABLE public.kq_support_card_rules
  ADD COLUMN IF NOT EXISTS advantage TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS drawback TEXT NOT NULL DEFAULT '';

UPDATE public.kq_support_card_rules rule
SET advantage = definition.description
FROM public.lottery_card_definitions definition
WHERE definition.id = rule.card_definition_id AND BTRIM(rule.advantage) = '';

ALTER TABLE public.lottery_card_collections
  ADD CONSTRAINT kq_botte_collection_description_length CHECK (char_length(description) <= 1000),
  ADD CONSTRAINT kq_botte_collection_image_length CHECK (char_length(image_url) <= 2000);
ALTER TABLE public.kq_support_card_rules
  ADD CONSTRAINT kq_support_advantage_length CHECK (char_length(BTRIM(advantage)) BETWEEN 3 AND 500),
  ADD CONSTRAINT kq_support_drawback_length CHECK (char_length(drawback) <= 500);

CREATE OR REPLACE FUNCTION public.rpc_kq_update_botte_card_editorial(
  p_card_id UUID, p_name TEXT, p_rarity public.lottery_card_rarity,
  p_description TEXT, p_image_url TEXT, p_is_active BOOLEAN,
  p_advantage TEXT, p_drawback TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF char_length(BTRIM(p_name)) < 3 OR char_length(BTRIM(p_advantage)) < 3 THEN
    RAISE EXCEPTION 'kq_botte_card_invalid';
  END IF;
  UPDATE public.lottery_card_definitions definition SET
    name = BTRIM(p_name), rarity = p_rarity, description = BTRIM(p_description),
    image_url = BTRIM(p_image_url), is_active = p_is_active, updated_at = now()
  FROM public.lottery_card_collections collection
  WHERE definition.id = p_card_id AND definition.collection_id = collection.id
    AND collection.code = 'BOTTE_DU_CHANVRIER_2026' AND definition.code ~ '^BOTTE-[0-9]{3}$';
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_botte_card_not_found'; END IF;
  UPDATE public.kq_support_card_rules SET advantage = BTRIM(p_advantage),
    drawback = BTRIM(p_drawback), updated_at = now() WHERE card_definition_id = p_card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_botte_rule_not_found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_kq_update_botte_card_editorial(UUID, TEXT, public.lottery_card_rarity, TEXT, TEXT, BOOLEAN, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_update_botte_card_editorial(UUID, TEXT, public.lottery_card_rarity, TEXT, TEXT, BOOLEAN, TEXT, TEXT)
  TO service_role;

COMMIT;
