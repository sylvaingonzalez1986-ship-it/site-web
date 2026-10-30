import type { KqHubAttentionResult } from "./kanab-quest-hub-attention";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const identity = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const quality = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10;
const ignoredStatuses = new Set(["paused", "closed", "sold-out", "discarded"]);
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

type BlockedListing = { id: string; name: string; remainingPackets: number; qualityScore: number };

/** Advice from the current server snapshot, without advancing time or changing a sale.
 * Voluntary pauses stay quiet, even when those packets have since lost quality.
 */
export function getKqHubSalesAttention(payload: unknown): KqHubAttentionResult {
  if (!record(payload) || !record(payload.online) || payload.online.version !== 1
    || !timestamp(payload.online.serverNow) || !Array.isArray(payload.online.listings)) return { notice: null, complete: false };
  const online = payload.online;
  const site = record(online.site) ? online.site : null;
  const siteKnown = Boolean(site && typeof site.active === "boolean"
    && (site.createdAt === null || timestamp(site.createdAt)) && !(site.createdAt === null && site.active));
  let complete = siteKnown;
  let blocked: BlockedListing | null = null;
  let activePackets = false;
  // An ambiguous identifier cannot safely open a particular announcement.
  const ids = new Map<string, number>();
  for (const value of payload.online.listings) if (record(value) && identity(value.id)) ids.set(value.id, (ids.get(value.id) ?? 0) + 1);

  for (const value of payload.online.listings) {
    if (!record(value) || typeof value.status !== "string") { complete = false; continue; }
    if (ignoredStatuses.has(value.status)) continue;
    if (!["active", "quality-blocked"].includes(value.status) || !count(value.remainingPackets)) { complete = false; continue; }
    if (value.remainingPackets === 0) continue;
    if (!identity(value.id) || ids.get(value.id) !== 1 || !identity(value.name) || !quality(value.qualityScore)) { complete = false; continue; }
    if (value.status === "quality-blocked" && value.qualityScore >= 5.8) { complete = false; continue; }
    if (value.qualityScore < 5.8) {
      // SQL presents an active listing below the retail gate as quality-blocked.
      blocked ??= { id: value.id, name: value.name, remainingPackets: value.remainingPackets, qualityScore: value.qualityScore };
    } else if (value.status === "active") activePackets = true;
  }

  if (blocked) {
    const packets = `${number(blocked.remainingPackets)} paquet${blocked.remainingPackets > 1 ? "s" : ""}`;
    const displayedQuality = number(blocked.qualityScore);
    const qualityDescription = displayedQuality === number(5.8)
      ? "qualité inférieure à 5,8/10"
      : `qualité ${displayedQuality}/10, sous le seuil de vente en ligne de 5,8/10`;
    return { complete, notice: {
      id: "sales-quality", severity: "attention", title: "Une vente est bloquée par la qualité",
      description: `« ${blocked.name} » : ${packets}, ${qualityDescription}. Ces paquets restent préparés ; consulte leur état.`,
      buttonLabel: "Vérifier ces paquets", summary: `Qualité insuffisante : ${packets} de « ${blocked.name} » à vérifier.`,
      destination: "market", options: { marketSection: "dashboard", listingId: blocked.id },
    } };
  }
  if (siteKnown && site!.createdAt !== null && site!.active === false && activePackets) return { complete, notice: {
    id: "sales-suspended", severity: "attention", title: "Ta boutique en ligne est suspendue",
    description: "Des paquets sont encore proposés à la vente, mais le site suspendu ne reçoit plus de commandes. Vérifie la situation de ta boutique ; tes paquets restent préparés.",
    buttonLabel: "Vérifier ma boutique", summary: "Boutique suspendue : des paquets attendent la reprise des commandes.",
    destination: "market", options: { marketSection: "management" },
  } };
  return { notice: null, complete };
}
