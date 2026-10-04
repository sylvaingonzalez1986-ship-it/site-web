import "server-only";

import { ProducerSettlementError } from "@/lib/producer-settlements";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type { ProducerPayment, ProducerRate, ProducerSaleSource, ProducerSettlementSources } from "@/types/producer-settlements";

const PAGE_SIZE = 1000;
const PAYMENT_COLUMNS = "id,producer_id,producer_name,sales_from_month,sales_month,amount_cents,paid_on,reference,note,created_at,voided_at,void_reason";
type Row = Record<string, unknown>;
type QueryResult = { data: unknown[] | null; error: { message: string; code?: string } | null };

function fail(error: QueryResult["error"], context: string): void {
  if (!error) return;
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST205") {
    throw new ProducerSettlementError("Le suivi des producteurs nécessite la migration de la base de données.", 503);
  }
  throw new Error(`[supabase:producer_settlements_${context}] ${error.message}`);
}

function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function optionalText(value: unknown): string | null { return text(value) || null; }
function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function optionalNumber(value: unknown): number | null { return value == null ? null : number(value); }

async function pages(query: (from: number, to: number) => PromiseLike<QueryResult>, context: string): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await query(offset, offset + PAGE_SIZE - 1);
    fail(page.error, context);
    const rows = (page.data ?? []) as Row[];
    result.push(...rows);
    if (rows.length < PAGE_SIZE) return result;
  }
}

function mapRate(row: Row): ProducerRate {
  return { producerId: text(row.producer_id), productId: text(row.product_id), effectiveMonth: text(row.effective_month).slice(0, 7),
    mode: row.mode as ProducerRate["mode"], rate: number(row.rate), gramsPerUnit: optionalNumber(row.grams_per_unit) };
}

function mapPayment(row: Row): ProducerPayment {
  return { id: text(row.id), producerId: text(row.producer_id), producerName: text(row.producer_name),
    salesFromMonth: text(row.sales_from_month ?? row.sales_month).slice(0, 7), salesMonth: text(row.sales_month).slice(0, 7),
    amountCents: number(row.amount_cents), paidOn: text(row.paid_on),
    reference: text(row.reference), note: text(row.note), createdAt: text(row.created_at),
    voidedAt: optionalText(row.voided_at), voidReason: optionalText(row.void_reason) };
}

export async function getProducerSettlementSources(): Promise<ProducerSettlementSources> {
  const client = createSupabaseServiceClient();
  const [orders, producers, rates, payments] = await Promise.all([
    pages((from, to) => client.from("orders").select("id,created_at,payment_state,status,archived_at")
      .in("payment_state", ["paid", "not_configured"]).neq("status", "cancelled").is("archived_at", null)
      .order("created_at").order("id").range(from, to), "orders"),
    pages((from, to) => client.from("producers").select("id,name").order("id").range(from, to), "producers"),
    pages((from, to) => client.from("producer_settlement_rates").select("producer_id,product_id,effective_month,mode,rate,grams_per_unit")
      .order("producer_id").order("product_id").order("effective_month").range(from, to), "rates"),
    pages((from, to) => client.from("producer_settlement_payments").select(PAYMENT_COLUMNS)
      .order("created_at", { ascending: false }).order("id").range(from, to), "payments"),
  ]);
  const sales: ProducerSaleSource[] = [];
  const ordersById = new Map(orders.map(order => [text(order.id), order]));
  const orderIds = [...ordersById.keys()];
  for (let index = 0; index < orderIds.length; index += 100) {
    const ids = orderIds.slice(index, index + 100);
    const items = await pages((from, to) => client.from("order_items")
      .select("id,order_id,product_id,name,quantity,line_total,line_total_ht,vat_rate,producer_unit_weight_grams,producer_id_snapshot,producer_name_snapshot,producer_attribution")
      .in("order_id", ids).order("id").range(from, to), "items");
    for (const item of items) {
      const order = ordersById.get(text(item.order_id));
      if (!order) continue;
      sales.push({ orderId: text(order.id), createdAt: text(order.created_at), paymentState: text(order.payment_state),
        status: text(order.status), archivedAt: optionalText(order.archived_at), productId: text(item.product_id),
        productName: text(item.name), producerId: optionalText(item.producer_id_snapshot), producerName: optionalText(item.producer_name_snapshot),
        attribution: item.producer_attribution === "producer" || item.producer_attribution === "own" ? item.producer_attribution : "unknown",
        quantity: number(item.quantity), unitWeightGrams: optionalNumber(item.producer_unit_weight_grams),
        lineTotal: number(item.line_total), lineTotalHt: optionalNumber(item.line_total_ht),
        vatRate: item.vat_rate == null ? 20 : number(item.vat_rate) });
    }
  }
  return { sales, producers: producers.map(row => ({ id: text(row.id), name: text(row.name) })),
    rates: rates.map(mapRate), payments: payments.map(mapPayment) };
}

async function assertProducerExists(producerId: string): Promise<void> {
  const client = createSupabaseServiceClient();
  const producer = await client.from("producers").select("id").eq("id", producerId).maybeSingle();
  fail(producer.error, "producer_lookup");
  if (producer.data) return;
  const historical = await client.from("order_items").select("id").eq("producer_id_snapshot", producerId)
    .eq("producer_attribution", "producer").limit(1);
  fail(historical.error, "historical_producer_lookup");
  if (historical.data?.length) return;
  const paid = await client.from("producer_settlement_payments").select("id").eq("producer_id", producerId).limit(1);
  fail(paid.error, "paid_producer_lookup");
  if (paid.data?.length) return;
  throw new ProducerSettlementError("Producteur introuvable.", 404);
}

async function assertProductBelongsToProducer(input: ProducerRate): Promise<void> {
  const client = createSupabaseServiceClient();
  const [baseProductId, variantId] = input.productId.split("::", 2);
  const product = await client.from("products").select("id,producer_id,variant_options").eq("id", baseProductId).maybeSingle();
  fail(product.error, "product_lookup");
  const row = product.data as Row | null;
  if (row?.producer_id === input.producerId && (!variantId || (Array.isArray(row.variant_options)
    && row.variant_options.some((variant: { id?: unknown }) => variant.id === variantId)))) return;
  const historical = await client.from("order_items").select("id").eq("producer_id_snapshot", input.producerId)
    .eq("producer_attribution", "producer").eq("product_id", input.productId).limit(1);
  fail(historical.error, "historical_product_lookup");
  if (historical.data?.length) return;
  throw new ProducerSettlementError("Ce produit n’est pas associé à ce producteur.");
}

export async function saveProducerRate(input: ProducerRate): Promise<void> {
  await assertProductBelongsToProducer(input);
  const result = await createSupabaseServiceClient().from("producer_settlement_rates").upsert({
    producer_id: input.producerId, product_id: input.productId, effective_month: `${input.effectiveMonth}-01`,
    mode: input.mode, rate: input.rate, grams_per_unit: input.gramsPerUnit,
  }, { onConflict: "producer_id,product_id,effective_month" });
  fail(result.error, "save_rate");
}

type PaymentInput = Omit<ProducerPayment, "createdAt" | "voidedAt" | "voidReason">;

export async function recordProducerPayment(input: PaymentInput): Promise<void> {
  await assertProducerExists(input.producerId);
  const client = createSupabaseServiceClient();
  const result = await client.from("producer_settlement_payments").insert({
    id: input.id, producer_id: input.producerId, producer_name: input.producerName,
    sales_from_month: `${input.salesFromMonth || input.salesMonth}-01`, sales_month: `${input.salesMonth}-01`,
    amount_cents: input.amountCents, paid_on: input.paidOn, reference: input.reference, note: input.note,
  });
  if (result.error?.code !== "23505") { fail(result.error, "record_payment"); return; }
  const existing = await client.from("producer_settlement_payments").select(PAYMENT_COLUMNS).eq("id", input.id).maybeSingle();
  fail(existing.error, "existing_payment");
  if (existing.data) {
    const payment = mapPayment(existing.data as Row);
    const same = payment.producerId === input.producerId && payment.producerName === input.producerName
      && payment.salesFromMonth === (input.salesFromMonth || input.salesMonth)
      && payment.salesMonth === input.salesMonth && payment.amountCents === input.amountCents
      && payment.paidOn === input.paidOn && payment.reference === input.reference && payment.note === input.note;
    if (same && !payment.voidedAt) return;
    if (same) throw new ProducerSettlementError("Ce règlement a été annulé. Enregistrez un nouveau règlement si nécessaire.", 409);
  }
  throw new ProducerSettlementError("Cet identifiant de règlement a déjà été utilisé pour un autre enregistrement.", 409);
}

export async function voidProducerPayment(id: string, reason: string): Promise<void> {
  const client = createSupabaseServiceClient();
  const result = await client.from("producer_settlement_payments").update({ voided_at: new Date().toISOString(), void_reason: reason })
    .eq("id", id).is("voided_at", null).select("id");
  fail(result.error, "void_payment");
  if (result.data?.length) return;
  const existing = await client.from("producer_settlement_payments").select("voided_at,void_reason").eq("id", id).maybeSingle();
  fail(existing.error, "voided_payment_lookup");
  if (!existing.data) throw new ProducerSettlementError("Règlement introuvable.", 404);
  if (existing.data.voided_at && existing.data.void_reason === reason) return;
  throw new ProducerSettlementError("Ce règlement a déjà été annulé.", 409);
}
