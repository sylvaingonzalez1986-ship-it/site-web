import type { KqOnlineListing } from "./kanab-quest-online";

export type KqOnlineListingViewState = "active" | "paused" | "suspended" | "blocked" | "sold-out" | "discarded";

/** Presentation only: legacy closed listings keep their stored status and can use resume-listing. */
export function getKqOnlineListingViewState(
  listing: Pick<KqOnlineListing, "status" | "remainingPackets" | "qualityScore">,
  siteActive: boolean,
): KqOnlineListingViewState {
  if (listing.status === "discarded") return "discarded";
  if (listing.status === "sold-out" || listing.remainingPackets === 0) return "sold-out";
  if (listing.status === "quality-blocked" || listing.qualityScore < 5.8) return "blocked";
  if (listing.status === "paused" || listing.status === "closed") return "paused";
  return siteActive ? "active" : "suspended";
}
