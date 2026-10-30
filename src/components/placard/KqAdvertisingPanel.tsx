"use client";

import { useId, useState } from "react";
import { ArrowRight, ChevronDown, Megaphone } from "lucide-react";
import { KQ_ADVERTISING, type KqAdvertisingKind } from "@/lib/kanab-quest-business";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqAdvertisingView } from "./kq-advertising-view";
import { KqBarChart, KqProgressMeter } from "./KqVisuals";
import styles from "./KqAdvertisingPanel.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Props = { data: KqCommerceSnapshot; now: number; busy: boolean; onAsk: Ask; onOpenSite?: () => void; onOpenSales?: () => void };
const kinds = Object.keys(KQ_ADVERTISING) as KqAdvertisingKind[];
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const percent = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
function remaining(ms: number) {
  const minutes = Math.ceil(ms / 60000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min ` : ""}réelles restantes` : `${minutes} min réelles restantes`;
}

function Comparison({ showDurations }: { showDurations: boolean }) {
  return <details className={styles.details} data-advertising-comparison>
    <summary>Comparer les offres en détail</summary>
    <div className={styles.charts}>
      <KqBarChart title="Bonus de fréquentation" items={kinds.map(kind => ({ label: KQ_ADVERTISING[kind].name, value: KQ_ADVERTISING[kind].boostPercent, displayValue: `+${KQ_ADVERTISING[kind].boostPercent} %`, tone: "teal" }))} />
      <KqBarChart title="Prix d’une nouvelle publicité" items={kinds.map(kind => ({ label: KQ_ADVERTISING[kind].name, value: KQ_ADVERTISING[kind].costCents, displayValue: formatKqCash(KQ_ADVERTISING[kind].costCents), tone: "gold" }))} />
    </div>
    {showDurations ? <dl className={styles.durations}>{kinds.map(kind => <div key={kind}><dt>{KQ_ADVERTISING[kind].name}</dt><dd>{KQ_ADVERTISING[kind].durationDays * 4} h réelles</dd></div>)}</dl> : null}
  </details>;
}

export function KqAdvertisingPanel({ data, now, busy, onAsk, onOpenSite, onOpenSales }: Props) {
  const id = useId();
  const [kind, setKind] = useState<KqAdvertisingKind>("flyers");
  const view = getKqAdvertisingView({ data, kind, now });
  const { advertising, advertisingState, definition, siteState } = view;
  const running = advertisingState === "active";
  const suspended = running && siteState === "inactive";
  const status = advertisingState === "none" ? `Attirer des visiteurs · dès ${formatKqCash(KQ_ADVERTISING.flyers.costCents)}`
    : running ? suspended ? "Bonus indisponible · campagne continue" : view.currentBoostPercent === null ? "En cours · bonus à confirmer" : `En cours · +${percent(view.currentBoostPercent)} % de fréquentation`
      : advertisingState === "scheduled" ? "Début à venir · créneau occupé"
        : advertisingState === "ended" ? "Terminée · actualisation nécessaire" : "État à confirmer · actualise les données";
  const effect = data.online
    ? "Agit sur les visiteurs habituels des fleurs, pas sur les visites des campagnes ciblées ni sur les produits dérivés."
    : "Augmente la fréquentation de ta boutique. Les ventes restent manuelles.";
  const hostingWarning = view.subscriptionEndsFirst && siteState === "active"
    ? "L’hébergement arrive à échéance avant la fin de cette publicité. Le site doit rester actif pour profiter du bonus." : null;
  const noFlowers = view.activeFlowerListings === 0;
  const stockWarning = noFlowers ? <div className={styles.warning}><p>Aucune fleur actuellement vendable en ligne. Vérifie le stock, la mise en vente et la qualité.</p>{onOpenSales ? <button type="button" className={styles.secondary} disabled={busy} onClick={onOpenSales}>Mon stock en vente<ArrowRight size={16} aria-hidden="true" /></button> : null}</div> : null;
  const site = data.online?.site ?? data.business?.shop;
  const activeHostingEndsFirst = advertising && site?.tier !== "basic" && siteState === "active"
    && site?.paidUntil && Number.isFinite(Date.parse(site.paidUntil)) && Date.parse(site.paidUntil) < Date.parse(advertising.endsAt);

  return <details className={styles.panel} data-advertising-panel>
    <summary className={styles.summary}>
      <Megaphone size={21} aria-hidden="true" />
      <span><strong>Publicité générale de la boutique</strong><span>{status}</span>{advertising && advertisingState !== "unavailable" ? <small>{KQ_ADVERTISING[advertising.kind].name} · {advertisingState === "scheduled" ? "Début" : "Fin"} le {date(advertisingState === "scheduled" ? advertising.startedAt : advertising.endsAt)}</small> : null}</span>
      <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />
    </summary>
    <div className={styles.body}>
      {advertisingState === "none" && definition ? <>
        <p className={styles.context}>{effect}</p>
        <div className={styles.planner}>
          <fieldset className={styles.offers} disabled={busy}>
            <legend>Choisir une publicité</legend>
            {kinds.map(option => {
              const ad = KQ_ADVERTISING[option];
              return <label key={option} data-selected={kind === option}>
                <input type="radio" name={`${id}-advertising`} value={option} checked={kind === option} onChange={() => setKind(option)} data-advertising-kind={option} />
                <span><strong>{ad.name}</strong><span><b>{formatKqCash(ad.costCents)}</b> · {ad.durationDays * 4} h réelles</span><small>+{ad.boostPercent} % de fréquentation</small></span>
              </label>;
            })}
          </fieldset>
          <div className={styles.decision}>
            <dl className={styles.commitment}><div><dt>À payer une fois</dt><dd>{formatKqCash(definition.costCents)}</dd></div><div><dt>Durée réelle</dt><dd>{definition.durationDays * 4} h</dd></div></dl>
            <p className={styles.hint}>Sans reconduction. Fin prévue {view.endsAt ? <>le <time dateTime={view.endsAt}>{date(view.endsAt)}</time>.</> : "à confirmer."}</p>
            <p className={styles.balance}>Trésorerie disponible : <strong>{view.cashCents === null ? "à confirmer" : formatKqCash(view.cashCents)}</strong></p>
            {view.missingCents !== null && view.missingCents > 0 ? <p className={styles.warning}>Il manque {formatKqCash(view.missingCents)} pour cette offre.</p> : null}
            {siteState === "inactive" ? <div className={styles.warning}><p>Ouvre ou réactive ton site pour utiliser cette publicité.</p>{onOpenSite ? <button type="button" className={styles.secondary} disabled={busy} onClick={onOpenSite}>Ouvrir Site internet<ArrowRight size={16} aria-hidden="true" /></button> : null}</div> : null}
            {hostingWarning ? <p className={styles.warning}>{hostingWarning}</p> : null}
            {stockWarning}
            {view.dataIssues.length ? <ul className={styles.warnings}>{view.dataIssues.map(issue => <li key={issue}>{issue}</li>)}</ul> : null}
            <p className={styles.hint}>Plus de fréquentation ne garantit pas de ventes : le stock, le prix et la qualité comptent.</p>
            <button type="button" className={styles.launch} data-advertising-launch disabled={busy || !view.canLaunch} onClick={() => {
              if (busy || !view.canLaunch || !view.kind) return;
              onAsk(`Lancer ${definition.name}`, `+${definition.boostPercent} % de fréquentation pendant ${definition.durationDays * 4} heures réelles (${definition.durationDays} jours de jeu). Paiement unique de ${formatKqCash(definition.costCents)}, sans reconduction. ${effect} Les ventes ne sont pas garanties.${hostingWarning ? ` ${hostingWarning}` : ""}${noFlowers ? " Aucune fleur n’est actuellement vendable en ligne." : ""}`, { action: "advertise", kind: view.kind }, definition.costCents);
            }}>Lancer · {formatKqCash(definition.costCents)}<ArrowRight size={17} aria-hidden="true" /></button>
          </div>
        </div>
      </> : <>
        {advertising && advertisingState !== "unavailable" ? <section className={styles.running} data-advertising-running aria-label="Publicité engagée">
          <dl className={styles.commitment}><div><dt>{KQ_ADVERTISING[advertising.kind].name}</dt><dd>{running ? view.currentBoostPercent === null ? "À confirmer" : suspended ? "Bonus indisponible" : `+${percent(view.currentBoostPercent)} %` : advertisingState === "ended" ? "Terminée" : "À venir"}</dd><small>{running && !suspended ? "de fréquentation actuellement" : `Bonus prévu : +${percent(advertising.boostPercent)} %`}</small></div><div><dt>Fin de la publicité</dt><dd className={styles.date}><time dateTime={advertising.endsAt}>{date(advertising.endsAt)}</time></dd>{view.remainingMs !== null && view.remainingMs > 0 ? <small>{remaining(view.remainingMs)}</small> : null}</div></dl>
          {running && view.remainingMs !== null && view.durationMs !== null ? <div className={styles.progress}><KqProgressMeter label="Durée écoulée" value={view.durationMs - view.remainingMs} max={view.durationMs} valueLabel={remaining(view.remainingMs)} tone="teal" /></div> : null}
          {suspended ? <div className={styles.warning}><p>Le site est inactif : le bonus est indisponible et le temps de la publicité continue de s’écouler.</p>{onOpenSite ? <button type="button" className={styles.secondary} disabled={busy} onClick={onOpenSite}>Ouvrir Site internet<ArrowRight size={16} aria-hidden="true" /></button> : null}</div> : null}
          {activeHostingEndsFirst ? <p className={styles.warning}>L’hébergement arrive à échéance avant cette publicité. Garde ton site actif pour conserver le bonus.</p> : null}
          {running && siteState === "active" ? stockWarning : null}
          {advertisingState === "scheduled" ? <p className={styles.warning}>Début prévu le <time dateTime={advertising.startedAt}>{date(advertising.startedAt)}</time>. Aucun bonus appliqué avant cette date.</p> : null}
          {advertisingState === "ended" ? <p className={styles.warning}>Actualise les données pour confirmer la clôture avant de lancer une nouvelle publicité.</p> : <p className={styles.hint}>Une publicité à la fois. Attends sa fin pour en lancer une autre. Sans reconduction.</p>}
        </section> : null}
        {view.dataIssues.length ? <ul className={styles.warnings}>{view.dataIssues.map(issue => <li key={issue}>{issue}</li>)}</ul> : null}
        <p className={styles.context}>{effect}</p>
      </>}
      <Comparison showDurations={advertisingState !== "none"} />
      <details className={styles.details} data-advertising-rules-details><summary>Comment fonctionne la publicité</summary><p>Le bonus dure jusqu’à la date affichée, même hors connexion. Il cesse d’agir si le site devient inactif, mais la durée continue de s’écouler. Une publicité à la fois, sans reconduction automatique.</p><p>Un jour de jeu dure 4 heures réelles. Le pourcentage décrit une hausse de fréquentation, pas un nombre de commandes ni une recette garantie.</p></details>
    </div>
  </details>;
}
