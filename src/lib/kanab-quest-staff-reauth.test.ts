import { describe, expect, it } from "vitest";
import { getKqStaffAuthProblem, getKqStaffReconnectHref } from "./kanab-quest-staff-reauth";

describe("Staff session recovery", () => {
  it.each([null, { error: "Non autorisé." }, "<html>Session expirée</html>"])("recognizes HTTP 401 without depending on its body (%#)", payload => {
    expect(getKqStaffAuthProblem(401, payload, false)).toBe("expired");
  });
  it("distinguishes owner changes from an ordinary conflict", () => {
    expect(getKqStaffAuthProblem(409, { code: "staff_owner_changed" }, false)).toBe("owner-changed");
    expect(getKqStaffAuthProblem(409, { error: "Le planning a changé." }, false)).toBeNull();
  });
  it.each([400, 403, 404, 429, 500, 503])("does not send business/service failure %i to login", status => {
    expect(getKqStaffAuthProblem(status, { error: "Indisponible" }, false)).toBeNull();
  });
  it("keeps simulated authentication failures inside the tutorial", () => {
    expect(getKqStaffAuthProblem(401, null, true)).toBeNull();
    expect(getKqStaffAuthProblem(409, { code: "staff_owner_changed" }, true)).toBeNull();
  });
  it("preserves the exact workshop, lot, employee and return context through the login parameter", () => {
    const location = { pathname: "/arene/placard", search: "?view=workshop&section=processing&workshop=trim&flower=lot%2B2&employee=anna&from=harvests&fromFlower=lot%2B2&fromSection=storage", hash: "#recolte" };
    const href = new URL(getKqStaffReconnectHref(location), "https://example.test");
    expect(href.pathname).toBe("/compte/connexion");
    expect(href.searchParams.get("next")).toBe(location.pathname + location.search + location.hash);
    expect([...href.searchParams.keys()]).toEqual(["next"]);
  });
  it("canonicalizes the old game URL before its context-dropping alias redirect", () => {
    expect(new URL(getKqStaffReconnectHref({ pathname: "/bete-de-concours/placard", search: "?view=staff", hash: "" }), "https://example.test").searchParams.get("next")).toBe("/arene/placard?view=staff");
  });
  it.each(["//evil.test", "https://evil.test/", "/compte/connexion", "/admin", "/arene/placard/../../admin"])("never uses arbitrary destination %s", pathname => {
    const href = getKqStaffReconnectHref({ pathname, search: "?view=staff", hash: "" });
    expect(href).toBe("/compte/connexion?next=%2Farene%2Fplacard");
  });
  it("keeps nested next as inert game data instead of following it", () => {
    const href = new URL(getKqStaffReconnectHref({ pathname: "/arene/placard", search: "?view=staff&next=https%3A%2F%2Fevil.test", hash: "" }), "https://example.test");
    expect(href.searchParams.get("next")).toBe("/arene/placard?view=staff&next=https%3A%2F%2Fevil.test");
  });
  it("rejects encoded controls while retaining a safe game fallback", () => {
    expect(getKqStaffReconnectHref({ pathname: "/arene/placard", search: "?view=staff%0d%0a", hash: "" })).toBe("/compte/connexion?next=%2Farene%2Fplacard");
  });
});
