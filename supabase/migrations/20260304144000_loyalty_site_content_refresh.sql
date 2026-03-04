BEGIN;

UPDATE public.site_content
SET profile =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          COALESCE(profile, '{}'::jsonb),
                          '{badgeBenefitsModalTitle}',
                          to_jsonb('Avantages du palier'::text),
                          true
                        ),
                        '{badgeBenefitsModalHint}',
                        to_jsonb('Chaque ligne correspond a un avantage actif de ton badge.'::text),
                        true
                      ),
                      '{badgeBenefitsCloseLabel}',
                      to_jsonb('Fermer'::text),
                      true
                    ),
                    '{decouverteDiscountPercent}',
                    to_jsonb(1),
                    true
                  ),
                  '{explorateurDiscountPercent}',
                  to_jsonb(4),
                  true
                ),
                '{connaisseurDiscountPercent}',
                to_jsonb(6),
                true
              ),
              '{ambassadeurDiscountPercent}',
              to_jsonb(8),
              true
            ),
            '{legendeDiscountPercent}',
            to_jsonb(10),
            true
          ),
          '{decouverteBenefits}',
          to_jsonb(('1% de reduction permanente' || E'\n' || '1 pack booster extra par commande')::text),
          true
        ),
        '{explorateurBenefits}',
        to_jsonb(('4% de reduction permanente' || E'\n' || 'Livraison offerte' || E'\n' || '3 packs booster extra par commande')::text),
        true
      ),
      '{connaisseurBenefits}',
      to_jsonb(('6% de reduction permanente' || E'\n' || 'Livraison offerte' || E'\n' || '5 packs booster extra par commande')::text),
      true
    ),
    '{ambassadeurBenefits}',
    to_jsonb(('8% de reduction permanente' || E'\n' || 'Livraison offerte' || E'\n' || '10 packs booster extra par commande' || E'\n' || '1 cadeau d''anniversaire pour toute commande passee le mois de ton anniversaire' || E'\n' || 'Acces aux ventes privees')::text),
    true
  )
WHERE id = 1;

UPDATE public.site_content
SET profile = jsonb_set(
  COALESCE(profile, '{}'::jsonb),
  '{legendeBenefits}',
  to_jsonb(('10% de reduction permanente' || E'\n' || 'Livraison offerte' || E'\n' || '20 packs booster extra par commande' || E'\n' || '1 cadeau d''anniversaire pour toute commande passee le mois de ton anniversaire' || E'\n' || '1 cadeau de Noel pour toute commande passee au mois de decembre' || E'\n' || 'Acces aux ventes privees')::text),
  true
)
WHERE id = 1;

COMMIT;
