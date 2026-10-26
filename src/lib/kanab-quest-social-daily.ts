import type { KqSocialHistoryEntry, KqSocialSnapshot } from "./kanab-quest-social-types";

export const KQ_SOCIAL_PUBLICATION_TIME_ZONE = "Europe/Paris";
export type KqSocialCadenceOptions = {
  /** Trusted server time, or the actual local session clock; never request-body data. */
  publicationNow?: number;
  legacyCadence?: boolean;
  inferLegacyPublications?: boolean;
  replayFirstDebates?: boolean;
};
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: KQ_SOCIAL_PUBLICATION_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export function getKqSocialPublicationDay(now: number): string {
  const parts = dayFormat.formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}
export function isKqSocialPublicationDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Find the next calendar boundary, including 23-hour and 25-hour Paris days. */
export function getKqSocialNextMidnight(now: number): number {
  const day = getKqSocialPublicationDay(now);
  let before = Math.floor(now), after = before + 27 * 3_600_000;
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (getKqSocialPublicationDay(middle) === day) before = middle;
    else after = middle;
  }
  return after;
}

const administrativeChoices = new Set(["recover", "sponsor-accept", "sponsor-decline", "sponsor-claim", "sponsor-cancel"]);
function wasPublished(entry: KqSocialHistoryEntry) {
  return entry.action === "publish" || entry.action === undefined && !administrativeChoices.has(entry.choiceId);
}

/** Mutates only an already-cloned engine state. Legacy lesson dates are fictional. */
export function applyKqSocialDailyCadence(snapshot: KqSocialSnapshot, now: number, inferLegacyPublications = true): void {
  const today = getKqSocialPublicationDay(now);
  for (const platform of ["instagram", "x"] as const) {
    const account = snapshot.platforms[platform];
    if (account.publishedDay === undefined) {
      let latest = -Infinity;
      if (inferLegacyPublications) {
        for (const entry of snapshot.history) {
          const at = Date.parse(entry.createdAt);
          if (entry.platform === platform && wasPublished(entry) && at <= now) latest = Math.max(latest, at);
        }
        // Use an exact publication receipt when available: an old five-minute
        // cooldown can cross midnight without consuming the following day's post.
        // With no retained publication, the deadline is the only remaining clue.
        if (!Number.isFinite(latest) && account.nextPostAt) latest = Math.min(now, Date.parse(account.nextPostAt));
      }
      account.publishedDay = Number.isFinite(latest) ? getKqSocialPublicationDay(latest) : null;
    }
    account.nextPostAt = account.publishedDay && account.publishedDay >= today
      ? new Date(getKqSocialNextMidnight(Date.parse(`${account.publishedDay}T12:00:00Z`))).toISOString() : null;
  }
  snapshot.cadenceVersion = 1;
  snapshot.publicationNow = new Date(now).toISOString();
}
