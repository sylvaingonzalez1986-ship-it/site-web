import "server-only";

import type { Product } from "@/data/products";
import type { PublicCustomer } from "@/types/customer";
import type { CmsOrder } from "@/types/store";

const MAX_SHIPMENTS_PER_FILE = 500;
const DEFAULT_WEIGHT_GRAMS = 150;
const MIAM_BONUS_GRAMS = 100;

const TEXT_ALLOWED = /[^0-9A-Z_\-'., /]/g;
const CITY_ALLOWED = /[^A-Z_\-' ]/g;
const ARTICLE_ALLOWED = /[<>&']/g;
const PHONE_FR_REGEX = /^((00|\+)33|0)[0-9][0-9]{8}$/;

export type MondialRelayExportConfig = {
  collectionType: "R" | "D";
  collectionRelayId: string;
  collectionCountry: string;
};

export type MondialRelayExportResult = {
  csv: string;
  errors: string[];
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeMrText(value: string): string {
  return stripDiacritics(value).toUpperCase().replace(/;/g, " ").trim();
}

function sanitizeText(
  value: string,
  maxLength: number,
  allowedRegex = TEXT_ALLOWED,
): string {
  const base = normalizeMrText(value).replace(allowedRegex, " ");
  return base.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeCity(value: string, maxLength: number): string {
  const base = normalizeMrText(value).replace(CITY_ALLOWED, " ");
  return base.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeEmail(value: string): string {
  return normalizeMrText(value).replace(/\s+/g, "").slice(0, 70);
}

function normalizeCountryCode(value: string | undefined): string {
  const normalized = normalizeMrText(value ?? "").replace(/[^A-Z]/g, "");
  if (!normalized) {
    return "";
  }
  if (normalized === "FRANCE") {
    return "FR";
  }
  return normalized.slice(0, 2);
}

function normalizePostalCode(value: string | undefined, countryCode: string): string {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  if (countryCode === "FR") {
    return digits.slice(0, 5);
  }
  return digits.slice(0, 10);
}

function normalizePhone(value: string | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (PHONE_FR_REGEX.test(cleaned)) {
    return cleaned;
  }
  return "";
}

function normalizeRelayId(value: string | undefined): string {
  const digits = normalizeMrText(value ?? "").replace(/[^0-9]/g, "");
  return digits.slice(0, 6);
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = sanitizeText(fullName, 64);
  if (!cleaned) {
    return { firstName: "", lastName: "" };
  }
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1)[0] ?? "",
  };
}

function buildConsigneeName(input: {
  customer?: PublicCustomer | null;
  orderName?: string | null;
}): { text: string; firstName: string; lastName: string } {
  const customer = input.customer;
  if (customer?.firstName || customer?.lastName) {
    const firstName = sanitizeText(customer.firstName ?? "", 32);
    const lastName = sanitizeText(customer.lastName ?? "", 32);
    const text = [lastName, firstName].filter(Boolean).join(" ").trim();
    return { text, firstName, lastName };
  }

  const fallback = splitName(input.orderName ?? "");
  const text = [fallback.lastName, fallback.firstName].filter(Boolean).join(" ").trim();
  return { text, firstName: fallback.firstName, lastName: fallback.lastName };
}

function computeOrderWeight(order: CmsOrder, productsById: Map<string, Product>): number {
  let total = 0;

  for (const item of order.items) {
    const product = productsById.get(item.productId);
    const quantity = Math.max(1, Math.floor(item.quantity));
    const weightPerUnit = product?.weightGrams && product.weightGrams > 0
      ? product.weightGrams
      : DEFAULT_WEIGHT_GRAMS;
    const miamBonus = product?.category === "miam" ? MIAM_BONUS_GRAMS : 0;
    total += (weightPerUnit + miamBonus) * quantity;
  }

  return Math.max(1, Math.round(total));
}

function expandArticles(order: CmsOrder): string[] {
  const list: string[] = [];
  for (const item of order.items) {
    const label = normalizeMrText(item.name).replace(ARTICLE_ALLOWED, "").trim();
    const safe = label.slice(0, 30);
    if (!safe) {
      continue;
    }
    const count = Math.max(1, Math.floor(item.quantity));
    for (let i = 0; i < count && list.length < 10; i += 1) {
      list.push(safe);
    }
    if (list.length >= 10) {
      break;
    }
  }
  return list;
}

function sanitizeMerchantReference(orderId: string): string {
  const safe = normalizeMrText(orderId).replace(/[^0-9A-Z_ -]/g, "");
  return safe.slice(0, 15);
}

function formatCents(value: number): string {
  const cents = Math.max(0, Math.round(value * 100));
  return String(cents).slice(0, 7);
}

function ensureLength(value: string, minLength: number): boolean {
  return value.length >= minLength;
}

export function buildMondialRelayCsv(input: {
  orders: CmsOrder[];
  productsById: Map<string, Product>;
  customersById: Map<string, PublicCustomer | null>;
  config: MondialRelayExportConfig;
}): MondialRelayExportResult {
  const errors: string[] = [];

  if (input.orders.length > MAX_SHIPMENTS_PER_FILE) {
    errors.push("Le fichier Mondial Relay ne peut pas contenir plus de 500 envois.");
    return { csv: "", errors };
  }

  const rows: string[] = [];

  for (const order of input.orders) {
    const customer = order.customerId ? input.customersById.get(order.customerId) : null;
    const consigneeName = buildConsigneeName({ customer, orderName: order.customerName });
    const customerAddress = customer?.address?.trim() ? customer.address : "";
    const customerCity = customer?.city?.trim() ? customer.city : "";
    const customerPostal = customer?.postalCode?.trim() ? customer.postalCode : "";
    const customerCountry = customer?.country?.trim() ? customer.country : "";

    const deliveryMethod = order.deliveryMethod === "relay" ? "relay" : "home";
    const countryCode = normalizeCountryCode(customerCountry || order.shippingCountry);
    const addressLine = sanitizeText(
      customerAddress || order.shippingAddress || "",
      32,
    );
    const city = sanitizeCity(customerCity || order.shippingCity || "", 25);
    const postalCode = normalizePostalCode(customerPostal || order.shippingPostalCode, countryCode);
    const email = sanitizeEmail(order.customerEmail ?? "");
    const phone = normalizePhone(
      customer?.phone?.trim() || order.shippingPhone?.trim() || "",
    );

    if (!ensureLength(consigneeName.text, 2)) {
      errors.push(`${order.id}: nom destinataire manquant.`);
      continue;
    }
    if (!ensureLength(addressLine, 2)) {
      errors.push(`${order.id}: adresse destinataire manquante.`);
      continue;
    }
    if (!ensureLength(city, 2)) {
      errors.push(`${order.id}: ville destinataire manquante.`);
      continue;
    }
    if (!postalCode) {
      errors.push(`${order.id}: code postal manquant.`);
      continue;
    }
    if (!countryCode) {
      errors.push(`${order.id}: pays manquant.`);
      continue;
    }
    if (!phone) {
      errors.push(`${order.id}: telephone invalide ou manquant.`);
      continue;
    }
    if (!email) {
      errors.push(`${order.id}: email invalide ou manquant.`);
      continue;
    }

    if (input.config.collectionType === "R") {
      const relayId = normalizeRelayId(input.config.collectionRelayId);
      const relayCountry = normalizeCountryCode(input.config.collectionCountry);
      if (!relayId || relayId.length < 6 || !relayCountry) {
        errors.push(`${order.id}: infos Point Relais collecte manquantes.`);
        continue;
      }
    }

    if (deliveryMethod === "relay") {
      const relayId = normalizeRelayId(order.relayId);
      const relayCountry = normalizeCountryCode(order.relayCountry || order.shippingCountry);
      if (!relayId || relayId.length < 6 || !relayCountry) {
        errors.push(`${order.id}: infos Point Relais livraison manquantes.`);
        continue;
      }
    }

    const weight = computeOrderWeight(order, input.productsById);
    const weightField = String(weight).padStart(3, "0").slice(0, 7);
    const parcelCount = "1";
    const articles = expandArticles(order);
    const deliveryRelayId =
      deliveryMethod === "relay" ? normalizeRelayId(order.relayId) : "";
    const deliveryRelayCountry =
      deliveryMethod === "relay"
        ? normalizeCountryCode(order.relayCountry || order.shippingCountry)
        : "";

    const row = [
      "", // A Consignee N°
      sanitizeMerchantReference(order.id), // B Merchant shipment reference
      consigneeName.text.slice(0, 32), // C Consignee name
      "", // D Other name info
      addressLine, // E Address
      "", // F Extra address
      city, // G City
      postalCode, // H Zipcode
      countryCode, // I Country
      "", // J Phone 1
      phone, // K Phone 2
      email, // L Email
      input.config.collectionType, // M Collection type
      input.config.collectionType === "R" ? normalizeRelayId(input.config.collectionRelayId) : "", // N Collection relay
      input.config.collectionType === "R" ? normalizeCountryCode(input.config.collectionCountry) : "", // O Collection country
      deliveryMethod === "relay" ? "R" : "D", // P Delivery type
      deliveryRelayId, // Q Delivery relay id
      deliveryRelayCountry, // R Delivery country
      "24R", // S Delivery mode
      "FR", // T Language
      parcelCount, // U Parcels
      weightField, // V Weight grams
      "0", // W Length
      "0", // X Volume
      formatCents(order.totalAmount), // Y Value
      "EUR", // Z Currency
      "0", // AA Insurance
      "0", // AB COD amount
      "EUR", // AC COD currency
      "", // AD Delivery info
      "1", // AE Notification
      "0", // AF Home collection
      "0", // AG Assembly time
      "", // AH Delivery appointment
      ...Array.from({ length: 10 }).map((_, index) => articles[index] ?? ""), // AI-AR
    ];

    rows.push(row.join(";"));
  }

  if (errors.length > 0) {
    return { csv: "", errors };
  }

  return { csv: rows.join("\n"), errors: [] };
}
