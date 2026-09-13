BEGIN;

-- Retire the item without rewriting old run snapshots, invoices or purchase receipts.
UPDATE public.kq_equipment_catalog
SET is_active=FALSE,is_purchasable=FALSE,updated_at=now()
WHERE code='SECURITY-FENCE';

DELETE FROM public.kq_equipment_loadouts WHERE equipment_code='SECURITY-FENCE';

COMMIT;
