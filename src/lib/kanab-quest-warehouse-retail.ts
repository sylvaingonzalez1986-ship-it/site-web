import equipment from "./kanab-quest-warehouse-retail-equipment.json";
import workshop from "./kanab-quest-workshop-retail.json";

export type KqRetailPrice = {
  model: string;
  seller: string;
  url: string;
  packPriceCents: number;
  packQuantity: number;
  packUnit: string;
  unitPriceCents: number;
  basis: string;
  components?: { model: string; seller: string; url: string; quantity: number; priceCents: number }[];
};

export const KQ_RETAIL_PRICE_CHECKED_AT = "2026-11-21";
const equipmentByCode: Readonly<Record<string, KqRetailPrice>> = equipment;
export type KqWorkshopRetailOffer = (typeof workshop)[keyof typeof workshop][number];
const workshopByCode: Readonly<Record<string, readonly KqWorkshopRetailOffer[]>> = workshop;

export function getKqWarehouseRetailPrice(code: string): KqRetailPrice | undefined {
  return Object.hasOwn(equipmentByCode, code) ? equipmentByCode[code] : undefined;
}

export function getKqWorkshopPriceList(code: string) {
  return Object.hasOwn(workshopByCode, code) ? workshopByCode[code] : undefined;
}
