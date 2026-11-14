import { sanitizeNextPath } from "./safe-next-path";

export type KqStaffAuthProblem = "expired" | "owner-changed";

export function getKqStaffAuthProblem(status: number, payload: unknown, isTutorial: boolean): KqStaffAuthProblem | null {
  if (isTutorial) return null;
  if (status === 401) return "expired";
  if (status === 409 && payload && typeof payload === "object" && "code" in payload && payload.code === "staff_owner_changed") return "owner-changed";
  return null;
}

/** Keep the complete game context, never a command, account identifier or arbitrary redirect. */
export function getKqStaffReconnectHref(location: { pathname: string; search: string; hash: string }) {
  const base = "/arene/placard";
  const gamePath = location.pathname === base || location.pathname === "/bete-de-concours/placard";
  const next = gamePath ? sanitizeNextPath(`${base}${location.search}${location.hash}`, base) : base;
  return `/compte/connexion?next=${encodeURIComponent(next)}`;
}
