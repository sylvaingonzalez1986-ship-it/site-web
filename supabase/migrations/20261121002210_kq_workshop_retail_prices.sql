-- Purchase prices for the six machines offered from the warehouse workshop.
-- Player purchases, maintenance receipts and their original cost are retained.
UPDATE public.kq_equipment_catalog catalog SET price_cents=offer.price
FROM (VALUES
  ('SIFT-TRAY', 45000),
  ('PRESS-0600', 24900),
  ('WASHER-25L', 9900),
  ('AUTO-SIEVE', 51900),
  ('FREEZE-DRYER', 343608),
  ('STATIC-PLASMA', 1800000)
) AS offer(code,price) WHERE catalog.code=offer.code AND catalog.price_cents IS DISTINCT FROM offer.price;
