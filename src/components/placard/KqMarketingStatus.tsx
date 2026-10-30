"use client";

import { ArrowRight, Check, Clock3, Megaphone, ReceiptText } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_ONLINE_MARKETING_MISSIONS, type KqOnlineMarketingAngle } from "@/lib/kanab-quest-online";
import type { KqMarketingCampaignCode } from "@/lib/kanab-quest-marketing";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqMarketingStatus.module.css";

export const marketingObjectives = {
  introduction: { name: "Se lancer", purpose: "Tes premiers clients", tradeoff: "Un essai offert, une seule fois." },
  harvest: { name: "Vendre une récolte", purpose: "Priorité aux ventes", tradeoff: "Plus de visites. Une seule campagne par récolte." },
  "behind-scenes": { name: "Montrer le savoir-faire", purpose: "Construire ton audience", tradeoff: "Préparation longue. Plus d’abonnés par client satisfait." },
  feedback: { name: "Fidéliser", purpose: "Faire revenir les clients", tradeoff: "Moins de visites. Le meilleur plafond d’abonnés." },
} satisfies Record<KqMarketingCampaignCode, { name: string; purpose: string; tradeoff: string }>;

export const marketingAudiences: Array<{ code: KqOnlineMarketingAngle; name: string; description: string }> = [
  { code: "value", name: "Accessible", description: "Prix jusqu’à 105 % du prix de référence." },
  { code: "craft", name: "Artisan", description: "Qualité ≥ 7,5 et prix jusqu’à 130 % de la référence." },
  { code: "premium", name: "Sélection", description: "Qualité ≥ 8,5 et prix entre 100 et 150 % de la référence." },
];

const countKnown = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const count = (value: unknown) => countKnown(value) ? number(value) : "Indisponible";
const cash = (value: unknown) => countKnown(value) ? formatKqCash(value) : "Indisponible";
const timestamp = (value: unknown) => typeof value === "string" ? Date.parse(value) : NaN;
const date = (value: unknown) => Number.isFinite(timestamp(value))
  ? new Date(timestamp(value)).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  : "Date indisponible";
const campaignName = (code: KqMarketingCampaignCode) => marketingObjectives[code]?.name ?? "Campagne";
function timeLeft(until: number, now: number) {
  const minutes = Math.max(0, Math.ceil((until - now) / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
}

export function KqMarketingStatus({ data, now, onOpenPricing }: {
  data: KqCommerceSnapshot; now: number; onOpenPricing: (listingId?: string) => void;
}) {
  const online = data.online;
  const active = online?.marketing?.active;
  if (!online || !active) return null;
  const campaign = active.version === 2 ? active : null;
  const isLegacy = active.version === undefined || active.version === 1;
  const legacy = isLegacy ? KQ_ONLINE_MARKETING_MISSIONS.find(item => item.code === active.code) : null;
  const started = timestamp(active.startedAt), ends = timestamp(active.endsAt);
  const launches = campaign ? timestamp(campaign.launchesAt) : started;
  const scheduleKnown = Boolean(campaign || isLegacy) && [started, launches, ends, now].every(Number.isFinite) && started <= launches && launches < ends && now >= started;
  const preparing = scheduleKnown && now < launches;
  const awaitingReport = scheduleKnown && now >= ends;
  const listing = campaign && Array.isArray(online.listings) ? online.listings.find(item => item?.id === campaign.listingId) : null;
  const stockKnown = countKnown(listing?.remainingPackets);
  const qualityKnown = typeof listing?.qualityScore === "number" && Number.isFinite(listing.qualityScore) && listing.qualityScore >= 0 && listing.qualityScore <= 10;
  const stockState = !listing ? "Annonce indisponible"
    : online.site?.active === false ? "Boutique suspendue"
      : online.site?.active !== true ? "État de la boutique indisponible"
        : listing.status === "paused" ? "Annonce en pause"
          : stockKnown && listing.remainingPackets === 0 ? "Stock épuisé"
            : !["active", "closed", "sold-out", "quality-blocked", "discarded"].includes(listing.status) ? "État de l’annonce indisponible"
              : listing.status !== "active" ? "Annonce hors vente"
              : !stockKnown || !qualityKnown ? "Disponibilité à vérifier"
                : listing.qualityScore < 5.8 ? "Qualité insuffisante pour vendre"
                  : "En vente";
  const results = campaign?.results;
  const ordersKnown = countKnown(results?.orders);
  const satisfiedKnown = countKnown(results?.satisfiedOrders) && (!ordersKnown || results!.satisfiedOrders <= results!.orders);
  const goalKnown = countKnown(campaign?.goalOrders) && campaign!.goalOrders > 0;
  const followersKnown = countKnown(results?.followersEarned) && (!countKnown(campaign?.followersCap) || results!.followersEarned <= campaign!.followersCap);
  const state = !campaign && !isLegacy ? "Conditions indisponibles" : !scheduleKnown ? "Calendrier indisponible" : awaitingReport ? "Bilan en cours de calcul" : preparing ? "En préparation" : "Diffusion en cours";

  return <section className={styles.status} aria-label="Campagne en cours" data-marketing-status data-marketing-running>
    <header className={styles.heading}>
      <div><p className={styles.state}><Clock3 size={16} aria-hidden="true" />{state}</p><h4>{campaign ? campaignName(campaign.code) : legacy?.name ?? "Campagne en cours"}</h4><p>{campaign?.listingName || (isLegacy ? "Ta campagne conserve ses conditions de départ." : "Les conditions de cette campagne ne sont pas disponibles.")}</p></div>
      <div className={styles.deadline}><strong>{!scheduleKnown ? "Échéance à vérifier" : awaitingReport ? "Actualisation en cours…" : `${timeLeft(preparing ? launches : ends, now)} restantes`}</strong><span>{preparing && campaign ? `Diffusion le ${date(campaign.launchesAt)}` : `Fin le ${date(active.endsAt)}`}</span></div>
    </header>

    {campaign ? <>
      <dl className={styles.keyNumbers}>
        <div><dt>Budget déjà payé</dt><dd>{cash(campaign.costCents)}</dd><small>Aucun nouveau débit au bilan.</small></div>
        <div><dt>Stock du produit</dt><dd>{stockKnown ? `${number(listing!.remainingPackets)} paquets` : "Indisponible"}</dd><small>{stockState}</small></div>
        <div><dt>Commandes du produit</dt><dd>{count(results?.orders)}</dd><small>Pendant la diffusion, trafic naturel inclus.</small></div>
      </dl>
      {stockState !== "En vente" ? <p className={styles.warning}>{stockState}. {stockState.includes("indisponible") || stockState === "Disponibilité à vérifier" ? "Vérifie que le produit peut encore se vendre." : "Ce produit ne peut plus recevoir de commandes."} {awaitingReport ? "La diffusion est terminée et le bilan est en cours de calcul." : "Une pause des ventes n’interrompt pas la campagne."} Le budget déjà payé ne sera pas remboursé.</p> : null}
      <div className={styles.results}>
        {satisfiedKnown && goalKnown ? <KqProgressMeter label="Objectif de commandes satisfaisantes" value={results!.satisfiedOrders} max={campaign.goalOrders} valueLabel={`${number(results!.satisfiedOrders)} / ${number(campaign.goalOrders)}`} hint={preparing ? "Les commandes compteront dès la diffusion." : "À partir de 75/100 de satisfaction."} />
          : <p className={styles.unavailable}>Commandes satisfaisantes : {satisfiedKnown ? count(results?.satisfiedOrders) : "indisponibles"}. Objectif : {goalKnown ? count(campaign.goalOrders) : "indisponible"}.</p>}
        <div className={styles.followers}><span>Abonnés à recevoir au bilan</span><strong>{followersKnown ? `+${number(results!.followersEarned)}` : "Indisponible"}</strong><small>{countKnown(campaign.followersCap) ? `${number(campaign.followersCap)} maximum · ` : ""}Pas encore crédités.</small></div>
      </div>
      {typeof campaign.listingId === "string" && campaign.listingId ? <button type="button" className={styles.action} onClick={() => onOpenPricing(campaign.listingId)}>{stockState === "En vente" ? "Revoir le prix du produit" : "Voir le produit en vente"}<ArrowRight size={16} aria-hidden="true" /></button> : null}
      <details className={styles.details} data-marketing-timeline>
        <summary>Calendrier et conditions de la campagne</summary>
        <ol className={styles.timeline} aria-label="Étapes de la campagne">
          <li aria-current={preparing ? "step" : undefined}><span>{scheduleKnown && !preparing ? <Check size={16} aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />}Préparer</span><time>{date(campaign.startedAt)}</time></li>
          <li aria-current={scheduleKnown && !preparing && !awaitingReport ? "step" : undefined}><span><Megaphone size={16} aria-hidden="true" />Diffuser</span><time>{date(campaign.launchesAt)}</time></li>
          <li aria-current={awaitingReport ? "step" : undefined}><span><ReceiptText size={16} aria-hidden="true" />Bilan</span><time>{date(campaign.endsAt)}</time></li>
        </ol>
        <p>Public : {marketingAudiences.find(item => item.code === campaign.angle)?.name ?? "indisponible"}. {typeof campaign.visitorsPerDay === "number" && Number.isFinite(campaign.visitorsPerDay) && campaign.visitorsPerDay >= 0 ? `${number(campaign.visitorsPerDay)} visites ciblées par jour, avant adéquation avec ton offre.` : "Visites ciblées indisponibles."}</p>
        <p>La préparation ne génère pas de trafic ciblé. Le créneau reste occupé jusqu’au bilan. Le budget couvre toute la campagne, y compris pendant une rupture de stock ou une pause des ventes.</p>
      </details>
    </> : <div className={styles.legacy}>
      {scheduleKnown ? <KqProgressMeter label="Avancement de la campagne" value={Math.max(0, now - started)} max={ends - started} valueLabel={`Fin le ${date(active.endsAt)}`} /> : isLegacy ? <p>Avancement indisponible tant que le calendrier n’est pas connu.</p> : null}
      <p>{legacy ? `+${legacy.followersReward} abonnés prévus au bilan.` : "Récompense au bilan indisponible."} Prochain créneau après cette campagne.</p>
    </div>}
  </section>;
}

export function KqMarketingHistory({ data }: { data: KqCommerceSnapshot }) {
  const source = data.online?.marketing?.history;
  if (!Array.isArray(source)) return <p className={styles.historyUnavailable}>Bilans des campagnes indisponibles.</p>;
  const hasUnreadableRows = source.some(item => !item || (item.version !== 2 && (
    (item.version !== 1 && item.version !== undefined) || typeof item.id !== "string"
    || typeof item.code !== "string" || !Number.isFinite(timestamp(item.completedAt))
  )));
  const history = source.filter(item => item?.version === 2).sort((a, b) => {
    const first = timestamp(a.completedAt), second = timestamp(b.completedAt);
    return (Number.isFinite(second) ? second : -Number.MAX_VALUE) - (Number.isFinite(first) ? first : -Number.MAX_VALUE);
  });
  if (!history.length) return hasUnreadableRows ? <p className={styles.historyUnavailable}>Certains bilans des campagnes sont indisponibles.</p> : null;
  const last = history[0];
  const lastFollowersKnown = countKnown(last.results?.followersEarned) && (!countKnown(last.followersCap) || last.results.followersEarned <= last.followersCap);
  const allDatesKnown = !hasUnreadableRows && history.every(report => Number.isFinite(timestamp(report.completedAt)));
  return <details className={styles.history} data-marketing-history>
    <summary><ReceiptText size={18} aria-hidden="true" /><strong>Bilans des campagnes</strong><span>{history.length} bilan{history.length > 1 ? "s" : ""}{allDatesKnown && lastFollowersKnown ? ` · dernier : +${number(last.results.followersEarned)} abonnés` : " · données incomplètes"}</span></summary>
    <p>Ces résultats incluent toutes les commandes du produit pendant la diffusion, y compris le trafic naturel. Les ventes versées en trésorerie ne sont pas le bénéfice de la campagne.</p>
    {hasUnreadableRows ? <p>Certains bilans sont indisponibles et ne figurent pas dans cette liste.</p> : null}
    <div className={styles.reports}>{history.map(report => {
      const satisfiedKnown = countKnown(report.results?.satisfiedOrders) && (!countKnown(report.results?.orders) || report.results.satisfiedOrders <= report.results.orders);
      const goalKnown = countKnown(report.goalOrders) && report.goalOrders > 0;
      const followersKnown = countKnown(report.results?.followersEarned) && (!countKnown(report.followersCap) || report.results.followersEarned <= report.followersCap);
      const goalReached = satisfiedKnown && goalKnown ? report.results.satisfiedOrders >= report.goalOrders : null;
      return <article key={report.id} tabIndex={-1} data-marketing-report={report.id} aria-label={`Bilan ${campaignName(report.code)}`}>
        <header><div><strong>{campaignName(report.code)}</strong><span>{report.listingName || "Produit indisponible"} · {date(report.completedAt)}</span></div><span className={styles.outcome} data-success={goalReached ?? undefined}>{goalReached === null ? "Objectif indisponible" : goalReached ? "Objectif atteint" : "Objectif partiel"}</span></header>
        <dl>
          <div><dt>Budget payé</dt><dd>{cash(report.costCents)}</dd></div>
          <div><dt>Commandes satisfaisantes</dt><dd>{satisfiedKnown ? count(report.results?.satisfiedOrders) : "Indisponible"} / {goalKnown ? count(report.goalOrders) : "objectif indisponible"}</dd></div>
          <div><dt>Ventes versées en trésorerie</dt><dd>{cash(report.results?.netRevenueCents)}</dd></div>
          <div><dt>Abonnés gagnés au bilan</dt><dd>{followersKnown ? `+${number(report.results.followersEarned)}` : "Indisponible"}</dd></div>
        </dl>
      </article>;
    })}</div>
  </details>;
}
