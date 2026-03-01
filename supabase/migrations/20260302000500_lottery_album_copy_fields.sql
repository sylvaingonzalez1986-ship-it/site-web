BEGIN;

ALTER TABLE public.lottery_game_config
  ADD COLUMN IF NOT EXISTS album_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS album_booster_title TEXT,
  ADD COLUMN IF NOT EXISTS album_booster_description TEXT;

UPDATE public.lottery_game_config
SET
  album_subtitle = COALESCE(
    NULLIF(album_subtitle, ''),
    'Ta collection de cartes. Complete chaque page pour debloquer ses recompenses.'
  ),
  album_booster_title = COALESCE(
    NULLIF(album_booster_title, ''),
    'packs a ouvrir'
  ),
  album_booster_description = COALESCE(
    NULLIF(album_booster_description, ''),
    'Ouvre un booster depuis l''album pour reveler les 3 cartes sans quitter cette page.'
  )
WHERE id = 1;

COMMIT;
