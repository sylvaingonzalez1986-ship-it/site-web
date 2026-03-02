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

function expectOptionalString(
  source: Record<string, unknown>,
  key: keyof CustomerProfilePatch,
  options?: {
    maxLength?: number;
    pattern?: RegExp;
    errorMessage?: string;
  },
): string | undefined {
  const value = source[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (options?.maxLength && trimmed.length > options.maxLength) {
    throw new Error(options.errorMessage ?? `Champ ${String(key)} trop long.`);
  }
  if (trimmed && options?.pattern && !options.pattern.test(trimmed)) {
    throw new Error(options.errorMessage ?? `Champ ${String(key)} invalide.`);
  }

  return value;
}

export function parseCustomerProfilePatch(payload: unknown): CustomerProfilePatch {
  const source =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  return {
    firstName: expectOptionalString(source, "firstName", {
      maxLength: 80,
      errorMessage: "Prenom trop long.",
    }),
    lastName: expectOptionalString(source, "lastName", {
      maxLength: 80,
      errorMessage: "Nom trop long.",
    }),
    dateOfBirth: expectOptionalString(source, "dateOfBirth", {
      maxLength: 10,
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      errorMessage: "Date de naissance invalide.",
    }),
    phone: expectOptionalString(source, "phone", {
      maxLength: 40,
      pattern: /^[\d+().\-\s]*$/,
      errorMessage: "Telephone invalide.",
    }),
    address: expectOptionalString(source, "address", {
      maxLength: 180,
      errorMessage: "Adresse trop longue.",
    }),
    city: expectOptionalString(source, "city", {
      maxLength: 120,
      errorMessage: "Ville trop longue.",
    }),
    postalCode: expectOptionalString(source, "postalCode", {
      maxLength: 16,
      pattern: /^[A-Za-z0-9\s-]*$/,
      errorMessage: "Code postal invalide.",
    }),
    country: expectOptionalString(source, "country", {
      maxLength: 80,
      pattern: /^[A-Za-zÀ-ÿ\s.'-]*$/u,
      errorMessage: "Pays invalide.",
    }),
  };
}

export async function applyCustomerProfilePatch(
  customerId: string,
  payload: unknown,
): Promise<PublicCustomer | null> {
  const patch = parseCustomerProfilePatch(payload);
  return updateCustomerProfileByBackend(customerId, patch);
}
