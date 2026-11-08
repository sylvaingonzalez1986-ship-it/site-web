import { getKqCareProduct } from "./kanab-quest-care";

export type KqCarePurchase = {
  id: string;
  kind: "input" | "pbi" | "basic";
  productCode: string | null;
  quantity: number;
  amountCents: number;
  createdAt: string;
  runId: string | null;
  areaM2: number | null;
  stageIndex: number | null;
};

export type KqCarePurchasesPage = {
  items: KqCarePurchase[];
  nextCursor: string | null;
  totalPaidCents: number;
  totalCount: number;
  serverNow: string;
};


const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const amount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isKqCarePurchasesPage(value: unknown): value is KqCarePurchasesPage {
  if (!record(value) || !date(value.serverNow) || !amount(value.totalPaidCents) || !amount(value.totalCount)
    || !Array.isArray(value.items) || value.items.length > 25 || value.items.length > value.totalCount
    || !(value.nextCursor === null || typeof value.nextCursor === "string" && value.nextCursor.length > 0)) return false;
  const ids = new Set<string>();
  let paid = 0;
  for (const item of value.items) {
    if (!record(item) || typeof item.id !== "string" || !/^(purchase|basic):[0-9a-f-]{36}$/i.test(item.id) || ids.has(item.id)
      || !amount(item.quantity) || !item.quantity || !amount(item.amountCents) || !item.amountCents || !date(item.createdAt)
      || !(item.runId === null || typeof item.runId === "string" && uuid.test(item.runId))
      || !(item.areaM2 === null || amount(item.areaM2) && item.areaM2 > 0)
      || !(item.stageIndex === null || amount(item.stageIndex) && item.stageIndex <= 4)) return false;
    if (item.kind === "basic") { if (item.productCode !== null || item.quantity !== 1) return false; }
    else if (typeof item.productCode !== "string" || getKqCareProduct(item.productCode)?.kind !== item.kind) return false;
    ids.add(item.id); paid += item.amountCents;
  }
  return Number.isSafeInteger(paid) && paid <= value.totalPaidCents;
}
