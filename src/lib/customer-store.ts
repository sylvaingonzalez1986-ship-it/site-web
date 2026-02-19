import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type {
  AdminCustomer,
  Customer,
  CustomerStore,
  PromoCode,
  PublicCustomer,
} from "@/types/customer";

const DATA_DIR = path.join(process.cwd(), "data");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");
const DEFAULT_COUNTRY = "France";
const PROMO_CODE_PATTERN = /^[A-Z0-9_-]{4,24}$/;
const DATE_OF_BIRTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTES_LENGTH = 4000;
const MAX_LOYALTY_BONUS_POINTS = 100000;
let customerWriteQueue: Promise<void> = Promise.resolve();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function sanitizePhone(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/[^\d+().\-\s]/g, "")
    .slice(0, 40);
}

function sanitizePostalCode(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .slice(0, 16);
}

function sanitizeCountry(value: unknown): string {
  const country = sanitizeText(value, 80);
  return country || DEFAULT_COUNTRY;
}

function parseDateOnly(dateValue: string): Date | null {
  if (!DATE_OF_BIRTH_PATTERN.test(dateValue)) {
    return null;
  }

  const [yearString, monthString, dayString] = dateValue.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function normalizeDateOfBirth(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  const parsed = parseDateOnly(trimmed);
  if (!parsed) {
    return undefined;
  }

  return trimmed;
}

export function isAtLeast18(dateOfBirth: string, now = new Date()): boolean {
  const parsedDate = parseDateOnly(dateOfBirth);
  if (!parsedDate) {
    return false;
  }

  const [yearString, monthString, dayString] = dateOfBirth.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  let age = now.getUTCFullYear() - year;
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();

  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age -= 1;
  }

  return age >= 18;
}

function sanitizeLoyaltyBonus(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(Number(value));
  if (rounded > MAX_LOYALTY_BONUS_POINTS) {
    return MAX_LOYALTY_BONUS_POINTS;
  }
  if (rounded < -MAX_LOYALTY_BONUS_POINTS) {
    return -MAX_LOYALTY_BONUS_POINTS;
  }
  return rounded;
}

function normalizePromoCode(input: unknown): PromoCode | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Partial<PromoCode>;
  const code = typeof raw.code === "string" ? raw.code.trim().toUpperCase() : "";
  if (!PROMO_CODE_PATTERN.test(code)) {
    return null;
  }

  const discountPercent = Number(raw.discountPercent);
  if (!Number.isFinite(discountPercent)) {
    return null;
  }

  const boundedDiscount = Math.round(discountPercent);
  if (boundedDiscount < 1 || boundedDiscount > 80) {
    return null;
  }

  const createdAt =
    typeof raw.createdAt === "string" && Number.isFinite(Date.parse(raw.createdAt))
      ? raw.createdAt
      : new Date().toISOString();

  const used = typeof raw.used === "boolean" ? raw.used : false;
  const usedAt =
    used && typeof raw.usedAt === "string" && Number.isFinite(Date.parse(raw.usedAt))
      ? raw.usedAt
      : undefined;

  return {
    code,
    discountPercent: boundedDiscount,
    used,
    createdAt,
    usedAt,
  };
}

function createCustomerId(): string {
  const random = Math.floor(Math.random() * 900000 + 100000);
  return `CUS-${Date.now()}-${random}`;
}

function normalizeCustomer(input: Partial<Customer>): Customer {
  const promoCodes: PromoCode[] = [];
  const rawPromoCodes = Array.isArray(input.promoCodes) ? input.promoCodes : [];
  const seenCodes = new Set<string>();

  for (const item of rawPromoCodes) {
    const promo = normalizePromoCode(item);
    if (!promo || seenCodes.has(promo.code)) {
      continue;
    }
    seenCodes.add(promo.code);
    promoCodes.push(promo);
  }

  return {
    id: sanitizeText(input.id, 64) || createCustomerId(),
    email: normalizeEmail(typeof input.email === "string" ? input.email : ""),
    firstName: sanitizeText(input.firstName, 80),
    lastName: sanitizeText(input.lastName, 80),
    dateOfBirth: normalizeDateOfBirth(input.dateOfBirth),
    phone: sanitizePhone(input.phone),
    address: sanitizeText(input.address, 180),
    city: sanitizeText(input.city, 120),
    postalCode: sanitizePostalCode(input.postalCode),
    country: sanitizeCountry(input.country),
    notes: sanitizeText(input.notes, MAX_NOTES_LENGTH),
    loyaltyPoints: sanitizeLoyaltyBonus(input.loyaltyPoints),
    promoCodes,
    passwordHash: typeof input.passwordHash === "string" ? input.passwordHash : "",
    passwordSalt: typeof input.passwordSalt === "string" ? input.passwordSalt : "",
    createdAt:
      typeof input.createdAt === "string" && Number.isFinite(Date.parse(input.createdAt))
        ? input.createdAt
        : new Date().toISOString(),
  };
}

function normalizeStore(store: Partial<CustomerStore>): CustomerStore {
  const rawCustomers = Array.isArray(store.customers) ? store.customers : [];
  const seenIds = new Set<string>();
  const customers: Customer[] = [];

  for (const entry of rawCustomers) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const normalized = normalizeCustomer(entry as Partial<Customer>);
    if (!normalized.id || seenIds.has(normalized.id)) {
      continue;
    }
    if (!normalized.email || !normalized.passwordHash || !normalized.passwordSalt) {
      continue;
    }

    seenIds.add(normalized.id);
    customers.push(normalized);
  }

  return { customers };
}

function toPublicCustomer(customer: Customer): PublicCustomer {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    dateOfBirth: customer.dateOfBirth,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    postalCode: customer.postalCode,
    country: customer.country,
    loyaltyPoints: customer.loyaltyPoints,
    promoCodes: customer.promoCodes,
    createdAt: customer.createdAt,
  };
}

function toAdminCustomer(customer: Customer): AdminCustomer {
  return {
    ...toPublicCustomer(customer),
    notes: customer.notes,
  };
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

async function ensureCustomersFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(CUSTOMERS_FILE, "utf8");
  } catch {
    const initial: CustomerStore = { customers: [] };
    await writeFile(CUSTOMERS_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readCustomersStore(): Promise<CustomerStore> {
  await ensureCustomersFile();
  const raw = await readFile(CUSTOMERS_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw) as Partial<CustomerStore>;
    return normalizeStore(parsed);
  } catch {
    return { customers: [] };
  }
}

async function writeCustomersStore(store: CustomerStore) {
  await ensureCustomersFile();
  await writeFile(CUSTOMERS_FILE, JSON.stringify(store, null, 2), "utf8");
}

function withCustomerWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const task = customerWriteQueue.then(operation, operation);
  customerWriteQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function createCustomer(input: {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  password: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}): Promise<{ customer: PublicCustomer; customerId: string }> {
  const email = normalizeEmail(input.email);
  const firstName = sanitizeText(input.firstName, 80);
  const lastName = sanitizeText(input.lastName, 80);
  const dateOfBirth = normalizeDateOfBirth(input.dateOfBirth);

  if (!email || !firstName || !lastName || input.password.length < 8 || !dateOfBirth) {
    throw new Error("Informations invalides.");
  }
  if (!isAtLeast18(dateOfBirth)) {
    throw new Error("Inscription reservee aux personnes majeures (18+).");
  }

  return withCustomerWriteLock(async () => {
    const store = await readCustomersStore();
    const exists = store.customers.some((customer) => customer.email === email);
    if (exists) {
      throw new Error("Cet email est deja utilise.");
    }

    const salt = randomBytes(16).toString("hex");
    const passwordHash = hashPassword(input.password, salt);

    const customer = normalizeCustomer({
      id: createCustomerId(),
      email,
      firstName,
      lastName,
      dateOfBirth,
      phone: input.phone,
      address: input.address,
      city: input.city,
      postalCode: input.postalCode,
      country: input.country,
      notes: "",
      loyaltyPoints: 0,
      promoCodes: [],
      passwordHash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    });

    await writeCustomersStore({ customers: [customer, ...store.customers] });
    return { customer: toPublicCustomer(customer), customerId: customer.id };
  });
}

export async function authenticateCustomer(input: {
  email: string;
  password: string;
}): Promise<{ customer: PublicCustomer; customerId: string } | null> {
  const email = normalizeEmail(input.email);
  const store = await readCustomersStore();
  const customer = store.customers.find((item) => item.email === email);

  if (!customer) {
    return null;
  }

  const candidateHash = hashPassword(input.password, customer.passwordSalt);
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(customer.passwordHash, "hex");

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  return { customer: toPublicCustomer(customer), customerId: customer.id };
}

export async function getCustomerById(customerId: string): Promise<PublicCustomer | null> {
  if (!customerId) {
    return null;
  }

  const store = await readCustomersStore();
  const customer = store.customers.find((item) => item.id === customerId);
  return customer ? toPublicCustomer(customer) : null;
}

export async function getCustomerByIdFull(customerId: string): Promise<AdminCustomer | null> {
  if (!customerId) {
    return null;
  }

  const store = await readCustomersStore();
  const customer = store.customers.find((item) => item.id === customerId);
  return customer ? toAdminCustomer(customer) : null;
}

export async function getAllCustomers(): Promise<AdminCustomer[]> {
  const store = await readCustomersStore();
  return store.customers.map(toAdminCustomer);
}

export async function updateCustomerProfile(
  customerId: string,
  input: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  },
): Promise<PublicCustomer | null> {
  const nextInput = { ...input };
  if (typeof input.dateOfBirth === "string") {
    const normalizedDateOfBirth = normalizeDateOfBirth(input.dateOfBirth);
    if (!normalizedDateOfBirth) {
      throw new Error("Date de naissance invalide.");
    }
    if (!isAtLeast18(normalizedDateOfBirth)) {
      throw new Error("Ce site est reserve aux personnes majeures (18+).");
    }

    nextInput.dateOfBirth = normalizedDateOfBirth;
  }

  const updated = await adminUpdateCustomer(customerId, nextInput);
  if (!updated) {
    return null;
  }

  return {
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    dateOfBirth: updated.dateOfBirth,
    phone: updated.phone,
    address: updated.address,
    city: updated.city,
    postalCode: updated.postalCode,
    country: updated.country,
    loyaltyPoints: updated.loyaltyPoints,
    promoCodes: updated.promoCodes,
    createdAt: updated.createdAt,
  };
}

export async function adminUpdateCustomer(
  customerId: string,
  input: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    notes?: string;
    loyaltyPoints?: number;
  },
): Promise<AdminCustomer | null> {
  if (!customerId) {
    return null;
  }

  return withCustomerWriteLock(async () => {
    const store = await readCustomersStore();
    let updated: Customer | null = null;

    const customers = store.customers.map((customer) => {
      if (customer.id !== customerId) {
        return customer;
      }

      updated = normalizeCustomer({
        ...customer,
        firstName:
          typeof input.firstName === "string" ? input.firstName : customer.firstName,
        lastName:
          typeof input.lastName === "string" ? input.lastName : customer.lastName,
        dateOfBirth:
          typeof input.dateOfBirth === "string"
            ? input.dateOfBirth
            : customer.dateOfBirth,
        phone: typeof input.phone === "string" ? input.phone : customer.phone,
        address:
          typeof input.address === "string" ? input.address : customer.address,
        city: typeof input.city === "string" ? input.city : customer.city,
        postalCode:
          typeof input.postalCode === "string"
            ? input.postalCode
            : customer.postalCode,
        country:
          typeof input.country === "string" ? input.country : customer.country,
        notes: typeof input.notes === "string" ? input.notes : customer.notes,
        loyaltyPoints:
          typeof input.loyaltyPoints === "number"
            ? input.loyaltyPoints
            : customer.loyaltyPoints,
      });

      return updated;
    });

    if (!updated) {
      return null;
    }

    await writeCustomersStore({ customers });
    return toAdminCustomer(updated);
  });
}

export async function addPromoCode(
  customerId: string,
  input: { code: string; discountPercent: number },
): Promise<AdminCustomer | null> {
  const normalizedPromo = normalizePromoCode({
    code: input.code,
    discountPercent: input.discountPercent,
    used: false,
    createdAt: new Date().toISOString(),
  });

  if (!normalizedPromo) {
    throw new Error("Code promo invalide.");
  }

  return withCustomerWriteLock(async () => {
    const store = await readCustomersStore();
    let updated: Customer | null = null;

    const customers = store.customers.map((customer) => {
      if (customer.id !== customerId) {
        return customer;
      }

      const hasDuplicate = customer.promoCodes.some(
        (promo) => promo.code === normalizedPromo.code,
      );
      if (hasDuplicate) {
        throw new Error("Ce code promo existe deja pour ce client.");
      }

      updated = normalizeCustomer({
        ...customer,
        promoCodes: [normalizedPromo, ...customer.promoCodes],
      });
      return updated;
    });

    if (!updated) {
      return null;
    }

    await writeCustomersStore({ customers });
    return toAdminCustomer(updated);
  });
}

export async function markPromoCodeUsed(
  customerId: string,
  code: string,
): Promise<PromoCode | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!PROMO_CODE_PATTERN.test(normalizedCode)) {
    return null;
  }

  return withCustomerWriteLock(async () => {
    const store = await readCustomersStore();
    let usedPromo: PromoCode | null = null;

    const customers = store.customers.map((customer) => {
      if (customer.id !== customerId) {
        return customer;
      }

      const promoCodes = customer.promoCodes.map((promo) => {
        if (promo.code !== normalizedCode || promo.used) {
          return promo;
        }

        usedPromo = {
          ...promo,
          used: true,
          usedAt: new Date().toISOString(),
        };
        return usedPromo;
      });

      return normalizeCustomer({
        ...customer,
        promoCodes,
      });
    });

    if (!usedPromo) {
      return null;
    }

    await writeCustomersStore({ customers });
    return usedPromo;
  });
}

export async function previewPromoCode(
  customerId: string,
  code: string,
): Promise<PromoCode | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!PROMO_CODE_PATTERN.test(normalizedCode)) {
    return null;
  }

  const store = await readCustomersStore();
  const customer = store.customers.find((item) => item.id === customerId);
  if (!customer) {
    return null;
  }

  return customer.promoCodes.find(
    (promo) => promo.code === normalizedCode && !promo.used,
  ) ?? null;
}

export async function consumePromoCode(
  customerId: string,
  code: string,
): Promise<PromoCode | null> {
  return markPromoCodeUsed(customerId, code);
}
