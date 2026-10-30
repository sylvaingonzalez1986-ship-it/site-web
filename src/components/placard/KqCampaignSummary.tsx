"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getBuddieArtwork } from "@/lib/buddie-artwork";
import { getKqCampaignMemberState, getKqCampaignTotals, type KqCampaignParticipant, type KqCampaignMember } from "@/lib/kanab-quest-campaign";
import { KQ_BUDDIES, getKqRunProjection, isKqCultureDead, type KqGameState } from "@/lib/kanab-quest-game";
import { getKqCannabinoidReport, getKqTerpeneReport } from "@/lib/kanab-quest-care";
import { KqCannabinoidReport } from "./KqCannabinoidReport";
import { KqHarvestTierProgress } from "./KqHarvestTierProgress";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import type { KqOfficialFlower } from "@/lib/kanab-quest-api";
import { getKqHarvestMoment } from "@/lib/kanab-quest-harvest-moment";
import styles from "./KqCampaignSummary.module.css";

const archetypes = { yield: "Rendement", balanced: "Équilibre", expression: "Expression" };
const percent = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

function CompletedCampaignSummary({ state, flowers }: { state: KqGameState; flowers: KqOfficialFlower[] }) {
  const members = state.campaign?.members ?? [];
  const harvest = getKqHarvestMoment(state, flowers);
  const dead = harvest?.outcome === "dead";
  return <section className={`${styles.summary} ${styles.complete}`} data-campaign-summary data-campaign-phase="complete" aria-label="Récoltes de la campagne">
    <header>
      <div><h2>Tes récoltes</h2><p>{members.length} Buddie{members.length > 1 ? "s" : ""} · {number(getKqCampaignTotals(members).areaM2)} m²</p></div>
      <strong data-campaign-harvest-total>{harvest?.totalGrams == null ? <>—<small>Quantité indisponible</small></> : <>{number(harvest.totalGrams)} g<small>récoltés</small></>}</strong>
    </header>
    <div className={styles.rows}>{members.map(member => {
      const result = harvest?.rows.find(row => row.runId === member.runId);
      const buddie = KQ_BUDDIES.find(item => item.code === member.buddieCode);
      const artwork = getBuddieArtwork(member.buddieCode);
      const zoneIdentity = getKqZoneIdentity(member.warehouse.sourceState, member.zoneId);
      const flower = result?.flowerId ? flowers.find(item => item.id === result.flowerId) : undefined;
      let own: KqGameState | null = null;
      if (!dead) {
        try { own = getKqCampaignMemberState(state, member); } catch { /* Keep incomplete historical results readable. */ }
      }
      const projection = own ? getKqRunProjection(own) : null;
      const report = own ? getKqCannabinoidReport(own) : null;
      const cannabinoid = report ? Object.entries(report.totals).sort((a, b) => b[1] - a[1])[0] : undefined;
      const terpenes = own ? getKqTerpeneReport(own) : null;
      return <article key={member.zoneId} className={styles.member} data-campaign-member={member.zoneId} data-campaign-buddie={member.buddieCode}>
        <div className={styles.identity}>
          {artwork ? <Image src={artwork} width={72} height={72} alt="" /> : null}
          <span><strong>{result?.varietyName ?? buddie?.name ?? member.buddieCode}</strong><small className={styles.zoneIdentity}>
            <b className={styles.zoneNumber} style={{ backgroundColor: zoneIdentity?.color }} aria-label={zoneIdentity?.label ?? "Zone"} data-zone-number={zoneIdentity?.number}>{zoneIdentity?.number ?? "Zone"}</b>
            <span>{number(member.warehouse.activeAreaM2)} m²</span>
          </small></span>
        </div>
        <dl className={styles.harvestMetrics}>
          <div><dt>Récolte</dt><dd><span data-campaign-harvest-grams>{result?.grams == null ? "—" : `${number(result.grams)} g`}</span>{result?.grams == null ? <small>Quantité indisponible</small> : null}</dd></div>
          <div><dt>Qualité de culture</dt><dd><span data-campaign-harvest-quality>{result?.quality == null ? "—" : `${number(result.quality)} pts`}</span>{result?.quality == null && !dead ? <small>Qualité indisponible</small> : null}</dd></div>
        </dl>
        {dead ? <p className={styles.harvestStatus}>Aucun lot récolté.</p> : null}
        {flower ? <Link className={styles.link} href={`/arene/placard?view=${flower.status === "available" && flower.storage?.stage !== "ready" ? "workshop&section=storage" : "arena"}&flower=${encodeURIComponent(flower.id)}`}>{flower.status === "available" && flower.storage?.stage !== "ready" ? "Ranger et suivre l’affinage" : "Voir cette Fleur"}</Link> : null}
        {!dead ? <details className={styles.harvestProfile} data-campaign-harvest-profile>
          <summary><span>Profil et détails</span><ChevronDown aria-hidden="true" /></summary>
          {own ? <>
            <p className={styles.notes}>{archetypes[member.cultivationProfile.archetype]} · {member.cultivationProfile.terpeneNotes.join(" · ")}</p>
            <dl className={styles.profileMetrics}>
              <div><dt>{cannabinoid?.[0].toUpperCase() ?? "Cannabinoïde dominant"} simulé</dt><dd>{cannabinoid ? percent(cannabinoid[1]) : "—"}</dd></div>
              <div><dt>Terpènes simulés</dt><dd>{terpenes ? percent(terpenes.totalPercent) : "—"}</dd></div>
            </dl>
            {projection ? <div className={styles.tier}><p><strong>{flower?.tier ?? projection.tier}</strong></p><p><KqHarvestTierProgress projection={projection} /></p></div> : null}
            {report ? <KqCannabinoidReport report={report} /> : null}
            <p className={styles.notes}>Les taux sont simulés pour le jeu.</p>
          </> : <p className={styles.notes}>Le profil de cette ancienne culture est indisponible.</p>}
        </details> : null}
      </article>;
    })}</div>
  </section>;
}

export function KqCampaignSummary({ participants = [], state, flowers = [] }: {
  participants?: readonly KqCampaignParticipant[]; state?: KqGameState; flowers?: KqOfficialFlower[];
}) {
  if (state?.phase === "complete" && state.campaign) return <CompletedCampaignSummary state={state} flowers={flowers} />;
  const members = state?.campaign?.members ?? participants;
  const complete = state?.phase === "complete";
  const dead = !!state && isKqCultureDead(state);
  const rows = members.map(member => {
    const own = state && "runId" in member && typeof member.runId === "string" ? getKqCampaignMemberState(state, member as KqCampaignMember) : null;
    const projection = own ? getKqRunProjection(own) : null;
    const report = own ? getKqCannabinoidReport(own) : null;
    const flower = "runId" in member ? flowers.find(item => item.runId === member.runId) : undefined;
    const cannabinoid = Object.entries(report?.totals ?? member.cultivationProfile.cannabinoidTargets).sort((a, b) => b[1] - a[1])[0];
    return { member, own, projection, report, flower, cannabinoid, terpenes: own ? getKqTerpeneReport(own) : undefined,
      grams: own && complete ? own.harvestGrams ?? 0 : projection?.harvestGrams ?? getKqCampaignTotals([member]).estimatedHarvestGrams };
  });
  const total = rows.reduce((sum, row) => sum + row.grams, 0);
  return <section className={styles.summary} data-campaign-summary data-campaign-phase={state?.phase ?? "preparation"} aria-label={complete ? "Récoltes de la campagne" : "Buddies de la campagne"}>
    <header><div><h2>{complete ? "Tes récoltes" : "Tes cultures réunies"}</h2><p>{members.length} Buddie{members.length > 1 ? "s" : ""} · {getKqCampaignTotals(members).areaM2} m²</p></div><strong>{total.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g<small>{complete ? "récoltés" : "estimés"}</small></strong></header>
    <div className={styles.rows}>{rows.map(({ member, own, projection, report, flower, cannabinoid, grams, terpenes }) => {
      const buddie = KQ_BUDDIES.find(item => item.code === member.buddieCode);
      const profile = member.cultivationProfile;
      const zoneIdentity = getKqZoneIdentity(member.warehouse.sourceState, member.zoneId);
      return <article key={member.zoneId} className={styles.member} data-campaign-member={member.zoneId} data-campaign-buddie={member.buddieCode}>
        <div className={styles.identity}><Image src={getBuddieArtwork(member.buddieCode)} width={72} height={72} alt="" /><span><strong>{buddie?.name ?? member.buddieCode}</strong><small className={styles.zoneIdentity}><b className={styles.zoneNumber} style={{ backgroundColor: zoneIdentity?.color }} aria-label={zoneIdentity?.label ?? "Zone"} data-zone-number={zoneIdentity?.number}>{zoneIdentity?.number ?? "Zone"}</b><span>{member.warehouse.activeAreaM2} m² · {archetypes[profile.archetype]}</span></small></span></div>
        <dl><div><dt>{complete ? "Récolte" : "Rendement estimé"}</dt><dd>{grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g</dd></div><div><dt>{cannabinoid?.[0].toUpperCase()} {own ? "simulé" : "potentiel"}</dt><dd>{dead ? "—" : percent(cannabinoid?.[1] ?? 0)}</dd></div><div><dt>Terpènes {own ? "simulés" : "potentiels"}</dt><dd>{dead ? "—" : percent(terpenes?.totalPercent ?? profile.terpenePotentialPercent)}</dd></div></dl>
        <p className={styles.notes}>{dead ? "Aucun lot récolté" : profile.terpeneNotes.join(" · ")}{complete && own && !dead ? ` · Qualité ${own.quality}` : ""}</p>
        {projection && !dead ? <details><summary>{flower?.tier ?? projection.tier}</summary><p className={styles.notes}><KqHarvestTierProgress projection={projection} /></p></details> : null}
        {report && !dead && <KqCannabinoidReport report={report} provisional={!complete} />}
        {complete && flower && <Link className={styles.link} href={`/arene/placard?view=${flower.status === "available" && flower.storage?.stage !== "ready" ? "workshop&section=storage" : "arena"}&flower=${encodeURIComponent(flower.id)}`}>{flower.status === "available" && flower.storage?.stage !== "ready" ? "Ranger et suivre l’affinage" : "Voir cette Fleur"}</Link>}
      </article>;
    })}</div>
    <small className={styles.caption}>{state ? "Même parcours, résultats propres à chaque Buddie et à son équipement." : "Un seul parcours, un deck commun. Les zones et leurs équipements seront figés au lancement."} Valeurs de simulation.</small>
  </section>;
}
