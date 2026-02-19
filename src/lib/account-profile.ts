import "server-only";

import { updateCustomerProfileByBackend } from "@/lib/customer-backend";
import type { PublicCustomer } from "@/types/customer";

export type CustomerProfilePatch = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
};

export function parseCustomerProfilePatch(payload: unknown): CustomerProfilePatch {
  const source =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const readString = (key: keyof CustomerProfilePatch): string | undefined => {
    const value = source[key];
    return typeof value === "string" ? value : undefined;
  };

  return {
    firstName: readString("firstName"),
    lastName: readString("lastName"),
    dateOfBirth: readString("dateOfBirth"),
    phone: readString("phone"),
    address: readString("address"),
    city: readString("city"),
    postalCode: readString("postalCode"),
    country: readString("country"),
  };
}

export async function applyCustomerProfilePatch(
  customerId: string,
  payload: unknown,
): Promise<PublicCustomer | null> {
  const patch = parseCustomerProfilePatch(payload);
  return updateCustomerProfileByBackend(customerId, patch);
}
