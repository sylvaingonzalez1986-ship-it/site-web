import { describe, expect, it } from "vitest";
import { getKqOnlineListingViewState } from "./kanab-quest-online-listing-state";
import type { KqOnlineListing } from "./kanab-quest-online";

describe("online listing presentation", () => {
  it.each(["paused", "closed"] as const)("keeps %s packets resumable without rewriting saved state", status => {
    const listing = { status, remainingPackets: 4, qualityScore: 7.6 };
    expect(getKqOnlineListingViewState(listing, true)).toBe("paused");
    expect(getKqOnlineListingViewState(listing, false)).toBe("paused");
    expect(listing).toEqual({ status, remainingPackets: 4, qualityScore: 7.6 });
  });

  it.each(["active", "paused", "closed", "quality-blocked"] as const)("shows the quality blocker before a resumable %s state", status => {
    expect(getKqOnlineListingViewState({ status, remainingPackets: 4, qualityScore: 5.7 }, true)).toBe("blocked");
    expect(getKqOnlineListingViewState({ status, remainingPackets: 4, qualityScore: 5.7 }, false)).toBe("blocked");
  });

  it("distinguishes site suspension from a player pause", () => {
    expect(getKqOnlineListingViewState({ status: "active", remainingPackets: 4, qualityScore: 5.8 }, false)).toBe("suspended");
    expect(getKqOnlineListingViewState({ status: "active", remainingPackets: 4, qualityScore: 5.8 }, true)).toBe("active");
  });

  it.each(["sold-out", "discarded"] as const)("keeps the terminal %s state despite a closed site or aged quality", status => {
    const listing: Pick<KqOnlineListing, "status" | "remainingPackets" | "qualityScore"> = { status, remainingPackets: 0, qualityScore: 2 };
    expect(getKqOnlineListingViewState(listing, false)).toBe(status);
  });
});
