import { KQ_ADVERTISING, KQ_GAME_DAY_MS, isKqAdvertisingKind, type KqAdvertisingKind, type KqBusinessState } from "@/lib/kanab-quest-business";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { KQ_ONLINE_SITE_TIERS } from "@/lib/kanab-quest-online";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const cents = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const time = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && Number.isFinite(new Date(value).getTime());
type Advertising = NonNullable<KqBusinessState["advertising"]>;
export type KqAdvertisingState = "none" | "active" | "scheduled" | "ended" | "unavailable";
export type KqAdvertisingSiteState = "active" | "inactive" | "unknown";

function validAdvertising(value: unknown): value is Advertising {
  return record(value) && typeof value.id === "string" && value.id.length > 0 && isKqAdvertisingKind(value.kind)
    && date(value.startedAt) && date(value.endsAt) && Date.parse(value.endsAt) > Date.parse(value.startedAt)
    && typeof value.boostPercent === "number" && Number.isFinite(value.boostPercent)
    && value.boostPercent >= 0 && value.boostPercent <= 100;
}

/** Presentation only: catalogue prices describe a new purchase; the current
 * campaign retains the server's dates and bonus. A non-null campaign is never
 * cleared here, even when its end has passed: the server settles it on refresh. */
export function getKqAdvertisingView({ data, kind: requestedKind, now: liveNow }: {
  data: KqCommerceSnapshot; kind: KqAdvertisingKind; now?: number;
}) {
  const business = data.business;
  const kind = isKqAdvertisingKind(requestedKind) ? requestedKind : null;
  const definition = kind ? KQ_ADVERTISING[kind] : null;
  const dataIssues: string[] = [];
  const snapshotNow = date(business?.serverNow) ? Date.parse(business.serverNow) : null;
  const now = snapshotNow !== null && (liveNow === undefined || time(liveNow))
    ? Math.max(snapshotNow, liveNow ?? snapshotNow) : null;
  const cashCents = cents(data.cashCents) ? data.cashCents : null;
  if (!definition) dataIssues.push("Cette publicité est indisponible. Choisis une offre du catalogue.");
  if (!business || business.version !== 1) dataIssues.push("Les données de gestion sont indisponibles. Actualise avant de lancer une publicité.");
  if (now === null) dataIssues.push("L’heure de la boutique est indisponible. Actualise les données.");
  if (cashCents === null) dataIssues.push("La trésorerie disponible est inconnue. Actualise avant d’engager un budget.");

  // Online snapshots declare the current tier and activity. Legacy accounts
  // retain their paid subscription contract without inventing a free tier.
  const site = data.online === undefined ? business?.shop : data.online?.site;
  const tierKnown = site?.tier === undefined ? data.online === undefined
    : KQ_ONLINE_SITE_TIERS.some(tier => tier.code === site.tier);
  const basic = site?.tier === "basic";
  const createdAt = date(site?.createdAt) ? Date.parse(site.createdAt) : null;
  const paidUntil = date(site?.paidUntil) ? Date.parse(site.paidUntil) : null;
  const siteKnown = Boolean(site && tierKnown && typeof site.active === "boolean"
    && (site.createdAt === null || createdAt !== null)
    && (basic || site.paidUntil === null || paidUntil !== null)
    && !(site.active && (createdAt === null || (!basic && paidUntil === null))));
  let siteState: KqAdvertisingSiteState = "unknown";
  if (siteKnown && now !== null) {
    siteState = site!.active && createdAt !== null && createdAt <= now && (basic || (paidUntil !== null && paidUntil > now))
      ? "active" : "inactive";
  }
  if (!siteKnown) dataIssues.push("L’état du site est indisponible. Actualise les données.");

  const rawAdvertising: unknown = business?.advertising;
  const advertising = validAdvertising(rawAdvertising) ? rawAdvertising : null;
  let advertisingState: KqAdvertisingState = "unavailable";
  if (business?.version === 1 && rawAdvertising === null) advertisingState = "none";
  else if (business?.version === 1 && advertising && now !== null) {
    advertisingState = Date.parse(advertising.endsAt) <= now ? "ended"
      : Date.parse(advertising.startedAt) > now ? "scheduled" : "active";
  }
  if (advertisingState === "unavailable") dataIssues.push("L’état de la publicité est indisponible. Actualise les données.");
  const durationMs = advertising ? Date.parse(advertising.endsAt) - Date.parse(advertising.startedAt) : null;
  const remainingMs = advertising && now !== null ? Math.max(0, Date.parse(advertising.endsAt) - now) : null;
  const currentBoostPercent = advertisingState === "none" || advertisingState === "ended" || advertisingState === "scheduled" ? 0
    : advertisingState === "active" && siteState !== "unknown" ? siteState === "active" ? advertising!.boostPercent : 0 : null;

  const endTime = now !== null && definition ? now + definition.durationDays * KQ_GAME_DAY_MS : null;
  const endsAt = time(endTime) ? new Date(endTime).toISOString() : null;
  if (now !== null && definition && endsAt === null) dataIssues.push("La fin de cette publicité ne peut pas être calculée. Actualise les données.");
  const subscriptionEndsFirst = siteKnown && endsAt !== null ? basic ? false : paidUntil === null ? null : paidUntil < Date.parse(endsAt) : null;
  const missingCents = cashCents !== null && definition ? Math.max(0, definition.costCents - cashCents) : null;
  // Only published listings with remaining stock and quality >= 5.8 can receive
  // buyers. An unreadable stock stays unknown; an empty stock is not a debit gate.
  const activeFlowerListings = data.online ? getKqShopActivity(data).flowers.activeListings : null;
  const blockingReasons = [...dataIssues];
  if (siteState === "inactive") blockingReasons.push("Ouvre ou réactive ton site avant de lancer une publicité.");
  if (advertisingState === "active" || advertisingState === "scheduled") blockingReasons.push("Une publicité occupe déjà ce créneau. Attends sa fin pour en lancer une autre.");
  if (advertisingState === "ended") blockingReasons.push("Cette publicité est terminée. Actualise pour confirmer sa clôture avant d’en lancer une autre.");
  if (missingCents !== null && missingCents > 0) blockingReasons.push("Ta trésorerie ne couvre pas cette publicité.");
  return { definition, kind, now, cashCents, siteState, advertisingState, advertising, currentBoostPercent,
    remainingMs, durationMs, endsAt, subscriptionEndsFirst, missingCents, activeFlowerListings, dataIssues, blockingReasons,
    canLaunch: blockingReasons.length === 0 && siteState === "active" && advertisingState === "none" };
}
