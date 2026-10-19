"use client";

import Image from "next/image";
import Link from "next/link";
import { getBuddieArtwork } from "@/lib/buddie-artwork";
import { getKqCampaignMemberState, getKqCampaignTotals, type KqCampaignParticipant, type KqCampaignMember } from "@/lib/kanab-quest-campaign";
import { KQ_BUDDIES, getKqRunProjection, isKqCultureDead, type KqGameState } from "@/lib/kanab-quest-game";
import { getKqCannabinoidReport, getKqTerpeneReport } from "@/lib/kanab-quest-care";
import { KqCannabinoidReport } from "./KqCannabinoidReport";
import { KqHarvestTierProgress } from "./KqHarvestTierProgress";
import type { KqOfficialFlower } from "@/lib/kanab-quest-api";
import styles from "./KqCampaignSummary.module.css";

const archetypes = { yield: "Rendement", balanced: "Équilibre", expression: "Expression" };
const percent = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;

export function KqCampaignSummary({ participants = [], state, flowers = [] }: {
  participants?: readonly KqCampaignParticipant[]; state?: KqGameState; flowers?: KqOfficialFlower[];
}) {
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
      return <article key={member.zoneId} className={styles.member} data-campaign-member={member.zoneId} data-campaign-buddie={member.buddieCode}>
        <div className={styles.identity}><Image src={getBuddieArtwork(member.buddieCode)} width={72} height={72} alt="" /><span><strong>{buddie?.name ?? member.buddieCode}</strong><small>{member.warehouse.zones[0]?.name} · {archetypes[profile.archetype]}</small></span></div>
        <dl><div><dt>{complete ? "Récolte" : "Rendement estimé"}</dt><dd>{grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g</dd></div><div><dt>{cannabinoid?.[0].toUpperCase()} {own ? "simulé" : "potentiel"}</dt><dd>{dead ? "—" : percent(cannabinoid?.[1] ?? 0)}</dd></div><div><dt>Terpènes {own ? "simulés" : "potentiels"}</dt><dd>{dead ? "—" : percent(terpenes?.totalPercent ?? profile.terpenePotentialPercent)}</dd></div></dl>
        <p className={styles.notes}>{dead ? "Aucun lot récolté" : profile.terpeneNotes.join(" · ")}{complete && own && !dead ? ` · Qualité ${own.quality}` : ""}</p>
        {projection && !dead ? <details><summary>{flower?.tier ?? projection.tier}</summary><p className={styles.notes}><KqHarvestTierProgress projection={projection} /></p></details> : null}
        {report && !dead && <KqCannabinoidReport report={report} provisional={!complete} />}
        {complete && flower && <Link className={styles.link} href={`/arene/placard?view=arena&flower=${encodeURIComponent(flower.id)}`}>Voir cette Fleur</Link>}
      </article>;
    })}</div>
    <small className={styles.caption}>{state ? "Même parcours, résultats propres à chaque Buddie et à son équipement." : "Un seul parcours, un deck commun. Les zones et leurs équipements seront figés au lancement."} Valeurs de simulation.</small>
  </section>;
}
