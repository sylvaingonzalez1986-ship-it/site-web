import "server-only";

import { cookies } from "next/headers";
import { CUSTOMER_COOKIE_NAME, getCustomerCookieOptions } from "@/lib/customer-auth";
import {
  addSupabasePromoCode,
  adminUpdateSupabaseCustomer,
  consumeSupabasePromoCode,
  getAllSupabaseCustomers,
  getCurrentSupabaseSessionCustomer,
  getCurrentSupabaseSessionIdentity,
  getSupabaseCustomerById,
  getSupabaseCustomerByIdFull,
  isAtLeast18,
  loginSupabaseCustomer,
  logoutSupabaseCustomer,
  normalizeDateOfBirth,
  previewSupabasePromoCode,
  requestSupabasePasswordReset,
  registerSupabaseCustomerWithEmailVerification,
  resetSupabaseCustomerPassword,
  updateSupabaseCustomerProfile,
} from "@/lib/supabase/customer-backend";
import type { AdminCustomer, PromoCode, PublicCustomer } from "@/types/customer";

type CustomerSession = {
  customerId: string;
  customer: PublicCustomer;
};

type CustomerSessionIdentity = {
  customerId: string;
  customer: { email: string };
};

export function getCurrentCustomerSessionByBackend(mode: "identity"): Promise<CustomerSessionIdentity | null>;
export function getCurrentCustomerSessionByBackend(): Promise<CustomerSession | null>;
export async function getCurrentCustomerSessionByBackend(
  mode?: "identity",
): Promise<CustomerSession | CustomerSessionIdentity | null> {
  return mode === "identity"
    ? getCurrentSupabaseSessionIdentity()
    : getCurrentSupabaseSessionCustomer();
}

export async function loginCustomerByBackend(input: {
  email: string;
  password: string;
}): Promise<
  | { customer: PublicCustomer; customerId: string }
  | { error: "email_not_confirmed" | "invalid_credentials" }
> {
  return loginSupabaseCustomer(input);
}

export async function registerCustomerByBackend(input: {
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
  return registerSupabaseCustomerWithEmailVerification(input);
}

export async function logoutCustomerByBackend(): Promise<void> {
  await logoutSupabaseCustomer();
}

export async function requestCustomerPasswordResetByBackend(input: {
  email: string;
  redirectTo: string;
}): Promise<void> {
  await requestSupabasePasswordReset(input);
}

export async function resetCustomerPasswordByBackend(input: {
  password: string;
  tokenHash?: string;
  accessToken?: string;
  refreshToken?: string;
}): Promise<{ email: string }> {
  return resetSupabaseCustomerPassword(input);
}

export async function clearLegacyCustomerCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: CUSTOMER_COOKIE_NAME,
    value: "",
    ...getCustomerCookieOptions(0),
  });
}

export async function getCustomerByIdByBackend(customerId: string): Promise<PublicCustomer | null> {
  return getSupabaseCustomerById(customerId);
}

export async function getCustomerByIdFullByBackend(customerId: string): Promise<AdminCustomer | null> {
  return getSupabaseCustomerByIdFull(customerId);
}

export async function getAllCustomersByBackend(): Promise<AdminCustomer[]> {
  return getAllSupabaseCustomers();
}

export async function updateCustomerProfileByBackend(
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
  return updateSupabaseCustomerProfile(customerId, input);
}

export async function adminUpdateCustomerByBackend(
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
  return adminUpdateSupabaseCustomer(customerId, input);
}

export async function addPromoCodeByBackend(
  customerId: string,
  input: { code: string; discountPercent: number },
): Promise<AdminCustomer | null> {
  return addSupabasePromoCode(customerId, input);
}

export async function previewPromoCodeByBackend(
  customerId: string,
  code: string,
): Promise<PromoCode | null> {
  return previewSupabasePromoCode(customerId, code);
}

export async function consumePromoCodeByBackend(
  customerId: string,
  code: string,
): Promise<PromoCode | null> {
  return consumeSupabasePromoCode(customerId, code);
}

export {
  isAtLeast18,
  normalizeDateOfBirth,
};
