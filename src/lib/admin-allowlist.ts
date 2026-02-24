export const ADMIN_ALLOWED_EMAIL = "leschanvriersbretons@gmail.com";

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === normalizeEmail(ADMIN_ALLOWED_EMAIL);
}
