import { describe, expect, it } from "vitest";
import { betaNoticeStorageKey, dismissBetaNotice, hasDismissedBetaNotice } from "./arena-beta-notice";

describe("beta welcome per connection", () => {
  it("remembers dismissal for navigation/reload, but a new connection or owner sees it", () => {
    const data = new Map<string, string>();
    const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    expect(hasDismissedBetaNotice("player", "session-a", store)).toBe(false);
    dismissBetaNotice("player", "session-a", store);
    expect(hasDismissedBetaNotice("player", "session-a", store)).toBe(true);
    expect(store.getItem(betaNoticeStorageKey("player"))).toBe("session-a");
    expect(hasDismissedBetaNotice("player", "session-b", store)).toBe(false);
    expect(hasDismissedBetaNotice("other", "session-a", store)).toBe(false);
  });
  it("reads another tab's dismissal and remains closable if persistence is blocked", () => {
    expect(hasDismissedBetaNotice("shared", "connection", { getItem: () => "connection" })).toBe(true);
    const blocked = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(hasDismissedBetaNotice("blocked", "connection", blocked)).toBe(false);
    dismissBetaNotice("blocked", "connection", blocked);
    expect(hasDismissedBetaNotice("blocked", "connection", blocked)).toBe(true);
  });
});
