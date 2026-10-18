import { describe, expect, it } from "vitest";

import { sanitizeAdminNextPath, sanitizeNextPath } from "@/lib/safe-next-path";

const unsafePaths = [
  undefined,
  null,
  42,
  ["/admin"],
  "",
  "admin",
  "https://audit.invalid/admin",
  "//audit.invalid/admin",
  "///audit.invalid/admin",
  "/\\audit.invalid",
  "/%5caudit.invalid",
  "/%255caudit.invalid",
  "/%25255caudit.invalid",
  "%2f%5caudit.invalid",
  "%252f%255caudit.invalid",
  "/%2faudit.invalid",
  "/%252faudit.invalid",
  "javascript:alert(1)",
  "data:text/html,test",
  "/admin\\audit.invalid",
  "/admin/%5caudit.invalid",
  "/admin\t/orders",
  "/admin\n/orders",
  "/admin\r/orders",
  "/admin/%00orders",
  "/admin/%0aorders",
  "/admin/%250dorders",
  "/admin/%7forders",
  " /admin",
  "/admin ",
  "/admin/../profil",
  "/admin/./orders",
  "/admin/%2e%2e/profil",
  "/admin/%252e%252e/profil",
  "/admin//orders",
  "/admin/%2forders",
  "/admin/%3forders",
  "/admin/%23orders",
  "/admin/..//audit.invalid",
  "/admin/broken%",
  "/admin/%E0%A4%A",
];

describe("safe-next-path", () => {
  it("keeps a valid internal path", () => {
    expect(sanitizeNextPath("/boutique/huile-cbd")).toBe("/boutique/huile-cbd");
  });

  it("falls back when path is null", () => {
    expect(sanitizeNextPath(null)).toBe("/");
  });

  it("blocks protocol-relative redirects", () => {
    expect(sanitizeNextPath("//evil.com", "/profil")).toBe("/profil");
  });

  it("blocks paths without a leading slash", () => {
    expect(sanitizeNextPath("profil", "/")).toBe("/");
  });

  it.each(unsafePaths)("rejects unsafe or ambiguous destinations: %j", (value) => {
    expect(sanitizeNextPath(value, "/profil")).toBe("/profil");
  });

  it.each([
    "/boutique/fleurs-cbd?panier=1&origine=bretagne#catalogue",
    "/boutique/%C3%A9dition%20limit%C3%A9e?filtre=huile%20bio#d%C3%A9tails",
    "/boutique?q=huile%26panier%3D0&return=%2Fprofil%3Ftab%3Dcommandes",
    "/boutique?remise=20%25&texte=%2526#prix",
  ])("preserves encoded path, query and fragment semantics: %s", (value) => {
    expect(sanitizeNextPath(value)).toBe(value);
    expect(sanitizeNextPath(sanitizeNextPath(value))).toBe(value);
  });

  it.each(["/\\audit.invalid", "//audit.invalid", "/%255caudit.invalid", "/../profil"])(
    "validates the fallback too: %s", (fallback) => {
      expect(sanitizeNextPath(null, fallback)).toBe("/");
    },
  );

  it("fails closed for excessive nested encoding", () => {
    const nested = `%${"25".repeat(10)}5c`;
    expect(sanitizeNextPath(`/admin/${nested}audit.invalid`, "/profil")).toBe("/profil");
  });
});

describe("admin login return paths", () => {
  it.each([...unsafePaths, "/", "/profil", "/administrator", "/admin.evil", "/admin;other"])(
    "falls back to the admin home for an invalid admin destination: %j", (value) => {
      expect(sanitizeAdminNextPath(value)).toBe("/admin");
    },
  );

  it.each([
    "/admin",
    "/admin/",
    "/admin/placard",
    "/admin?tab=commandes#recents",
    "/admin/orders?query=huile%26bio&remise=20%25#d%C3%A9tails",
    "/admin/%C3%A9dition%20limit%C3%A9e",
  ])("allows same-origin admin destinations without changing their encoding: %s", (value) => {
    expect(sanitizeAdminNextPath(value)).toBe(value);
    expect(new URL(sanitizeAdminNextPath(value), "https://shop.example").origin).toBe("https://shop.example");
  });
});
