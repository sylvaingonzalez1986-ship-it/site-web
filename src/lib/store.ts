import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { VAT_RATE_OPTIONS, categoryLabels, type Product, type VatRate } from "@/data/products";
import { NATIVE_SECTION_DEFINITIONS, createDefaultPageSections } from "@/data/sections";
import { defaultStore } from "@/data/default-store";
import { normalizeBlogImagePath } from "@/lib/blog-image-storage";
import { INVOICE_SETTINGS } from "@/lib/invoice-config";
import { normalizeProductAnalysisPath } from "@/lib/product-analysis-storage";
import { normalizeProductImagePath } from "@/lib/product-image-storage";
import { normalizeProducerImagePath } from "@/lib/producer-image-storage";
import { PRODUCT_IMAGE_MAX_COUNT } from "@/lib/product-image-policy";
import { computeFromTtc, computeOrderTaxTotals, sanitizeOrderVatRate } from "@/lib/tax";
import {
  SECTION_STYLE_OPTIONS,
  BLOG_CATEGORY_OPTIONS,
  ORDER_STATUS_OPTIONS,
  PRODUCER_CULTURE_TYPES,
  type ApplicationSection,
  type BlogCategory,
  type BlogPageSection,
  type BlogPost,
  type BoutiqueSection,
  type CmsOrder,
  type CmsStore,
  type HomeSection,
  type OrderItem,
  type OrderStatus,
  type PageSections,
  type Producer,
  type ProducerCultureType,
  type PublicStoreResponse,
  type SectionPageKey,
  type SectionStyle,
} from "@/types/store";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

const validCategories = new Set(Object.keys(categoryLabels));
const validOrderStatuses = new Set<OrderStatus>(ORDER_STATUS_OPTIONS);
const validBlogCategories = new Set<BlogCategory>(BLOG_CATEGORY_OPTIONS);
const validSectionStyles = new Set<SectionStyle>(SECTION_STYLE_OPTIONS);
const validVatRates = new Set<VatRate>(VAT_RATE_OPTIONS);
const validProducerCultureTypes = new Set<ProducerCultureType>(PRODUCER_CULTURE_TYPES);
const isTaxableStore = INVOICE_SETTINGS.vatMode === "taxable";
const MAX_CUSTOM_SECTIONS_PER_PAGE = 20;
const MAX_SECTION_TITLE_LENGTH = 120;
const MAX_SECTION_BODY_LENGTH = 6000;

function isValidIsoDate(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
}

function sanitizeBlogSlug(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function reserveUniqueBlogSlug(
  baseSlug: string,
  blogId: string,
  slugOwners: Map<string, string>,
): string {
  const fallbackBase = sanitizeBlogSlug(baseSlug) || `article-${blogId.slice(0, 8).toLowerCase()}`;

  let candidate = fallbackBase;
  let suffix = 2;

  while (true) {
    const ownerId = slugOwners.get(candidate);

    if (!ownerId || ownerId === blogId) {
      slugOwners.set(candidate, blogId);
      return candidate;
    }

    candidate = `${fallbackBase}-${suffix}`;
    suffix += 1;
  }
}

function normalizeProductImages(product: Product): string[] {
  const normalizedImages: string[] = [];
  const inputImages = Array.isArray(product.images) ? product.images : [];
  const candidates = [...inputImages, product.image];

  for (const candidate of candidates) {
    const safePath = normalizeProductImagePath(candidate);
    if (normalizedImages.includes(safePath)) {
      continue;
    }

    normalizedImages.push(safePath);

    if (normalizedImages.length >= PRODUCT_IMAGE_MAX_COUNT) {
      break;
    }
  }

  if (normalizedImages.length === 0) {
    normalizedImages.push(normalizeProductImagePath(undefined));
  }

  return normalizedImages;
}

function sanitizeWebsite(value: string | undefined): string {
  if (!value?.trim()) {
    return "";
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.href.slice(0, 512);
  } catch {
    return "";
  }
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function normalizePositivePrice(value: unknown): number | undefined {
  const price = Number(value);
  if (!Number.isFinite(price)) {
    return undefined;
  }

  if (price <= 0) {
    return undefined;
  }

  return roundMoney(price);
}

function normalizePromoPercent(value: unknown): number | undefined {
  const promoPercent = Number(value);
  if (!Number.isFinite(promoPercent)) {
    return undefined;
  }

  if (!Number.isInteger(promoPercent)) {
    return undefined;
  }

  if (promoPercent < 1 || promoPercent > 99) {
    return undefined;
  }

  return promoPercent;
}

function normalizeVatRate(value: unknown): VatRate {
  const rate = Number(value);
  if (validVatRates.has(rate as VatRate)) {
    return rate as VatRate;
  }

  return 20;
}

function normalizeProducerCultureTypes(value: unknown): ProducerCultureType[] {
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

function normalizeProducerCertifications(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const certification = item.trim();
    const key = certification.toLowerCase();
    if (!certification || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(certification);
  }

  return normalized;
}

function normalizeProducer(producer: Producer, index: number): Producer {
  void index;
  const region = producer.region?.trim() || "";
  const department = producer.department?.trim() || "";
  const structuredLocation = [department, region].filter(Boolean).join(", ");

  return {
    id: producer.id?.trim() || randomUUID(),
    name: producer.name?.trim() || "Producteur sans nom",
    description: producer.description?.trim() || "Description du producteur.",
    image: normalizeProducerImagePath(producer.image),
    location: structuredLocation || producer.location?.trim() || "France",
    department,
    region,
    website: sanitizeWebsite(producer.website),
    cultureType: normalizeProducerCultureTypes(producer.cultureType),
    climate: producer.climate?.trim() || "",
    soil: producer.soil?.trim() || "",
    altitude: producer.altitude?.trim() || "",
    certifications: normalizeProducerCertifications(producer.certifications),
    speciality: producer.speciality?.trim() || "",
    philosophy: producer.philosophy?.trim() || "",
    experience: producer.experience?.trim() || "",
    founded: producer.founded?.trim() || "",
  };
}

function normalizeProduct(
  product: Product,
  index: number,
  validProducerIds: Set<string>,
): Product {
  const id = product.id?.trim() || `product-${index + 1}`;
  const rawCategory = typeof product.category === "string" ? product.category.trim() : "";
  const categoryAliasMap: Record<string, Product["category"]> = {
    "e-liquides": "e-liquide",
    tisane: "alimentaire",
  };
  const aliasedCategory = categoryAliasMap[rawCategory] ?? rawCategory;
  const safeCategory = validCategories.has(aliasedCategory)
    ? (aliasedCategory as Product["category"])
    : "fleurs";
  const normalizedImages = normalizeProductImages(product);
  const safePrice = Number.isFinite(product.price)
    ? roundMoney(Math.max(0, Number(product.price)))
    : 0;
  const safeVatRate = normalizeVatRate(product.vatRate);
  const safePromoPercent = normalizePromoPercent(product.promoPercent);
  const safeOriginalPrice = normalizePositivePrice(product.originalPrice);
  const isPack = product.isPack === true ? true : undefined;
  const seenPackIds = new Set<string>();
  const safePackProductIds = Array.isArray(product.packProductIds)
    ? product.packProductIds
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => {
        if (!value || value === id || seenPackIds.has(value)) {
          return false;
        }
        seenPackIds.add(value);
        return true;
      })
    : [];

  const hasConsistentPromo =
    safePromoPercent !== undefined &&
    safeOriginalPrice !== undefined &&
    safeOriginalPrice > safePrice;

  return {
    id,
    name: product.name || "Produit sans nom",
    category: safeCategory,
    price: safePrice,
    vatRate: isPack ? undefined : safeVatRate,
    originalPrice: hasConsistentPromo ? safeOriginalPrice : undefined,
    promoPercent: hasConsistentPromo ? safePromoPercent : undefined,
    isPack,
    packProductIds: isPack && safePackProductIds.length > 0 ? safePackProductIds : undefined,
    image: normalizedImages[0],
    images: normalizedImages,
    producerId:
      product.producerId && validProducerIds.has(product.producerId)
        ? product.producerId
        : undefined,
    analysisPdf: normalizeProductAnalysisPath(product.analysisPdf),
    description: product.description || "",
    badge: product.badge || undefined,
  };
}

function normalizeBlogPost(
  post: BlogPost,
  slugOwners: Map<string, string>,
): BlogPost {
  const now = new Date().toISOString();
  const id = post.id?.trim() || randomUUID();
  const title = post.title?.trim() || "Article sans titre";
  const slugSource = sanitizeBlogSlug(post.slug) || sanitizeBlogSlug(title);
  const slug = reserveUniqueBlogSlug(slugSource, id, slugOwners);

  const excerpt = (post.excerpt || "").trim();
  const content = (post.content || "").trim();

  return {
    id,
    title,
    slug,
    excerpt: excerpt || "Resume de l'article.",
    content: content || "Contenu de l'article.",
    coverImage: normalizeBlogImagePath(post.coverImage),
    category: validBlogCategories.has(post.category) ? post.category : "guide",
    published: typeof post.published === "boolean" ? post.published : false,
    createdAt: isValidIsoDate(post.createdAt) ? post.createdAt : now,
    updatedAt: isValidIsoDate(post.updatedAt) ? post.updatedAt : now,
  };
}

function normalizeOrderItem(item: OrderItem): OrderItem {
  const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
  const vatRate = sanitizeOrderVatRate(item.vatRate);
  const safeUnitPrice = Number.isFinite(item.unitPrice) ? Number(item.unitPrice) : 0;
  const lineTotal = Number.isFinite(item.lineTotal)
    ? roundMoney(Math.max(0, Number(item.lineTotal)))
    : roundMoney(Math.max(0, safeUnitPrice * quantity));
  const unitPrice = lineTotal > 0 ? Number((lineTotal / quantity).toFixed(4)) : 0;
  const taxSplit = computeFromTtc(lineTotal, vatRate, { taxable: isTaxableStore });
  const unitPriceHt = quantity > 0 ? roundMoney(taxSplit.ht / quantity) : 0;
  const parentPackId = item.parentPackId?.trim() || undefined;
  const parentPackName = item.parentPackName?.trim() || undefined;

  return {
    productId: item.productId || "unknown",
    name: item.name || "Produit",
    unitPrice,
    unitPriceHt,
    quantity,
    lineTotal,
    vatRate,
    lineTotalHt: taxSplit.ht,
    lineVatAmount: taxSplit.vat,
    parentPackId,
    parentPackName,
  };
}

function normalizeOrder(order: CmsOrder, index: number): CmsOrder {
  const items = (order.items ?? []).map(normalizeOrderItem);
  const taxTotals = computeOrderTaxTotals(items, { taxable: isTaxableStore });
  const discountPercent = Number.isFinite(order.discountPercent)
    ? Math.max(0, Math.min(100, Math.round(order.discountPercent ?? 0)))
    : undefined;
  const discountAmount = Number.isFinite(order.discountAmount)
    ? Number((order.discountAmount ?? 0).toFixed(2))
    : undefined;
  const vivaOrderCode = Number.isFinite(order.vivaOrderCode)
    ? Math.floor(Number(order.vivaOrderCode))
    : undefined;
  const vivaTransactionId = order.vivaTransactionId?.trim() || undefined;

  return {
    id: order.id || `ORD-${Date.now()}-${index + 1}`,
    createdAt: order.createdAt || new Date().toISOString(),
    status: validOrderStatuses.has(order.status) ? order.status : "new",
    paymentProvider: "viva",
    paymentState: order.paymentState ?? "pending",
    vivaOrderCode: vivaOrderCode && vivaOrderCode > 0 ? vivaOrderCode : undefined,
    vivaTransactionId,
    source: "web",
    customerId: order.customerId || undefined,
    customerEmail: order.customerEmail || undefined,
    customerName: order.customerName || undefined,
    shippingAddress: order.shippingAddress?.trim() || undefined,
    shippingCity: order.shippingCity?.trim() || undefined,
    shippingPostalCode: order.shippingPostalCode?.trim() || undefined,
    shippingCountry: order.shippingCountry?.trim() || undefined,
    shippingPhone: order.shippingPhone?.trim() || undefined,
    deliveryMethod: order.deliveryMethod === "relay" ? "relay" : "home",
    deliveryFee: Number.isFinite(order.deliveryFee)
      ? Number((order.deliveryFee ?? 0).toFixed(2))
      : undefined,
    relayId: order.relayId?.trim() || undefined,
    relayName: order.relayName?.trim() || undefined,
    relayAddress: order.relayAddress?.trim() || undefined,
    relayPostalCode: order.relayPostalCode?.trim() || undefined,
    relayCity: order.relayCity?.trim() || undefined,
    relayCountry: order.relayCountry?.trim() || undefined,
    promoCode: order.promoCode?.trim().toUpperCase() || undefined,
    discountPercent,
    discountAmount,
    items,
    itemsCount: Number.isFinite(order.itemsCount)
      ? order.itemsCount
      : items.reduce((acc, item) => acc + item.quantity, 0),
    totalHt: taxTotals.totalHt,
    totalVat: taxTotals.totalVat,
    vatBreakdown: taxTotals.vatBreakdown,
    totalAmount: Number.isFinite(order.totalAmount)
      ? order.totalAmount
      : Number(items.reduce((acc, item) => acc + item.lineTotal, 0).toFixed(2)),
  };
}

function sanitizeSectionText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeCustomSectionContent(value: unknown): {
  title: string;
  body: string;
  style: SectionStyle;
} {
  const input = value && typeof value === "object"
    ? (value as { title?: unknown; body?: unknown; style?: unknown })
    : {};

  const style = typeof input.style === "string" && validSectionStyles.has(input.style as SectionStyle)
    ? (input.style as SectionStyle)
    : "cream";

  return {
    title: sanitizeSectionText(input.title, MAX_SECTION_TITLE_LENGTH) || "Nouvelle section",
    body: sanitizeSectionText(input.body, MAX_SECTION_BODY_LENGTH),
    style,
  };
}

function makeUniqueSectionId(
  preferredId: string,
  usedIds: Set<string>,
  fallbackPrefix: string,
): string {
  const sanitizedPreferred = preferredId.trim().slice(0, 64);
  let candidate = sanitizedPreferred || `${fallbackPrefix}-${randomUUID().slice(0, 8)}`;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${fallbackPrefix}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

type SectionForPage<K extends SectionPageKey> = PageSections[K][number];

function normalizePageSections<K extends SectionPageKey>(
  page: K,
  input: unknown,
  hasExplicitSections: boolean,
): PageSections[K] {
  const defaults = NATIVE_SECTION_DEFINITIONS[page];
  const allowedNativeTypes = new Set(defaults.map((section) => section.type));
  const allowedTypes = new Set<string>([...allowedNativeTypes, "custom"]);
  const usedIds = new Set<string>();
  const seenNativeTypes = new Set<string>();
  const normalized: SectionForPage<K>[] = [];
  let customCount = 0;

  if (!hasExplicitSections) {
    return createDefaultPageSections()[page];
  }

  if (Array.isArray(input)) {
    for (const rawSection of input) {
      if (!rawSection || typeof rawSection !== "object") {
        continue;
      }

      const section = rawSection as {
        id?: unknown;
        type?: unknown;
        visible?: unknown;
        custom?: unknown;
      };
      const rawType = typeof section.type === "string" ? section.type : "";

      if (!allowedTypes.has(rawType)) {
        continue;
      }

      const visible = typeof section.visible === "boolean" ? section.visible : true;

      if (rawType === "custom") {
        if (customCount >= MAX_CUSTOM_SECTIONS_PER_PAGE) {
          continue;
        }

        const id = makeUniqueSectionId(
          typeof section.id === "string" ? section.id : "",
          usedIds,
          `${page}-custom`,
        );

        normalized.push({
          id,
          type: "custom",
          visible,
          custom: normalizeCustomSectionContent(section.custom),
        } as SectionForPage<K>);

        customCount += 1;
        continue;
      }

      if (seenNativeTypes.has(rawType)) {
        continue;
      }

      const defaultDefinition = defaults.find((candidate) => candidate.type === rawType);
      if (!defaultDefinition) {
        continue;
      }

      seenNativeTypes.add(rawType);
      usedIds.add(defaultDefinition.id);
      normalized.push({
        id: defaultDefinition.id,
        type: rawType,
        visible,
      } as SectionForPage<K>);
    }
  }

  for (const definition of defaults) {
    if (seenNativeTypes.has(definition.type)) {
      continue;
    }

    if (usedIds.has(definition.id)) {
      continue;
    }

    usedIds.add(definition.id);
    normalized.push({
      id: definition.id,
      type: definition.type,
      visible: false,
    } as SectionForPage<K>);
  }

  return normalized as PageSections[K];
}

function normalizeSections(input: Partial<PageSections> | undefined): PageSections {
  const hasExplicitSections = Boolean(input && typeof input === "object");
  const rawSections =
    input && typeof input === "object"
      ? input
      : ({} as Partial<PageSections>);

  return {
    home: normalizePageSections("home", rawSections.home, hasExplicitSections),
    boutique: normalizePageSections("boutique", rawSections.boutique, hasExplicitSections),
    application: normalizePageSections(
      "application",
      rawSections.application,
      hasExplicitSections,
    ),
    blog: normalizePageSections("blog", rawSections.blog, hasExplicitSections),
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

function toPublicStore(store: CmsStore): PublicStoreResponse {
  return {
    content: store.content,
    sections: filterVisibleSections(store.sections),
    products: store.products,
    blog: store.blog.filter((post) => post.published),
    producers: store.producers,
    updatedAt: store.updatedAt,
  };
}

function normalizeStore(input: CmsStore, options?: { touchUpdatedAt?: boolean }): CmsStore {
  const blogSlugOwners = new Map<string, string>();
  const normalizedProducers = (input.producers ?? defaultStore.producers).map(
    normalizeProducer,
  );
  const validProducerIds = new Set(normalizedProducers.map((producer) => producer.id));
  const normalizedProducts = (input.products ?? defaultStore.products).map((product, index) =>
    normalizeProduct(product, index, validProducerIds),
  );

  const productsById = new Map(normalizedProducts.map((product) => [product.id, product]));
  const nonPackProductIds = new Set(
    normalizedProducts.filter((product) => !product.isPack).map((product) => product.id),
  );

  const stableProducts: Product[] = [];
  for (const product of normalizedProducts) {
    if (!product.isPack) {
      stableProducts.push(product);
      continue;
    }

    const validPackProductIds = (product.packProductIds ?? []).filter(
      (id) => id !== product.id && nonPackProductIds.has(id),
    );

    if (validPackProductIds.length === 0) {
      continue;
    }

    const originalPrice = roundMoney(
      validPackProductIds.reduce((total, id) => total + (productsById.get(id)?.price ?? 0), 0),
    );

    if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
      continue;
    }

    const packPrice =
      Number.isFinite(product.price) && product.price > 0
        ? roundMoney(product.price)
        : originalPrice;
    const recalculatedPromoPercent = Math.round((1 - packPrice / originalPrice) * 100);
    const hasPackPromo =
      Number.isFinite(recalculatedPromoPercent) &&
      recalculatedPromoPercent > 0 &&
      recalculatedPromoPercent <= 99 &&
      originalPrice > packPrice;

    stableProducts.push({
      ...product,
      price: packPrice,
      originalPrice: hasPackPromo ? originalPrice : undefined,
      promoPercent: hasPackPromo ? recalculatedPromoPercent : undefined,
      packProductIds: validPackProductIds,
      isPack: true,
    });
  }

  return {
    ...defaultStore,
    ...input,
    content: {
      ...defaultStore.content,
      ...input.content,
      home: { ...defaultStore.content.home, ...input.content?.home },
      boutique: { ...defaultStore.content.boutique, ...input.content?.boutique },
      application: {
        ...defaultStore.content.application,
        ...input.content?.application,
      },
      blog: {
        ...defaultStore.content.blog,
        ...input.content?.blog,
      },
      profile: {
        ...defaultStore.content.profile,
        ...input.content?.profile,
      },
      footer: { ...defaultStore.content.footer, ...input.content?.footer },
    },
    sections: normalizeSections(input.sections),
    products: stableProducts,
    blog: (input.blog ?? defaultStore.blog).map((post) =>
      normalizeBlogPost(post, blogSlugOwners),
    ),
    producers: normalizedProducers,
    orders: (input.orders ?? defaultStore.orders).map(normalizeOrder),
    updatedAt: options?.touchUpdatedAt
      ? new Date().toISOString()
      : (isValidIsoDate(input.updatedAt) ? input.updatedAt : defaultStore.updatedAt),
  };
}

async function ensureStoreFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_FILE, "utf8");
  } catch {
    await writeFile(STORE_FILE, JSON.stringify(defaultStore, null, 2), "utf8");
  }
}

function createOrderId(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `ORD-${y}${m}${d}-${random}`;
}

export async function readStore(): Promise<CmsStore> {
  await ensureStoreFile();
  const raw = await readFile(STORE_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw) as CmsStore;
    return normalizeStore(parsed);
  } catch {
    return defaultStore;
  }
}

export async function writeStore(nextStore: CmsStore): Promise<CmsStore> {
  await ensureStoreFile();
  const normalized = normalizeStore(nextStore, { touchUpdatedAt: true });
  await writeFile(STORE_FILE, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export async function readPublicStore(): Promise<PublicStoreResponse> {
  const store = await readStore();
  return toPublicStore(store);
}

const getPublishedBlogPostsByUpdatedAt = cache(async (updatedAt: string): Promise<BlogPost[]> => {
  void updatedAt;
  const store = await readStore();

  return store.blog
    .filter((post) => post.published)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  const store = await readStore();
  return getPublishedBlogPostsByUpdatedAt(store.updatedAt);
}

const getPublishedBlogPostBySlugAndUpdatedAt = cache(
  async (updatedAt: string, slug: string): Promise<BlogPost | null> => {
    const posts = await getPublishedBlogPostsByUpdatedAt(updatedAt);
    return posts.find((post) => post.slug === slug) ?? null;
  },
);

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const safeSlug = sanitizeBlogSlug(slug);
  if (!safeSlug) {
    return null;
  }

  const store = await readStore();
  return getPublishedBlogPostBySlugAndUpdatedAt(store.updatedAt, safeSlug);
}

export async function appendOrder(input: {
  items: Array<{
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal?: number;
    vatRate?: VatRate;
    unitPriceHt?: number;
    lineTotalHt?: number;
    lineVatAmount?: number;
    parentPackId?: string;
    parentPackName?: string;
  }>;
  totalAmount: number;
  itemsCount: number;
  totalHt?: number;
  totalVat?: number;
  vatBreakdown?: CmsOrder["vatBreakdown"];
  paymentState: CmsOrder["paymentState"];
  status?: OrderStatus;
  customer?: {
    id?: string;
    email?: string;
    name?: string;
  } | null;
  shipping?: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
    deliveryMethod?: "home" | "relay";
    deliveryFee?: number;
    relayId?: string;
    relayName?: string;
    relayAddress?: string;
    relayPostalCode?: string;
    relayCity?: string;
    relayCountry?: string;
  };
  promo?: {
    code: string;
    discountPercent: number;
    discountAmount: number;
  } | null;
  viva?: {
    orderCode: number;
    transactionId?: string;
  } | null;
}): Promise<CmsOrder> {
  const current = await readStore();

  const items: OrderItem[] = input.items.map((item) =>
    normalizeOrderItem({
      productId: item.productId,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: Number.isFinite(Number(item.lineTotal))
        ? Number(item.lineTotal)
        : item.unitPrice * item.quantity,
      vatRate: item.vatRate ?? 20,
      unitPriceHt: item.unitPriceHt ?? 0,
      lineTotalHt: item.lineTotalHt ?? 0,
      lineVatAmount: item.lineVatAmount ?? 0,
      parentPackId: item.parentPackId,
      parentPackName: item.parentPackName,
    }),
  );
  const taxTotals = computeOrderTaxTotals(items, { taxable: isTaxableStore });

  const order: CmsOrder = normalizeOrder(
    {
      id: createOrderId(),
      createdAt: new Date().toISOString(),
      status: input.status ?? "new",
      paymentProvider: "viva",
      paymentState: input.paymentState,
      vivaOrderCode:
        input.viva && Number.isFinite(input.viva.orderCode) && input.viva.orderCode > 0
          ? Math.floor(input.viva.orderCode)
          : undefined,
      vivaTransactionId: input.viva?.transactionId?.trim() || undefined,
      source: "web",
      customerId: input.customer?.id?.trim() || undefined,
      customerEmail: input.customer?.email?.trim() || undefined,
      customerName: input.customer?.name?.trim() || undefined,
      shippingAddress: input.shipping?.address,
      shippingCity: input.shipping?.city,
      shippingPostalCode: input.shipping?.postalCode,
      shippingCountry: input.shipping?.country,
      shippingPhone: input.shipping?.phone,
      deliveryMethod: input.shipping?.deliveryMethod,
      deliveryFee: Number.isFinite(input.shipping?.deliveryFee)
        ? Number((input.shipping?.deliveryFee ?? 0).toFixed(2))
        : undefined,
      relayId: input.shipping?.relayId,
      relayName: input.shipping?.relayName,
      relayAddress: input.shipping?.relayAddress,
      relayPostalCode: input.shipping?.relayPostalCode,
      relayCity: input.shipping?.relayCity,
      relayCountry: input.shipping?.relayCountry,
      promoCode: input.promo?.code,
      discountPercent: input.promo?.discountPercent,
      discountAmount: input.promo?.discountAmount,
      items,
      itemsCount:
        input.itemsCount || items.reduce((acc, item) => acc + item.quantity, 0),
      totalHt: Number.isFinite(input.totalHt) ? Number(input.totalHt) : taxTotals.totalHt,
      totalVat: Number.isFinite(input.totalVat) ? Number(input.totalVat) : taxTotals.totalVat,
      vatBreakdown: Array.isArray(input.vatBreakdown) ? input.vatBreakdown : taxTotals.vatBreakdown,
      totalAmount:
        input.totalAmount || Number(items.reduce((acc, item) => acc + item.lineTotal, 0).toFixed(2)),
    },
    0,
  );

  const nextStore = {
    ...current,
    orders: [order, ...current.orders],
  };

  await writeStore(nextStore);
  return order;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<CmsOrder | null> {
  if (!validOrderStatuses.has(status)) {
    return null;
  }

  const current = await readStore();
  let updatedOrder: CmsOrder | null = null;

  const orders = current.orders.map((order) => {
    if (order.id !== orderId) {
      return order;
    }

    updatedOrder = { ...order, status };
    return updatedOrder;
  });

  if (!updatedOrder) {
    return null;
  }

  await writeStore({ ...current, orders });
  return updatedOrder;
}

export async function updateOrderPaymentState(
  orderId: string,
  paymentState: CmsOrder["paymentState"],
): Promise<CmsOrder | null> {
  const current = await readStore();
  let updatedOrder: CmsOrder | null = null;

  const orders = current.orders.map((order) => {
    if (order.id !== orderId) {
      return order;
    }

    if (paymentState === "paid") {
      updatedOrder = {
        ...order,
        paymentState: "paid",
        status:
          order.status === "new" || order.status === "pending_payment"
            ? "paid"
            : order.status,
      };
      return updatedOrder;
    }

    if (paymentState === "failed") {
      updatedOrder = {
        ...order,
        paymentState: "failed",
        status:
          order.status === "new" || order.status === "pending_payment"
            ? "pending_payment"
            : order.status,
      };
      return updatedOrder;
    }

    if (paymentState === "not_configured") {
      updatedOrder = {
        ...order,
        paymentState: "not_configured",
        status:
          order.status === "new" || order.status === "pending_payment"
            ? "paid"
            : order.status,
      };
      return updatedOrder;
    }

    updatedOrder = {
      ...order,
      paymentState: "pending",
      status:
        order.status === "paid"
          ? "pending_payment"
          : order.status,
    };
    return updatedOrder;
  });

  if (!updatedOrder) {
    return null;
  }

  await writeStore({ ...current, orders });
  return updatedOrder;
}

export async function updateOrderPaymentByVivaOrderCode(input: {
  orderCode: number;
  paymentState: "paid" | "failed";
  transactionId?: string;
}): Promise<CmsOrder | null> {
  if (!Number.isFinite(input.orderCode) || input.orderCode <= 0) {
    return null;
  }

  const safeOrderCode = Math.floor(input.orderCode);
  const current = await readStore();
  let updatedOrder: CmsOrder | null = null;

  const orders = current.orders.map((order) => {
    if (order.vivaOrderCode !== safeOrderCode) {
      return order;
    }

    if (input.paymentState === "paid") {
      updatedOrder = {
        ...order,
        paymentState: "paid",
        status:
          order.status === "new" || order.status === "pending_payment"
            ? "paid"
            : order.status,
        vivaTransactionId: input.transactionId?.trim() || order.vivaTransactionId,
      };
      return updatedOrder;
    }

    if (order.paymentState === "paid") {
      updatedOrder = order;
      return order;
    }

    updatedOrder = {
      ...order,
      paymentState: "failed",
      status:
        order.status === "new" || order.status === "pending_payment"
          ? "pending_payment"
          : order.status,
      vivaTransactionId: input.transactionId?.trim() || order.vivaTransactionId,
    };
    return updatedOrder;
  });

  if (!updatedOrder) {
    return null;
  }

  await writeStore({ ...current, orders });
  return updatedOrder;
}
