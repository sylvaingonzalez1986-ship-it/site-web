-- Remove outdated "app" mention from tutorial navigation copy.
-- The app tab is not visible in the current navbar for regular users.

UPDATE public.cms_pages
SET description =
  replace(
    replace(
      description,
      'la boutique, le blog, l''app, ton compte',
      'la boutique, le blog, ton compte'
    ),
    'la boutique, le blog, l’app, ton compte',
    'la boutique, le blog, ton compte'
  )
WHERE slug LIKE 'tutorial-%';

UPDATE public.cms_pages
SET sections = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(section_value) = 'object' AND section_value ? 'body' THEN
        jsonb_set(
          section_value,
          '{body}',
          to_jsonb(
            replace(
              replace(
                section_value->>'body',
                'la boutique, le blog, l''app, ton compte',
                'la boutique, le blog, ton compte'
              ),
              'la boutique, le blog, l’app, ton compte',
              'la boutique, le blog, ton compte'
            )
          )
        )
      ELSE section_value
    END
    ORDER BY section_index
  )
  FROM jsonb_array_elements(sections) WITH ORDINALITY AS t(section_value, section_index)
)
WHERE slug LIKE 'tutorial-%'
  AND sections IS NOT NULL
  AND jsonb_typeof(sections) = 'array';
