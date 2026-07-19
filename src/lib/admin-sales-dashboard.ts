import "server-only";

import { computeFromTtc, sanitizeOrderVatRate } from "@/lib/tax";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type {
  AdminProductSalesDashboard,
  AdminSalesPeriodSummary,
  AdminSalesProductSummary,
} from "@/types/sales-dashboard";

const DASHBOARD_TIMEZONE = "Europe/Paris" as const;
const PAID_PAYMENT_STATES = ["paid", "not_configured"] as const;
const PAGE_SIZE = 1000;
const ORDER_ITEM_ORDER_ID_CHUNK_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminSalesDashboardOrderSource = {
  id: string;
  createdAt: string;
  paymentState: string;
  status: string;
  archivedAt?: string | null;
};

export type AdminSalesDashboardOrderItemSource = {
  orderId: string;
  productId: string;
  name: string;
  quantity: number;
  lineTotal: number;
  lineTotalHt?: number | null;
  lineVatAmount?: number | null;
  vatRate?: number | null;
};

export type AdminSalesDashboardProductSource = {
  id: string;
  name: string;
  category?: string | null;
};

type ProductInfo = {
  productName: string;
  category: string | null;
  isCurrentProduct: boolean;
};

type MutableProductSummary = Omit<
  AdminSalesProductSummary,
  "ordersCount" | "revenueTtc" | "revenueHt" | "vatAmount"
> & {
  orderIds: Set<string>;
  revenueTtcCents: number;
  revenueHtCents: number;
  vatAmountCents: number;
};

type MutablePeriodSummary = Omit<
  AdminSalesPeriodSummary,
  "ordersCount" | "revenueTtc" | "revenueHt" | "vatAmount" | "products"
> & {
  orderIds: Set<string>;
  revenueTtcCents: number;
  revenueHtCents: number;
  vatAmountCents: number;
  productsById: Map<string, MutableProductSummary>;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type PeriodKey = {
  periodKey: string;
  periodLabel: string;
  startsAt: string;
  endsAt: string;
};

type OrderRow = {
  id?: unknown;
  created_at?: unknown;
  payment_state?: unknown;
  status?: unknown;
  archived_at?: unknown;
};

type OrderItemRow = {
  order_id?: unknown;
  product_id?: unknown;
  name?: unknown;
  quantity?: unknown;
  line_total?: unknown;
  line_total_ht?: unknown;
  line_vat_amount?: unknown;
  vat_rate?: unknown;
};

type ProductRow = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toOptionalText(value: unknown): string | null {
  const text = toText(value).trim();
  return text ? text : null;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

function fromCents(value: number): number {
  return Number((Math.max(0, Math.round(value)) / 100).toFixed(2));
}

function formatDateOnlyFromUtcMs(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getParisDateParts(value: string): DateParts | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(parsed));

  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(byType.get("year"));
  const month = Number(byType.get("month"));
  const day = Number(byType.get("day"));

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return { year, month, day };
}

function getDateOnly(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function getIsoWeekPeriod(parts: DateParts): PeriodKey {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const isoDay = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - isoDay);
  const isoYear = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((thursday.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  const mondayMs = date.getTime() - (isoDay - 1) * DAY_MS;
  const sundayMs = mondayMs + 6 * DAY_MS;
  const periodKey = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;

  return {
    periodKey,
    periodLabel: `Semaine ${String(isoWeek).padStart(2, "0")} ${isoYear}`,
    startsAt: formatDateOnlyFromUtcMs(mondayMs),
    endsAt: formatDateOnlyFromUtcMs(sundayMs),
  };
}

function getMonthPeriod(parts: DateParts): PeriodKey {
  const startsAt = Date.UTC(parts.year, parts.month - 1, 1);
  const endsAt = Date.UTC(parts.year, parts.month, 0);
  const periodKey = formatMonthKey(parts.year, parts.month);

  return {
    periodKey,
    periodLabel: new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(startsAt)),
    startsAt: formatDateOnlyFromUtcMs(startsAt),
    endsAt: formatDateOnlyFromUtcMs(endsAt),
  };
}

function createMutablePeriod(period: PeriodKey): MutablePeriodSummary {
  return {
    ...period,
    orderIds: new Set<string>(),
    quantitySold: 0,
    revenueTtcCents: 0,
    revenueHtCents: 0,
    vatAmountCents: 0,
    productsById: new Map<string, MutableProductSummary>(),
  };
}

function getProductInfo(
  productId: string,
  lineName: string,
  productsById: Map<string, AdminSalesDashboardProductSource>,
): ProductInfo {
  const product = productsById.get(productId);
  if (product) {
    return {
      productName: product.name.trim() || lineName || productId,
      category: product.category?.trim() || null,
      isCurrentProduct: true,
    };
  }

  return {
    productName: lineName || productId,
    category: null,
    isCurrentProduct: false,
  };
}

function getMutableProduct(
  period: MutablePeriodSummary,
  productId: string,
  productInfo: ProductInfo,
): MutableProductSummary {
  const existing = period.productsById.get(productId);
  if (existing) {
    if (!existing.isCurrentProduct && productInfo.productName) {
      existing.productName = productInfo.productName;
    }
    return existing;
  }

  const created: MutableProductSummary = {
    productId,
    productName: productInfo.productName,
    category: productInfo.category,
    isCurrentProduct: productInfo.isCurrentProduct,
    quantitySold: 0,
    orderIds: new Set<string>(),
    revenueTtcCents: 0,
    revenueHtCents: 0,
    vatAmountCents: 0,
    firstSoldAt: null,
    lastSoldAt: null,
  };

  period.productsById.set(productId, created);
  return created;
}

function addLineToPeriod(input: {
  period: MutablePeriodSummary;
  order: AdminSalesDashboardOrderSource;
  productId: string;
  productInfo: ProductInfo;
  quantity: number;
  revenueTtcCents: number;
  revenueHtCents: number;
  vatAmountCents: number;
}): void {
  const {
    period,
    order,
    productId,
    productInfo,
    quantity,
    revenueTtcCents,
    revenueHtCents,
    vatAmountCents,
  } = input;

  period.orderIds.add(order.id);
  period.quantitySold += quantity;
  period.revenueTtcCents += revenueTtcCents;
  period.revenueHtCents += revenueHtCents;
  period.vatAmountCents += vatAmountCents;

  const product = getMutableProduct(period, productId, productInfo);
  product.orderIds.add(order.id);
  product.quantitySold += quantity;
  product.revenueTtcCents += revenueTtcCents;
  product.revenueHtCents += revenueHtCents;
  product.vatAmountCents += vatAmountCents;

  if (!product.firstSoldAt || order.createdAt < product.firstSoldAt) {
    product.firstSoldAt = order.createdAt;
  }
  if (!product.lastSoldAt || order.createdAt > product.lastSoldAt) {
    product.lastSoldAt = order.createdAt;
  }
}

function finalizeProduct(product: MutableProductSummary): AdminSalesProductSummary {
  return {
    productId: product.productId,
    productName: product.productName,
    category: product.category,
    isCurrentProduct: product.isCurrentProduct,
    quantitySold: product.quantitySold,
    ordersCount: product.orderIds.size,
    revenueTtc: fromCents(product.revenueTtcCents),
    revenueHt: fromCents(product.revenueHtCents),
    vatAmount: fromCents(product.vatAmountCents),
    firstSoldAt: product.firstSoldAt,
    lastSoldAt: product.lastSoldAt,
  };
}

function finalizePeriod(period: MutablePeriodSummary): AdminSalesPeriodSummary {
  return {
    periodKey: period.periodKey,
    periodLabel: period.periodLabel,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    ordersCount: period.orderIds.size,
    quantitySold: period.quantitySold,
    revenueTtc: fromCents(period.revenueTtcCents),
    revenueHt: fromCents(period.revenueHtCents),
    vatAmount: fromCents(period.vatAmountCents),
    products: [...period.productsById.values()]
      .map(finalizeProduct)
      .sort((a, b) => {
        if (b.revenueTtc !== a.revenueTtc) {
          return b.revenueTtc - a.revenueTtc;
        }
        if (b.quantitySold !== a.quantitySold) {
          return b.quantitySold - a.quantitySold;
        }
        return a.productName.localeCompare(b.productName, "fr");
      }),
  };
}

function isRealizedOrder(order: AdminSalesDashboardOrderSource): boolean {
  if (!PAID_PAYMENT_STATES.includes(order.paymentState as (typeof PAID_PAYMENT_STATES)[number])) {
    return false;
  }
  if (order.status === "cancelled") {
    return false;
  }
  return !order.archivedAt;
}

function isSyntheticFreeLine(item: AdminSalesDashboardOrderItemSource): boolean {
  const productId = item.productId.trim().toLowerCase();
  const name = item.name.trim().toLowerCase();
  const lineTotal = toNumber(item.lineTotal, 0);

  return lineTotal <= 0 && (productId.startsWith("gift-reward-") || name.startsWith("lot ticket:"));
}

function resolveLineAmounts(item: AdminSalesDashboardOrderItemSource): {
  revenueTtcCents: number;
  revenueHtCents: number;
  vatAmountCents: number;
} {
  const revenueTtcCents = toCents(toNumber(item.lineTotal, 0));
  const explicitHt = toOptionalNumber(item.lineTotalHt);
  const explicitVat = toOptionalNumber(item.lineVatAmount);
  const vatRate = sanitizeOrderVatRate(item.vatRate ?? 20);
  const fallbackTax = computeFromTtc(fromCents(revenueTtcCents), vatRate);
  const revenueHtCents = explicitHt === null ? toCents(fallbackTax.ht) : toCents(explicitHt);
  const vatAmountCents = explicitVat === null
    ? Math.max(0, revenueTtcCents - revenueHtCents)
    : toCents(explicitVat);

  return {
    revenueTtcCents,
    revenueHtCents,
    vatAmountCents,
  };
}

function mapOrderRow(row: OrderRow): AdminSalesDashboardOrderSource {
  return {
    id: toText(row.id),
    createdAt: toText(row.created_at),
    paymentState: toText(row.payment_state),
    status: toText(row.status),
    archivedAt: toOptionalText(row.archived_at),
  };
}

function mapOrderItemRow(row: OrderItemRow): AdminSalesDashboardOrderItemSource {
  return {
    orderId: toText(row.order_id),
    productId: toText(row.product_id),
    name: toText(row.name),
    quantity: Math.max(0, Math.floor(toNumber(row.quantity, 0))),
    lineTotal: toNumber(row.line_total, 0),
    lineTotalHt: toOptionalNumber(row.line_total_ht),
    lineVatAmount: toOptionalNumber(row.line_vat_amount),
    vatRate: toOptionalNumber(row.vat_rate),
  };
}

function mapProductRow(row: ProductRow): AdminSalesDashboardProductSource {
  return {
    id: toText(row.id),
    name: toText(row.name),
    category: toOptionalText(row.category),
  };
}

async function fetchRealizedOrders(): Promise<AdminSalesDashboardOrderSource[]> {
  const supabase = createSupabaseServiceClient();
  const rows: AdminSalesDashboardOrderSource[] = [];
  let offset = 0;

  for (;;) {
    const result = await supabase
      .from("orders")
      .select("id,created_at,payment_state,status,archived_at")
      .in("payment_state", [...PAID_PAYMENT_STATES])
      .neq("status", "cancelled")
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (result.error) {
      throw new Error(`[supabase:admin_sales_orders] ${result.error.message}`);
    }

    const data = (result.data ?? []) as OrderRow[];
    rows.push(...data.map(mapOrderRow));

    if (data.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return rows;
}

async function fetchProducts(): Promise<AdminSalesDashboardProductSource[]> {
  const supabase = createSupabaseServiceClient();
  const rows: AdminSalesDashboardProductSource[] = [];
  let offset = 0;

  for (;;) {
    const result = await supabase
      .from("products")
      .select("id,name,category")
      .order("position", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (result.error) {
      throw new Error(`[supabase:admin_sales_products] ${result.error.message}`);
    }

    const data = (result.data ?? []) as ProductRow[];
    rows.push(...data.map(mapProductRow).filter((product) => product.id.trim().length > 0));

    if (data.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return rows;
}

async function fetchOrderItemsForOrders(
  orderIds: string[],
): Promise<AdminSalesDashboardOrderItemSource[]> {
  const supabase = createSupabaseServiceClient();
  const rows: AdminSalesDashboardOrderItemSource[] = [];

  for (let index = 0; index < orderIds.length; index += ORDER_ITEM_ORDER_ID_CHUNK_SIZE) {
    const chunk = orderIds.slice(index, index + ORDER_ITEM_ORDER_ID_CHUNK_SIZE);
    let offset = 0;

    for (;;) {
      const result = await supabase
        .from("order_items")
        .select("id,order_id,product_id,name,quantity,line_total,line_total_ht,line_vat_amount,vat_rate")
        .in("order_id", chunk)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (result.error) {
        throw new Error(`[supabase:admin_sales_order_items] ${result.error.message}`);
      }

      const data = (result.data ?? []) as OrderItemRow[];
      rows.push(...data.map(mapOrderItemRow));

      if (data.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }
  }

  return rows;
}

export function buildAdminProductSalesDashboard(input: {
  orders: AdminSalesDashboardOrderSource[];
  orderItems: AdminSalesDashboardOrderItemSource[];
  products?: AdminSalesDashboardProductSource[];
  generatedAt?: string;
}): AdminProductSalesDashboard {
  const productsById = new Map(
    (input.products ?? [])
      .filter((product) => product.id.trim().length > 0)
      .map((product) => [product.id, product]),
  );
  const ordersById = new Map(
    input.orders
      .filter((order) => order.id.trim().length > 0 && isRealizedOrder(order))
      .map((order) => [order.id, order]),
  );
  const allTime = createMutablePeriod({
    periodKey: "all",
    periodLabel: "Depuis le debut",
    startsAt: "",
    endsAt: "",
  });
  const weeksByKey = new Map<string, MutablePeriodSummary>();
  const monthsByKey = new Map<string, MutablePeriodSummary>();

  for (const item of input.orderItems) {
    const order = ordersById.get(item.orderId);
    if (!order) {
      continue;
    }

    const productId = item.productId.trim();
    const quantity = Math.max(0, Math.floor(toNumber(item.quantity, 0)));
    if (!productId || quantity <= 0 || isSyntheticFreeLine(item)) {
      continue;
    }

    const dateParts = getParisDateParts(order.createdAt);
    if (!dateParts) {
      continue;
    }

    const dateOnly = getDateOnly(dateParts);
    if (!allTime.startsAt || dateOnly < allTime.startsAt) {
      allTime.startsAt = dateOnly;
    }
    if (!allTime.endsAt || dateOnly > allTime.endsAt) {
      allTime.endsAt = dateOnly;
    }

    const productInfo = getProductInfo(productId, item.name.trim(), productsById);
    const amounts = resolveLineAmounts(item);
    const weekPeriod = getIsoWeekPeriod(dateParts);
    const monthPeriod = getMonthPeriod(dateParts);
    const week = weeksByKey.get(weekPeriod.periodKey) ?? createMutablePeriod(weekPeriod);
    const month = monthsByKey.get(monthPeriod.periodKey) ?? createMutablePeriod(monthPeriod);

    weeksByKey.set(weekPeriod.periodKey, week);
    monthsByKey.set(monthPeriod.periodKey, month);

    for (const period of [allTime, week, month]) {
      addLineToPeriod({
        period,
        order,
        productId,
        productInfo,
        quantity,
        ...amounts,
      });
    }
  }

  if (!allTime.startsAt) {
    allTime.startsAt = "";
  }
  if (!allTime.endsAt) {
    allTime.endsAt = "";
  }

  const byWeek = [...weeksByKey.values()]
    .map(finalizePeriod)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const byMonth = [...monthsByKey.values()]
    .map(finalizePeriod)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    timezone: DASHBOARD_TIMEZONE,
    includedPaymentStates: [...PAID_PAYMENT_STATES],
    allTime: finalizePeriod(allTime),
    byWeek,
    byMonth,
  };
}

export async function getAdminProductSalesDashboard(): Promise<AdminProductSalesDashboard> {
  const [orders, products] = await Promise.all([
    fetchRealizedOrders(),
    fetchProducts(),
  ]);
  const orderItems = orders.length > 0
    ? await fetchOrderItemsForOrders(orders.map((order) => order.id))
    : [];

  return buildAdminProductSalesDashboard({
    orders,
    orderItems,
    products,
  });
}
