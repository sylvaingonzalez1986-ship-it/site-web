import { describe, expect, it } from "vitest";
import { DEFAULT_KQ_SOCIAL_PLAYER, getKqSocialPlayer } from "./kanab-quest-social-player";

const profile = { nickname: "elodie.atelier", gender: "female", skin: "brown", clothing: "berry", strength: "green-thumb", appearance: { hair: "braids" } };

describe("social player identity from the account and character", () => {
  it("uses the cleaned given name before the validated nickname and preserves appearance", () => {
    const player = getKqSocialPlayer({ firstName: "  E\u0301lodie   Marie \n", profile });
    expect(player).toMatchObject({ name: "Élodie Marie", handle: "@elodie.atelier", avatar: "player", profile: { nickname: "elodie.atelier", gender: "female", skin: "brown", clothing: "berry", appearance: { hair: "braids" } } });
    expect(getKqSocialPlayer({ firstName: "  \t ", profile }).name).toBe("elodie.atelier");
    expect(getKqSocialPlayer({ profile }).name).toBe("elodie.atelier");
  });

  it("falls back without inventing a profile or deriving a handle from personal account information", () => {
    expect(getKqSocialPlayer({ firstName: "Élodie", profile: null })).toEqual({ name: "Élodie", handle: "@ton_atelier", avatar: "player", profile: null });
    expect(getKqSocialPlayer({ firstName: "Mehdi", profile: { ...profile, nickname: "<invalid>" } })).toEqual({ name: "Mehdi", handle: "@ton_atelier", avatar: "player", profile: null });
    expect(getKqSocialPlayer({ profile: { ...profile, appearance: { hair: "remote-image-url" } } })).toEqual(DEFAULT_KQ_SOCIAL_PLAYER);
    for (const value of [null, [], 42, "Élodie", undefined, {}, { firstName: false }, { firstName: "   " }]) expect(getKqSocialPlayer(value)).toEqual(DEFAULT_KQ_SOCIAL_PLAYER);
  });

  it("retains only the allowed player fields and leaves the account response untouched", () => {
    const response = { firstName: "Élodie", lastName: "Private", email: "private@example.invalid", id: "private-user", profile: { ...profile, extra: "private" } };
    const original = structuredClone(response);
    const player = getKqSocialPlayer(response);
    expect(Object.keys(player).sort()).toEqual(["avatar", "handle", "name", "profile"]);
    expect(player.profile).not.toHaveProperty("extra");
    expect(JSON.stringify(player)).not.toMatch(/private|Private/);
    if (player.profile?.appearance) player.profile.appearance = { ...player.profile.appearance, hair: "crop" };
    expect(response).toEqual(original);
    const fallback = getKqSocialPlayer(null);
    fallback.name = "Changed";
    expect(DEFAULT_KQ_SOCIAL_PLAYER.name).toBe("Toi");
  });

  it("preserves literal accents and replacement-pattern characters while bounding display length", () => {
    expect(getKqSocialPlayer({ firstName: "  Anaïs $& $` $'  " }).name).toBe("Anaïs $& $` $'");
    expect(getKqSocialPlayer({ firstName: "Élodie\u200b\u0000" }).name).toBe("Élodie");
    expect([...getKqSocialPlayer({ firstName: "É".repeat(100) }).name]).toHaveLength(80);
  });
});
