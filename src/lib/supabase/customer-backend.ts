import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertPasswordNotLeaked } from "@/lib/password-leak-check";
import { bindSupabaseReferralCode } from "@/lib/supabase/referral-backend";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminCustomer, PromoCode, PublicCustomer } from "@/types/customer";

const PROMO_CODE_PATTERN = /^[A-Z0-9_-]{4,24}$/;
const DATE_OF_BIRTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_COUNTRY = "France";
const MAX_NOTES_LENGTH = 4000;
const MAX_LOYALTY_BONUS_POINTS = 100000;

const SELECT_PROFILE_COLUMNS = [
  "id",
  "first_name",
  "last_name",
  "date_of_birth",
  "phone",
  "address",
  "city",
  "postal_code",
  "country",
  "notes",
  "loyalty_points",
  "loyalty_points_spent",
  "referral_code",
  "referred_by_code",
  "referral_bound_at",
  "referral_rewarded_at",
  "created_at",
].join(",");

const SELECT_PROMO_CODE_COLUMNS = [
  "customer_id",
  "code",
  "discount_percent",
  "used",
  "created_at",
  "used_at",
].join(",");

const SELECT_CONTEST_BETA_TESTER_COLUMNS = [
  "customer_id",
  "enabled",
].join(",");

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function isMissingContestBetaTableError(error: { message: string } | null): boolean {
  const message = error?.message.toLowerCase() ?? "";
  return (
    message.includes("contest_beta_testers") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function isAuthSessionMissingError(error: { message: string } | null): boolean {
  if (!error?.message) {
    return false;
  }

  return error.message.toLowerCase().includes("auth session missing");
}

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

function createSupabasePasswordResetClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseEnv();
  return createClient(url, anonKey, {
    auth: {
      flowType: "implicit",
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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

function generateReferralCodeFromUserId(userId: string): string {
  return userId
    .replace(/-/g, "")
    .toUpperCase()
    .slice(0, 10);
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

function mapPromoCodeRow(row: Record<string, unknown>): PromoCode | null {
  const code = typeof row.code === "string" ? row.code.trim().toUpperCase() : "";
  if (!PROMO_CODE_PATTERN.test(code)) {
    return null;
  }

  const discountPercent = Number(row.discount_percent);
  if (!Number.isFinite(discountPercent)) {
    return null;
  }

  const boundedDiscount = Math.round(discountPercent);
  if (boundedDiscount < 1 || boundedDiscount > 80) {
    return null;
  }

  const createdAt =
    typeof row.created_at === "string" && Number.isFinite(Date.parse(row.created_at))
      ? row.created_at
      : new Date().toISOString();
  const used = row.used === true;
  const usedAt =
    used && typeof row.used_at === "string" && Number.isFinite(Date.parse(row.used_at))
      ? row.used_at
      : undefined;

  return {
    code,
    discountPercent: boundedDiscount,
    used,
    createdAt,
    usedAt,
  };
}

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  notes: string;
  loyalty_points: number;
  loyalty_points_spent: number;
  referral_code: string;
  referred_by_code: string | null;
  referral_bound_at: string | null;
  referral_rewarded_at: string | null;
  created_at: string;
};

function mapProfileToPublicCustomer(
  profile: ProfileRow,
  email: string,
  promoCodes: PromoCode[],
  contestBetaEnabled = false,
): PublicCustomer {
  return {
    id: profile.id,
    email: normalizeEmail(email),
    firstName: profile.first_name || "",
    lastName: profile.last_name || "",
    dateOfBirth: profile.date_of_birth ?? undefined,
    phone: profile.phone || "",
    address: profile.address || "",
    city: profile.city || "",
    postalCode: profile.postal_code || "",
    country: profile.country || DEFAULT_COUNTRY,
    loyaltyPoints: Number.isFinite(profile.loyalty_points) ? profile.loyalty_points : 0,
    loyaltyPointsSpent: Number.isFinite(profile.loyalty_points_spent)
      ? Math.max(0, Math.round(profile.loyalty_points_spent))
      : 0,
    contestBetaEnabled,
    promoCodes,
    referralCode:
      typeof profile.referral_code === "string" ? profile.referral_code.trim().toUpperCase() : undefined,
    referredByCode:
      typeof profile.referred_by_code === "string"
        ? profile.referred_by_code.trim().toUpperCase()
        : undefined,
    referralBoundAt:
      typeof profile.referral_bound_at === "string" &&
      Number.isFinite(Date.parse(profile.referral_bound_at))
        ? profile.referral_bound_at
        : undefined,
    referralRewardedAt:
      typeof profile.referral_rewarded_at === "string" &&
      Number.isFinite(Date.parse(profile.referral_rewarded_at))
        ? profile.referral_rewarded_at
        : undefined,
    createdAt:
      typeof profile.created_at === "string" && Number.isFinite(Date.parse(profile.created_at))
        ? profile.created_at
        : new Date().toISOString(),
  };
}

function mapProfileToAdminCustomer(
  profile: ProfileRow,
  email: string,
  promoCodes: PromoCode[],
  contestBetaEnabled = false,
): AdminCustomer {
  return {
    ...mapProfileToPublicCustomer(profile, email, promoCodes, contestBetaEnabled),
    notes: typeof profile.notes === "string" ? profile.notes : "",
  };
}

async function ensureProfileRow(input: {
  userId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}): Promise<ProfileRow> {
  const supabase = createSupabaseServiceClient();
  const existing = await supabase
    .from("profiles")
    .select(SELECT_PROFILE_COLUMNS)
    .eq("id", input.userId)
    .maybeSingle();
  failIfError(existing.error, "select profile");

  if (existing.data) {
    return existing.data as unknown as ProfileRow;
  }

  const insertRow = {
    id: input.userId,
    first_name: sanitizeText(input.firstName, 80),
    last_name: sanitizeText(input.lastName, 80),
    date_of_birth: normalizeDateOfBirth(input.dateOfBirth) ?? null,
    phone: sanitizePhone(input.phone),
    address: sanitizeText(input.address, 180),
    city: sanitizeText(input.city, 120),
    postal_code: sanitizePostalCode(input.postalCode),
    country: sanitizeCountry(input.country),
    notes: "",
    loyalty_points: 0,
    loyalty_points_spent: 0,
    referral_code: generateReferralCodeFromUserId(input.userId),
  };

  const inserted = await supabase
    .from("profiles")
    .insert(insertRow)
    .select(SELECT_PROFILE_COLUMNS)
    .single();
  failIfError(inserted.error, "insert profile");
  return inserted.data as unknown as ProfileRow;
}

async function loadPromoCodes(customerId: string): Promise<PromoCode[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("promo_codes")
    .select(SELECT_PROMO_CODE_COLUMNS)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  failIfError(result.error, "select promo_codes");

  const promoCodes: PromoCode[] = [];
  for (const rawRow of result.data ?? []) {
    const row = rawRow as unknown as Record<string, unknown>;
    const promo = mapPromoCodeRow(row);
    if (!promo) {
      continue;
    }
    promoCodes.push(promo);
  }
  return promoCodes;
}

async function loadPromoCodesByCustomerIds(customerIds: string[]): Promise<Map<string, PromoCode[]>> {
  const map = new Map<string, PromoCode[]>();
  if (customerIds.length === 0) {
    return map;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("promo_codes")
    .select(SELECT_PROMO_CODE_COLUMNS)
    .in("customer_id", customerIds)
    .order("created_at", { ascending: false });
  failIfError(result.error, "select promo_codes by customer ids");

  for (const rawRow of result.data ?? []) {
    const row = rawRow as unknown as Record<string, unknown>;
    const customerId = typeof row.customer_id === "string" ? row.customer_id : "";
    if (!customerId) {
      continue;
    }

    const promo = mapPromoCodeRow(row);
    if (!promo) {
      continue;
    }

    const list = map.get(customerId) ?? [];
    list.push(promo);
    map.set(customerId, list);
  }

  return map;
}

async function loadContestBetaTesterEnabled(customerId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_beta_testers")
    .select(SELECT_CONTEST_BETA_TESTER_COLUMNS)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (isMissingContestBetaTableError(result.error)) {
    return false;
  }
  failIfError(result.error, "select contest beta tester");

  const row = result.data as unknown as Record<string, unknown> | null;
  return row?.enabled === true;
}

async function loadContestBetaTesterMap(customerIds: string[]): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (customerIds.length === 0) {
    return map;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_beta_testers")
    .select(SELECT_CONTEST_BETA_TESTER_COLUMNS)
    .in("customer_id", customerIds);
  if (isMissingContestBetaTableError(result.error)) {
    return map;
  }
  failIfError(result.error, "select contest beta testers");

  for (const rawRow of result.data ?? []) {
    const row = rawRow as unknown as Record<string, unknown>;
    const customerId = typeof row.customer_id === "string" ? row.customer_id : "";
    if (!customerId) {
      continue;
    }
    map.set(customerId, row.enabled === true);
  }

  return map;
}

async function setContestBetaTesterEnabled(customerId: string, enabled: boolean): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("contest_beta_testers")
    .upsert(
      {
        customer_id: customerId,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" },
    );
  if (isMissingContestBetaTableError(result.error)) {
    throw new Error("Migration contest_beta_testers manquante.");
  }
  failIfError(result.error, "upsert contest beta tester");
}

export async function getCurrentSupabaseSessionCustomer(): Promise<{
  customerId: string;
  customer: PublicCustomer;
} | null> {
  const supabaseServer = await createSupabaseServerClient();
  const authResult = await supabaseServer.auth.getUser();
  if (authResult.error) {
    if (isAuthSessionMissingError(authResult.error)) {
      return null;
    }
    failIfError(authResult.error, "auth.getUser");
  }

  const user = authResult.data.user;
  if (!user) {
    return null;
  }

  const profile = await ensureProfileRow({ userId: user.id });
  const promoCodes = await loadPromoCodes(user.id);
  const contestBetaEnabled = await loadContestBetaTesterEnabled(user.id);
  const customer = mapProfileToPublicCustomer(profile, user.email ?? "", promoCodes, contestBetaEnabled);
  return { customerId: user.id, customer };
}

export async function loginSupabaseCustomer(input: {
  email: string;
  password: string;
}): Promise<
  | { customer: PublicCustomer; customerId: string }
  | { error: "email_not_confirmed" | "invalid_credentials" }
> {
  const email = normalizeEmail(input.email);
  if (!email || !input.password) {
    return { error: "invalid_credentials" };
  }

  const supabaseServer = await createSupabaseServerClient();
  const loginResult = await supabaseServer.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (loginResult.error || !loginResult.data.user) {
    const message = (loginResult.error?.message ?? "").toLowerCase();
    if (message.includes("email not confirmed")) {
      return { error: "email_not_confirmed" };
    }
    return { error: "invalid_credentials" };
  }

  const user = loginResult.data.user;
  const profile = await ensureProfileRow({ userId: user.id });
  const promoCodes = await loadPromoCodes(user.id);
  const contestBetaEnabled = await loadContestBetaTesterEnabled(user.id);
  const customer = mapProfileToPublicCustomer(profile, user.email ?? email, promoCodes, contestBetaEnabled);
  return { customer, customerId: user.id };
}

export async function registerSupabaseCustomerWithEmailVerification(input: {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  password: string;
  referralCode?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}): Promise<{ needsEmailVerification: true; email: string }> {
  const email = normalizeEmail(input.email);
  const firstName = sanitizeText(input.firstName, 80);
  const lastName = sanitizeText(input.lastName, 80);
  const dateOfBirth = normalizeDateOfBirth(input.dateOfBirth);
  const referralCode =
    typeof input.referralCode === "string" ? input.referralCode.trim() : "";

  if (!email || !firstName || !lastName || input.password.length < 8 || !dateOfBirth) {
    throw new Error("Informations invalides.");
  }
  if (!isAtLeast18(dateOfBirth)) {
    throw new Error("Inscription reservee aux personnes majeures (18+).");
  }

  await assertPasswordNotLeaked(input.password);

  const supabaseServer = await createSupabaseServerClient();
  const createUserResult = await supabaseServer.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        firstName,
        lastName,
        dateOfBirth,
        phone: sanitizePhone(input.phone),
        address: sanitizeText(input.address, 180),
        city: sanitizeText(input.city, 120),
        postalCode: sanitizePostalCode(input.postalCode),
        country: sanitizeCountry(input.country),
        referralCode: referralCode || "",
      },
    },
  });

  if (createUserResult.error || !createUserResult.data.user) {
    const message = createUserResult.error?.message ?? "Erreur inscription.";
    if (message.toLowerCase().includes("already")) {
      throw new Error("Cet email est deja utilise.");
    }
    throw new Error(message);
  }

  return { needsEmailVerification: true, email };
}

export async function ensureSupabaseProfileRow(input: {
  userId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}): Promise<ProfileRow> {
  return ensureProfileRow(input);
}

export async function bindSupabaseReferralCodeSafe(input: {
  refereeId: string;
  referralCode: string;
}): Promise<void> {
  await bindSupabaseReferralCode(input);
}

export async function clearSupabaseSignupTransientMetadata(userId: string): Promise<void> {
  const safeUserId = userId.trim();
  if (!safeUserId) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const userResult = await supabase.auth.admin.getUserById(safeUserId);
  failIfError(userResult.error, "auth.admin.getUserById(clear metadata)");

  const currentMetadata =
    (userResult.data.user?.user_metadata as Record<string, unknown> | undefined) ?? {};

  const cleanedMetadata = {
    ...currentMetadata,
    referralCode: null,
    dateOfBirth: null,
    phone: null,
    address: null,
    city: null,
    postalCode: null,
    country: null,
  };

  const updateResult = await supabase.auth.admin.updateUserById(safeUserId, {
    user_metadata: cleanedMetadata,
  });
  failIfError(updateResult.error, "auth.admin.updateUserById(clear metadata)");
}

export async function logoutSupabaseCustomer(): Promise<void> {
  const supabaseServer = await createSupabaseServerClient();
  const logoutResult = await supabaseServer.auth.signOut();
  if (logoutResult.error && !isAuthSessionMissingError(logoutResult.error)) {
    failIfError(logoutResult.error, "auth.signOut");
  }
}

export async function requestSupabasePasswordReset(input: {
  email: string;
  redirectTo: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const redirectTo = input.redirectTo.trim();
  if (!email || !redirectTo) {
    throw new Error("Informations invalides.");
  }

  const supabase = createSupabasePasswordResetClient();
  const result = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (result.error) {
    const message = result.error.message.toLowerCase();
    if (message.includes("email rate limit exceeded")) {
      throw new Error("password_reset_email_rate_limited");
    }
    failIfError(result.error, "auth.resetPasswordForEmail");
  }
}

function isPasswordResetSessionError(error: { message: string } | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes("auth session missing") ||
    message.includes("session not found") ||
    message.includes("session missing") ||
    message.includes("refresh token") ||
    message.includes("invalid jwt") ||
    message.includes("jwt expired") ||
    message.includes("invalid grant") ||
    message.includes("token") ||
    message.includes("otp") ||
    message.includes("expired")
  );
}
export async function resetSupabaseCustomerPassword(input: {
  password: string;
  tokenHash?: string;
  accessToken?: string;
  refreshToken?: string;
}): Promise<{ email: string }> {
  const password = input.password;
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caracteres.");
  }

  await assertPasswordNotLeaked(password);

  const tokenHash = input.tokenHash?.trim() ?? "";
  const accessToken = input.accessToken?.trim() ?? "";
  const refreshToken = input.refreshToken?.trim() ?? "";
  const supabase = createSupabasePasswordResetClient();

  let email = "";
  if (tokenHash) {
    const verifyResult = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (verifyResult.error) {
      if (isPasswordResetSessionError(verifyResult.error)) {
        throw new Error("password_reset_session_invalid");
      }
      failIfError(verifyResult.error, "auth.verifyOtp(password reset)");
    }

    email = verifyResult.data.user?.email ?? verifyResult.data.session?.user?.email ?? "";
  } else if (accessToken && refreshToken) {
    const sessionResult = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionResult.error) {
      if (isPasswordResetSessionError(sessionResult.error)) {
        throw new Error("password_reset_session_invalid");
      }
      failIfError(sessionResult.error, "auth.setSession(password reset)");
    }

    email = sessionResult.data.user?.email ?? sessionResult.data.session?.user?.email ?? "";
  } else {
    throw new Error("password_reset_session_invalid");
  }

  const updateResult = await supabase.auth.updateUser({ password });
  if (updateResult.error) {
    if (isPasswordResetSessionError(updateResult.error)) {
      throw new Error("password_reset_session_invalid");
    }
    failIfError(updateResult.error, "auth.updateUser(password reset)");
  }

  const logoutResult = await supabase.auth.signOut();
  if (logoutResult.error && !isAuthSessionMissingError(logoutResult.error)) {
    failIfError(logoutResult.error, "auth.signOut(password reset)");
  }

  return { email: updateResult.data.user?.email ?? email };
}

export async function getSupabaseCustomerById(customerId: string): Promise<PublicCustomer | null> {
  const safeId = customerId.trim();
  if (!safeId) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const profileResult = await supabase
    .from("profiles")
    .select(SELECT_PROFILE_COLUMNS)
    .eq("id", safeId)
    .maybeSingle();
  failIfError(profileResult.error, "get profile by id");
  if (!profileResult.data) {
    return null;
  }

  const userResult = await supabase.auth.admin.getUserById(safeId);
  failIfError(userResult.error, "auth.admin.getUserById");
  const email = userResult.data.user?.email ?? "";

  const promoCodes = await loadPromoCodes(safeId);
  const contestBetaEnabled = await loadContestBetaTesterEnabled(safeId);
  return mapProfileToPublicCustomer(
    profileResult.data as unknown as ProfileRow,
    email,
    promoCodes,
    contestBetaEnabled,
  );
}

export async function getSupabaseCustomerByIdFull(customerId: string): Promise<AdminCustomer | null> {
  const safeId = customerId.trim();
  if (!safeId) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const profileResult = await supabase
    .from("profiles")
    .select(SELECT_PROFILE_COLUMNS)
    .eq("id", safeId)
    .maybeSingle();
  failIfError(profileResult.error, "get full profile by id");
  if (!profileResult.data) {
    return null;
  }

  const userResult = await supabase.auth.admin.getUserById(safeId);
  failIfError(userResult.error, "auth.admin.getUserById");
  const email = userResult.data.user?.email ?? "";

  const promoCodes = await loadPromoCodes(safeId);
  const contestBetaEnabled = await loadContestBetaTesterEnabled(safeId);
  return mapProfileToAdminCustomer(
    profileResult.data as unknown as ProfileRow,
    email,
    promoCodes,
    contestBetaEnabled,
  );
}

export async function getAllSupabaseCustomers(): Promise<AdminCustomer[]> {
  const supabase = createSupabaseServiceClient();
  const profilesResult = await supabase
    .from("profiles")
    .select(SELECT_PROFILE_COLUMNS)
    .order("created_at", { ascending: false });
  failIfError(profilesResult.error, "list profiles");

  const profiles = (profilesResult.data ?? []) as unknown as ProfileRow[];
  const ids = profiles.map((profile) => profile.id);
  const [promoById, contestBetaById] = await Promise.all([
    loadPromoCodesByCustomerIds(ids),
    loadContestBetaTesterMap(ids),
  ]);

  const listUsersResult = await supabase.auth.admin.listUsers();
  failIfError(listUsersResult.error, "auth.admin.listUsers");
  const emailById = new Map<string, string>();
  for (const user of listUsersResult.data.users ?? []) {
    if (!user.id) {
      continue;
    }
    emailById.set(user.id, user.email ?? "");
  }

  return profiles.map((profile) =>
    mapProfileToAdminCustomer(
      profile,
      emailById.get(profile.id) ?? "",
      promoById.get(profile.id) ?? [],
      contestBetaById.get(profile.id) === true,
    ),
  );
}

export async function updateSupabaseCustomerProfile(
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
  const updated = await adminUpdateSupabaseCustomer(customerId, input);
  if (!updated) {
    return null;
  }

  const { notes: _, ...publicCustomer } = updated;
  void _;
  return publicCustomer;
}

export async function adminUpdateSupabaseCustomer(
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
    contestBetaEnabled?: boolean;
  },
): Promise<AdminCustomer | null> {
  const safeId = customerId.trim();
  if (!safeId) {
    return null;
  }

  const dateOfBirth =
    typeof input.dateOfBirth === "string" ? normalizeDateOfBirth(input.dateOfBirth) : undefined;
  if (typeof input.dateOfBirth === "string" && !dateOfBirth) {
    throw new Error("Date de naissance invalide.");
  }
  if (dateOfBirth && !isAtLeast18(dateOfBirth)) {
    throw new Error("Ce site est reserve aux personnes majeures (18+).");
  }

  const supabase = createSupabaseServiceClient();
  const patch: Record<string, unknown> = {};
  if (typeof input.firstName === "string") {
    patch.first_name = sanitizeText(input.firstName, 80);
  }
  if (typeof input.lastName === "string") {
    patch.last_name = sanitizeText(input.lastName, 80);
  }
  if (typeof input.dateOfBirth === "string") {
    patch.date_of_birth = dateOfBirth ?? null;
  }
  if (typeof input.phone === "string") {
    patch.phone = sanitizePhone(input.phone);
  }
  if (typeof input.address === "string") {
    patch.address = sanitizeText(input.address, 180);
  }
  if (typeof input.city === "string") {
    patch.city = sanitizeText(input.city, 120);
  }
  if (typeof input.postalCode === "string") {
    patch.postal_code = sanitizePostalCode(input.postalCode);
  }
  if (typeof input.country === "string") {
    patch.country = sanitizeCountry(input.country);
  }
  if (typeof input.notes === "string") {
    patch.notes = sanitizeText(input.notes, MAX_NOTES_LENGTH);
  }
  if (typeof input.loyaltyPoints === "number") {
    patch.loyalty_points = sanitizeLoyaltyBonus(input.loyaltyPoints);
  }

  const shouldUpdateContestBeta = typeof input.contestBetaEnabled === "boolean";

  if (Object.keys(patch).length === 0) {
    if (shouldUpdateContestBeta) {
      await setContestBetaTesterEnabled(safeId, input.contestBetaEnabled === true);
    }
    return getSupabaseCustomerByIdFull(safeId);
  }

  const updateResult = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", safeId)
    .select(SELECT_PROFILE_COLUMNS)
    .maybeSingle();
  failIfError(updateResult.error, "update profile");
  if (!updateResult.data) {
    return null;
  }

  const userResult = await supabase.auth.admin.getUserById(safeId);
  failIfError(userResult.error, "auth.admin.getUserById");
  const email = userResult.data.user?.email ?? "";
  const promoCodes = await loadPromoCodes(safeId);
  if (shouldUpdateContestBeta) {
    await setContestBetaTesterEnabled(safeId, input.contestBetaEnabled === true);
  }
  const contestBetaEnabled = await loadContestBetaTesterEnabled(safeId);

  return mapProfileToAdminCustomer(updateResult.data as unknown as ProfileRow, email, promoCodes, contestBetaEnabled);
}

export async function addSupabasePromoCode(
  customerId: string,
  input: { code: string; discountPercent: number },
): Promise<AdminCustomer | null> {
  const safeId = customerId.trim();
  if (!safeId) {
    return null;
  }

  const code = sanitizeText(input.code, 24).toUpperCase();
  if (!PROMO_CODE_PATTERN.test(code)) {
    throw new Error("Code promo invalide.");
  }

  const discountPercent = Number.isFinite(input.discountPercent)
    ? Math.round(input.discountPercent)
    : NaN;
  if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 80) {
    throw new Error("Code promo invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const insertResult = await supabase.from("promo_codes").insert({
    customer_id: safeId,
    code,
    discount_percent: discountPercent,
    used: false,
  });

  if (insertResult.error) {
    const message = insertResult.error.message.toLowerCase();
    if (message.includes("duplicate")) {
      throw new Error("Ce code promo existe deja pour ce client.");
    }
    throw new Error(insertResult.error.message);
  }

  return getSupabaseCustomerByIdFull(safeId);
}

export async function previewSupabasePromoCode(
  customerId: string,
  code: string,
): Promise<PromoCode | null> {
  const safeId = customerId.trim();
  const safeCode = code.trim().toUpperCase();
  if (!safeId || !PROMO_CODE_PATTERN.test(safeCode)) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("promo_codes")
    .select(SELECT_PROMO_CODE_COLUMNS)
    .eq("customer_id", safeId)
    .eq("code", safeCode)
    .eq("used", false)
    .maybeSingle();
  failIfError(result.error, "preview promo code");
  if (!result.data) {
    return null;
  }

  return mapPromoCodeRow(result.data as unknown as Record<string, unknown>);
}

export async function consumeSupabasePromoCode(
  customerId: string,
  code: string,
): Promise<PromoCode | null> {
  const safeId = customerId.trim();
  const safeCode = code.trim().toUpperCase();
  if (!safeId || !PROMO_CODE_PATTERN.test(safeCode)) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const updateResult = await supabase
    .from("promo_codes")
    .update({
      used: true,
      used_at: new Date().toISOString(),
    })
    .eq("customer_id", safeId)
    .eq("code", safeCode)
    .eq("used", false)
    .select(SELECT_PROMO_CODE_COLUMNS)
    .maybeSingle();
  failIfError(updateResult.error, "consume promo code");

  if (!updateResult.data) {
    return null;
  }

  return mapPromoCodeRow(updateResult.data as unknown as Record<string, unknown>);
}

export async function createTemporarySupabaseUserFromLegacy(input: {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const password = `${randomUUID()}aA1!`;
  const createUser = await supabase.auth.admin.createUser({
    email: normalizeEmail(input.email),
    password,
    email_confirm: true,
    user_metadata: {
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });
  failIfError(createUser.error, "create temporary supabase user");
  const userId = createUser.data.user?.id;
  if (!userId) {
    throw new Error("Impossible de creer l'utilisateur Supabase.");
  }

  await ensureProfileRow({
    userId,
    firstName: input.firstName,
    lastName: input.lastName,
    dateOfBirth: input.dateOfBirth,
    phone: input.phone,
    address: input.address,
    city: input.city,
    postalCode: input.postalCode,
    country: input.country,
  });

  return userId;
}
