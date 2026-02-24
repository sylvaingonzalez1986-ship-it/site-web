-- Reclassify obvious resin products previously stored under "fleurs".
UPDATE products
SET category = 'resines'
WHERE category = 'fleurs'
  AND (
    lower(name) LIKE '%resine%'
    OR lower(description) LIKE '%resine%'
    OR lower(id) LIKE '%resine%'
  );

