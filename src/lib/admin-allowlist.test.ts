import { afterEach, describe, expect, it, vi } from "vitest";

const originalAllowedEmails = process.env.ADMIN_ALLOWED_EMAILS;

async function loadAdminAllowlistModule() {
  vi.resetModules();
  return import("@/lib/admin-allowlist");
}

afterEach(() => {
  if (originalAllowedEmails === undefined) {
    delete process.env.ADMIN_ALLOWED_EMAILS;
  } else {
    process.env.ADMIN_ALLOWED_EMAILS = originalAllowedEmails;
  }
  vi.resetModules();
});

describe("admin-allowlist", () => {
  it("falls back to the default admin email when the env is empty", async () => {
    delete process.env.ADMIN_ALLOWED_EMAILS;
    const { isAllowedAdminEmail } = await loadAdminAllowlistModule();

    expect(isAllowedAdminEmail("leschanvriersbretons@gmail.com")).toBe(true);
    expect(isAllowedAdminEmail("other@example.com")).toBe(false);
  });

  it("normalizes and checks comma-separated emails", async () => {
    process.env.ADMIN_ALLOWED_EMAILS = " Admin@Example.com, second@example.com ";
    const { isAllowedAdminEmail, normalizeEmail } = await loadAdminAllowlistModule();

    expect(normalizeEmail("  Admin@Example.com ")).toBe("admin@example.com");
    expect(isAllowedAdminEmail("admin@example.com")).toBe(true);
    expect(isAllowedAdminEmail("SECOND@example.com")).toBe(true);
    expect(isAllowedAdminEmail("")).toBe(false);
  });
});