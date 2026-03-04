-- Rename tutorial wording from "Hemp Heroes 2026" to "Kanab Quest"
-- for tutorial CMS pages only.

UPDATE public.cms_pages
SET
  title = replace(title, 'Hemp Heroes 2026', 'Kanab Quest'),
  description = replace(description, 'Hemp Heroes 2026', 'Kanab Quest')
WHERE slug LIKE 'tutorial-%'
  AND (
    title ILIKE '%Hemp Heroes 2026%'
    OR description ILIKE '%Hemp Heroes 2026%'
  );

UPDATE public.cms_pages
SET sections = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(section_value) = 'object' AND section_value ? 'body' THEN
        jsonb_set(
          section_value,
          '{body}',
          to_jsonb(replace(section_value->>'body', 'Hemp Heroes 2026', 'Kanab Quest'))
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
