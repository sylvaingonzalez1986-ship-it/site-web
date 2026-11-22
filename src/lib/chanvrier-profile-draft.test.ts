import { afterEach, describe, expect, it, vi } from "vitest";
import { getChanvrierAppearance } from "./arena-chanvrier";
import {
  NEW_CHANVRIER_PROFILE, clearChanvrierDraft, getChanvrierPreviewScope, observeChanvrierAdventure,
  readChanvrierDraft, readChanvrierPreviewProfile, writeChanvrierDraft, writeChanvrierPreviewProfile,
  type ChanvrierDraft,
} from "./chanvrier-profile-draft";

function makeStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  };
}

const draft: ChanvrierDraft = {
  profile: { ...NEW_CHANVRIER_PROFILE, nickname: "Lé", strength: "merchant", appearance: { ...getChanvrierAppearance(NEW_CHANVRIER_PROFILE), hair: "waves" } },
  step: "look",
};

afterEach(() => vi.unstubAllGlobals());

describe("character editor drafts", () => {
  it("resumes incomplete drafts and discards them explicitly", () => {
    vi.stubGlobal("window", { localStorage: makeStorage(), sessionStorage: makeStorage() });
    const first = observeChanvrierAdventure("creator", null);
    writeChanvrierDraft(first, draft);
    const reopened = observeChanvrierAdventure("creator", null);
    expect(readChanvrierDraft(reopened, null)).toEqual(draft);
    clearChanvrierDraft(reopened);
    expect(readChanvrierDraft(first, null)).toBeNull();
  });

  it("separates accounts, adventures, live creation and previews", () => {
    vi.stubGlobal("window", { localStorage: makeStorage(), sessionStorage: makeStorage() });
    const creation = observeChanvrierAdventure("player", null);
    writeChanvrierDraft(creation, draft);
    expect(readChanvrierDraft(observeChanvrierAdventure("other", null), null)).toBeNull();
    const preview = getChanvrierPreviewScope("player", "create");
    expect(readChanvrierDraft(preview, null)).toBeNull();
    const first = observeChanvrierAdventure("player", "2026-11-22T09:00:00Z");
    expect(readChanvrierDraft(creation, null)).toBeNull();
    expect(readChanvrierDraft(first, NEW_CHANVRIER_PROFILE)).toBeNull();
    writeChanvrierDraft(first, draft);
    const newCreation = observeChanvrierAdventure("player", null);
    expect(newCreation.key).not.toEqual(creation.key);
    expect(readChanvrierDraft(newCreation, null)).toBeNull();
    const second = observeChanvrierAdventure("player", "2026-11-22T10:00:00Z");
    expect(readChanvrierDraft(second, NEW_CHANVRIER_PROFILE)).toBeNull();
  });

  it("restores edits with the character's saved specialty", () => {
    vi.stubGlobal("window", { localStorage: makeStorage(), sessionStorage: makeStorage() });
    const scope = observeChanvrierAdventure("edition", "2026-11-22T09:00:00Z");
    writeChanvrierDraft(scope, draft);
    const existing = { ...NEW_CHANVRIER_PROFILE, nickname: "Sylvain" };
    expect(readChanvrierDraft(scope, existing)).toEqual({ ...draft, profile: { ...draft.profile, strength: existing.strength } });
  });

  it("keeps changes and discards during a blocked-storage remount", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("Storage blocked"); } });
    const scope = observeChanvrierAdventure("blocked", null);
    writeChanvrierDraft(scope, draft);
    expect(readChanvrierDraft(observeChanvrierAdventure("blocked", null), null)).toEqual(draft);
    clearChanvrierDraft(scope);
    expect(readChanvrierDraft(scope, null)).toBeNull();
  });

  it("rejects corrupt catalog values and keeps the demo result separate from its draft", () => {
    const sessionStorage = makeStorage();
    vi.stubGlobal("window", { sessionStorage });
    const scope = getChanvrierPreviewScope("rehearsal", "edit");
    sessionStorage.setItem(scope.key, JSON.stringify({ ...draft, profile: { ...draft.profile, skin: "invalid" } }));
    expect(readChanvrierDraft(scope, null)).toBeNull();
    const result = getChanvrierPreviewScope("rehearsal", "profile");
    const profile = { ...draft.profile, nickname: "Loic29" };
    writeChanvrierPreviewProfile(result, profile);
    expect(readChanvrierPreviewProfile(result)).toEqual(profile);
    expect(readChanvrierPreviewProfile(getChanvrierPreviewScope("someone-else", "profile"))).toBeNull();
    clearChanvrierDraft(result);
    expect(readChanvrierPreviewProfile(result)).toBeNull();
  });
});
