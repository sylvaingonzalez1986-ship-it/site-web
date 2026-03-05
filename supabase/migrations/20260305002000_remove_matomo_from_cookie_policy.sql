BEGIN;

UPDATE public.cms_pages
SET
  description = replace(
    description,
    'Matomo Cloud peut etre utilise pour la mesure d''audience uniquement apres votre choix explicite dans le bandeau cookies.',
    'A ce jour, aucun tracker tiers de mesure d''audience n''est active par defaut.'
  ),
  sections = replace(
    replace(
      replace(
        sections::text,
        'Matomo Cloud peut etre utilise pour la mesure d''audience uniquement apres votre choix explicite dans le bandeau cookies. Aucun cookie publicitaire tiers n''est depose par defaut sur le site.',
        'A ce jour, aucun tracker tiers de mesure d''audience n''est active par defaut. Aucun cookie publicitaire tiers n''est depose par defaut sur le site.'
      ),
      'Matomo Cloud peut etre utilise pour la mesure d''audience uniquement apres votre choix explicite dans le bandeau cookies.',
      'A ce jour, aucun tracker tiers de mesure d''audience n''est active par defaut.'
    ),
    'Le site utilise des cookies techniques et, sur choix, analytics.',
    'Le site utilise uniquement des cookies techniques strictement necessaires.'
  )::jsonb,
  updated_at = now()
WHERE slug = 'politique-cookies';

COMMIT;
