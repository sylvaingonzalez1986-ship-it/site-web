import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type {
  PrintfulAdminSnapshot,
  PrintfulSyncedProduct,
  PrintfulSyncedVariant,
  PrintfulSyncState,
  PrintfulSyncSummary,
} from "@/types/printful";

const PRINTFUL_PRODUCT_ID_PREFIX = "printful-p-";
const LEGACY_PRINTFUL_VARIANT_PRODUCT_ID_PREFIX = "printful-v-";
const DEFAULT_PRINTFUL_BASE_URL = "https://api.printful.com";
const MAX_SYNC_BATCH = 300;

type AnyObject = Record<string, unknown>;

type ParsedPrintfulProduct = {
  syncProductId: number;
  externalId: string;
  name: string;
  thumbnailUrl: string;
  isIgnored: boolean;
  synced: boolean;
  raw: AnyObject;
  variants: ParsedPrintfulVariant[];
};

type ParsedPrintfulVariant = {
  syncVariantId: number;
  syncProductId: number;
  externalId: string;
  name: string;
  sku: string;
  retailPrice: number;
  currency: string;
  isEnabled: boolean;
  isInStock: boolean;
  imageUrl: string;
  raw: AnyObject;
};

type PrintfulCatalogSource = "store_products" | "sync_products";

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function toObject(value: unknown): AnyObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as AnyObject;
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toOptionalText(value: unknown): string {
  return toText(value).trim();
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toMoney(value: unknown, fallback = 0): number {
  return Number(toNumber(value, fallback).toFixed(2));
}

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function toLooseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on", "enabled", "active"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "off", "disabled", "inactive"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function normalizePrintfulBaseUrl(): string {
  const baseUrl = process.env.PRINTFUL_API_BASE_URL?.trim() || DEFAULT_PRINTFUL_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

function readPrintfulTokenOrThrow(): string {
  const token = process.env.PRINTFUL_TOKEN?.trim();
  if (!token) {
    throw new Error("PRINTFUL_TOKEN manquant.");
  }
  return token;
}

function readPrintfulStoreId(): string | undefined {
  const rawStoreId = process.env.PRINTFUL_STORE_ID?.trim() || "";
  const cleanedStoreId = rawStoreId.split("#")[0].trim() || "";
  if (!cleanedStoreId) {
    return undefined;
  }

  // Printful store ids are expected to be short opaque identifiers; reject obvious invalid values.
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanedStoreId)) {
    return undefined;
  }

  return cleanedStoreId;
}

function isPrintfulTokenConfigured(): boolean {
  return Boolean(process.env.PRINTFUL_TOKEN?.trim());
}

function isPrintfulStoreIdConfigured(): boolean {
  return Boolean(readPrintfulStoreId());
}

function extractRowsFromPrintfulPayload(payload: AnyObject): unknown[] {
  if (Array.isArray(payload.result)) {
    return payload.result;
  }

  const result = toObject(payload.result);
  if (Array.isArray(result.products)) {
    return result.products;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function extractPrintfulErrorMessage(payload: AnyObject): string {
  const candidates = [
    payload.error,
    payload.result,
    payload.result_msg,
    payload.message,
    payload.detail,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (candidate && typeof candidate === "object") {
      const asObject = toObject(candidate);
      const nested = [
        asObject.message,
        asObject.error,
        asObject.reason,
        asObject.detail,
      ];
      for (const nestedValue of nested) {
        if (typeof nestedValue === "string" && nestedValue.trim()) {
          return nestedValue.trim();
        }
      }
    }
  }

  return "";
}

function isManualOrderOnlyStoreProductsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("manual order / api platform") ||
    message.includes("applies only to printful stores")
  );
}

function getVariantImage(rawVariant: AnyObject, fallback: string): string {
  const direct = toOptionalText(rawVariant.image);
  if (direct) {
    return direct;
  }

  const preview = toOptionalText(rawVariant.preview_url);
  if (preview) {
    return preview;
  }

  const files = Array.isArray(rawVariant.files) ? rawVariant.files : [];
  for (const rawFile of files) {
    const file = toObject(rawFile);
    const filePreview = toOptionalText(file.preview_url) || toOptionalText(file.thumbnail_url);
    if (filePreview) {
      return filePreview;
    }
  }

  return fallback;
}

function parsePrintfulVariant(
  rawVariant: AnyObject,
  product: { syncProductId: number; name: string; thumbnailUrl: string },
): ParsedPrintfulVariant | null {
  const syncVariantId = toInteger(rawVariant.id, toInteger(rawVariant.sync_variant_id, 0));
  if (syncVariantId <= 0) {
    return null;
  }

  const variantName = toOptionalText(rawVariant.name) || `${product.name} variante`;
  const currency = toOptionalText(rawVariant.currency) || "EUR";
  const availability = toOptionalText(rawVariant.availability_status).toLowerCase();
  const stockByAvailability =
    availability.length === 0 ? true : !(availability.includes("out") || availability.includes("discontinued"));
  const isIgnored = toLooseBoolean(rawVariant.is_ignored, false);
  const isEnabledRaw = toLooseBoolean(rawVariant.is_enabled, true);

  return {
    syncVariantId,
    syncProductId: product.syncProductId,
    externalId: toOptionalText(rawVariant.external_id),
    name: variantName,
    sku: toOptionalText(rawVariant.sku),
    retailPrice: toMoney(rawVariant.retail_price, toMoney(rawVariant.price, 0)),
    currency,
    isEnabled: !isIgnored && isEnabledRaw,
    isInStock: toLooseBoolean(rawVariant.in_stock, stockByAvailability),
    imageUrl: getVariantImage(rawVariant, product.thumbnailUrl),
    raw: rawVariant,
  };
}

function parsePrintfulProductRow(rawRow: AnyObject): ParsedPrintfulProduct | null {
  const syncProductRawCandidate = toObject(rawRow.sync_product);
  const syncProductRaw =
    Object.keys(syncProductRawCandidate).length > 0 ? syncProductRawCandidate : rawRow;

  const syncProductId = toInteger(syncProductRaw.id, toInteger(rawRow.id, 0));
  if (syncProductId <= 0) {
    return null;
  }

  const productName = toOptionalText(syncProductRaw.name) || `Produit Printful ${syncProductId}`;
  const thumbnailUrl =
    toOptionalText(syncProductRaw.thumbnail_url) ||
    toOptionalText(rawRow.thumbnail_url) ||
    "/product_flower.jpg";

  const variantCandidates = Array.isArray(rawRow.sync_variants)
    ? rawRow.sync_variants
    : Array.isArray(syncProductRaw.sync_variants)
      ? syncProductRaw.sync_variants
      : Array.isArray(syncProductRaw.variants)
        ? syncProductRaw.variants
        : [];

  const variants = variantCandidates
    .map((variant) => parsePrintfulVariant(toObject(variant), {
      syncProductId,
      name: productName,
      thumbnailUrl,
    }))
    .filter((variant): variant is ParsedPrintfulVariant => variant !== null);

  return {
    syncProductId,
    externalId: toOptionalText(syncProductRaw.external_id),
    name: productName,
    thumbnailUrl,
    isIgnored: toLooseBoolean(syncProductRaw.is_ignored, false) || toLooseBoolean(rawRow.is_ignored, false),
    synced: toLooseBoolean(syncProductRaw.synced, toLooseBoolean(rawRow.synced, true)),
    raw: rawRow,
    variants,
  };
}

function parsePublishedSyncProductIdFromProductId(productId: string): number | null {
  const match = productId.match(/^printful-p-(\d+)$/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length <= size) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchPrintful(endpointPath: string): Promise<AnyObject> {
  const token = readPrintfulTokenOrThrow();
  const baseUrl = normalizePrintfulBaseUrl();
  const storeId = readPrintfulStoreId();

  const response = await fetch(`${baseUrl}${endpointPath}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(storeId ? { "X-PF-Store-Id": storeId } : {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as AnyObject;

  if (!response.ok) {
    const reason = extractPrintfulErrorMessage(payload);
    throw new Error(`Printful API erreur (${response.status}). ${reason}`.trim());
  }

  return payload;
}

async function fetchPrintfulCatalogRowsViaStoreProducts(): Promise<{
  rows: unknown[];
  source: PrintfulCatalogSource;
}> {
  const allRows: unknown[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const payload = await fetchPrintful(`/store/products?limit=${limit}&offset=${offset}`);
    const rows = extractRowsFromPrintfulPayload(payload);
    if (rows.length === 0) {
      break;
    }

    allRows.push(...rows);
    offset += rows.length;

    if (rows.length < limit || offset >= 5000) {
      break;
    }
  }

  return { rows: allRows, source: "store_products" };
}

async function fetchPrintfulCatalogRowsViaSyncProducts(): Promise<{
  rows: unknown[];
  source: PrintfulCatalogSource;
}> {
  const summaries: AnyObject[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const payload = await fetchPrintful(`/sync/products?limit=${limit}&offset=${offset}`);
    const rows = extractRowsFromPrintfulPayload(payload).map((row) => toObject(row));
    if (rows.length === 0) {
      break;
    }

    summaries.push(...rows);
    offset += rows.length;

    if (rows.length < limit || offset >= 5000) {
      break;
    }
  }

  const detailsRows: unknown[] = [];
  for (const summary of summaries) {
    const syncProductId = toInteger(summary.id, 0);
    if (syncProductId <= 0) {
      continue;
    }

    const detailPayload = await fetchPrintful(`/sync/products/${syncProductId}`);
    const detailResult = toObject(detailPayload.result);
    const syncProduct = toObject(detailResult.sync_product);
    const syncVariants = Array.isArray(detailResult.sync_variants)
      ? detailResult.sync_variants
      : [];

    detailsRows.push({
      sync_product: {
        ...summary,
        ...syncProduct,
      },
      sync_variants: syncVariants,
    });
  }

  return { rows: detailsRows, source: "sync_products" };
}

async function fetchPrintfulCatalogRows(): Promise<{
  rows: unknown[];
  source: PrintfulCatalogSource;
}> {
  try {
    return await fetchPrintfulCatalogRowsViaStoreProducts();
  } catch (error) {
    if (!isManualOrderOnlyStoreProductsError(error)) {
      throw error;
    }

    return fetchPrintfulCatalogRowsViaSyncProducts();
  }
}

async function updateSyncState(input: {
  status: PrintfulSyncState["lastSyncStatus"];
  message: string;
  lastSyncAt?: string;
  updatedBy?: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase.from("printful_sync_state").upsert(
    {
      id: 1,
      last_sync_status: input.status,
      last_sync_message: input.message ?? "",
      last_sync_at: input.lastSyncAt ?? null,
      updated_by: input.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  failIfError(result.error, "upsert printful_sync_state");
}

export async function getPrintfulAdminSnapshotFromSupabase(): Promise<PrintfulAdminSnapshot> {
  const supabase = createSupabaseServiceClient();

  const [stateResult, productsResult, variantsResult, publishedResult] = await Promise.all([
    supabase
      .from("printful_sync_state")
      .select("last_sync_at,last_sync_status,last_sync_message,updated_at")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("printful_sync_products")
      .select("sync_product_id,name,thumbnail_url,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("printful_sync_variants")
      .select("sync_variant_id,sync_product_id,name,sku,retail_price,currency,is_enabled,is_in_stock,image_url,updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("products").select("id").like("id", `${PRINTFUL_PRODUCT_ID_PREFIX}%`),
  ]);

  failIfError(stateResult.error, "read printful_sync_state");
  failIfError(productsResult.error, "read printful_sync_products");
  failIfError(variantsResult.error, "read printful_sync_variants");
  failIfError(publishedResult.error, "read printful published products");

  const publishedSyncProductIds = new Set<number>();
  for (const rawRow of publishedResult.data ?? []) {
    const row = toObject(rawRow);
    const id = toText(row.id);
    const syncProductId = parsePublishedSyncProductIdFromProductId(id);
    if (syncProductId !== null) {
      publishedSyncProductIds.add(syncProductId);
    }
  }

  const variantsByProductId = new Map<number, PrintfulSyncedVariant[]>();
  for (const rawRow of variantsResult.data ?? []) {
    const row = toObject(rawRow);
    const syncVariantId = toInteger(row.sync_variant_id, 0);
    const syncProductId = toInteger(row.sync_product_id, 0);
    if (syncVariantId <= 0 || syncProductId <= 0) {
      continue;
    }

    const variant: PrintfulSyncedVariant = {
      syncVariantId,
      syncProductId,
      variantName: toOptionalText(row.name) || `Variante ${syncVariantId}`,
      sku: toOptionalText(row.sku) || undefined,
      retailPrice: toMoney(row.retail_price, 0),
      currency: toOptionalText(row.currency) || "EUR",
      imageUrl: toOptionalText(row.image_url) || "/product_flower.jpg",
      isEnabled: row.is_enabled !== false,
      isInStock: row.is_in_stock !== false,
      updatedAt: toText(row.updated_at, new Date().toISOString()),
    };

    const list = variantsByProductId.get(syncProductId) ?? [];
    list.push(variant);
    variantsByProductId.set(syncProductId, list);
  }

  const products: PrintfulSyncedProduct[] = (productsResult.data ?? [])
    .map((rawRow) => toObject(rawRow))
    .map((row) => {
      const syncProductId = toInteger(row.sync_product_id, 0);
      const variants = variantsByProductId.get(syncProductId) ?? [];

      return {
        syncProductId,
        productName: toOptionalText(row.name) || `Produit Printful ${syncProductId}`,
        thumbnailUrl: toOptionalText(row.thumbnail_url) || variants[0].imageUrl || "/product_flower.jpg",
        variants,
        isPublished: publishedSyncProductIds.has(syncProductId),
        updatedAt: toText(row.updated_at, new Date().toISOString()),
      };
    })
    .filter((product) => product.syncProductId > 0);

  const stateRow = stateResult.data ? toObject(stateResult.data) : null;
  const state: PrintfulSyncState = {
    lastSyncAt: stateRow ? toOptionalText(stateRow.last_sync_at) || undefined : undefined,
    lastSyncStatus: stateRow
      ? (toText(stateRow.last_sync_status, "idle") as PrintfulSyncState["lastSyncStatus"])
      : "idle",
    lastSyncMessage: stateRow ? toOptionalText(stateRow.last_sync_message) || undefined : undefined,
    updatedAt: stateRow ? toOptionalText(stateRow.updated_at) || undefined : undefined,
  };

  return {
    tokenConfigured: isPrintfulTokenConfigured(),
    storeIdConfigured: isPrintfulStoreIdConfigured(),
    state,
    products,
  };
}

export async function syncPrintfulCatalogInSupabase(input: {
  triggeredBy: string;
}): Promise<PrintfulSyncSummary> {
  const supabase = createSupabaseServiceClient();
  const startedAt = new Date().toISOString();

  await updateSyncState({
    status: "running",
    message: "Synchronisation Printful en cours...",
    updatedBy: input.triggeredBy,
  });

  const runInsert = await supabase
    .from("printful_sync_runs")
    .insert({
      started_at: startedAt,
      triggered_by: input.triggeredBy ?? null,
    })
    .select("id")
    .single();

  failIfError(runInsert.error, "insert printful_sync_runs");
  const runId = toInteger(toObject(runInsert.data).id, 0);

  try {
    const catalog = await fetchPrintfulCatalogRows();

    const parsedProducts = catalog.rows
      .map((rawRow) => parsePrintfulProductRow(toObject(rawRow)))
      .filter((product): product is ParsedPrintfulProduct => product !== null);
    const parsedVariants = parsedProducts.flatMap((product) => product.variants);

    const productRows = parsedProducts.map((product) => ({
      sync_product_id: product.syncProductId,
      external_id: product.externalId || null,
      name: product.name,
      thumbnail_url: product.thumbnailUrl,
      is_ignored: product.isIgnored,
      synced: product.synced,
      raw: product.raw,
      updated_at: new Date().toISOString(),
    }));

    const variantRows = parsedVariants.map((variant) => ({
      sync_variant_id: variant.syncVariantId,
      sync_product_id: variant.syncProductId,
      external_id: variant.externalId || null,
      name: variant.name,
      sku: variant.sku || null,
      retail_price: variant.retailPrice,
      currency: variant.currency,
      is_enabled: variant.isEnabled,
      is_in_stock: variant.isInStock,
      image_url: variant.imageUrl,
      raw: variant.raw,
      updated_at: new Date().toISOString(),
    }));

    for (const batch of chunkArray(productRows, MAX_SYNC_BATCH)) {
      const upsertProducts = await supabase
        .from("printful_sync_products")
        .upsert(batch, { onConflict: "sync_product_id" });
      failIfError(upsertProducts.error, "upsert printful_sync_products");
    }

    for (const batch of chunkArray(variantRows, MAX_SYNC_BATCH)) {
      const upsertVariants = await supabase
        .from("printful_sync_variants")
        .upsert(batch, { onConflict: "sync_variant_id" });
      failIfError(upsertVariants.error, "upsert printful_sync_variants");
    }

    const existingProductsResult = await supabase
      .from("printful_sync_products")
      .select("sync_product_id");
    failIfError(existingProductsResult.error, "select existing printful_sync_products");

    const incomingProductIds = new Set(productRows.map((row) => row.sync_product_id));
    const productIdsToDelete = (existingProductsResult.data ?? [])
      .map((row) => toInteger(toObject(row).sync_product_id, 0))
      .filter((id) => id > 0 && !incomingProductIds.has(id));

    if (productIdsToDelete.length > 0) {
      const deleteProducts = await supabase
        .from("printful_sync_products")
        .delete()
        .in("sync_product_id", productIdsToDelete);
      failIfError(deleteProducts.error, "delete removed printful_sync_products");
    }

    const existingVariantsResult = await supabase
      .from("printful_sync_variants")
      .select("sync_variant_id");
    failIfError(existingVariantsResult.error, "select existing printful_sync_variants");

    const incomingVariantIds = new Set(variantRows.map((row) => row.sync_variant_id));
    const variantIdsToDelete = (existingVariantsResult.data ?? [])
      .map((row) => toInteger(toObject(row).sync_variant_id, 0))
      .filter((id) => id > 0 && !incomingVariantIds.has(id));

    if (variantIdsToDelete.length > 0) {
      const deleteVariants = await supabase
        .from("printful_sync_variants")
        .delete()
        .in("sync_variant_id", variantIdsToDelete);
      failIfError(deleteVariants.error, "delete removed printful_sync_variants");
    }

    const syncedAt = new Date().toISOString();
    await updateSyncState({
      status: "success",
      message: `${productRows.length} produit(s), ${variantRows.length} variante(s) synchronise(s) via ${catalog.source}.`,
      lastSyncAt: syncedAt,
      updatedBy: input.triggeredBy,
    });

    if (runId > 0) {
      const runUpdate = await supabase
        .from("printful_sync_runs")
        .update({
          ended_at: syncedAt,
          success: true,
          products_count: productRows.length,
          variants_count: variantRows.length,
          error_message: null,
        })
        .eq("id", runId);
      failIfError(runUpdate.error, "update printful_sync_runs success");
    }

    return {
      productsCount: productRows.length,
      variantsCount: variantRows.length,
      syncedAt,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Synchronisation Printful impossible.";

    await updateSyncState({
      status: "error",
      message: errorMessage,
      updatedBy: input.triggeredBy,
    });

    if (runId > 0) {
      const runErrorUpdate = await supabase
        .from("printful_sync_runs")
        .update({
          ended_at: new Date().toISOString(),
          success: false,
          error_message: errorMessage.slice(0, 2000),
        })
        .eq("id", runId);
      failIfError(runErrorUpdate.error, "update printful_sync_runs error");
    }

    throw error;
  }
}

export async function publishPrintfulProductToStoreInSupabase(input: {
  syncProductId: number;
}): Promise<{ productId: string }> {
  const syncProductId = Math.floor(Number(input.syncProductId));
  if (!Number.isFinite(syncProductId) || syncProductId <= 0) {
    throw new Error("Produit Printful invalide.");
  }

  const supabase = createSupabaseServiceClient();

  const [productResult, variantsResult] = await Promise.all([
    supabase
      .from("printful_sync_products")
      .select("sync_product_id,name,thumbnail_url")
      .eq("sync_product_id", syncProductId)
      .maybeSingle(),
    supabase
      .from("printful_sync_variants")
      .select("sync_variant_id,name,sku,retail_price,currency,image_url,is_enabled,is_in_stock")
      .eq("sync_product_id", syncProductId)
      .order("sync_variant_id", { ascending: true }),
  ]);

  failIfError(productResult.error, "read printful_sync_products by id");
  failIfError(variantsResult.error, "read printful_sync_variants by product id");

  const productRow = productResult.data ? toObject(productResult.data) : null;
  if (!productRow) {
    throw new Error("Produit Printful introuvable. Lance une synchronisation Printful.");
  }

  const variantRows = (variantsResult.data ?? []).map((raw) => toObject(raw));
  if (variantRows.length === 0) {
    throw new Error("Aucune variante disponible pour ce produit Printful.");
  }

  const variantOptions = variantRows
    .map((row) => {
      const variantId = toInteger(row.sync_variant_id, 0);
      if (variantId <= 0) {
        return null;
      }
      return {
        id: String(variantId),
        label: toOptionalText(row.name) || `Taille ${variantId}`,
        price: toMoney(row.retail_price, 0),
      sku: toOptionalText(row.sku) || "",
        inStock: row.is_in_stock !== false,
        stockQuantity: null,
        enabled: row.is_enabled !== false,
        imageUrl: toOptionalText(row.image_url) || "",
        currency: toOptionalText(row.currency) || "EUR",
      };
    })
    .filter((option): option is NonNullable<typeof option> => option !== null);

  const activeOptions = variantOptions.filter(
    (option) => option.enabled && option.inStock && option.price > 0,
  );

  if (activeOptions.length === 0) {
    throw new Error("Aucune variante active/en stock avec un prix valide pour ce produit.");
  }

  const defaultOption = activeOptions[0];
  const productName = toOptionalText(productRow.name) || `Produit Printful ${syncProductId}`;
  const thumbnailUrl = toOptionalText(productRow.thumbnail_url);

  const imageCandidates = [
    thumbnailUrl,
    ...variantOptions.map((option) => option.imageUrl),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  const uniqueImages: string[] = [];
  for (const candidate of imageCandidates) {
    if (uniqueImages.includes(candidate)) {
      continue;
    }
    uniqueImages.push(candidate);
    if (uniqueImages.length >= 8) {
      break;
    }
  }

  const fallbackImage = uniqueImages[0] || "/product_flower.jpg";

  const existingProductResult = await supabase
    .from("products")
    .select("position")
    .eq("id", `${PRINTFUL_PRODUCT_ID_PREFIX}${syncProductId}`)
    .maybeSingle();

  failIfError(existingProductResult.error, "read existing printful product position");

  let nextPosition = toInteger(toObject(existingProductResult.data).position, -1);
  if (nextPosition < 0) {
    const positionResult = await supabase
      .from("products")
      .select("position")
      .eq("category", "accessoires")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    failIfError(positionResult.error, "select accessories max position");
    const maxPosition = toInteger(toObject(positionResult.data).position, -1);
    nextPosition = maxPosition + 1;
  }

  const localProductId = `${PRINTFUL_PRODUCT_ID_PREFIX}${syncProductId}`;
  const upsertProduct = await supabase.from("products").upsert(
    {
      id: localProductId,
      name: productName,
      category: "accessoires",
      price: defaultOption.price,
      track_stock: false,
      stock_quantity: null,
      vat_rate: 20,
      original_price: null,
      promo_percent: null,
      is_pack: false,
      image: fallbackImage,
      images: uniqueImages.length > 0 ? uniqueImages : [fallbackImage],
      producer_id: null,
      description: "Produit print on demand synchronise depuis Printful. Choisis ta taille sur la fiche produit.",
      badge: "Printful POD",
      source: "printful",
      printful_sync_product_id: syncProductId,
      variant_label: "Taille",
      variant_options: variantOptions.map((option) => ({
        id: option.id,
        label: option.label,
        price: option.price,
        sku: option.sku ?? null,
        inStock: option.inStock,
        stockQuantity: option.stockQuantity ?? null,
        enabled: option.enabled,
      })),
      position: nextPosition,
    },
    { onConflict: "id" },
  );
  failIfError(upsertProduct.error, "upsert products printful publish");

  const legacyIdsToDelete = variantOptions.map(
    (option) => `${LEGACY_PRINTFUL_VARIANT_PRODUCT_ID_PREFIX}${option.id}`,
  );
  if (legacyIdsToDelete.length > 0) {
    const deleteLegacyResult = await supabase
      .from("products")
      .delete()
      .in("id", legacyIdsToDelete);
    failIfError(deleteLegacyResult.error, "delete legacy printful variant products");
  }

  return { productId: localProductId };
}

export async function unpublishPrintfulProductFromStoreInSupabase(input: {
  syncProductId: number;
}): Promise<boolean> {
  const syncProductId = Math.floor(Number(input.syncProductId));
  if (!Number.isFinite(syncProductId) || syncProductId <= 0) {
    throw new Error("Produit Printful invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const productId = `${PRINTFUL_PRODUCT_ID_PREFIX}${syncProductId}`;
  const [variantsResult, deleteResult] = await Promise.all([
    supabase
      .from("printful_sync_variants")
      .select("sync_variant_id")
      .eq("sync_product_id", syncProductId),
    supabase.from("products").delete().eq("id", productId),
  ]);

  failIfError(variantsResult.error, "read printful variants for unpublish");
  failIfError(deleteResult.error, "delete printful published product");

  const legacyIdsToDelete = (variantsResult.data ?? [])
    .map((row) => toInteger(toObject(row).sync_variant_id, 0))
    .filter((id) => id > 0)
    .map((id) => `${LEGACY_PRINTFUL_VARIANT_PRODUCT_ID_PREFIX}${id}`);

  if (legacyIdsToDelete.length > 0) {
    const deleteLegacyResult = await supabase
      .from("products")
      .delete()
      .in("id", legacyIdsToDelete);
    failIfError(deleteLegacyResult.error, "delete legacy printful variant products on unpublish");
  }

  return true;
}

export async function publishPrintfulVariantToStoreInSupabase(input: {
  syncVariantId: number;
}): Promise<{ productId: string }> {
  const variantId = Math.floor(Number(input.syncVariantId));
  if (!Number.isFinite(variantId) || variantId <= 0) {
    throw new Error("Variante Printful invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const variantResult = await supabase
    .from("printful_sync_variants")
    .select("sync_product_id")
    .eq("sync_variant_id", variantId)
    .maybeSingle();

  failIfError(variantResult.error, "read variant for publish compatibility");
  const syncProductId = toInteger(toObject(variantResult.data).sync_product_id, 0);
  if (syncProductId <= 0) {
    throw new Error("Variante Printful introuvable.");
  }

  return publishPrintfulProductToStoreInSupabase({ syncProductId });
}

export async function unpublishPrintfulVariantFromStoreInSupabase(input: {
  syncVariantId: number;
}): Promise<boolean> {
  const variantId = Math.floor(Number(input.syncVariantId));
  if (!Number.isFinite(variantId) || variantId <= 0) {
    throw new Error("Variante Printful invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const variantResult = await supabase
    .from("printful_sync_variants")
    .select("sync_product_id")
    .eq("sync_variant_id", variantId)
    .maybeSingle();

  failIfError(variantResult.error, "read variant for unpublish compatibility");
  const syncProductId = toInteger(toObject(variantResult.data).sync_product_id, 0);
  if (syncProductId <= 0) {
    throw new Error("Variante Printful introuvable.");
  }

  return unpublishPrintfulProductFromStoreInSupabase({ syncProductId });
}




