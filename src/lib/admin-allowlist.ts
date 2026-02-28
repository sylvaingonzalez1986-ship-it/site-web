const DEFAULT_ADMIN_EMAIL = "leschanvriersbretons@gmail.com";

function resolveAllowedEmails(): Set<string> {
  const envValue = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  if (!envValue) {
    return new Set([normalizeEmail(DEFAULT_ADMIN_EMAIL)]);
  }

  const emails = new Set<string>();
  for (const raw of envValue.split(",")) {
    const normalized = normalizeEmail(raw);
    if (normalized) {
      emails.add(normalized);
    }
  }

  return emails.size > 0 ? emails : new Set([normalizeEmail(DEFAULT_ADMIN_EMAIL)]);
}

let cachedAllowedEmails: Set<string> | null = null;

function getAllowedEmails(): Set<string> {
  if (!cachedAllowedEmails) {
    cachedAllowedEmails = resolveAllowedEmails();
  }
  return cachedAllowedEmails;
}

/**
 * @deprecated Use `isAllowedAdminEmail()` instead. Kept for backward compatibility
 * with code that reads the constant directly. Returns the first allowed email.
 */
export const ADMIN_ALLOWED_EMAIL = DEFAULT_ADMIN_EMAIL;

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }
  return getAllowedEmails().has(normalized);
}
