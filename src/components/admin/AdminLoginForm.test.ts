import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), request: vi.fn() }));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: <T>(initial: T) => [initial, vi.fn()],
}));
vi.mock("@/components/navigation/NavigationFeedback", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

import { AdminLoginForm } from "./AdminLoginForm";

async function submit(nextUrl: string) {
  const form = AdminLoginForm({ nextUrl });
  await form.props.onSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.request);
  mocks.request.mockResolvedValue(Response.json({ success: true }));
});

afterEach(() => vi.unstubAllGlobals());

describe("admin login navigation", () => {
  it.each([
    "/\\audit.invalid",
    "/%5caudit.invalid",
    "/%255caudit.invalid",
    "//audit.invalid",
    "/admin/../profil",
    "/profil",
    "javascript:alert(1)",
  ])("revalidates an untrusted prop at the navigation point: %s", async (next) => {
    await submit(next);
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/admin");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("returns to the requested admin page after a successful login", async () => {
    const next = "/admin/placard?filtre=huile%26bio#inventaire";
    await submit(next);
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(next);
  });

  it.each([
    [401, { error: "Connexion refusee" }],
    [200, { requireTotp: true }],
  ])("does not navigate before authentication finishes: %s %j", async (status, body) => {
    mocks.request.mockResolvedValue(Response.json(body, { status }));
    await submit("/admin/placard");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
