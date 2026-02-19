import "server-only";

import { Buffer } from "node:buffer";
import { defaultStore } from "@/data/default-store";
import type { Product, VatRate } from "@/data/products";
import { normalizeProductAnalysisPath } from "@/lib/product-analysis-storage";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { sanitizeOrderVatRate } from "@/lib/tax";
import type { BlogPost, CmsStore, PublicStoreResponse } from "@/types/store";
import type { OrderItem, OrderStatus, PageSections, Producer, SiteContent } from "@/types/store";

const validOrderStatus = new Set<OrderStatus>([
  "new",
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "cancelled",
]);
const validPaymentState = new Set<CmsStore["orders"][number]["paymentState"]>([
  "pending",
  "paid",
  "failed",
  "not_configured",
]);
const MOJIBAKE_CHARS_REGEX = /[ÃÂâ�]/g;

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function repairLikelyMojibake(value: string): string {
  const originalNoise = (value.match(MOJIBAKE_CHARS_REGEX) ?? []).length;
  if (originalNoise === 0) {
    return value;
  }

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    const repairedNoise = (repaired.match(MOJIBAKE_CHARS_REGEX) ?? []).length;
    return repairedNoise < originalNoise ? repaired : value;
  } catch {
    return value;
  }
}

function sanitizeDisplayText(value: unknown, fallback = ""): string {
  const text = typeof value === "string" ? value : fallback;
  return repairLikelyMojibake(text);
}

function sanitizeNestedText<T>(value: T): T {
  if (typeof value === "string") {
    return repairLikelyMojibake(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeNestedText(item)) as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sanitizeNestedText(item),
    ]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toIsoString(value: unknown): string {
  const text = toStringValue(value);
  if (!text) {
    return new Date().toISOString();
  }

  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    return new Date().toISOString();
  }

  return new Date(parsed).toISOString();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toVatRate(value: unknown): VatRate {
  const parsed = toNumber(value, 20);
  return parsed === 5.5 ? 5.5 : 20;
}

function toNonNegativeMoney(value: unknown): number {
  const parsed = toNumber(value, 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Number(parsed.toFixed(2));
}

function toPositiveMoneyOrNull(value: unknown): number | null {
  const parsed = toNumber(value, NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Number(parsed.toFixed(2));
}

function toPromoPercentOrNull(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > 99) {
    return null;
  }
  return rounded;
}

function mapProducerRow(row: Record<string, unknown>): Producer {
  const region = sanitizeDisplayText(row.region);
  const department = sanitizeDisplayText(row.department);
  const location =
    sanitizeDisplayText(row.location) ||
    [department, region].filter(Boolean).join(", ") ||
    "France";

  return {
    id: toStringValue(row.id),
    name: sanitizeDisplayText(row.name, "Producteur sans nom"),
    description: sanitizeDisplayText(row.description),
    image: toStringValue(row.image),
    location,
    department,
    region,
    website: toStringValue(row.website),
  };
}

function mapOrderItemRow(row: Record<string, unknown>): OrderItem {
  return {
    productId: toStringValue(row.product_id) || "unknown",
    name: sanitizeDisplayText(row.name, "Produit"),
    unitPrice: Number(toNumber(row.unit_price, 0).toFixed(4)),
    unitPriceHt: Number(toNumber(row.unit_price_ht, 0).toFixed(2)),
    quantity: Math.max(1, Math.floor(toNumber(row.quantity, 1))),
    lineTotal: Number(toNumber(row.line_total, 0).toFixed(2)),
    lineTotalHt: Number(toNumber(row.line_total_ht, 0).toFixed(2)),
    lineVatAmount: Number(toNumber(row.line_vat_amount, 0).toFixed(2)),
    vatRate: sanitizeOrderVatRate(toNumber(row.vat_rate, 20)),
    parentPackId: toOptionalString(row.parent_pack_id),
    parentPackName: toOptionalString(row.parent_pack_name),
  };
}

function mapOrderRow(
  row: Record<string, unknown>,
  orderItemsByOrderId: Map<string, OrderItem[]>,
): CmsStore["orders"][number] {
  const id = toStringValue(row.id);
  const items = orderItemsByOrderId.get(id) ?? [];
  const fallbackTotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
  const statusCandidate = toStringValue(row.status);
  const paymentStateCandidate = toStringValue(row.payment_state) as CmsStore["orders"][number]["paymentState"];

  return {
    id,
    createdAt: toIsoString(row.created_at),
    status: validOrderStatus.has(statusCandidate as OrderStatus)
      ? (statusCandidate as OrderStatus)
      : "new",
    paymentProvider: "viva",
    paymentState: validPaymentState.has(paymentStateCandidate)
      ? paymentStateCandidate
      : "pending",
    vivaOrderCode: Number.isFinite(Number(row.viva_order_code))
      ? Math.floor(Number(row.viva_order_code))
      : undefined,
    vivaTransactionId: toOptionalString(row.viva_transaction_id),
    source: "web",
    customerId: toOptionalString(row.customer_id) ?? toOptionalString(row.legacy_customer_id),
    customerEmail: toOptionalString(row.customer_email),
    customerName: toOptionalString(row.customer_name),
    shippingAddress: toOptionalString(row.shipping_address),
    shippingCity: toOptionalString(row.shipping_city),
    shippingPostalCode: toOptionalString(row.shipping_postal_code),
    shippingCountry: toOptionalString(row.shipping_country),
    shippingPhone: toOptionalString(row.shipping_phone),
    promoCode: toOptionalString(row.promo_code),
    discountPercent: Number.isFinite(Number(row.discount_percent))
      ? Number(row.discount_percent)
      : undefined,
    discountAmount: Number.isFinite(Number(row.discount_amount))
      ? Number(Number(row.discount_amount).toFixed(2))
      : undefined,
    itemsCount: Number.isFinite(Number(row.items_count))
      ? Math.floor(Number(row.items_count))
      : items.reduce((acc, item) => acc + item.quantity, 0),
    totalHt: Number(toNumber(row.total_ht, 0).toFixed(2)),
    totalVat: Number(toNumber(row.total_vat, 0).toFixed(2)),
    vatBreakdown: Array.isArray(row.vat_breakdown)
      ? row.vat_breakdown
        .map((line) => toObject(line))
        .map((line) => ({
          rate: sanitizeOrderVatRate(toNumber(line.rate, 20)),
          baseHt: Number(toNumber(line.baseHt, 0).toFixed(2)),
          vatAmount: Number(toNumber(line.vatAmount, 0).toFixed(2)),
        }))
      : [],
    totalAmount: Number(toNumber(row.total_amount, fallbackTotal).toFixed(2)),
    items,
  };
}

function mapBlogRow(row: Record<string, unknown>): BlogPost {
  return {
    id: toStringValue(row.id),
    title: sanitizeDisplayText(row.title, "Article sans titre"),
    slug: toStringValue(row.slug),
    excerpt: sanitizeDisplayText(row.excerpt),
    content: sanitizeDisplayText(row.content),
    coverImage: toStringValue(row.cover_image),
    category: (toStringValue(row.category) as BlogPost["category"]) || "guide",
    published: row.published === true,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapProductRow(
  row: Record<string, unknown>,
  packProductIdsByPackId: Map<string, string[]>,
): Product {
  const id = toStringValue(row.id);
  const isPack = row.is_pack === true;
  const images = toStringArray(row.images);
  const fallbackImage = toStringValue(row.image);
  const normalizedImages = images.length > 0
    ? images
    : fallbackImage
      ? [fallbackImage]
      : [defaultStore.products[0]?.image ?? ""];

  const packProductIds = isPack ? (packProductIdsByPackId.get(id) ?? []) : undefined;

  return {
    id,
    name: sanitizeDisplayText(row.name, "Produit sans nom"),
    category: (toStringValue(row.category) as Product["category"]) || "fleurs",
    price: Number(toNumber(row.price, 0).toFixed(2)),
    vatRate: isPack ? undefined : toVatRate(row.vat_rate),
    originalPrice: Number.isFinite(Number(row.original_price))
      ? Number(Number(row.original_price).toFixed(2))
      : undefined,
    promoPercent: Number.isFinite(Number(row.promo_percent))
      ? Math.max(1, Math.min(99, Math.round(Number(row.promo_percent))))
      : undefined,
    isPack: isPack ? true : undefined,
    packProductIds: packProductIds && packProductIds.length > 0 ? packProductIds : undefined,
    image: normalizedImages[0] ?? "",
    images: normalizedImages,
    producerId: toOptionalString(row.producer_id),
    analysisPdf: normalizeProductAnalysisPath(toOptionalString(row.analysis_pdf)),
    description: sanitizeDisplayText(row.description),
    badge: toOptionalString(sanitizeDisplayText(row.badge)),
  };
}

function mergeContent(row: Record<string, unknown> | null): SiteContent {
  if (!row) {
    return defaultStore.content;
  }

  const safeHome = sanitizeNestedText(
    (row.home as Partial<SiteContent["home"]> | undefined) ?? {},
  );
  const safeBoutique = sanitizeNestedText(
    (row.boutique as Partial<SiteContent["boutique"]> | undefined) ?? {},
  );
  const safeApplication = sanitizeNestedText(
    (row.application as Partial<SiteContent["application"]> | undefined) ?? {},
  );
  const safeBlog = sanitizeNestedText(
    (row.blog as Partial<SiteContent["blog"]> | undefined) ?? {},
  );
  const safeFooter = sanitizeNestedText(
    (row.footer as Partial<SiteContent["footer"]> | undefined) ?? {},
  );

  return {
    ...defaultStore.content,
    home: {
      ...defaultStore.content.home,
      ...safeHome,
    },
    boutique: {
      ...defaultStore.content.boutique,
      ...safeBoutique,
    },
    application: {
      ...defaultStore.content.application,
      ...safeApplication,
    },
    blog: {
      ...defaultStore.content.blog,
      ...safeBlog,
    },
    footer: {
      ...defaultStore.content.footer,
      ...safeFooter,
    },
  };
}

function mergeSections(row: Record<string, unknown> | null): PageSections {
  if (!row) {
    return defaultStore.sections;
  }

  return {
    home: Array.isArray(row.home) ? (row.home as PageSections["home"]) : defaultStore.sections.home,
    boutique: Array.isArray(row.boutique)
      ? (row.boutique as PageSections["boutique"])
      : defaultStore.sections.boutique,
    application: Array.isArray(row.application)
      ? (row.application as PageSections["application"])
      : defaultStore.sections.application,
    blog: Array.isArray(row.blog) ? (row.blog as PageSections["blog"]) : defaultStore.sections.blog,
  };
}

function filterVisibleSections(sections: PageSections): PageSections {
  return {
    home: sections.home.filter((section) => section.visible),
    boutique: sections.boutique.filter((section) => section.visible),
    application: sections.application.filter((section) => section.visible),
    blog: sections.blog.filter((section) => section.visible),
  };
}

export async function readStoreFromSupabase(): Promise<CmsStore> {
  const supabase = createSupabaseServiceClient();

  const [
    producersResult,
    productsResult,
    packComponentsResult,
    blogResult,
    siteContentResult,
    sectionsResult,
    ordersResult,
  ] = await Promise.all([
    supabase.from("producers").select("*").order("position", { ascending: true }),
    supabase.from("products").select("*").order("position", { ascending: true }),
    supabase.from("pack_components").select("*"),
    supabase.from("blog_posts").select("*").order("created_at", { ascending: false }),
    supabase.from("site_content").select("*").eq("id", 1).maybeSingle(),
    supabase.from("page_sections").select("*").eq("id", 1).maybeSingle(),
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
  ]);

  failIfError(producersResult.error, "read producers");
  failIfError(productsResult.error, "read products");
  failIfError(packComponentsResult.error, "read pack_components");
  failIfError(blogResult.error, "read blog_posts");
  failIfError(siteContentResult.error, "read site_content");
  failIfError(sectionsResult.error, "read page_sections");
  failIfError(ordersResult.error, "read orders");

  const packProductIdsByPackId = new Map<string, string[]>();
  for (const rawRow of packComponentsResult.data ?? []) {
    const row = toObject(rawRow);
    const packId = toStringValue(row.pack_id);
    const productId = toStringValue(row.product_id);
    if (!packId || !productId) {
      continue;
    }

    const list = packProductIdsByPackId.get(packId) ?? [];
    if (!list.includes(productId)) {
      list.push(productId);
    }
    packProductIdsByPackId.set(packId, list);
  }

  const products = (productsResult.data ?? []).map((row) =>
    mapProductRow(toObject(row), packProductIdsByPackId),
  );

  const producers = (producersResult.data ?? []).map((row) => mapProducerRow(toObject(row)));
  const blog = (blogResult.data ?? []).map((row) => mapBlogRow(toObject(row)));

  const orderRows = (ordersResult.data ?? []).map((row) => toObject(row));
  const orderIds = orderRows
    .map((row) => toStringValue(row.id))
    .filter((id) => id.length > 0);

  let orderItemsByOrderId = new Map<string, OrderItem[]>();
  if (orderIds.length > 0) {
    const itemsResult = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds)
      .order("id", { ascending: true });

    failIfError(itemsResult.error, "read order_items");

    orderItemsByOrderId = new Map<string, OrderItem[]>();
    for (const rawRow of itemsResult.data ?? []) {
      const row = toObject(rawRow);
      const orderId = toStringValue(row.order_id);
      if (!orderId) {
        continue;
      }

      const list = orderItemsByOrderId.get(orderId) ?? [];
      list.push(mapOrderItemRow(row));
      orderItemsByOrderId.set(orderId, list);
    }
  }

  const orders = orderRows.map((row) => mapOrderRow(row, orderItemsByOrderId));
  const content = mergeContent(siteContentResult.data ? toObject(siteContentResult.data) : null);
  const sections = mergeSections(sectionsResult.data ? toObject(sectionsResult.data) : null);
  const updatedAt = siteContentResult.data?.updated_at
    ? toIsoString(siteContentResult.data.updated_at)
    : new Date().toISOString();

  return {
    ...defaultStore,
    content,
    sections,
    products,
    blog,
    producers,
    orders,
    updatedAt,
  };
}

export async function writeStoreToSupabase(nextStore: CmsStore): Promise<CmsStore> {
  const supabase = createSupabaseServiceClient();
  const validProducerIds = new Set(nextStore.producers.map((producer) => producer.id));

  const producerRows = nextStore.producers.map((producer, index) => ({
    id: producer.id,
    name: sanitizeDisplayText(producer.name),
    description: sanitizeDisplayText(producer.description),
    image: producer.image,
    location: sanitizeDisplayText(producer.location),
    department: sanitizeDisplayText(producer.department),
    region: sanitizeDisplayText(producer.region),
    website: producer.website,
    position: index,
  }));

  if (producerRows.length > 0) {
    const upsertProducers = await supabase
      .from("producers")
      .upsert(producerRows, { onConflict: "id" });
    failIfError(upsertProducers.error, "upsert producers");
  }

  const existingProducersResult = await supabase.from("producers").select("id");
  failIfError(existingProducersResult.error, "select existing producers");
  const nextProducerIds = new Set(nextStore.producers.map((producer) => producer.id));
  const producerIdsToDelete = (existingProducersResult.data ?? [])
    .map((row) => toStringValue((row as Record<string, unknown>).id))
    .filter((id) => id && !nextProducerIds.has(id));

  if (producerIdsToDelete.length > 0) {
    const deleteProducers = await supabase.from("producers").delete().in("id", producerIdsToDelete);
    failIfError(deleteProducers.error, "delete removed producers");
  }

  const productRows = nextStore.products.map((product, index) => {
    const safePrice = toNonNegativeMoney(product.price);
    const safeOriginalPrice = toPositiveMoneyOrNull(product.originalPrice);
    const safePromoPercent = toPromoPercentOrNull(product.promoPercent);
    const hasConsistentPromo =
      safeOriginalPrice !== null &&
      safePromoPercent !== null &&
      safeOriginalPrice > safePrice;

    return {
      id: product.id,
      name: sanitizeDisplayText(product.name),
      category: product.category,
      price: safePrice,
      vat_rate: product.vatRate ?? 20,
      original_price: hasConsistentPromo ? safeOriginalPrice : null,
      promo_percent: hasConsistentPromo ? safePromoPercent : null,
      is_pack: product.isPack === true,
      image: product.image,
      images: Array.isArray(product.images) ? product.images : [product.image],
      producer_id:
        product.producerId && validProducerIds.has(product.producerId)
          ? product.producerId
          : null,
      analysis_pdf: normalizeProductAnalysisPath(product.analysisPdf) ?? null,
      description: sanitizeDisplayText(product.description),
      badge: toOptionalString(sanitizeDisplayText(product.badge ?? "")) ?? null,
      position: index,
    };
  });

  if (productRows.length > 0) {
    const upsertProducts = await supabase
      .from("products")
      .upsert(productRows, { onConflict: "id" });
    failIfError(upsertProducts.error, "upsert products");
  }

  const existingProductsResult = await supabase.from("products").select("id");
  failIfError(existingProductsResult.error, "select existing products");
  const nextProductIds = new Set(nextStore.products.map((product) => product.id));
  const productIdsToDelete = (existingProductsResult.data ?? [])
    .map((row) => toStringValue((row as Record<string, unknown>).id))
    .filter((id) => id && !nextProductIds.has(id));

  if (productIdsToDelete.length > 0) {
    const deleteProducts = await supabase.from("products").delete().in("id", productIdsToDelete);
    failIfError(deleteProducts.error, "delete removed products");
  }

  const clearPackComponents = await supabase.from("pack_components").delete().neq("pack_id", "");
  failIfError(clearPackComponents.error, "clear pack_components");

  const nonPackProductIds = new Set(
    nextStore.products.filter((product) => !product.isPack).map((product) => product.id),
  );

  const packComponentRows: Array<{ pack_id: string; product_id: string; qty: number }> = [];
  const seenPackComponentKeys = new Set<string>();
  for (const product of nextStore.products) {
    if (!product.isPack || !Array.isArray(product.packProductIds)) {
      continue;
    }

    for (const componentId of product.packProductIds) {
      if (!componentId || componentId === product.id || !nonPackProductIds.has(componentId)) {
        continue;
      }

      const key = `${product.id}::${componentId}`;
      if (seenPackComponentKeys.has(key)) {
        continue;
      }
      seenPackComponentKeys.add(key);

      packComponentRows.push({
        pack_id: product.id,
        product_id: componentId,
        qty: 1,
      });
    }
  }

  if (packComponentRows.length > 0) {
    const insertPackComponents = await supabase.from("pack_components").insert(packComponentRows);
    failIfError(insertPackComponents.error, "insert pack_components");
  }

  const blogRows = nextStore.blog.map((post) => ({
    id: post.id,
    title: sanitizeDisplayText(post.title),
    slug: post.slug,
    excerpt: sanitizeDisplayText(post.excerpt),
    content: sanitizeDisplayText(post.content),
    cover_image: post.coverImage,
    category: post.category,
    published: post.published,
    created_at: post.createdAt,
    updated_at: post.updatedAt,
  }));

  if (blogRows.length > 0) {
    const upsertBlog = await supabase.from("blog_posts").upsert(blogRows, { onConflict: "id" });
    failIfError(upsertBlog.error, "upsert blog_posts");
  }

  const existingBlogResult = await supabase.from("blog_posts").select("id");
  failIfError(existingBlogResult.error, "select existing blog_posts");
  const nextBlogIds = new Set(nextStore.blog.map((post) => post.id));
  const blogIdsToDelete = (existingBlogResult.data ?? [])
    .map((row) => toStringValue((row as Record<string, unknown>).id))
    .filter((id) => id && !nextBlogIds.has(id));

  if (blogIdsToDelete.length > 0) {
    const deleteBlog = await supabase.from("blog_posts").delete().in("id", blogIdsToDelete);
    failIfError(deleteBlog.error, "delete removed blog_posts");
  }

  const contentRow = {
    id: 1,
    home: nextStore.content.home,
    boutique: nextStore.content.boutique,
    application: nextStore.content.application,
    blog: nextStore.content.blog,
    footer: nextStore.content.footer,
    updated_at: new Date().toISOString(),
  };
  const upsertContent = await supabase.from("site_content").upsert(contentRow, { onConflict: "id" });
  failIfError(upsertContent.error, "upsert site_content");

  const sectionsRow = {
    id: 1,
    home: nextStore.sections.home,
    boutique: nextStore.sections.boutique,
    application: nextStore.sections.application,
    blog: nextStore.sections.blog,
  };
  const upsertSections = await supabase.from("page_sections").upsert(sectionsRow, { onConflict: "id" });
  failIfError(upsertSections.error, "upsert page_sections");

  return readStoreFromSupabase();
}

export async function readPublicStoreFromSupabase(): Promise<PublicStoreResponse> {
  const store = await readStoreFromSupabase();
  return {
    content: store.content,
    sections: filterVisibleSections(store.sections),
    products: store.products,
    blog: store.blog.filter((post) => post.published),
    producers: store.producers,
    updatedAt: store.updatedAt,
  };
}

export async function getPublishedBlogPostsFromSupabase(): Promise<BlogPost[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("blog_posts")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  failIfError(result.error, "read published blog_posts");
  return (result.data ?? []).map((row) => mapBlogRow(toObject(row)));
}

export async function getBlogPostBySlugFromSupabase(slug: string): Promise<BlogPost | null> {
  const safeSlug = slug.trim().toLowerCase();
  if (!safeSlug) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", safeSlug)
    .eq("published", true)
    .maybeSingle();

  failIfError(result.error, "read blog_post by slug");
  if (!result.data) {
    return null;
  }

  return mapBlogRow(toObject(result.data));
}
