/** Public lobby and character creation precede the game opening (Paris time). */
export const ARENA_OPENING_AT = "2026-10-15T00:00:00+02:00";
export const ARENA_OPENING_MESSAGE = "Rendez-vous le 15 octobre";

export function isArenaPrelaunch(now = Date.now()): boolean {
  return process.env.NODE_ENV === "production" && now < Date.parse(ARENA_OPENING_AT);
}

export function isArenaActivityApi(pathname: string, method: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/api/account/pioneer-pack") return method !== "GET" && method !== "HEAD";
  if (path === "/api/arena/chanvrier") return false;
  if (path === "/api/contest/access") return false;
  return path === "/api/arena" || path.startsWith("/api/arena/") || path === "/api/contest" || path.startsWith("/api/contest/");
}

export function getArenaClosedPageMode(pathname: string): "carnet" | "jouer" | "classement" | null {
  const path = pathname.replace(/\/+$/, "");
  if (path.startsWith("/arene/placard")) return "jouer";
  if (path.includes("classement") && path.startsWith("/arene/")) return "classement";
  if (path.startsWith("/arene/") || path === "/bete-de-concours" || path.startsWith("/bete-de-concours/")) return "carnet";
  return null;
}
