import { parseChanvrierProfile, type ChanvrierProfile } from "./arena-chanvrier";

export type KqSocialPlayer = { name: string; handle: string; avatar: "player"; profile: ChanvrierProfile | null };
export const DEFAULT_KQ_SOCIAL_PLAYER: KqSocialPlayer = { name: "Toi", handle: "@ton_atelier", avatar: "player", profile: null };

/** Use only the account's given name and the validated in-game character profile. */
export function getKqSocialPlayer(value: unknown): KqSocialPlayer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_KQ_SOCIAL_PLAYER };
  const row = value as Record<string, unknown>;
  const profile = parseChanvrierProfile(row.profile);
  const firstName = typeof row.firstName === "string"
    ? [...row.firstName.normalize("NFC").replace(/\s+/gu, " ").replace(/[\p{Cc}\p{Cf}]/gu, "").trim()].slice(0, 80).join("").trim()
    : "";
  return { name: firstName || profile?.nickname || DEFAULT_KQ_SOCIAL_PLAYER.name,
    handle: profile ? `@${profile.nickname}` : DEFAULT_KQ_SOCIAL_PLAYER.handle, avatar: "player", profile };
}
