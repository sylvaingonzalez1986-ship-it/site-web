import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DATE_OF_BIRTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function sanitizeText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizePhone(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[^\d+().\-\s]/g, "").slice(0, 40);
}

function sanitizePostalCode(value) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[^A-Z0-9\s-]/g, "").slice(0, 16);
}

function normalizeDateOfBirth(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!DATE_OF_BIRTH_PATTERN.test(trimmed)) return null;
  const parsed = Date.parse(`${trimmed}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return trimmed;
}

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function mapPromoCode(customerId, promo) {
  const code = sanitizeText(promo?.code, 24).toUpperCase();
  const discountPercent = Number(promo?.discountPercent);
  const used = promo?.used === true;
  const createdAt = typeof promo?.createdAt === "string" ? promo.createdAt : new Date().toISOString();
  const usedAt = typeof promo?.usedAt === "string" ? promo.usedAt : null;

  if (!code || !Number.isFinite(discountPercent)) {
    return null;
  }

  return {
    customer_id: customerId,
    code,
    discount_percent: Math.max(1, Math.min(80, Math.round(discountPercent))),
    used,
    created_at: createdAt,
    used_at: used ? usedAt : null,
  };
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw new Error(`listUsers failed: ${error.message}`);
    }
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

async function ensureAuthUser(supabase, email, firstName, lastName) {
  const allUsers = await listAllUsers(supabase);
  const existing = allUsers.find((user) => (user.email ?? "").toLowerCase() === email.toLowerCase());
  if (existing?.id) {
    return { id: existing.id, created: false };
  }

  const tempPassword = `${randomUUID()}aA1!`;
  const created = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { firstName, lastName, needsPasswordReset: true },
  });
  if (created.error || !created.data.user?.id) {
    throw new Error(`createUser failed for ${email}: ${created.error?.message ?? "unknown"}`);
  }

  return { id: created.data.user.id, created: true };
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

  const customersFile = path.join(ROOT, "data", "customers.json");
  const customersStore = await readJson(customersFile, { customers: [] });
  const customers = Array.isArray(customersStore?.customers) ? customersStore.customers : [];

  if (customers.length === 0) {
    console.log("No legacy customers found, nothing to migrate.");
    return;
  }

  let createdUsers = 0;
  let updatedProfiles = 0;
  let migratedPromoCodes = 0;

  for (const legacyCustomer of customers) {
    const email = normalizeEmail(legacyCustomer?.email);
    if (!email) continue;

    const firstName = sanitizeText(legacyCustomer?.firstName, 80);
    const lastName = sanitizeText(legacyCustomer?.lastName, 80);
    const dateOfBirth = normalizeDateOfBirth(legacyCustomer?.dateOfBirth);

    const ensured = await ensureAuthUser(supabase, email, firstName, lastName);
    if (ensured.created) {
      createdUsers += 1;
    }

    const profile = {
      id: ensured.id,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      phone: sanitizePhone(legacyCustomer?.phone),
      address: sanitizeText(legacyCustomer?.address, 180),
      city: sanitizeText(legacyCustomer?.city, 120),
      postal_code: sanitizePostalCode(legacyCustomer?.postalCode),
      country: sanitizeText(legacyCustomer?.country, 80) || "France",
      notes: sanitizeText(legacyCustomer?.notes, 4000),
      loyalty_points: Number.isFinite(Number(legacyCustomer?.loyaltyPoints))
        ? Math.round(Number(legacyCustomer.loyaltyPoints))
        : 0,
    };

    const upsertProfile = await supabase
      .from("profiles")
      .upsert(profile, { onConflict: "id" });
    if (upsertProfile.error) {
      throw new Error(`upsert profile failed for ${email}: ${upsertProfile.error.message}`);
    }
    updatedProfiles += 1;

    const promoCodes = Array.isArray(legacyCustomer?.promoCodes) ? legacyCustomer.promoCodes : [];
    const rows = promoCodes
      .map((promo) => mapPromoCode(ensured.id, promo))
      .filter((row) => row !== null);

    if (rows.length > 0) {
      const upsertPromos = await supabase
        .from("promo_codes")
        .upsert(rows, { onConflict: "customer_id,code" });
      if (upsertPromos.error) {
        throw new Error(`upsert promo_codes failed for ${email}: ${upsertPromos.error.message}`);
      }
      migratedPromoCodes += rows.length;
    }
  }

  console.log(
    `Legacy customer migration completed. createdUsers=${createdUsers}, updatedProfiles=${updatedProfiles}, migratedPromoCodes=${migratedPromoCodes}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
