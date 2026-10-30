"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { ArrowRight, Camera, Check, ChevronRight, CircleAlert, Globe2, Leaf, LockKeyhole, Paintbrush, ShoppingBag, Sparkles, Trophy } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_ONLINE_FEE_PERCENT, KQ_ONLINE_SITE_TIERS, KQ_ONLINE_UPGRADES, getKqOnlineSiteTier, getKqOnlineTierEligibility, type KqOnlineSiteTier, type KqOnlineSnapshot } from "@/lib/kanab-quest-online";
import { KqBarChart, KqProgressMeter } from "./KqVisuals";
import { getKqStudioStyle, type KqStudioStyle } from "@/lib/kanab-quest-studio";
import styles from "./KqOnlineSiteProgression.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Props = { online: KqOnlineSnapshot; cashCents: number; currentHostingCents?: number | null; shopName: string; busy: boolean; onAsk: Ask; onOpenBrand: () => void; onOpenMarketing: () => void };
const known = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const labels: Record<KqOnlineSiteTier, string> = { basic: "Base", improved: "Améliorée", pro: "Pro", studio: "Créateur", signature: "Signature", flagship: "Référence" };
const subtitles: Record<KqOnlineSiteTier, string> = {
  basic: "Les premières récoltes", improved: "Une vitrine qui prend forme", pro: "Un commerce qui s’affirme",
  studio: "Le produit au premier plan", signature: "Une marque reconnaissable", flagship: "La maison des belles récoltes",
};

/** A design preview, deliberately separate from inventory and real shop results. */
function SitePreview({ tier, name, direction }: { tier: KqOnlineSiteTier; name: string; direction?: KqStudioStyle }) {
  const level = getKqOnlineSiteTier(tier).level;
  const packaging = level >= 5 ? "printed" : level >= 3 ? "glass" : "kraft";
  return <figure className={styles.preview} data-online-site-preview={tier}>
    <div className={styles.browser} data-level={level} data-direction={direction} aria-hidden="true">
      <div className={styles.browserBar}><span><i /><i /><i /></span><Globe2 size={12} />Ma boutique</div>
      <div className={styles.mockBrand}><Leaf size={level >= 5 ? 27 : 19} /><strong>{name}</strong>{level >= 3 && <ShoppingBag size={18} />}</div>
      <div className={styles.mockHero}>
        <div><small>{level >= 5 ? "Une maison, une signature" : "De notre atelier à ta porte"}</small><strong>{subtitles[tier]}</strong></div>
        {level >= 2 && <Image src={level >= 4 ? "/placard/market-brand-studio-sylvain-v3.webp" : "/placard/channel-online-sylvain-v2.webp"} alt="" width={480} height={320} sizes="(max-width: 600px) 240px, 320px" />}
      </div>
      <div className={styles.mockProducts}>{Array.from({ length: level === 1 ? 1 : level === 2 ? 2 : 3 }, (_, index) => <div key={index}>
        <Image src={`/placard/equipment-sylvain-v1/packaging-${packaging}.webp`} alt="" width={96} height={96} sizes="70px" />
        <span /><i />
      </div>)}</div>
      {level >= 4 && <div className={styles.mockSignature}><Sparkles size={13} />{level >= 6 ? "Le soin du détail, de l’atelier à la vitrine" : "Le savoir-faire de notre atelier"}</div>}
    </div>
    <figcaption>Aperçu de présentation · niveau {level}{direction ? ` · direction ${direction === "clear" ? "Clair" : direction === "craft" ? "Atelier" : "Signature"}` : ""}</figcaption>
  </figure>;
}

export function KqOnlineSiteProgression({ online, cashCents, currentHostingCents, shopName, busy, onAsk, onOpenBrand, onOpenMarketing }: Props) {
  const panelId = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const current = getKqOnlineSiteTier(online.site.tier);
  const next = KQ_ONLINE_SITE_TIERS.find(item => item.level === current.level + 1);
  const [selection, setSelection] = useState<{ from: KqOnlineSiteTier; tier: KqOnlineSiteTier } | null>(null);
  const selectedTier = selection?.from === current.code ? selection.tier : null;
  const target = getKqOnlineSiteTier(selectedTier ?? next?.code ?? current.code);
  const eligibility = getKqOnlineTierEligibility(online, target.code, cashCents);
  const acquired = target.level <= current.level;
  const installed = target.code === current.code;
  const unavailable = eligibility.blockers.some(item => item.code === "unavailable");
  const gain = (target.conversionMultiplier / current.conversionMultiplier - 1) * 100;
  const gainLabel = number(Math.round(gain * 1_000) / 1_000);
  const currentMonthlyCents = currentHostingCents === undefined ? current.monthlyCents : currentHostingCents;
  const targetMonthlyCents = installed ? currentMonthlyCents : target.monthlyCents;
  const monthlyChange = currentMonthlyCents === null ? null : target.monthlyCents - currentMonthlyCents;
  const cost = eligibility.costCents;
  const cashKnown = Number.isSafeInteger(cashCents) && cashCents >= 0;
  const cashMet = cashKnown && known(cost) && cashCents >= cost;
  const missingUpgrades = target.requiredUpgrades.filter(code => !online.upgrades[code]);
  const needsAudience = target.minimumFollowers > 0 && known(online.followers) && online.followers < target.minimumFollowers;
  const prerequisites = [
    { code: "orders", label: "Commandes", value: online.stats.orders, goal: target.minimumOrders },
    { code: "confidence", label: "Confiance /100", value: online.confidence, goal: target.minimumConfidence },
    { code: "followers", label: "Abonnés", value: online.followers, goal: target.minimumFollowers },
  ].filter(item => item.goal > 0).map(item => {
    const blocker = eligibility.blockers.find(blocker => blocker.code === item.code);
    const valid = known(item.value) && item.value >= 0 && blocker?.actual !== null;
    return { ...item, valid, met: valid && item.value >= item.goal };
  });
  const unmet = prerequisites.filter(item => !item.met);
  const met = prerequisites.filter(item => item.met);
  const acquiredUpgrades = target.requiredUpgrades.filter(code => online.upgrades[code] === true);
  const unknownRequirements = eligibility.blockers.filter(item => item.actual === null && item.code !== "cash");

  function requirement(item: typeof prerequisites[number]) {
    return <div key={item.code} data-online-condition={item.code} data-met={item.met}>
      {item.valid ? <KqProgressMeter label={`${item.met ? "✓ " : ""}${item.label}`} value={item.value} max={item.goal} valueLabel={`${number(item.value)} / ${item.goal}`} tone={item.met ? "teal" : "gold"} /> : <p>{item.label} : à confirmer · objectif {item.goal}</p>}
    </div>;
  }

  function choose(index: number, focus = false) {
    setSelection({ from: current.code, tier: KQ_ONLINE_SITE_TIERS[index].code });
    if (focus) buttons.current[index]?.focus({ preventScroll: true });
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = KQ_ONLINE_SITE_TIERS.length - 1;
    const destination = event.key === "ArrowRight" ? Math.min(last, index + 1) : event.key === "ArrowLeft" ? Math.max(0, index - 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (destination === null) return;
    event.preventDefault();
    choose(destination, true);
  }
  function purchase() {
    if (busy || !eligibility.allowed || !known(cost)) return;
    onAsk(`Passer au niveau ${target.level} · ${target.name}`,
      `${formatKqCash(cost)} une seule fois, tes niveaux précédents déjà déduits. Les 5 premiers jours réels d’hébergement sont inclus. Puis ${formatKqCash(target.monthlyCents)} tous les 5 jours réels (30 jours de jeu). La reconduction automatique sera activée ; tu pourras la désactiver. À offre et audience identiques : +${gainLabel} % de cadence de vente estimée, sans commande garantie ni visite supplémentaire. Frais par vente : ${number(KQ_ONLINE_FEE_PERCENT)} %.`,
      { action: "online", command: "upgrade-site", payload: { tier: target.code } }, cost);
  }

  if (!KQ_ONLINE_SITE_TIERS.some(item => item.code === online.site.tier)) return <section className={styles.progression} aria-label="Améliorer mon site" data-online-progression><header className={styles.heading}><h3>Améliorer mon site</h3></header><p role="status">Le niveau de ton site est à confirmer. Actualise les données de ta boutique avant de l’améliorer.</p></section>;

  return <section className={styles.progression} aria-label="Améliorer et gérer mon site" data-online-progression>
    <header className={styles.heading}><h3>{next ? "Améliorer mon site" : "Mon site"}</h3><p data-online-current>Site actuel : <strong>niveau {current.level} / {KQ_ONLINE_SITE_TIERS.length} · {current.name}</strong></p></header>
    <details className={styles.explorer} data-online-tier-explorer><summary>Explorer les autres niveaux</summary>
    <div className={styles.levels} role="group" aria-label="Explorer les niveaux du site">{KQ_ONLINE_SITE_TIERS.map((item, index) => {
      const owned = item.level <= current.level;
      const active = item.code === current.code;
      return <button key={item.code} type="button" ref={node => { buttons.current[index] = node; }} data-online-tier={item.code} data-owned={owned} data-current={active} aria-pressed={target.code === item.code} aria-controls={panelId}
        aria-label={`Niveau ${item.level} · ${item.name}${active ? " · installé" : owned ? " · acquis" : ""}`} onClick={() => choose(index)} onKeyDown={event => navigate(event, index)}>
        <span className={styles.levelNumber}>{owned && !active ? <Check size={16} aria-hidden="true" /> : item.level}</span><strong>{labels[item.code]}</strong><small>{active ? "Installé" : owned ? "Acquis" : item.level === current.level + 1 ? "Prochain" : "À atteindre"}</small>
      </button>;
    })}</div></details>

    <div id={panelId} className={styles.focusCard} data-selected-tier={target.code}>
      <header className={styles.tierHeading}><span className={styles.tierBadge}>{installed ? <Check size={14} aria-hidden="true" /> : acquired ? <Trophy size={14} aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}{installed ? "Niveau installé" : acquired ? "Niveau déjà acquis" : target.level === current.level + 1 ? "Prochain niveau" : "Objectif à venir"}</span><h4>Niveau {target.level} · {target.name}</h4></header>
      <div className={styles.decision}>
        <dl className={styles.metrics} data-online-comparison data-conversion-gain={gain} data-monthly-cents={targetMonthlyCents ?? undefined}>
          {!acquired && <div data-online-cost><dt>{target.level === current.level + 1 ? "Amélioration · une fois" : "Investissement cumulé restant"}</dt><dd>{known(cost) ? formatKqCash(cost) : "À confirmer"}</dd><small>Niveaux précédents déjà déduits</small></div>}
          <div data-online-hosting><dt>Hébergement</dt><dd>{targetMonthlyCents === null ? "À confirmer" : formatKqCash(targetMonthlyCents)}</dd><small>{targetMonthlyCents === 0 ? "Sans abonnement" : "Tous les 5 jours réels"}{!acquired && monthlyChange !== null && monthlyChange !== 0 && <> · {monthlyChange > 0 ? "+" : "−"}{formatKqCash(Math.abs(monthlyChange))} par rapport à ton site</>}</small></div>
          <div><dt>Cadence de vente estimée</dt><dd>{acquired ? `×${target.conversionMultiplier.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}` : `+${gainLabel} %`}</dd><small>{acquired ? "Face au site de base" : "Face à ton site"} · même offre et audience</small></div>
        </dl>
        <p className={styles.estimate}>Aucune commande garantie. Cette amélioration n’ajoute pas de visiteurs.</p>
        {!acquired ? <>
          <div className={styles.budget} data-online-condition="budget" data-met={cashMet}>
            <span>Trésorerie disponible <strong>{cashKnown ? formatKqCash(cashCents) : "à confirmer"}</strong></span>
            {!cashMet && <small><CircleAlert size={14} aria-hidden="true" />{cashKnown && known(cost) ? `Il manque ${formatKqCash(Math.max(0, cost - cashCents))}.` : "Actualise les données avant cet achat."}</small>}
          </div>
          <p className={styles.terms}>Les 5 premiers jours réels sont inclus. Puis {formatKqCash(target.monthlyCents)} tous les 5 jours réels, avec reconduction automatique activée à l’achat et désactivable.</p>
          {(unmet.length > 0 || missingUpgrades.length > 0) && <section className={styles.conditions} aria-label="Conditions à atteindre"><h5>À débloquer</h5>
            <div className={styles.requirements}>{unmet.map(requirement)}</div>
            {missingUpgrades.length > 0 && <ul className={styles.requiredUpgrades}>{missingUpgrades.map(code => <li key={code} data-online-condition={code} data-met="false">
              {code === "photography" ? <Camera size={15} aria-hidden="true" /> : <Paintbrush size={15} aria-hidden="true" />}
              <span>{code === "photography" ? "Photos et fiches produits" : "Identité de marque"}<strong>Achat séparé · {formatKqCash(KQ_ONLINE_UPGRADES.find(item => item.code === code)!.costCents)}</strong></span>
            </li>)}</ul>}
          </section>}
          {unknownRequirements.length > 0 && <p className={styles.blocked}>Certaines données de ta boutique sont à confirmer. Actualise-les avant l’achat.</p>}
          {unavailable ? <p className={styles.blocked}><LockKeyhole size={15} aria-hidden="true" />Ce niveau n’est pas encore disponible.</p>
            : target.level > current.level + 1 && next ? <p className={styles.blocked}><LockKeyhole size={15} aria-hidden="true" />Passe d’abord au niveau {next.level} · {labels[next.code]}. Chaque niveau se débloque dans l’ordre.</p> : null}
          <button type="button" className={styles.purchase} data-online-upgrade disabled={busy || !eligibility.allowed} onClick={purchase}>
            {busy ? "Opération en cours…" : unavailable ? "Niveau indisponible" : target.level > current.level + 1 ? "Niveau précédent requis" : unknownRequirements.length > 0 || !cashKnown ? "Données à confirmer" : eligibility.blockers.some(item => item.code !== "cash") ? "Conditions à atteindre" : !cashMet ? "Trésorerie insuffisante" : `Examiner l’amélioration · ${formatKqCash(cost!)}`}<ArrowRight size={17} aria-hidden="true" />
          </button>
          <div className={styles.actions}>
            {missingUpgrades.length > 0 && <button type="button" className={styles.textAction} disabled={busy} onClick={onOpenBrand}>Ouvrir le Studio<ArrowRight size={15} aria-hidden="true" /></button>}
            {needsAudience && <button type="button" className={styles.textAction} disabled={busy} onClick={onOpenMarketing}>Promouvoir ma boutique<ArrowRight size={15} aria-hidden="true" /></button>}
            {target.level > current.level + 1 && next && <button type="button" className={styles.textAction} onClick={() => setSelection({ from: current.code, tier: next.code })}>Voir le prochain niveau<ChevronRight size={16} aria-hidden="true" /></button>}
          </div>
          {(met.length > 0 || acquiredUpgrades.length > 0) && <details className={styles.metConditions} data-online-met-conditions><summary>{unmet.length === 0 && missingUpgrades.length === 0 && unknownRequirements.length === 0 ? "Prérequis remplis" : "Prérequis déjà remplis"} · {met.length + acquiredUpgrades.length}</summary>
            <div className={styles.requirements}>{met.map(requirement)}</div>
            {acquiredUpgrades.length > 0 && <ul className={styles.requiredUpgrades}>{acquiredUpgrades.map(code => <li key={code} data-online-condition={code} data-met="true"><Check size={15} aria-hidden="true" /><span>{KQ_ONLINE_UPGRADES.find(item => item.code === code)!.name} · Acquis</span></li>)}</ul>}
          </details>}
        </> : <div className={styles.acquired}><Check size={20} aria-hidden="true" /><strong>{installed ? next ? "Ce niveau est installé" : "Niveau maximal atteint" : "Ce niveau est déjà acquis"}</strong><p>{installed ? online.site.active ? "Ses effets sont pris en compte dans tes estimations de vente." : "L’hébergement est suspendu. Réactive-le pour reprendre les ventes." : "Ton site actuel conserve cet investissement. Aucun retour à ce niveau n’est nécessaire."}</p>{next && <button type="button" className={styles.textAction} onClick={() => setSelection({ from: current.code, tier: next.code })}>Voir le prochain niveau<ChevronRight size={16} aria-hidden="true" /></button>}</div>}
      </div>
      <details className={styles.previewDetails} data-online-preview-details><summary>Voir l’aperçu du niveau {target.level}</summary><p>{target.description}</p><SitePreview tier={target.code} name={shopName} direction={online.studio?.version === 1 ? getKqStudioStyle(online) : undefined} /></details>
    </div>
    <p className={styles.note}>Le site aide les visiteurs à acheter. La qualité, les prix et le stock déterminent toujours les ventes. Frais par vente : {number(KQ_ONLINE_FEE_PERCENT)} %.</p>
    <details className={styles.comparison}><summary>Comparer les six niveaux</summary><div>
      <KqBarChart title="Cadence estimée · site de base = 100" items={KQ_ONLINE_SITE_TIERS.map(item => ({ label: `${item.level}. ${labels[item.code]}`, value: item.conversionMultiplier * 100, displayValue: number(item.conversionMultiplier * 100), tone: item.code === current.code ? "teal" : "gold" }))} />
      <KqBarChart title="Hébergement · tarifs catalogue tous les 5 jours réels" items={KQ_ONLINE_SITE_TIERS.map(item => ({ label: `${item.level}. ${labels[item.code]}`, value: item.monthlyCents, displayValue: formatKqCash(item.monthlyCents), tone: item.code === current.code ? "teal" : "ink" }))} />
    </div><p>Un mois de jeu dure 5 jours réels. Les améliorations se paient une fois, en déduisant les niveaux déjà achetés. Elles ne garantissent aucune commande.</p></details>
  </section>;
}
