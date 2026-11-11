import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));

vi.mock("@/components/admin/AdminLoginForm", () => ({
  AdminLoginForm: ({ nextUrl }: { nextUrl: string }) => createElement("form", { "data-next": nextUrl }),
}));

import AdminLoginPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_ALLOWED_EMAILS", "allowed@example.test");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network access in login page test"); }));
  mocks.session.mockResolvedValue({ customerId: "account-1", customer: { email: "allowed@example.test" } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("admin login server destination validation", () => {
  it.each([
    undefined,
    "/\\audit.invalid",
    "/%255caudit.invalid",
    "/admin/../profil",
    "/profil",
    ["/admin/placard", "//audit.invalid"],
  ])("removes an unsafe or repeated next value before serializing the form: %j", async (next) => {
    const page = await AdminLoginPage({ searchParams: Promise.resolve({ next }) });
    expect(renderToStaticMarkup(page)).toContain('data-next="/admin"');
  });

  it("preserves a safe admin return", async () => {
    const page = await AdminLoginPage({ searchParams: Promise.resolve({ next: "/admin/placard?tab=stock" }) });
    expect(renderToStaticMarkup(page)).toContain('data-next="/admin/placard?tab=stock"');
  });

  it("takes an unauthenticated account through account login and back to its safe admin destination", async () => {
    mocks.session.mockResolvedValue(null);
    const next = "/admin/placard?tab=stock";
    const html = renderToStaticMarkup(await AdminLoginPage({ searchParams: Promise.resolve({ next }) }));
    const href = html.match(/href="([^"]*\/compte\/connexion[^"]*)"/)?.[1];
    expect(href).toBeDefined();
    const accountNext = new URL(href!, "https://example.test").searchParams.get("next");
    expect(accountNext).toBe(`/admin/login?next=${encodeURIComponent(next)}`);
    expect(html).toContain("Se connecter au compte");
    expect(html).not.toContain("<form");
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith("identity");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["//outside.example", "/\\outside.example", ["/admin", "/admin/placard"]])("cleans unsafe next before nesting the account return: %j", async (next) => {
    mocks.session.mockResolvedValue(null);
    const html = renderToStaticMarkup(await AdminLoginPage({ searchParams: Promise.resolve({ next }) }));
    const href = html.match(/href="([^"]*\/compte\/connexion[^"]*)"/)?.[1];
    expect(new URL(href!, "https://example.test").searchParams.get("next")).toBe("/admin/login?next=%2Fadmin");
    expect(html).not.toContain("outside.example");
  });

  it("keeps an unauthorized account signed in without exposing allowed emails", async () => {
    mocks.session.mockResolvedValue({ customerId: "other-account", customer: { email: "other@example.test" } });
    const html = renderToStaticMarkup(await AdminLoginPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Ce compte n’est pas autorisé");
    expect(html).toContain("Ta connexion au site reste active");
    expect(html).toContain('href="/profil"');
    expect(html).not.toContain("<form");
    expect(html).not.toContain("allowed@example.test");
    expect(html).not.toContain("logout");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("explains the separate administrator password to an authorized account", async () => {
    const html = renderToStaticMarkup(await AdminLoginPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("distinct du mot de passe de ton compte");
    expect(html).toContain("configuration sécurisée du site");
    expect(html).toContain('<form data-next="/admin"');
    expect(html).not.toContain("allowed@example.test");
  });

  it("shows an identity-service failure without treating the account as logged out", async () => {
    mocks.session.mockRejectedValue(new Error("identity temporarily unavailable"));
    const html = renderToStaticMarkup(await AdminLoginPage({ searchParams: Promise.resolve({ next: "/admin/placard" }) }));
    expect(html).toContain("Impossible de vérifier ta connexion");
    expect(html).toContain("Ta session n’a pas été");
    expect(html).toContain('href="/admin/login?next=%2Fadmin%2Fplacard"');
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Se connecter au compte");
    expect(html).not.toContain("identity temporarily unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });
});
