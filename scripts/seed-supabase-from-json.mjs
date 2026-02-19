import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

function parseEnv(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      result[key] = value;
    }
  }
  return result;
}

async function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  try {
    const content = await fs.readFile(envPath, "utf8");
    const parsed = parseEnv(content);
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value;
    }
  } catch {
    // ignore if .env missing
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIso(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const store = await readJson(path.join(ROOT, "data", "store.json"), null);
  if (!store || typeof store !== "object") {
    throw new Error("data/store.json is missing or invalid.");
  }

  const invoicesStore = await readJson(path.join(ROOT, "data", "invoices.json"), { nextSequence: 1, issued: {} });

  const producers = Array.isArray(store.producers) ? store.producers : [];
  const products = Array.isArray(store.products) ? store.products : [];
  const blog = Array.isArray(store.blog) ? store.blog : [];
  const orders = Array.isArray(store.orders) ? store.orders : [];

  if (producers.length > 0) {
    const rows = producers.map((producer, index) => ({
      id: String(producer.id ?? ""),
      name: String(producer.name ?? ""),
      description: String(producer.description ?? ""),
      image: String(producer.image ?? ""),
      location: String(producer.location ?? ""),
      department: String(producer.department ?? ""),
      region: String(producer.region ?? ""),
      website: String(producer.website ?? ""),
      position: index,
    }));
    const result = await supabase.from("producers").upsert(rows, { onConflict: "id" });
    if (result.error) throw new Error(`upsert producers failed: ${result.error.message}`);
  }

  if (products.length > 0) {
    const rows = products.map((product, index) => ({
      id: String(product.id ?? ""),
      name: String(product.name ?? ""),
      category: String(product.category ?? "fleurs"),
      price: Number(toNumber(product.price, 0).toFixed(2)),
      vat_rate: Number(toNumber(product.vatRate, 20).toFixed(2)),
      original_price: Number.isFinite(Number(product.originalPrice)) ? Number(Number(product.originalPrice).toFixed(2)) : null,
      promo_percent: Number.isFinite(Number(product.promoPercent)) ? Math.max(1, Math.min(99, Math.round(Number(product.promoPercent)))) : null,
      is_pack: product.isPack === true,
      image: String(product.image ?? ""),
      images: Array.isArray(product.images) ? product.images.map((item) => String(item)) : [String(product.image ?? "")],
      producer_id: product.producerId ? String(product.producerId) : null,
      analysis_pdf: product.analysisPdf ? String(product.analysisPdf) : null,
      description: String(product.description ?? ""),
      badge: product.badge ? String(product.badge) : null,
      position: index,
    }));
    const result = await supabase.from("products").upsert(rows, { onConflict: "id" });
    if (result.error) throw new Error(`upsert products failed: ${result.error.message}`);
  }

  {
    const clear = await supabase.from("pack_components").delete().neq("pack_id", "");
    if (clear.error) throw new Error(`clear pack_components failed: ${clear.error.message}`);

    const nonPackIds = new Set(
      products.filter((product) => product && product.isPack !== true).map((product) => String(product.id ?? "")),
    );
    const packRows = [];
    for (const product of products) {
      if (!product || product.isPack !== true || !Array.isArray(product.packProductIds)) continue;
      for (const componentId of product.packProductIds) {
        const id = String(componentId ?? "");
        const packId = String(product.id ?? "");
        if (!id || !packId || id === packId || !nonPackIds.has(id)) continue;
        packRows.push({ pack_id: packId, product_id: id, qty: 1 });
      }
    }
    if (packRows.length > 0) {
      const insert = await supabase.from("pack_components").insert(packRows);
      if (insert.error) throw new Error(`insert pack_components failed: ${insert.error.message}`);
    }
  }

  if (blog.length > 0) {
    const rows = blog.map((post) => ({
      id: String(post.id ?? ""),
      title: String(post.title ?? ""),
      slug: String(post.slug ?? ""),
      excerpt: String(post.excerpt ?? ""),
      content: String(post.content ?? ""),
      cover_image: String(post.coverImage ?? ""),
      category: String(post.category ?? "guide"),
      published: post.published === true,
      created_at: toIso(post.createdAt),
      updated_at: toIso(post.updatedAt),
    }));
    const result = await supabase.from("blog_posts").upsert(rows, { onConflict: "id" });
    if (result.error) throw new Error(`upsert blog_posts failed: ${result.error.message}`);
  }

  {
    const content = store.content && typeof store.content === "object" ? store.content : {};
    const sections = store.sections && typeof store.sections === "object" ? store.sections : {};

    const contentUpsert = await supabase.from("site_content").upsert({
      id: 1,
      home: content.home ?? {},
      boutique: content.boutique ?? {},
      application: content.application ?? {},
      blog: content.blog ?? {},
      footer: content.footer ?? {},
      updated_at: toIso(store.updatedAt),
    }, { onConflict: "id" });
    if (contentUpsert.error) throw new Error(`upsert site_content failed: ${contentUpsert.error.message}`);

    const sectionsUpsert = await supabase.from("page_sections").upsert({
      id: 1,
      home: Array.isArray(sections.home) ? sections.home : [],
      boutique: Array.isArray(sections.boutique) ? sections.boutique : [],
      application: Array.isArray(sections.application) ? sections.application : [],
      blog: Array.isArray(sections.blog) ? sections.blog : [],
    }, { onConflict: "id" });
    if (sectionsUpsert.error) throw new Error(`upsert page_sections failed: ${sectionsUpsert.error.message}`);
  }

  if (orders.length > 0) {
    const orderRows = orders.map((order) => ({
      id: String(order.id ?? ""),
      created_at: toIso(order.createdAt),
      status: String(order.status ?? "new"),
      payment_provider: "viva",
      payment_state: String(order.paymentState ?? "pending"),
      viva_order_code: Number.isFinite(Number(order.vivaOrderCode)) ? Math.floor(Number(order.vivaOrderCode)) : null,
      viva_transaction_id: order.vivaTransactionId ? String(order.vivaTransactionId) : null,
      customer_id: null,
      legacy_customer_id: order.customerId ? String(order.customerId) : null,
      customer_email: order.customerEmail ? String(order.customerEmail) : null,
      customer_name: order.customerName ? String(order.customerName) : null,
      shipping_address: order.shippingAddress ? String(order.shippingAddress) : null,
      shipping_city: order.shippingCity ? String(order.shippingCity) : null,
      shipping_postal_code: order.shippingPostalCode ? String(order.shippingPostalCode) : null,
      shipping_country: order.shippingCountry ? String(order.shippingCountry) : null,
      shipping_phone: order.shippingPhone ? String(order.shippingPhone) : null,
      promo_code: order.promoCode ? String(order.promoCode) : null,
      discount_percent: Number.isFinite(Number(order.discountPercent)) ? Number(order.discountPercent) : null,
      discount_amount: Number.isFinite(Number(order.discountAmount)) ? Number(order.discountAmount) : null,
      items_count: Number.isFinite(Number(order.itemsCount)) ? Number(order.itemsCount) : 0,
      total_ht: Number.isFinite(Number(order.totalHt)) ? Number(order.totalHt) : null,
      total_vat: Number.isFinite(Number(order.totalVat)) ? Number(order.totalVat) : null,
      vat_breakdown: Array.isArray(order.vatBreakdown) ? order.vatBreakdown : [],
      total_amount: Number(toNumber(order.totalAmount, 0).toFixed(2)),
    }));
    const upsertOrders = await supabase.from("orders").upsert(orderRows, { onConflict: "id" });
    if (upsertOrders.error) throw new Error(`upsert orders failed: ${upsertOrders.error.message}`);

    const orderIds = orderRows.map((row) => row.id);
    if (orderIds.length > 0) {
      const clearItems = await supabase.from("order_items").delete().in("order_id", orderIds);
      if (clearItems.error) throw new Error(`clear order_items failed: ${clearItems.error.message}`);
    }

    const itemRows = [];
    for (const order of orders) {
      const orderId = String(order.id ?? "");
      for (const item of Array.isArray(order.items) ? order.items : []) {
        itemRows.push({
          order_id: orderId,
          product_id: String(item.productId ?? ""),
          name: String(item.name ?? ""),
          unit_price: Number(toNumber(item.unitPrice, 0).toFixed(4)),
          unit_price_ht: Number.isFinite(Number(item.unitPriceHt)) ? Number(item.unitPriceHt) : null,
          quantity: Math.max(1, Math.floor(toNumber(item.quantity, 1))),
          line_total: Number(toNumber(item.lineTotal, 0).toFixed(2)),
          line_total_ht: Number.isFinite(Number(item.lineTotalHt)) ? Number(item.lineTotalHt) : null,
          line_vat_amount: Number.isFinite(Number(item.lineVatAmount)) ? Number(item.lineVatAmount) : null,
          vat_rate: Number(toNumber(item.vatRate, 20).toFixed(2)),
          parent_pack_id: item.parentPackId ? String(item.parentPackId) : null,
          parent_pack_name: item.parentPackName ? String(item.parentPackName) : null,
        });
      }
    }

    if (itemRows.length > 0) {
      const insertItems = await supabase.from("order_items").insert(itemRows);
      if (insertItems.error) throw new Error(`insert order_items failed: ${insertItems.error.message}`);
    }
  }

  {
    const issued = invoicesStore && invoicesStore.issued && typeof invoicesStore.issued === "object"
      ? invoicesStore.issued
      : {};
    const rows = Object.values(issued)
      .filter((invoice) => invoice && typeof invoice === "object")
      .map((invoice) => ({
        order_id: String(invoice.orderId ?? ""),
        invoice_number: String(invoice.invoiceNumber ?? ""),
        sequence: Math.max(1, Math.floor(toNumber(invoice.sequence, 1))),
        year: Number(new Date(toIso(invoice.issuedAt)).getUTCFullYear()),
        issued_at: toIso(invoice.issuedAt),
      }))
      .filter((invoice) => invoice.order_id && invoice.invoice_number);

    if (rows.length > 0) {
      const upsertInvoices = await supabase
        .from("invoices")
        .upsert(rows, { onConflict: "order_id" });
      if (upsertInvoices.error) throw new Error(`upsert invoices failed: ${upsertInvoices.error.message}`);
    }

    const currentYear = new Date().getUTCFullYear();
    const nextSequence = Math.max(1, Math.floor(toNumber(invoicesStore?.nextSequence, 1)));
    const upsertCounter = await supabase
      .from("invoice_counter")
      .upsert({ year: currentYear, next_sequence: nextSequence }, { onConflict: "year" });
    if (upsertCounter.error) throw new Error(`upsert invoice_counter failed: ${upsertCounter.error.message}`);
  }

  console.log("Supabase seed completed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
