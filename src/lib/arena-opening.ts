import { isAllowedAdminEmail } from "@/lib/admin-allowlist";

﻿/** Public lobby and character creation precede the game opening (Paris time). */
export const ARENA_OPENING_AT = "2026-11-01T00:00:00+01:00";
export const ARENA_OPENING_MESSAGE = "Rendez-vous le 1er novembre";

export function isArenaPrelaunch(now = Date.now()): boolean {
  return process.env.NODE_ENV === "production" && now < Date.parse(ARENA_OPENING_AT);
}

export function isArenaActivityApi(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  // The Carnet draw is available independently of the game's opening.
  if (path === "/api/contest/monthly-draw") return false;
  if (path === "/api/arena/chanvrier") return false;
  if (path === "/api/contest/access") return false;
  // Only notebook routes are public here. Game rewards keep their opening gate.
  if (/^\/api\/contest\/(?:entries(?:\/[^/]+)?|feed|profile|rankings|review-pages\/[^/]+|reviews(?:\/[^/]+\/vote)?|seasons|tester\/progress|testers\/[^/]+)$/.test(path)) return false;
  return path === "/api/arena" || path.startsWith("/api/arena/") || path === "/api/contest" || path.startsWith("/api/contest/");
}

export function getArenaClosedPageMode(pathname: string): "carnet" | "jouer" | "classement" | null {
  const path = pathname.replace(/\/+$/, "");
  if (path.startsWith("/arene/placard")) return "jouer";
  if (/^\/arene\/(?:carnet(?:\/(?:regular|concours|classement))?|profils\/[^/]+|[^/]+)$/.test(path)) return null;
  if (path === "/bete-de-concours" || /^\/bete-de-concours\/(?:profils\/[^/]+|[^/]+)$/.test(path)) return null;
  if (path.includes("classement") && path.startsWith("/arene/")) return "classement";
  if (path.startsWith("/arene/") || path === "/bete-de-concours" || path.startsWith("/bete-de-concours/")) return "carnet";
  return null;
}

/** Use only with a server-verified identity when authorizing a request. */
export function hasArenaBetaAccess(customer: { email?: string; contestBetaEnabled?: boolean } | null | undefined, adminAuthorized = false): boolean {
  return adminAuthorized || isAllowedAdminEmail(customer?.email) || customer?.contestBetaEnabled === true;
}
