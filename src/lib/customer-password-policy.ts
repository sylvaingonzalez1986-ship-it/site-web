// Applies only when choosing a new customer password, never when signing in.
export const CUSTOMER_PASSWORD_MIN_LENGTH = 12;
export const CUSTOMER_PASSWORD_REQUIREMENT = `Le mot de passe doit contenir au moins ${CUSTOMER_PASSWORD_MIN_LENGTH} caractères.`;

export function hasMinimumCustomerPasswordLength(value: unknown): value is string {
  return typeof value === "string" && value.length >= CUSTOMER_PASSWORD_MIN_LENGTH;
}
