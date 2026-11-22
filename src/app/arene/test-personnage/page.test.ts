import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }), redirect: vi.fn(() => { throw new Error("REDIRECT"); }) }));
vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext: mocks.admin }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/components/contest/ArenaCharacterPreview", () => ({ ArenaCharacterPreview: () => null }));
import CharacterPreviewPage from "./page";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("local character preview access", () => {
  it("is unavailable in production even for an admin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.admin.mockResolvedValue({ customerId: "admin-id" });
    await expect(CharacterPreviewPage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("requires the existing admin session in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.admin.mockResolvedValue(null);
    await expect(CharacterPreviewPage()).rejects.toThrow("REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin");
  });
  it("scopes the preview to the verified admin", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.admin.mockResolvedValue({ customerId: "admin-id" });
    expect((await CharacterPreviewPage()).props).toEqual({ ownerId: "admin-id" });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
