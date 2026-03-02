ALTER TABLE public.lottery_game_config
  ADD COLUMN IF NOT EXISTS season_label TEXT NOT NULL DEFAULT 'Saison 1';

UPDATE public.lottery_game_config
SET season_label = 'Saison 1'
WHERE id = 1 AND COALESCE(season_label, '') = '';
