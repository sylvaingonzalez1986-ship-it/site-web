import type { PublicCustomer } from "@/types/customer";

const DATE_OF_BIRTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function isAtLeast18(dateOfBirth: string, now = new Date()): boolean {
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

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export type CheckoutEligibilityResult = {
  allowed: boolean;
  error?: string;
};

export function getCustomerCheckoutEligibility(
  customer: Pick<
    PublicCustomer,
    | "firstName"
    | "lastName"
    | "dateOfBirth"
    | "phone"
    | "address"
    | "city"
    | "postalCode"
    | "country"
  >,
): CheckoutEligibilityResult {
  if (
    !hasValue(customer.firstName) ||
    !hasValue(customer.lastName) ||
    !hasValue(customer.phone) ||
    !hasValue(customer.address) ||
    !hasValue(customer.city) ||
    !hasValue(customer.postalCode) ||
    !hasValue(customer.country)
  ) {
    return {
      allowed: false,
      error: "Profil incomplet. Complète ton profil avant de commander.",
    };
  }

  if (!customer.dateOfBirth) {
    return {
      allowed: false,
      error: "Date de naissance requise pour commander (18+).",
    };
  }

  if (!isAtLeast18(customer.dateOfBirth)) {
    return {
      allowed: false,
      error: "Commande réservée aux personnes majeures (18+).",
    };
  }

  return { allowed: true };
}


