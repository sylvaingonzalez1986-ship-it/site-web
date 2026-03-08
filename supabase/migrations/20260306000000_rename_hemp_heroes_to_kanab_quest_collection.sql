UPDATE public.lottery_card_collections
SET title = replace(title, 'Hemp Heroes 2026 Collection', 'Kanab Quest Collection')
WHERE title IS NOT NULL
  AND title LIKE '%Hemp Heroes 2026 Collection%';

UPDATE public.lottery_card_collections
SET title = replace(title, 'Hemp Heroes 2026', 'Kanab Quest')
WHERE title IS NOT NULL
  AND title LIKE '%Hemp Heroes 2026%';

UPDATE public.lottery_game_config
SET collection_title = replace(collection_title, 'Hemp Heroes 2026 Collection', 'Kanab Quest Collection')
WHERE collection_title IS NOT NULL
  AND collection_title LIKE '%Hemp Heroes 2026 Collection%';

UPDATE public.lottery_game_config
SET album_subtitle = replace(album_subtitle, 'Hemp Heroes', 'Kanab Quest')
WHERE album_subtitle IS NOT NULL
  AND album_subtitle LIKE '%Hemp Heroes%';

UPDATE public.cms_pages
SET
  title = replace(title, 'Hemp Heroes 2026', 'Kanab Quest'),
  description = replace(description, 'Hemp Heroes 2026', 'Kanab Quest')
WHERE title LIKE '%Hemp Heroes 2026%'
  OR description LIKE '%Hemp Heroes 2026%';

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
WHERE sections IS NOT NULL
  AND jsonb_typeof(sections) = 'array';
