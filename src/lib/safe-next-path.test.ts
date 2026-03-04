import { describe, expect, it } from "vitest";

import { sanitizeNextPath } from "@/lib/safe-next-path";

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
});
