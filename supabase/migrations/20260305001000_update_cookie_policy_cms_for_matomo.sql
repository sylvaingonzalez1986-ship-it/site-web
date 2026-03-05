BEGIN;

UPDATE public.cms_pages
SET
  description = replace(
    description,
    'A ce jour, aucun cookie non essentiel n''est depose par defaut sur le site.',
    'Matomo Cloud peut etre utilise pour la mesure d''audience uniquement apres votre choix explicite dans le bandeau cookies.'
  ),
  sections = replace(
    replace(
      replace(
        sections::text,
        'A ce jour, aucun cookie publicitaire tiers n''est depose par defaut sur le site. Si des outils de mesure d''audience non strictement necessaires sont ajoutes, cette politique sera mise a jour et un mecanisme de consentement sera mis en place le cas echeant.',
        'Matomo Cloud peut etre utilise pour la mesure d''audience uniquement apres votre choix explicite dans le bandeau cookies. Aucun cookie publicitaire tiers n''est depose par defaut sur le site.'
      ),
      'A ce jour, aucun cookie publicitaire tiers n''est depose par defaut sur le site.',
      'Matomo Cloud peut etre utilise pour la mesure d''audience uniquement apres votre choix explicite dans le bandeau cookies.'
    ),
    'Version en vigueur : 21 fevrier 2026',
    'Version en vigueur : 5 mars 2026'
  )::jsonb,
  updated_at = now()
WHERE slug = 'politique-cookies';

COMMIT;
