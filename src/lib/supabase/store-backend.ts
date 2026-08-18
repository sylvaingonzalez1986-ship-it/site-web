import "server-only";

import { defaultStore } from "@/data/default-store";
import {
  PRODUCT_CULTURE_TYPES,
  isProductCultureModeEligible,
  type Product,
  type ProductCultureType,
  type VatRate,
} from "@/data/products";
import { mergeOwnProducer } from "@/lib/own-producer";
import { normalizeProducerImagePath } from "@/lib/producer-image-storage";
import { normalizeProductAnalysisPath, normalizeProductVideoPath } from "@/lib/product-media-paths";
import { normalizeProductImagePath } from "@/lib/product-image-storage";
import { normalizeExternalUrl } from "@/lib/external-url";
import { PRODUCT_IMAGE_MAX_COUNT } from "@/lib/product-image-policy";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { deleteContestEntry } from "@/lib/supabase/contest-backend";
import { sanitizeOrderVatRate } from "@/lib/tax";
import { sanitizeDisplayText, sanitizeNestedText } from "@/lib/text-encoding-repair";
import {
  PRODUCER_CULTURE_TYPES,
  type BlogPost,
  type CmsStore,
  type OrderItem,
  type OrderStatus,
  type PageSections,
  type Producer,
  type ProducerCultureType,
  type PublicStoreResponse,
  type SiteContent,
} from "@/types/store";

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
const validProducerCultureTypes = new Set<ProducerCultureType>(PRODUCER_CULTURE_TYPES);
const validProductCultureTypes = new Set<ProductCultureType>(PRODUCT_CULTURE_TYPES);
const SELECT_PRODUCERS_COLUMNS = [
  "id",
  "name",
  "description",
  "image",
  "location",
  "department",
  "region",
  "website",
  "instagram",
  "facebook",
  "tiktok",
  "culture_type",
  "climate",
  "soil",
  "altitude",
  "certifications",
  "speciality",
  "philosophy",
  "experience",
  "founded",
].join(",");

const PRODUCT_COLUMNS = [
  "id",
  "created_at",
  "updated_at",
  "name",
  "category",
  "culture_type",
  "price",
  "vat_rate",
  "original_price",
  "promo_percent",
  "is_pack",
  "weight_grams",
  "video_url",
  "image",
  "images",
  "producer_id",
  "analysis_pdf",
  "description",
  "badge",
  "featured_in_popup",
  "bonus_points",
  "track_stock",
  "stock_quantity",
  "variant_label",
  "variant_options",
];
const SELECT_PRODUCTS_COLUMNS = PRODUCT_COLUMNS.join(",");
const SELECT_PRODUCTS_WITHOUT_UPDATED_AT = PRODUCT_COLUMNS
  .filter((column) => column !== "updated_at")
  .join(",");

const SELECT_BLOG_COLUMNS = [
  "id",
  "title",
  "slug",
  "excerpt",
  "content",
  "cover_image",
  "category",
  "published",
  "created_at",
  "updated_at",
].join(",");

const SELECT_SITE_CONTENT_COLUMNS = [
  "id",
  "home",
  "boutique",
  "application",
  "blog",
  "profile",
  "footer",
  "updated_at",
].join(",");

const SELECT_PAGE_SECTIONS_COLUMNS = [
  "id",
  "home",
  "boutique",
  "application",
  "blog",
].join(",");

const SELECT_ORDERS_COLUMNS = [
  "id",
  "created_at",
  "status",
  "payment_state",
  "archived_at",
  "archived_reason",
  "viva_order_code",
  "viva_transaction_id",
  "customer_id",
  "legacy_customer_id",
  "customer_email",
  "customer_name",
  "shipping_address",
  "shipping_city",
  "shipping_postal_code",
  "shipping_country",
  "shipping_phone",
  "delivery_method",
  "delivery_fee",
  "relay_id",
  "relay_name",
  "relay_address",
  "relay_postal_code",
  "relay_city",
  "relay_country",
  "tracking_number",
  "promo_code",
  "discount_percent",
  "discount_amount",
  "items_count",
  "total_ht",
  "total_vat",
  "vat_breakdown",
  "total_amount",
].join(",");

const SELECT_ORDER_ITEMS_COLUMNS = [
  "order_id",
  "product_id",
  "name",
  "unit_price",
  "unit_price_ht",
  "quantity",
  "line_total",
  "line_total_ht",
  "line_vat_amount",
  "vat_rate",
  "bonus_points",
  "parent_pack_id",
  "parent_pack_name",
].join(",");

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
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

function isMissingProductFreshnessColumn(
  error: { code?: string; message: string } | null,
): boolean {
  return Boolean(
    error &&
      (error.code === "42703" || error.message.toLowerCase().includes("does not exist")) &&
      error.message.includes("updated_at"),
  );
}

async function selectProductRows(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
) {
  const result = await supabase
    .from("products")
    .select(SELECT_PRODUCTS_COLUMNS)
    .order("position", { ascending: true });

  if (!isMissingProductFreshnessColumn(result.error)) {
    return result;
  }

  // Keeps deployments available while the additive migration is applied.
  // The sitemap uses created_at until updated_at becomes available.
  return supabase
    .from("products")
    .select(SELECT_PRODUCTS_WITHOUT_UPDATED_AT)
    .order("position", { ascending: true });
}

function toOptionalIsoString(value: unknown): string | undefined {
  const text = toStringValue(value);
  if (!text) {
    return undefined;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function sanitizeProducerCultureTypes(value: unknown): ProducerCultureType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: ProducerCultureType[] = [];
  const seen = new Set<ProducerCultureType>();

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const candidate = item.trim().toLowerCase() as ProducerCultureType;
    if (!validProducerCultureTypes.has(candidate) || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

function sanitizeProductCultureType(value: unknown): ProductCultureType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const candidate = value.trim().toLowerCase() as ProductCultureType;
  return validProductCultureTypes.has(candidate) ? candidate : undefined;
}

function sanitizeProducerCertifications(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const certification = sanitizeDisplayText(item, "").trim();
    const key = certification.toLowerCase();
    if (!certification || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(certification);
  }

  return normalized;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function toNonNegativeIntegerOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return Math.floor(parsed);
}

function sanitizeVariantOptions(
  value: unknown,
): Product["variantOptions"] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const mapped = value
    .map((rawOption, index) => {
      const option = toObject(rawOption);
      const id = toOptionalString(option.id) ?? `variant-${index + 1}`;
      const label = sanitizeDisplayText(option.label, "").trim() || `Option ${index + 1}`;
      const price = toNonNegativeMoney(option.price);
      const enabled = toBoolean(option.enabled, true);
      const inStock = toBoolean(option.inStock, true);
      const stockQuantity = toNonNegativeIntegerOrUndefined(option.stockQuantity);

      return {
        id,
        label,
        price,
        enabled,
        inStock,
        stockQuantity,
      };
    })
    .filter((option) => option.id.trim().length > 0);

  return mapped.length > 0 ? mapped : undefined;
}

function normalizeProductImagesForPersistence(product: Pick<Product, "image" | "images">): string[] {
  const normalized: string[] = [];
  const candidates = [
    ...(Array.isArray(product.images) ? product.images : []),
    product.image,
  ];

  for (const candidate of candidates) {
    const safePath = normalizeProductImagePath(candidate);
    if (normalized.includes(safePath)) {
      continue;
    }

    normalized.push(safePath);
    if (normalized.length >= PRODUCT_IMAGE_MAX_COUNT) {
      break;
    }
  }

  if (normalized.length === 0) {
    normalized.push(normalizeProductImagePath(undefined));
  }

  return normalized;
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

function isPrintfulProductRecord(input: { id?: unknown; source?: unknown }): boolean {
  const id = toStringValue(input.id);
  if (id.startsWith("printful-p-")) {
    return true;
  }

  const source = toStringValue(input.source).trim().toLowerCase();
  return source === "printful";
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
    website: normalizeExternalUrl(toStringValue(row.website)),
    socialLinks: {
      instagram: normalizeExternalUrl(toStringValue(row.instagram)),
      facebook: normalizeExternalUrl(toStringValue(row.facebook)),
      tiktok: normalizeExternalUrl(toStringValue(row.tiktok)),
    },
    cultureType: sanitizeProducerCultureTypes(row.culture_type),
    climate: sanitizeDisplayText(row.climate),
    soil: sanitizeDisplayText(row.soil),
    altitude: sanitizeDisplayText(row.altitude),
    certifications: sanitizeProducerCertifications(row.certifications),
    speciality: sanitizeDisplayText(row.speciality),
    philosophy: sanitizeDisplayText(row.philosophy),
    experience: sanitizeDisplayText(row.experience),
    founded: sanitizeDisplayText(row.founded),
  };
}

function sanitizeProducerContent(value: unknown): Producer {
  const producer = mergeOwnProducer(value);
  const region = sanitizeDisplayText(producer.region);
  const department = sanitizeDisplayText(producer.department);
  const location =
    sanitizeDisplayText(producer.location) ||
    [department, region].filter(Boolean).join(", ") ||
    "France";

  return {
    id: toStringValue(producer.id) || producer.id,
    name: sanitizeDisplayText(producer.name, "Producteur sans nom"),
    description: sanitizeDisplayText(producer.description),
    image: normalizeProducerImagePath(toStringValue(producer.image)),
    location,
    department,
    region,
    website: normalizeExternalUrl(toStringValue(producer.website)),
    socialLinks: {
      instagram: normalizeExternalUrl(toStringValue(producer.socialLinks?.instagram)),
      facebook: normalizeExternalUrl(toStringValue(producer.socialLinks?.facebook)),
      tiktok: normalizeExternalUrl(toStringValue(producer.socialLinks?.tiktok)),
    },
    cultureType: sanitizeProducerCultureTypes(producer.cultureType),
    climate: sanitizeDisplayText(producer.climate),
    soil: sanitizeDisplayText(producer.soil),
    altitude: sanitizeDisplayText(producer.altitude),
    certifications: sanitizeProducerCertifications(producer.certifications),
    speciality: sanitizeDisplayText(producer.speciality),
    philosophy: sanitizeDisplayText(producer.philosophy),
    experience: sanitizeDisplayText(producer.experience),
    founded: sanitizeDisplayText(producer.founded),
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
    bonusPoints: toNonNegativeIntegerOrUndefined(row.bonus_points),
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
    archivedAt: toOptionalString(row.archived_at),
    archivedReason: toOptionalString(row.archived_reason),
    vivaOrderCode:
      typeof row.viva_order_code === "string" && /^\d{1,32}$/.test(row.viva_order_code)
        ? row.viva_order_code
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
    deliveryMethod:
      toStringValue(row.delivery_method).toLowerCase() === "relay" ? "relay" : "home",
    deliveryFee: Number.isFinite(Number(row.delivery_fee))
      ? Number(Number(row.delivery_fee).toFixed(2))
      : undefined,
    relayId: toOptionalString(row.relay_id),
    relayName: toOptionalString(row.relay_name),
    relayAddress: toOptionalString(row.relay_address),
    relayPostalCode: toOptionalString(row.relay_postal_code),
    relayCity: toOptionalString(row.relay_city),
    relayCountry: toOptionalString(row.relay_country),
    trackingNumber: toOptionalString(row.tracking_number),
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
  const category = (toStringValue(row.category) as Product["category"]) || "fleurs";
  const images = toStringArray(row.images);
  const fallbackImage = toStringValue(row.image);
  const normalizedImages = images.length > 0
    ? images
    : fallbackImage
      ? [fallbackImage]
      : [defaultStore.products[0]?.image ?? ""];

  const packProductIds = isPack ? (packProductIdsByPackId.get(id) ?? []) : undefined;
  const stockQuantity = toNonNegativeIntegerOrUndefined(row.stock_quantity);
  const weightGrams = toNonNegativeIntegerOrUndefined(row.weight_grams);
  const videoUrl = normalizeProductVideoPath(toOptionalString(row.video_url) ?? "");
  const variantLabel = toOptionalString(sanitizeDisplayText(row.variant_label));
  const variantOptions = sanitizeVariantOptions(row.variant_options);
  const cultureMode = isProductCultureModeEligible(category)
    ? sanitizeProductCultureType(row.culture_type)
    : undefined;

  return {
    id,
    createdAt: toOptionalIsoString(row.created_at),
    updatedAt: toOptionalIsoString(row.updated_at),
    name: sanitizeDisplayText(row.name, "Produit sans nom"),
    category,
    cultureMode,
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
    weightGrams,
    videoUrl: videoUrl ?? undefined,
    image: normalizedImages[0] ?? "",
    images: normalizedImages,
    producerId: toOptionalString(row.producer_id),
    analysisPdf: normalizeProductAnalysisPath(toOptionalString(row.analysis_pdf)),
    description: sanitizeDisplayText(row.description),
    badge: toOptionalString(sanitizeDisplayText(row.badge)),
    featuredInPopup: toBoolean(row.featured_in_popup, false),
    bonusPoints: toNonNegativeIntegerOrUndefined(row.bonus_points),
    trackStock: toBoolean(row.track_stock, false),
    stockQuantity,
    variantLabel,
    variantOptions,
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
  const safeLogistics = sanitizeNestedText(
    (row.logistics as Partial<SiteContent["logistics"]> | undefined) ?? {},
  );
  const safeProfile = sanitizeNestedText(
    (row.profile as Partial<SiteContent["profile"]> | undefined) ?? {},
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
      ownProducerLabel:
        typeof safeBoutique.ownProducerLabel === "string" &&
        safeBoutique.ownProducerLabel.trim().length > 0
          ? safeBoutique.ownProducerLabel.trim()
          : defaultStore.content.boutique.ownProducerLabel,
      ownProducer: sanitizeProducerContent(safeBoutique.ownProducer),
    },
    application: {
      ...defaultStore.content.application,
      ...safeApplication,
    },
    blog: {
      ...defaultStore.content.blog,
      ...safeBlog,
    },
    logistics: {
      ...defaultStore.content.logistics,
      ...safeLogistics,
    },
    profile: {
      ...defaultStore.content.profile,
      ...safeProfile,
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
    supabase
      .from("producers")
      .select(SELECT_PRODUCERS_COLUMNS)
      .order("position", { ascending: true }),
    selectProductRows(supabase),
    supabase.from("pack_components").select("pack_id,product_id"),
    supabase
      .from("blog_posts")
      .select(SELECT_BLOG_COLUMNS)
      .order("created_at", { ascending: false }),
    supabase
      .from("site_content")
      .select(SELECT_SITE_CONTENT_COLUMNS)
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("page_sections")
      .select(SELECT_PAGE_SECTIONS_COLUMNS)
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("orders")
      .select(SELECT_ORDERS_COLUMNS)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
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

  if (orderIds.length > 0) {
    const reviewResult = await supabase
      .from("orders")
      .select("id,payment_review_required,payment_review_reason")
      .in("id", orderIds);

    if (!reviewResult.error) {
      const reviewByOrderId = new Map(
        (reviewResult.data ?? []).map((row) => {
          const review = toObject(row);
          return [toStringValue(review.id), review] as const;
        }),
      );
      for (const orderRow of orderRows) {
        const review = reviewByOrderId.get(toStringValue(orderRow.id));
        if (review) {
          orderRow.payment_review_required = review.payment_review_required;
          orderRow.payment_review_reason = review.payment_review_reason;
        }
      }
    } else if (
      reviewResult.error.code !== "42703" &&
      reviewResult.error.code !== "PGRST204" &&
      !reviewResult.error.message.includes("payment_review_required")
    ) {
      failIfError(reviewResult.error, "read order payment reviews");
    }
  }

  let orderItemsByOrderId = new Map<string, OrderItem[]>();
  if (orderIds.length > 0) {
    const itemsResult = await supabase
      .from("order_items")
      .select(SELECT_ORDER_ITEMS_COLUMNS)
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
  const siteContentRow = siteContentResult.data ? toObject(siteContentResult.data) : null;
  const content = mergeContent(siteContentRow);
  const sections = mergeSections(sectionsResult.data ? toObject(sectionsResult.data) : null);
  const updatedAt = siteContentRow?.updated_at
    ? toIsoString(siteContentRow.updated_at)
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
    website: normalizeExternalUrl(producer.website),
    instagram: normalizeExternalUrl(producer.socialLinks?.instagram),
    facebook: normalizeExternalUrl(producer.socialLinks?.facebook),
    tiktok: normalizeExternalUrl(producer.socialLinks?.tiktok),
    culture_type: sanitizeProducerCultureTypes(producer.cultureType),
    climate: sanitizeDisplayText(producer.climate),
    soil: sanitizeDisplayText(producer.soil),
    altitude: sanitizeDisplayText(producer.altitude),
    certifications: sanitizeProducerCertifications(producer.certifications),
    speciality: sanitizeDisplayText(producer.speciality),
    philosophy: sanitizeDisplayText(producer.philosophy),
    experience: sanitizeDisplayText(producer.experience),
    founded: sanitizeDisplayText(producer.founded),
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

  const editableProducts = nextStore.products.filter(
    (product) =>
      !isPrintfulProductRecord(product as Product & { source?: unknown }),
  );

  const productRows = editableProducts.map((product, index) => {
    const normalizedImages = normalizeProductImagesForPersistence(product);
    const category = product.category;
    const safePrice = toNonNegativeMoney(product.price);
    const safeOriginalPrice = toPositiveMoneyOrNull(product.originalPrice);
    const safePromoPercent = toPromoPercentOrNull(product.promoPercent);
    const hasConsistentPromo =
      safeOriginalPrice !== null &&
      safePromoPercent !== null &&
      safeOriginalPrice > safePrice;

    const stockQuantity =
      product.trackStock === true
        ? toNonNegativeIntegerOrUndefined(product.stockQuantity) ?? 0
        : null;
    const variantOptions = Array.isArray(product.variantOptions)
      ? product.variantOptions.map((option, optionIndex) => ({
          id: toOptionalString(option.id) ?? `variant-${optionIndex + 1}`,
          label: sanitizeDisplayText(option.label, "").trim() || `Option ${optionIndex + 1}`,
          price: toNonNegativeMoney(option.price),
          enabled: option.enabled !== false,
          inStock: option.inStock !== false,
          stockQuantity:
            toNonNegativeIntegerOrUndefined(option.stockQuantity) ?? null,
        }))
      : null;
    const cultureMode = isProductCultureModeEligible(category)
      ? sanitizeProductCultureType(product.cultureMode)
      : undefined;

    return {
      id: product.id,
      name: sanitizeDisplayText(product.name),
      category,
      culture_type: cultureMode ?? null,
      price: safePrice,
      vat_rate: product.vatRate ?? 20,
      original_price: hasConsistentPromo ? safeOriginalPrice : null,
      promo_percent: hasConsistentPromo ? safePromoPercent : null,
      is_pack: product.isPack === true,
      weight_grams: toNonNegativeIntegerOrUndefined(product.weightGrams) ?? null,
      video_url: normalizeProductVideoPath(product.videoUrl) ?? null,
      image: normalizedImages[0],
      images: normalizedImages,
      producer_id:
        product.producerId && validProducerIds.has(product.producerId)
          ? product.producerId
          : null,
      analysis_pdf: normalizeProductAnalysisPath(product.analysisPdf) ?? null,
      description: sanitizeDisplayText(product.description),
      badge: toOptionalString(sanitizeDisplayText(product.badge ?? "")) ?? null,
      featured_in_popup: product.featuredInPopup === true,
      bonus_points: toNonNegativeIntegerOrUndefined(product.bonusPoints) ?? null,
      track_stock: product.trackStock === true,
      stock_quantity: stockQuantity,
      variant_label: toOptionalString(sanitizeDisplayText(product.variantLabel ?? "")) ?? null,
      variant_options: variantOptions,
      position: index,
    };
  });

  if (productRows.length > 0) {
    const upsertProducts = await supabase
      .from("products")
      .upsert(productRows, { onConflict: "id" });
    failIfError(upsertProducts.error, "upsert products");
  }

  const existingProductsResult = await supabase.from("products").select("id,source");
  failIfError(existingProductsResult.error, "select existing products");
  const nextProductIds = new Set(editableProducts.map((product) => product.id));
  const productIdsToDelete = (existingProductsResult.data ?? [])
    .map((row) => row as Record<string, unknown>)
    .filter((row) => {
      if (isPrintfulProductRecord({ id: row.id, source: row.source })) {
        return false;
      }

      const id = toStringValue(row.id);
      return Boolean(id) && !nextProductIds.has(id);
    })
    .map((row) => toStringValue(row.id));

  if (productIdsToDelete.length > 0) {
    const linkedEntriesResult = await supabase
      .from("contest_entries")
      .select("id")
      .in("product_id", productIdsToDelete);
    failIfError(linkedEntriesResult.error, "select contest entries for removed products");

    const linkedEntryIds = (linkedEntriesResult.data ?? [])
      .map((row) => toStringValue((row as Record<string, unknown>).id))
      .filter(Boolean);
    for (const entryId of linkedEntryIds) {
      await deleteContestEntry(entryId);
    }

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
    home: sanitizeNestedText(nextStore.content.home),
    boutique: sanitizeNestedText(nextStore.content.boutique),
    application: sanitizeNestedText(nextStore.content.application),
    blog: sanitizeNestedText(nextStore.content.blog),
    profile: sanitizeNestedText(nextStore.content.profile),
    footer: sanitizeNestedText(nextStore.content.footer),
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
  const supabase = createSupabaseServiceClient();

  const [
    producersResult,
    productsResult,
    packComponentsResult,
    blogResult,
    siteContentResult,
    sectionsResult,
  ] = await Promise.all([
    supabase
      .from("producers")
      .select(SELECT_PRODUCERS_COLUMNS)
      .order("position", { ascending: true }),
    selectProductRows(supabase),
    supabase.from("pack_components").select("pack_id,product_id"),
    supabase
      .from("blog_posts")
      .select(SELECT_BLOG_COLUMNS)
      .order("created_at", { ascending: false }),
    supabase
      .from("site_content")
      .select(SELECT_SITE_CONTENT_COLUMNS)
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("page_sections")
      .select(SELECT_PAGE_SECTIONS_COLUMNS)
      .eq("id", 1)
      .maybeSingle(),
  ]);

  failIfError(producersResult.error, "read public producers");
  failIfError(productsResult.error, "read public products");
  failIfError(packComponentsResult.error, "read public pack_components");
  failIfError(blogResult.error, "read public blog_posts");
  failIfError(siteContentResult.error, "read public site_content");
  failIfError(sectionsResult.error, "read public page_sections");

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
  const siteContentRow = siteContentResult.data ? toObject(siteContentResult.data) : null;
  const content = mergeContent(siteContentRow);
  const sections = mergeSections(sectionsResult.data ? toObject(sectionsResult.data) : null);
  const updatedAt = siteContentRow?.updated_at
    ? toIsoString(siteContentRow.updated_at)
    : new Date().toISOString();

  return {
    content,
    sections: filterVisibleSections(sections),
    products,
    blog: blog.filter((post) => post.published),
    producers,
    updatedAt,
  };
}

export async function getPublishedBlogPostsFromSupabase(): Promise<BlogPost[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("blog_posts")
    .select(SELECT_BLOG_COLUMNS)
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
    .select(SELECT_BLOG_COLUMNS)
    .eq("slug", safeSlug)
    .eq("published", true)
    .maybeSingle();

  failIfError(result.error, "read blog_post by slug");
  if (!result.data) {
    return null;
  }

  return mapBlogRow(toObject(result.data));
}


