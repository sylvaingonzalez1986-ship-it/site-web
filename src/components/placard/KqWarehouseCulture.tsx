"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sprout } from "lucide-react";
import { KQ_BUDDIES, KQ_STAGES } from "@/lib/kanab-quest-game";
import { getBuddieArtwork } from "@/lib/buddie-artwork";
import { getKqBuddieRotationRemaining, type KqBuddieRotation } from "@/lib/kanab-quest-buddie-rotation";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqWarehouseZoneQuote, type KqWarehouseZone } from "@/lib/kanab-quest-warehouse";
import { applyKqBuddieYield, getKqBuddieCultivationProfile } from "@/lib/kanab-quest-buddie-cultivation";
import type { KqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import styles from "./KqWarehouse.module.css";

export type KqWarehouseCultureSummary = { runId: string; zoneId: string | null; buddieCode: string; stageIndex: number; phase: string; startedAt: string; campaignId?: string; leaderRunId?: string };
export type KqWarehouseBuddies = { ownedBuddieCodes: string[]; buddieRotation?: KqBuddieRotation };
export const warehouseCultureHref = (zoneId: string, runId?: string) => `/arene/placard?view=game&zone=${encodeURIComponent(zoneId)}${runId ? `&run=${encodeURIComponent(runId)}` : "&campaign=1"}`;
export const warehouseCampaignHref = (runId?: string) => `/arene/placard?view=game&campaign=1${runId ? `&run=${encodeURIComponent(runId)}` : ""}`;
export const warehouseCultureStage = (run: KqWarehouseCultureSummary) => KQ_STAGES[run.stageIndex]?.replace("Séchage & affinage", "Séchage") ?? "En cours";

export function KqWarehouseCulture({ zone, zoneIdentity, run, runs, buddies, disabled, dirty, legacy, onSave, onManage, completedRunId, previewBuddieCode }: {
  zone: KqWarehouseZone; run?: KqWarehouseCultureSummary; runs: KqWarehouseCultureSummary[];
  zoneIdentity: KqZoneIdentity | null;
  buddies: KqWarehouseBuddies | null; disabled: boolean; dirty: boolean; legacy: boolean;
  onSave: () => void; onManage: () => void; completedRunId?: string;
  previewBuddieCode?: string | null;
}) {
  const buddie = KQ_BUDDIES.find(item => item.code === (run?.buddieCode ?? previewBuddieCode ?? zone.buddieCode));
  const quote = getKqWarehouseZoneQuote(zone);
  const profile = buddie && !run ? getKqBuddieCultivationProfile(buddie.code) : null;
  const busy = (code: string) => runs.some(item => item.buddieCode === code && item.zoneId !== zone.id);
  const waiting = (code: string) => getKqBuddieRotationRemaining(code, buddies?.buddieRotation?.recentBuddieCodes ?? []);
  const canStart = !!buddie && !!buddies?.ownedBuddieCodes.includes(buddie.code) && !busy(buddie.code) && !waiting(buddie.code) && zone.active && !legacy && !runs.length;
  const artwork = buddie ? getBuddieArtwork(buddie.code) : "";
  return <div className={styles.culturePanel} data-warehouse-culture={zone.id}>
    <div className={styles.culturePortrait}>{artwork ? <Image src={artwork} alt={buddie!.name} width={320} height={240} /> : <Sprout size={48} />}<span>{run ? warehouseCultureStage(run) : "À préparer"}</span></div>
    <div className={styles.cultureIdentity}><small><b className={styles.zoneNumber} style={{ background: zoneIdentity?.color }} aria-label={zoneIdentity?.label ?? "Zone"} data-zone-number={zoneIdentity?.number}>{zoneIdentity?.number ?? "Zone"}</b> · {zone.width * zone.height} m²</small><h3>{buddie?.name ?? "Choisis ton Buddie"}</h3></div>
    {profile && <div className={styles.buddieProfile} data-warehouse-buddie-profile={profile.buddieCode}>
      <dl><div><dt>Rendement estimé</dt><dd>{(applyKqBuddieYield(quote.estimatedHarvestGrams, profile) / quote.areaM2).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g/m²</dd></div><div><dt>CBD potentiel</dt><dd>{profile.cannabinoidTargets.cbd.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</dd></div><div><dt>Terpènes potentiels</dt><dd>{profile.terpenePotentialPercent.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</dd></div></dl>
      <small>{profile.terpeneNotes.join(" · ")} · simulation{previewBuddieCode ? " · Choisis sa zone sur le plan" : ""}</small>
    </div>}
    {run ? <><progress aria-label="Progression de la culture" value={run.stageIndex + 1} max={KQ_STAGES.length} />{dirty ? <button type="button" className={styles.primary} disabled={disabled} onClick={onSave}>Enregistrer le plan</button> : disabled ? <button type="button" className={styles.primary} disabled>Reprendre</button> : <Link className={styles.primary} data-warehouse-culture-action="resume" href={warehouseCultureHref(zone.id, run.leaderRunId ?? run.runId)}>{run.campaignId ? "Reprendre la campagne" : "Reprendre"}<ArrowRight size={16} /></Link>}</> : <>
      {!buddie && <p className={styles.help}>Glisse un Buddie du carrousel dans cette zone.</p>}
      {buddies && !buddies.ownedBuddieCodes.length && <p className={styles.help}>Tes Buddies de collection apparaîtront ici.</p>}
      {buddie && !busy(buddie.code) && !!waiting(buddie.code) && <p className={styles.help}>Rotation : joue {waiting(buddie.code)} autre{waiting(buddie.code) > 1 ? "s" : ""} Buddie{waiting(buddie.code) > 1 ? "s" : ""} avant de le reprendre.</p>}
      {buddie && busy(buddie.code) && <p className={styles.help}>Ce Buddie est déjà dans une autre zone.</p>}
      <div className={styles.cultureCosts}><span>Charges / cycle<strong>{formatKqCash(quote.operatingCostCents)}</strong></span><span>Par m²<strong>{formatKqCash(Math.round(quote.operatingCostCents / quote.areaM2))}</strong></span></div>
      {dirty ? <button type="button" className={styles.primary} data-warehouse-culture-action="save" disabled={disabled} onClick={onSave}>Enregistrer</button> : canStart ? <p className={styles.help}>Prête pour la prochaine campagne.</p> : runs.length > 0 ? <p className={styles.help}>La prochaine campagne commencera après les cultures en cours.</p> : null}
      {!zone.active && <p className={styles.help}>Active cette zone dans Aménager.</p>}
      {completedRunId && !dirty && !disabled && <Link className={styles.secondary} href={warehouseCultureHref(zone.id, completedRunId)}>Dernière récolte</Link>}
    </>}
    <button type="button" className={styles.secondary} disabled={disabled} onClick={onManage}>Aménager</button>
  </div>;
}
