import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/AdminLoginForm", () => ({
  AdminLoginForm: ({ nextUrl }: { nextUrl: string }) => createElement("form", { "data-next": nextUrl }),
}));

import AdminLoginPage from "./page";

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
});
