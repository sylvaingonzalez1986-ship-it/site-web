import { Children, isValidElement, type FormEvent, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), request: vi.fn(), states: [] as unknown[], cursor: 0 }));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: <T>(initial: T) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [mocks.states[index] as T, (value: T | ((previous: T) => T)) => {
      mocks.states[index] = typeof value === "function" ? (value as (previous: T) => T)(mocks.states[index] as T) : value;
    }];
  },
}));
vi.mock("@/components/navigation/NavigationFeedback", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

import { AdminLoginForm } from "./AdminLoginForm";

type Props = {
  id?: string; role?: string; type?: string; href?: string; value?: string; disabled?: boolean; autoFocus?: boolean;
  children?: ReactNode; onClick?: () => void; onChange?: (event: { target: { value: string } }) => void;
};
function render(nextUrl = "/admin") {
  mocks.cursor = 0;
  return AdminLoginForm({ nextUrl });
}
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap((child) => isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function textOf(node: ReactNode): string {
  return Children.toArray(node).map((child) => isValidElement<Props>(child)
    ? textOf(child.props.children) : String(child)).join("");
}
function input(id: string, nextUrl = "/admin") {
  const element = elements(render(nextUrl)).find((element) => element.props.id === id);
  if (!element) throw new Error(`Missing input ${id}`);
  return element;
}
function enter(id: string, value: string) { input(id).props.onChange!({ target: { value } }); }
const errorText = () => textOf(elements(render()).find((element) => element.props.role === "alert"));

async function submit(nextUrl: string) {
  const form = render(nextUrl);
  await form.props.onSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  mocks.cursor = 0;
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

  it.each(["", "not-json", "{}", "null", "[]", '{"success":false}', '{"success":"true"}', '{"success":true,"requireTotp":true}'])
  ("refuses a false successful response: %s", async (body) => {
    mocks.request.mockResolvedValue(new Response(body, { status: 200 }));
    await submit("/admin");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(errorText()).toContain("Réponse inattendue");
  });

  it("requests a configured second factor, preserves the password and submits the six-digit code", async () => {
    enter("admin-password", "admin-fixture-password");
    mocks.request.mockResolvedValueOnce(Response.json({ requireTotp: true }));
    await submit("/admin/placard");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(elements(render()).some((element) => element.props.id === "admin-password")).toBe(false);
    enter("admin-totp", "12x3456");
    await submit("/admin/placard");
    expect(JSON.parse(mocks.request.mock.calls[1][1].body)).toEqual({ password: "admin-fixture-password", totp: "123456" });
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/admin/placard");
  });

  it("lets the user return from a second-factor challenge and enter a different password", async () => {
    enter("admin-password", "first-fixture-password");
    mocks.request.mockResolvedValueOnce(Response.json({ requireTotp: true }));
    await submit("/admin");
    enter("admin-totp", "123456");
    const back = elements(render()).find((element) => element.type === "button" && textOf(element) === "Revenir au mot de passe");
    expect(back?.props.type).toBe("button");
    back!.props.onClick!();
    expect(input("admin-password").props.value).toBe("");
    expect(input("admin-password").props.autoFocus).toBe(true);
    expect(elements(render()).some((element) => element.props.id === "admin-totp")).toBe(false);
    enter("admin-password", "second-fixture-password");
    await submit("/admin");
    expect(JSON.parse(mocks.request.mock.calls[1][1].body)).toEqual({ password: "second-fixture-password" });
  });

  it("keeps a repeated challenge pending instead of treating it as success", async () => {
    mocks.request.mockImplementation(async () => Response.json({ requireTotp: true }));
    await submit("/admin");
    await submit("/admin");
    expect(errorText()).toContain("Saisis le code actuel");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it.each([
    [401, "Mot de passe administrateur incorrect"], [403, "Reconnecte-toi"],
    [429, "Trop de tentatives"], [503, "momentanément indisponible"],
  ])("explains HTTP %s even when the error response is HTML", async (status, message) => {
    mocks.request.mockResolvedValue(new Response("<html>provider unavailable</html>", { status }));
    await submit("/admin");
    expect(errorText()).toContain(message);
    expect(errorText()).not.toContain("serveur local");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("offers an account reconnect link with a sanitized admin return after a 403", async () => {
    mocks.request.mockResolvedValue(Response.json({ error: "private technical detail" }, { status: 403 }));
    await submit("//outside.example");
    const reconnect = elements(render("//outside.example")).find((element) => element.props.href?.startsWith("/compte/connexion"));
    expect(new URL(reconnect!.props.href!, "https://example.test").searchParams.get("next")).toBe("/admin/login?next=%2Fadmin");
    expect(errorText()).not.toContain("private technical detail");
  });

  it("distinguishes an expired account session from an incorrect administrator password on 401", async () => {
    mocks.request.mockResolvedValue(Response.json({ code: "account_session_required" }, { status: 401 }));
    await submit("/admin/placard");
    expect(errorText()).toContain("Ta session de compte a expiré");
    expect(errorText()).not.toContain("Mot de passe administrateur incorrect");
    const reconnect = elements(render("/admin/placard")).find((element) => element.props.href?.startsWith("/compte/connexion"));
    expect(new URL(reconnect!.props.href!, "https://example.test").searchParams.get("next")).toBe("/admin/login?next=%2Fadmin%2Fplacard");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("reports a code error during a challenge without resetting or navigating", async () => {
    mocks.request.mockResolvedValueOnce(Response.json({ requireTotp: true }));
    await submit("/admin");
    mocks.request.mockResolvedValueOnce(Response.json({ error: "invalid" }, { status: 401 }));
    await submit("/admin");
    expect(errorText()).toContain("code est incorrect ou expiré");
    expect(input("admin-totp")).toBeDefined();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("reports connectivity failures without exposing raw exception messages", async () => {
    mocks.request.mockRejectedValue(new Error("internal network diagnostic"));
    await submit("/admin");
    expect(errorText()).toContain("Vérifie ta connexion Internet");
    expect(errorText()).not.toContain("internal network diagnostic");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
