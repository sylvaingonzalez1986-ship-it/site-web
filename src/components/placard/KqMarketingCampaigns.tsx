"use client";

import { useId, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Target } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import type { KqOnlineMarketingAngle } from "@/lib/kanab-quest-online";
import { KQ_MARKETING_BUDGETS, KQ_MARKETING_CAMPAIGNS, type KqMarketingBudgetCode, type KqMarketingCampaignCode } from "@/lib/kanab-quest-marketing";
import { KqMarketingHistory, KqMarketingStatus, marketingAudiences, marketingObjectives } from "./KqMarketingStatus";
import { getKqMarketingView } from "./kq-marketing-view";
import { KqBarChart, KqProgressMeter } from "./KqVisuals";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqMarketingCampaigns.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Props = { data: KqCommerceSnapshot; now: number; busy: boolean; onAsk: Ask; onOpenPricing: (listingId?: string) => void; onPrepareStock?: () => void; advertising?: ReactNode };
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const cashKnown = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function CampaignPlanner({ data, busy, onAsk, onOpenPricing, onPrepareStock }: Omit<Props, "now" | "advertising">) {
  const id = useId(), api = useKqTutorialApi();
  const completed = Array.isArray(data.online?.marketing?.completedCodes) ? data.online.marketing.completedCodes : [];
  const [code, setCode] = useState<KqMarketingCampaignCode>(() => completed.includes("introduction") ? "harvest" : "introduction");
  const [listingId, setListingId] = useState("");
  const [angle, setAngle] = useState<KqOnlineMarketingAngle>("craft");
  const [budgetCode, setBudgetCode] = useState<KqMarketingBudgetCode>("local");
  const view = getKqMarketingView({ data, code, angle, listingId, budgetCode });
  const { preview, definition, listing, listings, selectedCode, selectedBudget, costCents } = view;
  const audience = marketingAudiences.find(item => item.code === angle)!;
  const reference = preview?.referencePacketCents;
  const audienceDescription = reference === undefined ? audience.description : angle === "value"
    ? `Prix jusqu’à ${formatKqCash(Math.floor(reference * 1.05))} par paquet.`
    : angle === "craft" ? `Qualité ≥ 7,5/10 et prix jusqu’à ${formatKqCash(Math.floor(reference * 1.3))} par paquet.`
      : `Qualité ≥ 8,5/10 et prix entre ${formatKqCash(reference)} et ${formatKqCash(Math.floor(reference * 1.5))} par paquet.`;
  const timeUnit = api.isTutorial ? "fictives" : "réelles";
  const cash = cashKnown(data.cashCents) ? data.cashCents : null;
  function launch() {
    if (busy || !view.canLaunch || !preview || !listing) return;
    onAsk(`Lancer « ${marketingObjectives[selectedCode].name} »`, `${costCents ? `${formatKqCash(costCents)} débités maintenant, sans remboursement.` : "Essai offert, utilisable une seule fois."} ${definition.preparationHours ? `${definition.preparationHours} h de préparation, puis ` : ""}${definition.durationHours} h de diffusion pour « ${listing.name} », public ${audience.name}. Le créneau reste occupé jusqu’à la fin. Chaque commande satisfaisante de ce produit pendant la diffusion rapporte ${definition.followersPerOrder} abonnés, dans la limite de ${definition.followersCap}, attribués au bilan.${preview.netAfterCampaignCents < 0 ? ` Contribution supplémentaire estimée après budget : ${formatKqCash(preview.netAfterCampaignCents)}, avant production et charges fixes.` : ""} Les ventes ne sont pas garanties ; une rupture ou une pause de l’annonce ne suspend pas la campagne.`, { action: "online", command: "start-marketing", payload: { version: 2, code: selectedCode, angle, listingId: listing.id, budgetCode: selectedBudget } }, costCents);
  }
  return <form className={styles.planner} aria-label="Préparer une campagne" onSubmit={event => { event.preventDefault(); launch(); }}>
    <div className={styles.brief}>
      <div className={styles.field}><label htmlFor={`${id}-objective`}>Objectif de campagne</label><div className={styles.selectControl}><select id={`${id}-objective`} data-marketing-objective value={selectedCode} disabled={busy} onChange={event => setCode(event.target.value as KqMarketingCampaignCode)}>{KQ_MARKETING_CAMPAIGNS.map(item => <option key={item.code} value={item.code} disabled={item.code === "introduction" && completed.includes("introduction")}>{marketingObjectives[item.code].name}{item.code === "introduction" ? completed.includes("introduction") ? " · déjà utilisé" : " · offert" : ""}</option>)}</select><ChevronDown className={styles.selectChevron} size={17} aria-hidden="true" /></div><p className={styles.hint}>{marketingObjectives[selectedCode].tradeoff}</p></div>
      <div className={styles.field}><label htmlFor={`${id}-listing`}>Produit à promouvoir</label><div className={styles.selectControl}><select id={`${id}-listing`} data-marketing-listing value={listing?.id ?? ""} disabled={busy || !listings?.length} onChange={event => setListingId(event.target.value)}>{!listings?.length ? <option value="">{listings === null ? "Stock à confirmer" : "Aucun paquet en vente"}</option> : listings.map(item => <option key={item.id} value={item.id}>{item.name} · {item.formatGrams} g · {item.remainingPackets} paquets</option>)}</select><ChevronDown className={styles.selectChevron} size={17} aria-hidden="true" /></div>
        {listing ? <><dl className={styles.productFacts}><div data-marketing-stock><dt>En vente</dt><dd>{listing.remainingPackets} paquets de {listing.formatGrams} g</dd></div><div><dt>Prix par paquet</dt><dd>{formatKqCash(listing.packetPriceCents)}</dd></div><div><dt>Qualité</dt><dd>{number(listing.qualityScore)} / 10</dd></div></dl><button type="button" className={styles.secondary} onClick={() => onOpenPricing(listing.id)}>Ajuster mon prix<ArrowRight size={15} aria-hidden="true" /></button></> : listings !== null ? <Link prefetch={false} className={styles.secondary} href="/arene/placard?view=market&section=sales" onClick={event => { if (onPrepareStock) { event.preventDefault(); onPrepareStock(); } }}>Préparer des paquets<ArrowRight size={16} aria-hidden="true" /></Link> : null}
      </div>
      <div className={styles.field}><label htmlFor={`${id}-audience`}>Public visé</label><div className={styles.selectControl}><select id={`${id}-audience`} data-marketing-audience value={angle} disabled={busy} onChange={event => setAngle(event.target.value as KqOnlineMarketingAngle)}>{marketingAudiences.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown className={styles.selectChevron} size={17} aria-hidden="true" /></div><p className={styles.hint}>{audienceDescription}</p>{preview ? <p className={styles.fit} data-fit={preview.fit >= 1}>{preview.fit >= 1 ? <Check size={16} aria-hidden="true" /> : <Target size={16} aria-hidden="true" />}{preview.fit >= 1 ? "Public adapté à cette offre" : "Public peu adapté à cette offre"}</p> : null}</div>
      {selectedCode !== "introduction" ? <fieldset className={styles.budget}><legend>Budget total de campagne</legend><div>{KQ_MARKETING_BUDGETS.map(item => <label key={item.code} data-selected={selectedBudget === item.code}><input type="radio" data-marketing-budget={item.code} name={`${id}-budget`} value={item.code} checked={selectedBudget === item.code} disabled={busy} onChange={() => setBudgetCode(item.code)} /><span><span>{item.name}</span><strong>{formatKqCash(item.costCents)}</strong><small>{number(item.visitorsPerDay * definition.trafficMultiplier)} visites/j</small></span></label>)}</div><p className={styles.hint}>Visites ciblées prévues par jour {api.isTutorial ? "fictif" : "réel"}, avant adéquation avec le public.</p></fieldset> : null}
    </div>
    <section className={styles.decision} aria-label="Engagement de campagne">
      <dl className={styles.commitment} data-marketing-commitment><div><dt>{costCents ? "Débit au lancement" : "Premier essai"}</dt><dd>{costCents ? formatKqCash(costCents) : "Offert"}</dd><small>{costCents ? "Budget total, non remboursable" : "Une seule fois"}</small></div><div><dt>Créneau occupé</dt><dd>{definition.preparationHours + definition.durationHours} h</dd><small>{timeUnit}</small></div></dl>
      <p className={styles.timing}>{definition.preparationHours ? `${definition.preparationHours} h de préparation sans visites ciblées, puis ` : "Diffusion immédiate pendant "}{definition.durationHours} h{definition.preparationHours ? " de diffusion." : "."}</p>
      <p className={styles.balance}>Trésorerie : <strong>{cash === null ? "À confirmer" : formatKqCash(cash)}</strong>{cash !== null && cash < costCents ? <span>Il manque {formatKqCash(costCents - cash)}.</span> : null}</p>
      {preview ? <div className={styles.estimateSummary} data-marketing-estimate><dl><div><dt>Contribution supplémentaire estimée après budget</dt><dd data-negative={preview.netAfterCampaignCents < 0}>{formatKqCash(preview.netAfterCampaignCents)}</dd></div><div><dt>Abonnés estimés au bilan</dt><dd>+{number(preview.expectedFollowers)}<small> / {definition.followersCap} max.</small></dd></div></dl><p>Avant coût de production et charges fixes. Les ventes et abonnés restent estimés.</p></div> : <p className={styles.notice}>Prévisions indisponibles{listing ? " : certaines données sont à confirmer." : " tant qu’aucun produit disponible n’est sélectionné."}</p>}
      {preview && preview.netAfterCampaignCents < 0 ? <p className={styles.loss} data-marketing-loss>Les ventes supplémentaires estimées ne couvrent pas ce budget.</p> : null}
      {view.warnings.length ? <ul className={styles.warnings} data-marketing-warnings>{view.warnings.map(message => <li key={message}>{message}</li>)}</ul> : null}
      {view.blockingReasons.length ? <div className={styles.blockers} data-marketing-blockers><strong>Avant de lancer</strong><ul>{view.blockingReasons.map(message => <li key={message}>{message}</li>)}</ul></div> : null}
      <p className={styles.risk}>Le créneau reste occupé jusqu’à la fin, même en cas de rupture ou de pause du produit. {definition.preparationHours ? "Le stock peut aussi se vendre pendant la préparation." : ""}</p>
      <button type="submit" className={styles.launch} data-marketing-launch disabled={busy || !view.canLaunch}>{busy ? "Validation en cours…" : costCents ? `Examiner la campagne · ${formatKqCash(costCents)}` : "Examiner mon essai offert"}<ArrowRight size={17} aria-hidden="true" /></button>
    </section>
    <details className={styles.details} data-marketing-forecast-details><summary>Prévisions détaillées</summary>{preview ? <div className={styles.forecast}>
      <div><KqProgressMeter label="Satisfaction estimée" value={preview.satisfactionScore} max={100} valueLabel={`${number(preview.satisfactionScore)} / 100`} hint="75/100 minimum pour gagner des abonnés" tone={preview.satisfactionScore >= 75 ? "teal" : "gold"} /><dl className={styles.estimates}><div><dt>Visites ciblées après adéquation</dt><dd>≈ {number(preview.visitorsPerDay * preview.fit)} / jour {api.isTutorial ? "fictif" : "réel"}</dd></div><div><dt>Ventes supplémentaires sur la diffusion</dt><dd>≈ {number(preview.projectedExtraOrders)} paquets</dd></div><div><dt>Pour couvrir le budget</dt><dd>{preview.breakEvenOrders === null ? "Non calculable avec cette offre" : `${number(preview.breakEvenOrders)} ventes supplémentaires`}</dd></div><div><dt>Prix de référence estimé à la diffusion</dt><dd>{formatKqCash(preview.referencePacketCents)} / paquet</dd></div></dl></div>
      <div><KqBarChart title="Contribution supplémentaire estimée" items={[{ label: "Avant budget de campagne", value: preview.projectedExtraContributionCents, displayValue: formatKqCash(preview.projectedExtraContributionCents), tone: "teal" }, { label: "Budget de campagne", value: -costCents, displayValue: formatKqCash(-costCents), tone: "gold" }, { label: "Après budget", value: preview.netAfterCampaignCents, displayValue: formatKqCash(preview.netAfterCampaignCents), tone: preview.netAfterCampaignCents < 0 ? "red" : "teal" }]} /><p className={styles.hint}>Après TVA, frais, emballage et budget de campagne ; avant coût de production et charges fixes.</p></div>
      <p className={styles.calculation}>Comparaison avec les ventes estimées sans campagne, limitée par le stock, la qualité et l’hébergement payé. Les commandes peuvent aussi venir naturellement. Le prix de référence et la satisfaction peuvent évoluer avant la diffusion.</p>
    </div> : <p className={styles.hint}>Les données nécessaires aux prévisions doivent être disponibles. Aucun résultat n’est supposé.</p>}</details>
    <details className={styles.details} data-marketing-rules-details><summary>Objectif et règles de cette campagne</summary><dl className={styles.rules}><div><dt>Objectif pendant la diffusion</dt><dd>{definition.goalOrders} commandes satisfaisantes</dd></div><div><dt>Par commande satisfaisante</dt><dd>+{definition.followersPerOrder} abonnés · {definition.followersCap} maximum</dd></div></dl><p className={styles.hint}>Les abonnés sont crédités au bilan. Toutes les commandes de ce produit pendant la diffusion comptent, y compris celles venues naturellement, à partir de 75/100 de satisfaction.</p>{definition.cooldownHours ? <p className={styles.hint}>Délai entre deux campagnes de ce type : {definition.cooldownHours} h {timeUnit} depuis le début de la précédente.</p> : null}{selectedCode === "harvest" ? <p className={styles.hint}>Une seule présentation par récolte, même si elle est répartie entre plusieurs annonces. Son historique complet est vérifié au lancement.</p> : null}</details>
  </form>;
}

export function KqMarketingCampaigns({ data, now, busy, onAsk, onOpenPricing, onPrepareStock, advertising }: Props) {
  if (!data.online) return null;
  const active = data.online.marketing?.active;
  const freeSlot = active === null;
  return <div className={styles.campaigns} data-marketing-campaigns>
    <header className={styles.heading}><Image src="/placard/market-social-missions-sylvain-v3.webp" width={64} height={64} alt="" /><div><h3>Campagnes</h3><p>{active ? "Une campagne en cours · créneau occupé" : freeSlot ? "Un créneau disponible" : "Créneau à confirmer"}</p></div></header>
    {active ? <KqMarketingStatus data={data} now={now} onOpenPricing={onOpenPricing} /> : freeSlot ? <CampaignPlanner data={data} busy={busy} onAsk={onAsk} onOpenPricing={onOpenPricing} onPrepareStock={onPrepareStock} /> : <p className={styles.notice}>L’état des campagnes est indisponible. Actualise la boutique avant de préparer un lancement.</p>}
    <KqMarketingHistory data={data} />
    {advertising}
  </div>;
}
