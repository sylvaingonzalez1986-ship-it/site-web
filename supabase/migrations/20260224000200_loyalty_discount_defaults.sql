BEGIN;

UPDATE site_content
SET profile =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(profile, '{}'::jsonb),
            '{decouverteDiscountPercent}',
            to_jsonb(
              CASE
                WHEN COALESCE(NULLIF(profile->>'decouverteDiscountPercent', '')::numeric, 0) > 0 THEN NULLIF(profile->>'decouverteDiscountPercent', '')::numeric
                ELSE 2
              END
            ),
            true
          ),
          '{explorateurDiscountPercent}',
          to_jsonb(
            CASE
              WHEN COALESCE(NULLIF(profile->>'explorateurDiscountPercent', '')::numeric, 0) > 0 THEN NULLIF(profile->>'explorateurDiscountPercent', '')::numeric
              ELSE 4
            END
          ),
          true
        ),
        '{connaisseurDiscountPercent}',
        to_jsonb(
          CASE
            WHEN COALESCE(NULLIF(profile->>'connaisseurDiscountPercent', '')::numeric, 0) > 0 THEN NULLIF(profile->>'connaisseurDiscountPercent', '')::numeric
            ELSE 6
          END
        ),
        true
      ),
      '{ambassadeurDiscountPercent}',
      to_jsonb(
        CASE
          WHEN COALESCE(NULLIF(profile->>'ambassadeurDiscountPercent', '')::numeric, 0) > 0 THEN NULLIF(profile->>'ambassadeurDiscountPercent', '')::numeric
          ELSE 8
        END
      ),
      true
    ),
    '{legendeDiscountPercent}',
    to_jsonb(
      CASE
        WHEN COALESCE(NULLIF(profile->>'legendeDiscountPercent', '')::numeric, 0) > 0 THEN NULLIF(profile->>'legendeDiscountPercent', '')::numeric
        ELSE 10
      END
    ),
    true
  )
WHERE id = 1;

COMMIT;
