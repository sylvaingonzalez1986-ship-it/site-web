BEGIN;

UPDATE public.cms_pages
SET
  title = 'Tutoriel - Boosters TCG',
  description = 'Tu gagnes 1 pack par tranche de depense affichee sur le site. Chaque booster revele 3 cartes de la collection Hemp Heroes 2026.',
  sections = jsonb_build_array(
    jsonb_build_object(
      'id', 'main-text',
      'title', 'Texte principal',
      'body', 'Tu gagnes 1 pack par tranche de depense affichee sur le site. Chaque booster revele 3 cartes de la collection Hemp Heroes 2026.',
      'style', 'cream'
    ),
    jsonb_build_object(
      'id', 'detail-1',
      'title', 'Detail 1',
      'body', 'Les cartes peuvent etre communes, silver, gold, epiques ou legendaires.',
      'style', 'mint'
    ),
    jsonb_build_object(
      'id', 'detail-2',
      'title', 'Detail 2',
      'body', 'Les doublons comptent aussi dans ta collection.',
      'style', 'mint'
    ),
    jsonb_build_object(
      'id', 'detail-3',
      'title', 'Detail 3',
      'body', 'Le reglement complet est disponible sur la page dediee.',
      'style', 'mint'
    )
  ),
  updated_at = now()
WHERE slug = 'tutorial-tickets'
  AND (
    title ILIKE '%ticket%'
    OR description ILIKE '%ticket%'
    OR description ILIKE '%gratter%'
    OR sections::text ILIKE '%ticket%'
    OR sections::text ILIKE '%gratter%'
  );

UPDATE public.cms_pages
SET
  title = 'Tutoriel - Mini demo booster',
  description = 'Essaie ici: ouvre un booster demo et retourne les 3 cartes comme dans l''experience reelle.',
  sections = jsonb_build_array(
    jsonb_build_object(
      'id', 'main-text',
      'title', 'Texte principal',
      'body', 'Essaie ici: ouvre un booster demo et retourne les 3 cartes comme dans l''experience reelle.',
      'style', 'cream'
    ),
    jsonb_build_object(
      'id', 'detail-1',
      'title', 'Detail 1',
      'body', 'Le resultat est fictif.',
      'style', 'mint'
    ),
    jsonb_build_object(
      'id', 'detail-2',
      'title', 'Detail 2',
      'body', 'Le tutoriel avance ensuite normalement.',
      'style', 'mint'
    )
  ),
  updated_at = now()
WHERE slug = 'tutorial-tickets-demo'
  AND (
    title ILIKE '%ticket%'
    OR description ILIKE '%ticket%'
    OR description ILIKE '%gratter%'
    OR sections::text ILIKE '%ticket%'
    OR sections::text ILIKE '%gratter%'
  );

COMMIT;
