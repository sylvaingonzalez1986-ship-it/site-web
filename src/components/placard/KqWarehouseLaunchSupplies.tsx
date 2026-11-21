"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { KqCampaignParticipant } from "@/lib/kanab-quest-campaign";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import { getKqWarehousePreparationEffects, KQ_WAREHOUSE_PREPARATION_CATALOG, type KqWarehouseInputCode } from "@/lib/kanab-quest-warehouse-preparations";
import { preparationDate, RegisterStatus } from "./KqWarehouseSupplies";
import { useWarehousePreparations } from "./useWarehousePreparations";
import styles from "./KqWarehouseSupplies.module.css";

export function KqWarehouseLaunchSupplies({ members, onReady }: {
  members: KqCampaignParticipant[];
  onReady: (key: string | null) => void;
}) {
  const register = useWarehousePreparations();
  const { state } = register;
  const cleaningActive = (step: "vacuum" | "mop") => Date.parse(state?.cleaning[step].expiresAt ?? "") > Date.parse(state?.serverNow ?? "");
  const quoteKey = !register.busy && !register.error ? state?.quoteKey ?? null : null;
  const items = state?.items.filter(item => item.kind === "consumable");
  const stockKnown = !!items?.length && items.every(item => [item.availableQuantity, item.reservedQuantity]
    .every(quantity => Number.isSafeInteger(quantity) && quantity >= 0));
  const inStock = items?.filter(item => item.availableQuantity > 0 || item.reservedQuantity > 0 || (item.legacyPassQuantity ?? 0) > 0) ?? [];
  useEffect(() => { onReady(quoteKey); return () => onReady(null); }, [quoteKey, onReady]);
  return <section className={styles.panel} aria-label="Préparation des zones" data-launch-supplies>
    <h3>Préparation au semis</h3><RegisterStatus register={register} />
    {state && <>
      <p>Tu peux semer sans intrants. Pour les soins de cette culture, seules les doses libres au semis comptent, y compris les suppléments nutritifs et la protection biologique (PBI). Les achats ultérieurs serviront aux prochains semis.</p>
      {stockKnown && !register.error ? <details className={styles.sheet} data-sylvain-supplies-ready={quoteKey && members.length > 0 || undefined}>
        <summary data-sylvain-target="supplies">Doses avant le semis{inStock.length === 0 ? " · aucune dose" : ""}</summary>
        {inStock.length > 0 && <p>Les zones puisent dans le même stock, dans la limite des doses accessibles à chacune au semis.</p>}
        {inStock.length ? <ul className={styles.launchStock}>{inStock.map(item => <li key={item.code}>
          <strong>{item.name}</strong> · {item.availableQuantity.toLocaleString("fr-FR")} libres · {item.reservedQuantity.toLocaleString("fr-FR")} réservées
          {item.legacyPassQuantity ? ` · ${item.legacyPassQuantity.toLocaleString("fr-FR")} traitement(s) de zone en réserve` : ""}
        </li>)}</ul> : <p>Aucune dose en stock. Tu peux semer dès que le reste est prêt.</p>}
        {inStock.some(item => item.reservedQuantity > 0) ? <p>Les doses réservées sont déjà affectées. Les mélanges programmés pour ce semis sont détaillés par zone ci-dessous.</p> : null}
      </details> : !register.busy && !register.error ? <p>Les quantités par produit sont indisponibles.</p> : null}
      {typeof state.entranceAirlock === "boolean" && <p>{state.entranceAirlock ? "Sas installé à la porte sud · toutes les zones sont protégées." : "Aucun sas installé à la porte sud."}</p>}
      <Link href="/arene/placard?view=workshop&catalog=equipment&equipment=WAREHOUSE-NUTRITION-BASE">Ouvrir le catalogue des intrants</Link>
      {members.map(member => {
        const { zoneId } = member;
        const zone = state.coverage.find(z => z.zoneId === zoneId);
        const programs = state.programs.filter(p => p.zoneId === zoneId);
        const fed = programs.reduce((sum, p) => sum + (p.quantities["WAREHOUSE-NUTRITION-BASE"] ?? 0), 0);
        const supplement = programs.reduce((sum, p) => sum + (p.quantities["WAREHOUSE-NUTRITION-SUPPLEMENT"] ?? 0), 0);
        const hygieneM2 = zone?.stations.filter(s => s.kind === "hygiene").reduce((sum, s) => sum + s.servedM2, 0) ?? 0;
        const effects = getKqWarehousePreparationEffects(member.warehouse.activeAreaM2, {
          used: { "WAREHOUSE-NUTRITION-BASE": fed, "WAREHOUSE-NUTRITION-SUPPLEMENT": supplement },
          vacuum: cleaningActive("vacuum"), mop: cleaningActive("mop"), entranceAirlock: state.entranceAirlock, hygieneM2, irrigatedM2: fed,
        });
        return <section className={styles.sheet} key={zoneId}><h4>{getKqZoneIdentity(member.warehouse.sourceState, zoneId)?.label ?? zoneId} · {member.warehouse.activeAreaM2} m²</h4>
          <p>{zone ? `${zone.stations.filter(s => s.kind === "irrigation").reduce((sum, s) => sum + s.servedM2, 0)} / ${zone.areaM2} m² desservis par centrale` : "Aucune couverture d’irrigation enregistrée"}</p>
          {programs.length ? programs.map(p => <p key={p.stationId}>Mélange au semis · {Object.entries(p.quantities).map(([code,q]) => `${KQ_WAREHOUSE_PREPARATION_CATALOG[code as KqWarehouseInputCode].name} × ${q}`).join(" · ")} · échéance {preparationDate(p.expiresAt, state)}</p>) : <p>Aucun programme nutritif prévu.</p>}
          <p>{fed} / {member.warehouse.activeAreaM2} m² alimentés au semis{fed > 0 && ` · rendement potentiel de la zone +${effects.yieldBonusPercent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`}.</p>
          <p>Risques d’infection, de ravageurs et de virus au semis · réduction de {effects.preventionPercent.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %.</p>
          </section>;
      })}
      <div>{(["vacuum", "mop"] as const).map(step => {
        const record = state.cleaning[step];
        return <p key={step}>{step === "vacuum" ? "Aspiration" : "Lavage"} · {record.expiresAt && cleaningActive(step) ? `valide jusqu’au ${preparationDate(record.expiresAt, state)}` : "sans protection au départ"}</p>;
      })}</div>
    </>}
  </section>;
}
