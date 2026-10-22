import type { KqCommerceSnapshot } from './kanab-quest-commerce';
import { estimateKqMerchOffer, KQ_MERCH_MODULES, KQ_MERCH_PRODUCTS, type KqMerchProductCode } from './kanab-quest-merch';
import { KQ_ONLINE_SITE_TIERS } from './kanab-quest-online';

export type KqShopActivityMerchEntry = {
  code: KqMerchProductCode;
  product: typeof KQ_MERCH_PRODUCTS[number];
  quantity: number | null;
  priceCents: number | null;
  sold: number | null;
  /** Publication state is preserved when hosting is suspended. */
  status: 'active' | 'paused' | 'sold-out' | 'unknown';
  estimatedUnitsPerDay: number | null;
};
type ReceiptValues = {
  /** Prefix includes the circuit so equal database IDs cannot collide in the UI. */
  id: string;
  name: string;
  soldAt: string;
  quantity: number;
  netPayoutCents: number | null;
  revenueCents: number | null;
  feesCents: number | null;
  /** Manufacturing cost recorded on a merch receipt, already paid before sale.
   * Null for flower receipts; this is never another cash debit. */
  costCents: number | null;
  /** Recorded flower satisfaction, 0–100. Merchandise has no satisfaction score. */
  satisfaction: number | null;
};
export type KqShopActivityReceipt = ReceiptValues & (
  | { kind: 'flower'; unitLabel: 'paquets'; formatGrams: 5 | 10 | null }
  | { kind: 'merch'; unitLabel: 'articles'; formatGrams: null; code: KqMerchProductCode }
);
export type KqShopActivity = {
  flowers: {
    activeListings: number | null;
    activePackets: number | null;
    remainingPackets: number | null;
    orders: number | null;
    revenueCents: number | null;
    netRevenueCents: number | null;
  };
  merch: {
    available: boolean;
    inventory: KqShopActivityMerchEntry[] | null;
    active: KqShopActivityMerchEntry[] | null;
    paused: KqShopActivityMerchEntry[] | null;
    soldOut: KqShopActivityMerchEntry[] | null;
    remainingUnits: number | null;
    activeUnits: number | null;
    unitsSold: number | null;
    revenueCents: number | null;
    netRevenueCents: number | null;
    estimatedUnitsPerDay: number | null;
  };
  receipts: KqShopActivityReceipt[];
  /** Whether both recent-receipt streams were received and every row was readable.
   * This is not a guarantee that the server supplied the entire sales history. */
  receiptsComplete: boolean;
};

const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
const price = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 100000 ? value : null;
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const sumKnown = (values: Array<number | null> | null) => values === null || values.some(value => value === null)
  ? null : values.reduce<number>((total, value) => total + value!, 0);

/** A read-only activity view. Flower orders and merch articles deliberately stay
 * separate: merchandise never advances the flower-order upgrade requirements. */
export function getKqShopActivity(data: KqCommerceSnapshot): KqShopActivity {
  const online = data.online;
  const merch = online?.merch?.version === 1 ? online.merch : undefined;
  const flowerRows = Array.isArray(online?.listings) ? online.listings : null;
  const flowerStatusKnown = flowerRows !== null && flowerRows.every(row => row && count(row.remainingPackets) !== null
    && ['active', 'paused', 'closed', 'sold-out', 'quality-blocked', 'discarded'].includes(row.status)
    && (row.status !== 'active' || (finite(row.qualityScore) && row.qualityScore <= 10)));
  const activeFlowers = flowerStatusKnown ? flowerRows.filter(row => row.status === 'active' && row.remainingPackets > 0 && row.qualityScore >= 5.8) : null;

  const inventoryReadable = Array.isArray(merch?.inventory) && merch.inventory.every(row => row && KQ_MERCH_PRODUCTS.some(product => product.code === row.code))
    && new Set(merch.inventory.map(row => row.code)).size === merch.inventory.length;
  const inventory: KqShopActivityMerchEntry[] | null = inventoryReadable ? merch!.inventory.map(row => {
    const quantity = count(row.quantity);
    return {
      code: row.code, product: KQ_MERCH_PRODUCTS.find(product => product.code === row.code)!, quantity,
      priceCents: price(row.priceCents), sold: count(row.sold), estimatedUnitsPerDay: null,
      status: quantity === 0 ? 'sold-out' : quantity === null || typeof row.active !== 'boolean' ? 'unknown' : row.active ? 'active' : 'paused',
    };
  }) : null;
  const statesKnown = inventory !== null && inventory.every(entry => entry.status !== 'unknown');
  const active = statesKnown ? inventory.filter(entry => entry.status === 'active') : null;
  const paused = statesKnown ? inventory.filter(entry => entry.status === 'paused') : null;
  const soldOut = statesKnown ? inventory.filter(entry => entry.status === 'sold-out') : null;
  const studioKnown = !online?.studio || (online.studio.version === 1
    && ['clear', 'craft', 'signature'].includes(online.studio.style)
    && (['photography', 'branding', 'editorial'] as const).every(track => {
      const level = online.studio!.levels?.[track];
      return count(level) !== null && level! <= 3;
    }));
  const forecastKnown = online && typeof online.site?.active === 'boolean'
    && KQ_ONLINE_SITE_TIERS.some(tier => tier.code === online.site.tier)
    && typeof online.upgrades?.branding === 'boolean' && typeof online.upgrades?.photography === 'boolean'
    && finite(data.reputation) && count(data.clients) !== null && count(online.followers) !== null
    && finite(online.confidence) && online.confidence <= 100 && studioKnown
    && Array.isArray(merch?.modules) && merch.modules.every(code => KQ_MERCH_MODULES.some(module => module.code === code));
  for (const entry of inventory ?? []) {
    if (entry.status === 'paused' || entry.status === 'sold-out' || online?.site?.active === false) entry.estimatedUnitsPerDay = 0;
    else if (entry.status === 'active' && active && forecastKnown && entry.priceCents !== null) {
      entry.estimatedUnitsPerDay = estimateKqMerchOffer({ online, code: entry.code, priceCents: entry.priceCents,
        reputation: data.reputation, clients: data.clients, activeProductCount: active.length }).unitsPerDay;
    }
  }

  const receipts: KqShopActivityReceipt[] = [];
  const ids = new Set<string>();
  let receiptsComplete = Array.isArray(online?.recentSales) && Array.isArray(merch?.recentSales);
  const validReceipt = (sale: unknown): sale is Record<string, unknown> => record(sale)
    && typeof sale.id === 'string' && sale.id.length > 0 && typeof sale.soldAt === 'string' && Number.isFinite(Date.parse(sale.soldAt));
  const addReceipt = (receipt: KqShopActivityReceipt) => {
    if (ids.has(receipt.id)) { receiptsComplete = false; return; }
    if (receipt.netPayoutCents === null || receipt.revenueCents === null || receipt.feesCents === null
      || (receipt.kind === 'flower' && (receipt.formatGrams === null || receipt.satisfaction === null))
      || (receipt.kind === 'merch' && receipt.costCents === null)) receiptsComplete = false;
    ids.add(receipt.id);
    receipts.push(receipt);
  };
  for (const sale of Array.isArray(online?.recentSales) ? online.recentSales : []) {
    if (!validReceipt(sale) || !sale.name || typeof sale.name !== 'string' || count(sale.packets) === null || sale.packets <= 0) { receiptsComplete = false; continue; }
    addReceipt({ kind: 'flower', id: `flower:${sale.id}`, name: sale.name, soldAt: sale.soldAt, quantity: sale.packets,
      unitLabel: 'paquets', formatGrams: sale.formatGrams === 5 || sale.formatGrams === 10 ? sale.formatGrams : null,
      netPayoutCents: count(sale.netPayoutCents), revenueCents: count(sale.payoutCents), feesCents: count(sale.feesCents), costCents: null,
      satisfaction: finite(sale.satisfaction) && sale.satisfaction <= 100 ? sale.satisfaction : null });
  }
  for (const sale of Array.isArray(merch?.recentSales) ? merch.recentSales : []) {
    const product = KQ_MERCH_PRODUCTS.find(product => product.code === sale?.code);
    if (!validReceipt(sale) || !product || count(sale.quantity) === null || sale.quantity <= 0) { receiptsComplete = false; continue; }
    const unitPrice = price(sale.priceCents);
    addReceipt({ kind: 'merch', id: `merch:${sale.id}`, name: product.name, code: product.code, soldAt: sale.soldAt,
      quantity: sale.quantity, unitLabel: 'articles', formatGrams: null, netPayoutCents: count(sale.netPayoutCents),
      revenueCents: unitPrice === null ? null : count(unitPrice * sale.quantity), feesCents: count(sale.feesCents),
      costCents: count(sale.costCents), satisfaction: null });
  }
  receipts.sort((left, right) => Date.parse(right.soldAt) - Date.parse(left.soldAt) || left.id.localeCompare(right.id));

  return {
    flowers: {
      activeListings: activeFlowers?.length ?? null,
      activePackets: sumKnown(activeFlowers?.map(row => count(row.remainingPackets)) ?? null),
      remainingPackets: sumKnown(flowerRows?.map(row => count(row?.remainingPackets)) ?? null),
      orders: count(online?.stats?.orders), revenueCents: count(online?.stats?.revenueCents), netRevenueCents: count(online?.stats?.netRevenueCents),
    },
    merch: {
      available: merch !== undefined, inventory, active, paused, soldOut,
      remainingUnits: sumKnown(inventory?.map(entry => entry.quantity) ?? null),
      activeUnits: sumKnown(active?.map(entry => entry.quantity) ?? null),
      unitsSold: count(merch?.stats?.unitsSold), revenueCents: count(merch?.stats?.revenueCents), netRevenueCents: count(merch?.stats?.netRevenueCents),
      estimatedUnitsPerDay: sumKnown(active?.map(entry => entry.estimatedUnitsPerDay) ?? null),
    },
    receipts, receiptsComplete,
  };
}
