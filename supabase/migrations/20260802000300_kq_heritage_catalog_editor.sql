BEGIN;

ALTER TABLE public.kq_heritage_card_definitions
  ADD COLUMN IF NOT EXISTS advantage TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS drawback TEXT NOT NULL DEFAULT '';

UPDATE public.kq_heritage_card_definitions
SET advantage = description
WHERE BTRIM(advantage) = '';

ALTER TABLE public.kq_heritage_card_definitions
  ADD CONSTRAINT kq_heritage_advantage_length CHECK (char_length(BTRIM(advantage)) BETWEEN 3 AND 500),
  ADD CONSTRAINT kq_heritage_drawback_length CHECK (char_length(drawback) <= 500),
  ADD CONSTRAINT kq_heritage_image_length CHECK (char_length(image_url) <= 2000);

CREATE OR REPLACE FUNCTION public.rpc_kq_update_heritage_card_editorial(
  p_code TEXT, p_name TEXT, p_rarity TEXT, p_description TEXT,
  p_image_url TEXT, p_is_active BOOLEAN, p_advantage TEXT, p_drawback TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_code !~ '^HERITAGE-[0-9]{3}$'
    OR p_rarity NOT IN ('common', 'rare', 'epic')
    OR char_length(BTRIM(p_name)) NOT BETWEEN 3 AND 120
    OR char_length(BTRIM(p_advantage)) NOT BETWEEN 3 AND 500
    OR char_length(BTRIM(p_description)) NOT BETWEEN 10 AND 500
    OR char_length(p_image_url) > 2000
    OR char_length(p_drawback) > 500 THEN
    RAISE EXCEPTION 'kq_heritage_card_invalid';
  END IF;
  UPDATE public.kq_heritage_card_definitions SET
    name = BTRIM(p_name), rarity = p_rarity, description = BTRIM(p_description),
    image_url = BTRIM(p_image_url), is_active = p_is_active,
    advantage = BTRIM(p_advantage), drawback = BTRIM(p_drawback), updated_at = now()
  WHERE code = p_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_card_not_found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_update_heritage_card_editorial(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_update_heritage_card_editorial(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT)
  TO service_role;

COMMIT;
