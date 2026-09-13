BEGIN;
ALTER TABLE public.kq_equipment_catalog DROP CONSTRAINT kq_equipment_catalog_slot_check;
ALTER TABLE public.kq_equipment_catalog ADD CONSTRAINT kq_equipment_catalog_slot_check CHECK (slot IN (
  'tent','lighting','air','climate-controller','sifting','washing','filtration','static-separation','press','drying','energy','security','flower-drying'
));
ALTER TABLE public.kq_equipment_loadouts DROP CONSTRAINT kq_equipment_loadouts_slot_check;
ALTER TABLE public.kq_equipment_loadouts ADD CONSTRAINT kq_equipment_loadouts_slot_check CHECK (slot IN (
  'tent','lighting','air','climate-controller','sifting','washing','filtration','static-separation','press','drying','energy','security','flower-drying'
));
-- Uses the existing transactional purchase, equip and level-up RPCs.
-- Distinct from 'drying', which remains the hash freeze-dryer slot.
INSERT INTO public.kq_equipment_catalog(code,category,slot,price_cents,is_purchasable,is_active,sort_order,metadata)
VALUES ('DRYING-ROOM','infrastructure','flower-drying',60000,TRUE,TRUE,35,
  '{"name":"Pièce séchoir","game_power_watts":75,"quality_max_bonus":1,"regularity_percent":2}'::JSONB)
ON CONFLICT(code) DO UPDATE SET category=EXCLUDED.category,slot=EXCLUDED.slot,price_cents=EXCLUDED.price_cents,
  is_purchasable=TRUE,is_active=TRUE,sort_order=EXCLUDED.sort_order,metadata=EXCLUDED.metadata,updated_at=now();
COMMIT;
