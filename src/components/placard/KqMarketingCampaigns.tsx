"use client";

import { useId, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Clock3, Coins, Megaphone, Package, ReceiptText, Sparkles, Target, Users } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_ONLINE_MARKETING_MISSIONS, type KqOnlineMarketingAngle } from "@/lib/kanab-quest-online";
import { KQ_MARKETING_BUDGETS, KQ_MARKETING_CAMPAIGNS, getKqMarketingPreview, type KqMarketingBudgetCode, type KqMarketingCampaignCode } from "@/lib/kanab-quest-marketing";
import { KqBarChart, KqProgressMeter } from "./KqVisuals";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqMarketingCampaigns.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Props = { data: KqCommerceSnapshot; now: number; busy: boolean; onAsk: Ask; onOpenPricing: (listingId?: string) => void; onPrepareStock?: () => void; advertising?: ReactNode };
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const hoursLeft = (until: string, now: number) => {
  const minutes = Math.max(0, Math.ceil((Date.parse(until) - now) / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ""}`.trim() : `${minutes} min`;
};
const objectives = {
  introduction: { name: "Se lancer", purpose: "Tes premiers clients", tradeoff: "Un essai offert, une seule fois." },
  harvest: { name: "Vendre une récolte", purpose: "Priorité aux ventes", tradeoff: "Plus de visites. Une seule campagne par récolte." },
  "behind-scenes": { name: "Montrer le savoir-faire", purpose: "Construire ton audience", tradeoff: "Préparation longue. Plus d’abonnés par client satisfait." },
  feedback: { name: "Fidéliser", purpose: "Faire revenir les clients", tradeoff: "Moins de visites. Le meilleur plafond d’abonnés." },
} satisfies Record<KqMarketingCampaignCode, { name: string; purpose: string; tradeoff: string }>;
const audiences: Array<{ code: KqOnlineMarketingAngle; name: string; description: string }> = [
  { code: "value", name: "Accessible", description: "Prix jusqu’à 105 % du prix de référence." },
  { code: "craft", name: "Artisan", description: "Qualité ≥ 7,5 et prix jusqu’à 130 % de la référence." },
  { code: "premium", name: "Sélection", description: "Qualité ≥ 8,5 et prix entre 100 et 150 % de la référence." },
];

export function KqMarketingCampaigns({ data, now, busy, onAsk, onOpenPricing, onPrepareStock, advertising }: Props) {
  const id = useId(), api = useKqTutorialApi();
  const [code, setCode] = useState<KqMarketingCampaignCode>(() => data.online?.marketing.completedCodes.includes("introduction") ? "harvest" : "introduction");
  const [listingId, setListingId] = useState("");
  const [angle, setAngle] = useState<KqOnlineMarketingAngle>("craft");
  const [budgetCode, setBudgetCode] = useState<KqMarketingBudgetCode>("local");
  const online = data.online;
  if (!online) return null;
  const active = online.marketing.active;
  const activeV2 = active?.version === 2 ? active : null;
  const legacyMission = active && !activeV2 ? KQ_ONLINE_MARKETING_MISSIONS.find(item => item.code === active.code) : null;
  const preparing = Boolean(activeV2 && Date.parse(activeV2.launchesAt) > now);
  const awaitingReport = Boolean(active && Date.parse(active.endsAt) <= now);
  const listings = online.listings.filter(item => item.status === "active" && item.remainingPackets > 0 && item.qualityScore >= 5.8);
  const selectedListing = listings.find(item => item.id === listingId) ?? listings[0];
  const selectedCode = code === "introduction" && online.marketing.completedCodes.includes("introduction") ? "harvest" : code;
  const selectedBudget = selectedCode === "introduction" ? "local" : budgetCode;
  const preview = getKqMarketingPreview({ data, code: selectedCode, angle, listingId: selectedListing?.id ?? "", budgetCode: selectedBudget });
  const definition = preview.definition;
  const reference = preview.referencePacketCents;
  const audienceDescription = (audience: typeof audiences[number]) => !reference ? audience.description : audience.code === "value"
    ? `Prix jusqu’à ${formatKqCash(Math.floor(reference * 1.05))} par paquet.`
    : audience.code === "craft" ? `Qualité ≥ 7,5 et prix jusqu’à ${formatKqCash(Math.floor(reference * 1.3))}.`
      : `Qualité ≥ 8,5 et prix entre ${formatKqCash(reference)} et ${formatKqCash(Math.floor(reference * 1.5))}.`;
  const history = [...(online.marketing.history ?? [])].filter(item => item.version === 2).sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const activeListing = activeV2 ? online.listings.find(item => item.id === activeV2.listingId) : null;
  const blocked = !preview.ready || online.marketing.version !== 2;
  function launch() {
    if (busy || blocked || active || !selectedListing) return;
    onAsk(`Lancer « ${objectives[selectedCode].name} »`, `${formatKqCash(preview.costCents)} débités maintenant, sans remboursement. ${definition.preparationHours ? `${definition.preparationHours} h de préparation, puis ` : ""}${definition.durationHours} h de diffusion pour « ${selectedListing.name} », public ${audiences.find(item => item.code === angle)?.name}. Le créneau reste occupé jusqu’à la fin. Chaque commande satisfaisante du produit pendant la diffusion rapporte ${definition.followersPerOrder} abonnés, dans la limite de ${definition.followersCap}, attribués au bilan. Le trafic et les ventes ne sont pas garantis ; une rupture ou une pause de l’annonce ne suspend pas la campagne.`, { action: "online", command: "start-marketing", payload: { version: 2, code: selectedCode, angle, listingId: selectedListing.id, budgetCode: selectedBudget } }, preview.costCents);
  }
  return <div className={styles.campaigns}>
    <header className={styles.heading}>
      <div><span className={styles.kicker}><Megaphone size={16} aria-hidden="true" />Le bureau des campagnes</span><h3>Attirer, vendre, fidéliser.</h3></div>
      <span className={styles.slot} data-occupied={Boolean(active)}><span />{active ? "Créneau occupé · 1/1" : "Un créneau disponible"}<small>Préparation et ventes hors connexion</small></span>
    </header>

    {active ? <section className={styles.running} aria-label="Campagne en cours">
      <div className={styles.runningHeader}><div><span className={styles.kicker}>{awaitingReport ? "Bilan en cours de calcul" : preparing ? "En préparation" : "Diffusion en cours"}</span><h4>{activeV2 ? objectives[activeV2.code].name : legacyMission?.name}</h4><p>{activeV2 ? activeV2.listingName : "Ta campagne déjà engagée conserve ses conditions."}</p></div><span className={styles.clock}><Clock3 size={18} aria-hidden="true" />{awaitingReport ? "Actualisation en cours…" : `Encore ${hoursLeft(preparing && activeV2 ? activeV2.launchesAt : active.endsAt, now)}`}<small>{preparing && activeV2 ? `Diffusion le ${date(activeV2.launchesAt)}` : `Fin le ${date(active.endsAt)}`}</small></span></div>
      {activeV2 ? <>
        <ol className={styles.timeline} aria-label="Étapes de la campagne"><li data-current={preparing}><span>{preparing ? <Clock3 size={15} /> : <Check size={15} />}</span>Préparer<small>{date(activeV2.startedAt)}</small></li><li data-current={!preparing && !awaitingReport}><span><Megaphone size={15} /></span>Diffuser<small>{date(activeV2.launchesAt)}</small></li><li data-current={awaitingReport}><span><ReceiptText size={15} /></span>Bilan<small>{date(activeV2.endsAt)}</small></li></ol>
        <div className={styles.liveResults}>
          <div className={styles.goal}><KqProgressMeter label="Objectif de commandes satisfaisantes" value={activeV2.results.satisfiedOrders} max={activeV2.goalOrders} valueLabel={`${activeV2.results.satisfiedOrders} / ${activeV2.goalOrders}`} hint={preparing ? "Les commandes compteront dès la diffusion." : "Une commande compte dès 75/100 de satisfaction."} /><KqProgressMeter label="Abonnés acquis au bilan" value={activeV2.results.followersEarned} max={activeV2.followersCap} valueLabel={`+${activeV2.results.followersEarned} / ${activeV2.followersCap} max.`} tone="gold" /></div>
          <dl className={styles.runningStats}><div><dt>Budget engagé</dt><dd>{formatKqCash(activeV2.costCents)}</dd></div><div><dt>Commandes pendant la diffusion</dt><dd>{activeV2.results.orders}</dd></div><div><dt>Paquets encore en vente</dt><dd>{activeListing ? activeListing.status === "active" ? activeListing.remainingPackets : 0 : "Indisponible"}</dd></div></dl>
        </div>
        {!activeListing || activeListing.status !== "active" || activeListing.remainingPackets <= 0 ? <p className={styles.warning}>L’annonce ne vend plus. La campagne continue de consommer son temps et son budget sans nouvelles commandes sur ce produit.</p> : null}
        <div className={styles.runningFooter}><p>{audiences.find(item => item.code === activeV2.angle)?.name} · {number(activeV2.visitorsPerDay)} visites ciblées / jour avant adéquation. Le budget est engagé pour toute la durée.</p><button type="button" className={styles.textButton} onClick={() => onOpenPricing(activeV2.listingId)}>Revoir mes prix <ArrowRight size={15} aria-hidden="true" /></button></div>
      </> : <div className={styles.legacy}><KqProgressMeter label="Avancement de la campagne" value={Math.max(0, now - Date.parse(active.startedAt))} max={Date.parse(active.endsAt) - Date.parse(active.startedAt)} valueLabel={`Fin le ${date(active.endsAt)}`} /><p>{legacyMission ? `+${legacyMission.followersReward} abonnés prévus au bilan.` : "Récompense au bilan indisponible."} Prochain créneau après cette campagne.</p></div>}
    </section> : <>
      <div className={styles.objectives} role="group" aria-label="Objectif de campagne">{KQ_MARKETING_CAMPAIGNS.map(item => {
        const used = item.code === "introduction" && online.marketing.completedCodes.includes("introduction");
        return <button type="button" key={item.code} aria-pressed={item.code === selectedCode} disabled={busy || used} onClick={() => setCode(item.code)}><span>{objectives[item.code].purpose}{item.code === selectedCode ? <Check size={15} aria-hidden="true" /> : null}</span><strong>{objectives[item.code].name}</strong><small>{used ? "Lancement déjà effectué" : item.code === "introduction" ? "Premier essai offert" : `${item.preparationHours} h de préparation · ${item.durationHours} h de diffusion`}</small></button>;
      })}</div>
      <div className={styles.planner}>
        <form className={styles.brief} aria-label="Préparer une campagne" onSubmit={event => { event.preventDefault(); launch(); }}>
          <div className={styles.briefHeading}><div><h4>{objectives[selectedCode].name}</h4><p>{objectives[selectedCode].tradeoff}</p></div><Image src="/placard/market-social-missions-sylvain-v3.webp" width={104} height={84} alt="" /></div>
          <div className={styles.productField}><label htmlFor={`${id}-listing`}><Package size={16} aria-hidden="true" />Annonce à promouvoir</label><select id={`${id}-listing`} value={selectedListing?.id ?? ""} disabled={busy || !listings.length} onChange={event => setListingId(event.target.value)}>{!listings.length ? <option value="">Aucune annonce en vente</option> : listings.map(item => <option key={item.id} value={item.id}>{item.name} · {item.formatGrams} g · {item.remainingPackets} paquets</option>)}</select>
            {selectedListing ? <div className={styles.productFacts}><span>Prix <strong>{formatKqCash(selectedListing.packetPriceCents)}</strong></span><span>Qualité <strong>{number(selectedListing.qualityScore)}/10</strong></span><span>Référence estimée à la diffusion <strong>{formatKqCash(reference)}</strong></span><button type="button" className={styles.textButton} onClick={() => onOpenPricing(selectedListing.id)}>Ajuster mon prix <ArrowRight size={13} aria-hidden="true" /></button></div> : <Link prefetch={false} className={styles.textButton} href="/arene/placard?view=market&section=sales" onClick={event => { if (onPrepareStock) { event.preventDefault(); onPrepareStock(); } }}>Préparer des paquets au Marché <ArrowRight size={14} aria-hidden="true" /></Link>}
          </div>
          <fieldset className={styles.audience}><legend><Users size={16} aria-hidden="true" />Public visé</legend><div>{audiences.map(item => <label key={item.code} data-selected={angle === item.code}><input type="radio" name={`${id}-audience`} value={item.code} checked={angle === item.code} disabled={busy} onChange={() => setAngle(item.code)} /><span><strong>{item.name}</strong><small>{audienceDescription(item)}</small></span></label>)}</div></fieldset>
          <fieldset className={styles.budget}><legend><Coins size={16} aria-hidden="true" />Budget de campagne</legend>{selectedCode === "introduction" ? <p className={styles.freeTrial}><Sparkles size={18} aria-hidden="true" /><span><strong>Ton premier essai est offert.</strong><small>35 visites / jour pendant 24 h. Les abonnés se gagnent avec les ventes.</small></span></p> : <div>{KQ_MARKETING_BUDGETS.map(item => <label key={item.code} data-selected={budgetCode === item.code}><input type="radio" name={`${id}-budget`} value={item.code} checked={budgetCode === item.code} disabled={busy} onChange={() => setBudgetCode(item.code)} /><span><small>{item.name}</small><strong>{formatKqCash(item.costCents)}</strong><small>{number(item.visitorsPerDay * definition.trafficMultiplier)} visites / jour</small></span></label>)}</div>}</fieldset>
          <dl className={styles.rules}><div><dt>Préparation · sans trafic</dt><dd>{definition.preparationHours} h</dd></div><div><dt>Diffusion</dt><dd>{definition.durationHours} h</dd></div><div><dt>Par commande satisfaisante</dt><dd>+{definition.followersPerOrder} abonnés</dd></div><div><dt>Crédités au bilan</dt><dd>{definition.followersCap} abonnés max.</dd></div></dl>
        </form>

        <aside className={styles.forecast} aria-label="Prévision de campagne" aria-live="polite" aria-atomic="true">
          <span className={styles.kicker}><Target size={16} aria-hidden="true" />Avant de t’engager</span><h4>Ce que tu mets en jeu</h4>
          <dl className={styles.investment}><div><dt>Budget débité au lancement</dt><dd>{formatKqCash(preview.costCents)}</dd></div><div><dt>Créneau occupé</dt><dd>{definition.preparationHours + definition.durationHours} h<small> {api.isTutorial ? "fictives" : "réelles"}</small></dd></div></dl>
          <div className={styles.fit} data-fit={preview.fit >= 1}><span>{preview.fit >= 1 ? <Check size={17} aria-hidden="true" /> : <Target size={17} aria-hidden="true" />} {selectedListing ? preview.fit >= 1 ? "Ce public correspond à ton offre" : "Ton offre convainc peu ce public" : "Choisis d’abord une annonce"}</span><p>{selectedListing ? `${number(preview.visitorsPerDay * preview.fit)} visites ciblées / jour après adéquation. ${preview.fit < 1 ? "Adapte le public ou ton prix avant d’investir." : "Le stock et la satisfaction feront la différence."}` : "Il faut un produit disponible pour transformer les visites en commandes."}</p></div>
          {selectedListing ? <>
            <div className={styles.visualCard}><KqProgressMeter label="Satisfaction estimée" value={preview.satisfactionScore} max={100} valueLabel={`${number(preview.satisfactionScore)} / 100`} hint="75/100 minimum pour gagner des abonnés" tone={preview.satisfactionScore >= 75 ? "teal" : "gold"} /></div>
            <div className={styles.visualCard}><KqBarChart title="Contribution supplémentaire estimée" items={[
              { label: "Avant budget de campagne", value: preview.projectedExtraContributionCents, displayValue: formatKqCash(preview.projectedExtraContributionCents), tone: "teal" },
              { label: "Budget de campagne", value: -preview.costCents, displayValue: formatKqCash(-preview.costCents), tone: "gold" },
              { label: "Après budget", value: preview.netAfterCampaignCents, displayValue: formatKqCash(preview.netAfterCampaignCents), tone: preview.netAfterCampaignCents < 0 ? "red" : "teal" },
            ]} /><small>Avant coût de production et charges fixes.</small></div>
            <dl className={styles.estimates}><div><dt>Ventes supplémentaires estimées</dt><dd>≈ {number(preview.projectedExtraOrders)}<small> paquets</small></dd></div><div><dt>Pour couvrir le budget*</dt><dd>{Number.isFinite(preview.breakEvenOrders) ? preview.breakEvenOrders : "Non calculable"}<small>{Number.isFinite(preview.breakEvenOrders) ? "ventes supplémentaires" : "avec cette offre"}</small></dd></div><div><dt>Abonnés estimés au bilan</dt><dd>+{number(preview.expectedFollowers)}<small> / {definition.followersCap} max.</small></dd></div></dl>
          </> : <p className={styles.noForecast}>Prévisions disponibles après sélection d’une annonce.</p>}
          <p className={styles.target}><Target size={16} aria-hidden="true" />Objectif : {definition.goalOrders} commandes satisfaisantes sur le produit pendant la diffusion.</p>
          {preview.warnings.length ? <ul className={styles.warnings}>{preview.warnings.map(message => <li key={message}>{message}</li>)}</ul> : null}
          {online.marketing.version !== 2 ? <p className={styles.warning}>Les nouvelles campagnes sont momentanément indisponibles.</p> : preview.blockingReasons.length ? <ul className={styles.blockers}>{preview.blockingReasons.map(message => <li key={message}>{message}</li>)}</ul> : null}
          <button type="button" className={styles.launch} disabled={busy || blocked} onClick={launch}>{busy ? "En cours…" : preview.costCents ? `Engager ${formatKqCash(preview.costCents)}` : "Préparer mon premier lancement"}<ArrowRight size={17} aria-hidden="true" /></button>
          <small className={styles.commitment}>Budget engagé jusqu’au bout, même si le produit ne se vend pas. Les actions se déroulent dans le jeu.</small>
        </aside>
      </div>
      <details className={styles.footnote}><summary>Comment sont calculées les prévisions ?</summary><p>Comparaison avec les ventes estimées sans campagne : après TVA, frais, emballage et budget de campagne, avant coût de production et charges fixes. Prévisions indicatives, limitées par le stock et le temps de vente disponible. Les résultats incluent toutes les commandes du produit pendant la diffusion. La satisfaction évolue avec la qualité et la demande.</p></details>
    </>}

    {history.length ? <details className={styles.history} data-marketing-history><summary><ReceiptText size={18} aria-hidden="true" /><strong>Bilans des campagnes</strong><span>{history.length} récent{history.length > 1 ? "s" : ""} · dernier : +{history[0].results.followersEarned} abonnés</span></summary><p>Commandes du produit pendant la diffusion, y compris celles venues naturellement. Le montant des ventes n’est pas le bénéfice de la campagne.</p><div className={styles.reports}>{history.map(report => <article key={report.id} data-marketing-report={report.id} aria-label={`Bilan ${objectives[report.code].name}`}><header><div><strong>{objectives[report.code].name}</strong><small>{report.listingName} · {date(report.completedAt)}</small></div><span data-success={report.results.satisfiedOrders >= report.goalOrders}>{report.results.satisfiedOrders >= report.goalOrders ? "Objectif atteint" : "Objectif partiel"}</span></header><dl><div><dt>Budget engagé</dt><dd>{formatKqCash(report.costCents)}</dd></div><div><dt>Commandes satisfaisantes</dt><dd>{report.results.satisfiedOrders} / {report.goalOrders}</dd></div><div><dt>Ventes versées en trésorerie</dt><dd>{formatKqCash(report.results.netRevenueCents)}</dd></div><div><dt>Abonnés gagnés</dt><dd>+{report.results.followersEarned}</dd></div></dl></article>)}</div></details> : null}
    {advertising ? <details className={styles.advertising}><summary><Megaphone size={18} aria-hidden="true" /><strong>Publicité générale de la boutique</strong><span>Un autre levier pour l’audience naturelle</span></summary><p>La publicité générale agit sur les visiteurs habituels de la boutique. Elle ne multiplie pas les visites ciblées de ces campagnes.</p>{advertising}</details> : null}
  </div>;
}
