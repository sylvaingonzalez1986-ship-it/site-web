import { createHash } from "node:crypto";

/** Stable public identity for tied ranks and anonymous display names. */
export function arenaPublicPlayerKey(userId: string) {
  return createHash("sha256").update(`arena-public-player:${userId}`).digest("hex").slice(0, 24);
}
