-- Align durable equipment with verifiable public TTC prices observed on 2026-08-31.
-- The application keeps the seller, source URL and any observed promotion in its
-- versioned catalog; the database stores the stable public price used at checkout.

BEGIN;

WITH verified_prices(code, price_cents) AS (
  VALUES
    ('TENT-120', 12990),
    ('TENT-150', 19690),
    ('LED-300', 48690),
    ('LED-500', 97499),
    ('AIR-EC6', 11900),
    ('CLIMATE-SMART', 18900),
    ('SIFT-TRAY', 5500),
    ('WASHER-25L', 12000),
    ('PRESS-0600', 19900),
    ('PRESS-2T', 39000),
    ('PRESS-10T', 48209),
    ('PRESS-20T', 73000),
    ('FREEZE-DRYER', 279000),
    ('SOLAR-BACKUP', 129900),
    ('SECURITY-CAMERA', 6999)
)
UPDATE public.kq_equipment_catalog AS catalog
SET price_cents = verified_prices.price_cents
FROM verified_prices
WHERE catalog.code = verified_prices.code;

COMMIT;
