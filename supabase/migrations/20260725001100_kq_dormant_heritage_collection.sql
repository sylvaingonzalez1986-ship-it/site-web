BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_heritage_card_definitions (
  code TEXT PRIMARY KEY CHECK (code ~ '^HERITAGE-[0-9]{3}$'),
  name TEXT NOT NULL UNIQUE CHECK (char_length(BTRIM(name)) BETWEEN 3 AND 120),
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic')),
  timing TEXT NOT NULL CHECK (timing IN ('passive', 'once-per-run')),
  effect_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL CHECK (char_length(BTRIM(description)) BETWEEN 10 AND 500),
  image_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kq_heritage_player_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pulls_without_rare INTEGER NOT NULL DEFAULT 0 CHECK (pulls_without_rare BETWEEN 0 AND 5),
  total_pulls INTEGER NOT NULL DEFAULT 0 CHECK (total_pulls >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kq_heritage_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_item_id BIGINT NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  unit_index INTEGER NOT NULL CHECK (unit_index > 0),
  card_code TEXT NOT NULL REFERENCES public.kq_heritage_card_definitions(code) ON DELETE RESTRICT,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic')),
  seed INTEGER NOT NULL CHECK (seed BETWEEN 0 AND 2147483647),
  was_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, unit_index)
);

CREATE INDEX IF NOT EXISTS idx_kq_heritage_draws_user_recent
  ON public.kq_heritage_draws(user_id, drawn_at DESC);
CREATE INDEX IF NOT EXISTS idx_kq_heritage_draws_user_card
  ON public.kq_heritage_draws(user_id, card_code);

ALTER TABLE public.kq_heritage_card_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_heritage_player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_heritage_draws ENABLE ROW LEVEL SECURITY;

INSERT INTO public.kq_heritage_card_definitions(
  code, name, rarity, timing, effect_code, description, is_active
)
VALUES
  ('HERITAGE-001', 'Racines solides', 'common', 'once-per-run', 'root-danger-shield', 'Annule le premier Danger pendant l''Enracinement.', FALSE),
  ('HERITAGE-002', 'Réserve du jardinier', 'common', 'passive', 'starting-xp', 'Commence chaque culture avec 1 XP supplémentaire.', FALSE),
  ('HERITAGE-003', 'Main prévoyante', 'common', 'once-per-run', 'opening-draw-twelve', 'À la première étape, pioche 12 cartes et conserve une main de 10.', FALSE),
  ('HERITAGE-004', 'Climat stable', 'common', 'once-per-run', 'climate-pressure-shield', 'Ignore la première hausse de pression provoquée par le climat.', FALSE),
  ('HERITAGE-005', 'Second regard', 'common', 'passive', 'extra-redraw', 'Accorde un changement de main supplémentaire par culture.', FALSE),
  ('HERITAGE-006', 'Reprise vigoureuse', 'common', 'once-per-run', 'failure-xp', 'Après le premier échec de la culture, récupère 1 XP.', FALSE),
  ('HERITAGE-007', 'Instinct du cultivateur', 'rare', 'once-per-run', 'reroll-neutral', 'Après un lancer, relance un dé neutre.', FALSE),
  ('HERITAGE-008', 'Bouclier biologique', 'rare', 'once-per-run', 'free-pest-inspection', 'La première inspection révèle le ravageur sans coût supplémentaire.', FALSE),
  ('HERITAGE-009', 'Floraison maîtrisée', 'rare', 'once-per-run', 'flower-neutral-success', 'Pendant la Floraison, transforme un résultat neutre en réussite.', FALSE),
  ('HERITAGE-010', 'Affinage patient', 'rare', 'once-per-run', 'drying-reroll-lowest', 'À la dernière étape, relance le dé le plus faible.', FALSE),
  ('HERITAGE-011', 'Héritage de la canopée', 'epic', 'once-per-run', 'ignore-roll-dangers', 'Ignore tous les Dangers d''un lancer, sans créer d''Étincelle.', FALSE),
  ('HERITAGE-012', 'Signature du maître', 'epic', 'once-per-run', 'four-keep-three', 'Ajoute un quatrième dé et conserve les trois meilleurs.', FALSE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  rarity = EXCLUDED.rarity,
  timing = EXCLUDED.timing,
  effect_code = EXCLUDED.effect_code,
  description = EXCLUDED.description,
  is_active = FALSE,
  updated_at = now();

COMMIT;
