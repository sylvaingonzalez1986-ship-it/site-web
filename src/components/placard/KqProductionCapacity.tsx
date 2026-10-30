"use client";

import Image from "next/image";
import { ArrowRight, Building2, Check, ChevronDown, LoaderCircle, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { createClientRequestKey } from "@/lib/client-request-key";
import { formatKqCash, getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import { getKqProductionExpansion } from "@/lib/kanab-quest-production";
import { getChanvrierCareerGate, getChanvrierExpansionRequiredLevel, type ChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import type { KqTentOverview } from "./KqTentSelector";
import styles from "./KqProductionCapacity.module.css";
import { useKqTutorialApi } from "./KqTutorialApiContext";

export type KqProductionSnapshot = ReturnType<typeof getKqProductionExpansion>;

export function KqProductionCapacity({ production, cashCents, career, storageCapacity, expansionEnergyCents, equipmentScopeVersion = 2, activeRun, disabled, onUpdated, onPendingChange, tents = [] }: {
  equipmentScopeVersion?: 2 | 3;
  career?: ChanvrierCareerSnapshot;
  storageCapacity?: { freeUnits: number; totalUnits: number } | null;
  expansionEnergyCents?: number;
  tents?: KqTentOverview[];
  production: KqProductionSnapshot;
  cashCents: number;
  activeRun: boolean;
  disabled: boolean;
  onUpdated: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const api = useKqTutorialApi();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [completedUnits, setCompletedUnits] = useState<number | null>(null);
  const inFlight = useRef(false);
  const request = useRef<{ units: number; cost: number; key: string } | null>(null);
  const isNewWarehouse = production.propertyCostCents > 0;
  const careerGate = career && production.nextUnits !== null ? getChanvrierCareerGate(career.xp, getChanvrierExpansionRequiredLevel(production.nextUnits)) : null;
  const shortfall = Math.max(0, production.totalCostCents - cashCents);
  const unavailable = disabled || pending || activeRun || shortfall > 0 || !careerGate?.allowed || completedUnits === production.units;

  const expand = async () => {
    if (inFlight.current || unavailable || production.nextUnits === null) return;
    inFlight.current = true;
    setPending(true); onPendingChange(true); setError(""); setNotice("");
    if (request.current?.units !== production.units || request.current.cost !== production.totalCostCents) {
      request.current = { units: production.units, cost: production.totalCostCents, key: createClientRequestKey() };
    }
    try {
      const response = await api.request("/api/arena/placard/equipment", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expand-production", requestKey: request.current.key,
          expectedUnits: production.units, expectedCostCents: production.totalCostCents }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Agrandissement impossible.");
      setCompletedUnits(production.units);
      setNotice(`${isNewWarehouse ? "Second entrepôt ouvert" : "Nouvelle tente installée"} : ${production.nextUnits} tentes prêtes pour la prochaine culture.`);
      api.notify("kq:equipment-updated");
      onUpdated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agrandissement impossible.");
    } finally {
      inFlight.current = false; setPending(false); onPendingChange(false);
    }
  };


  const targetUnits = production.nextUnits ?? production.units;
  const visibleWarehouses = targetUnits > 4 ? 2 : 1;

  return <details className={styles.capacity} data-production-capacity aria-labelledby="production-capacity-title">
    <summary className={styles.entry}>
      <span className={styles.entryIcon} aria-hidden="true"><Building2 size={20} /></span>
      <span className={styles.entryCopy}>
        <strong id="production-capacity-title">{production.nextUnits === null ? "Mes espaces de culture" : "Agrandir l’atelier"}</strong>
        <small>{production.warehouseCount} entrepôt{production.warehouseCount > 1 ? "s" : ""} · {production.units} tente{production.units > 1 ? "s" : ""} en service</small>
      </span>
      <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />
    </summary>
    <div className={styles.content}>
      <div className={styles.project}>
        <figure className={styles.plan}>
          <figcaption><span>Plan de l’installation</span><span>{production.nextUnits === null ? "Complet" : "Extension"}</span></figcaption>
          <div className={styles.warehouses} data-double={visibleWarehouses === 2}>
            {Array.from({ length: visibleWarehouses }, (_, warehouse) => <div key={warehouse} className={styles.warehouse} data-new={warehouse === 1 && isNewWarehouse}>
              <div className={styles.roomLabel}><span>{warehouse === 0 ? "Entrepôt 01" : "Entrepôt 02"}</span><small>{warehouse === 1 && isNewWarehouse ? "+ 1 tente · 4 places" : warehouse === 0 && isNewWarehouse ? "Conservé" : ""}</small></div>
              <ol aria-label={warehouse === 0 ? "Tentes du premier entrepôt" : "Tentes du second entrepôt"}>
                {Array.from({ length: 4 }, (_, index) => {
                  const number = warehouse * 4 + index + 1;
                  const owned = number <= production.units;
                  const next = !owned && number <= targetUnits;
                  const installedTent = tents.find(tent => tent.tentNumber === number)?.equippedCodes.find(code => getKqEquipmentDefinition(code)?.slot === "tent");
                  const tentArtwork = installedTent && getKqEquipmentDefinition(installedTent)?.purchasable ? "tent-pro" : "tent-starter";
                  return <li key={number} data-owned={owned} data-next={next} aria-label={`Tente ${number} · ${owned ? "installée" : next ? "prochain agrandissement" : "emplacement libre"}`}>
                    {owned || next ? <Image src={`/placard/warehouse-v2/${tentArtwork}.webp`} width={366} height={488} sizes="80px" alt="" draggable={false} /> : <span className={styles.emptySlot} aria-hidden="true" />}
                    <small>{String(number).padStart(2, "0")}{next ? <Plus size={9} aria-hidden="true" /> : null}</small>
                  </li>;
                })}
              </ol>
            </div>)}
          </div>
          <div className={styles.legend}><span><i />En service</span>{production.nextUnits !== null ? <span><i />À ajouter</span> : null}</div>
        </figure>
        <div className={styles.offer}>
          <small className={styles.eyebrow}>{production.nextUnits === null ? "Installation complète" : "Prochain agrandissement"}</small>
          <h4>{production.nextUnits === null ? "Les deux entrepôts sont à toi." : isNewWarehouse ? "Un second entrepôt." : `Ta ${production.nextUnits}e tente.`}</h4>
          <p>{production.nextUnits === null ? "Tes huit tentes cultivent ensemble, chacune avec son propre matériel." : isNewWarehouse ? "Un nouveau local et une première tente équipée. Les trois autres places s’aménagent ensuite, une tente à la fois." : "Une tente supplémentaire avec son kit de départ : tente, lampe et extraction."}</p>
          {production.nextUnits !== null ? <>
            <div className={styles.capacityChange}><span>{production.units}<small>tente{production.units > 1 ? "s" : ""}</small></span><ArrowRight size={19} aria-hidden="true" /><strong>{production.nextUnits}<small>tentes</small></strong></div>
            <details className={styles.quote}>
              <summary><span>Détail du devis</span><ChevronDown size={13} aria-hidden="true" /></summary>
              <dl>{production.propertyCostCents > 0 ? <div><dt>Second entrepôt</dt><dd>{formatKqCash(production.propertyCostCents)}</dd></div> : null}<div><dt>Nouvelle tente ×{production.addedUnits}</dt><dd>{formatKqCash(production.equipmentCostCents)}</dd></div></dl>
            </details>
            {activeRun ? <p className={styles.constraint}>Disponible après la culture en cours.</p> : shortfall > 0 ? <p className={styles.constraint}>Il te manque {formatKqCash(shortfall)}.</p> : null}
            {!careerGate?.allowed ? <p className={styles.constraint}>{careerGate?.reason ?? "Chargement de la progression du Chanvrier…"}</p> : null}
            <dl className={styles.planningMetrics} aria-label="Préparer cet agrandissement">
              <div><dt>Solde après achat</dt><dd>{formatKqCash(cashCents - production.totalCostCents)}</dd></div>
              <div><dt>Électricité supplémentaire / culture</dt><dd>{expansionEnergyCents === undefined ? "Estimation indisponible" : `≈ ${formatKqCash(expansionEnergyCents)}`}</dd></div>
              <div><dt>Stockage libre maintenant</dt><dd>{storageCapacity ? `${(storageCapacity.freeUnits / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g sur ${(storageCapacity.totalUnits / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g` : "Capacité indisponible"}</dd></div>
              <div><dt>Récolte de la nouvelle tente</dt><dd>Jusqu’à {production.addedUnits * 500} g</dd></div>
            </dl>
            <p className={styles.planning}>Le plafond de récolte n’est pas une prévision. Prévois des contenants et une réserve pour les charges. L’électricité est estimée avec le kit de départ en mode équilibré, hors entretien.</p>
            <div className={styles.purchase}>
              <div className={styles.price}><small>Investissement total</small><strong>{formatKqCash(production.totalCostCents)}</strong></div>
              <button type="button" disabled={unavailable} onClick={() => void expand()} aria-label={`${isNewWarehouse ? "Ouvrir le second entrepôt" : "Ajouter cette tente"} · ${formatKqCash(production.totalCostCents)}`}>
                {pending ? <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}{pending ? "Agrandissement…" : isNewWarehouse ? "Ouvrir le second entrepôt" : "Ajouter cette tente"}
              </button>
            </div>
          </> : <p className={styles.complete}><Check size={16} aria-hidden="true" />Deux entrepôts, huit tentes : capacité maximale atteinte.</p>}
        </div>
      </div>
      <p className={styles.footnote}>Chaque nouvelle tente reçoit un kit de départ neuf. Ses équipements de culture s’achètent séparément.{equipmentScopeVersion===3?" Elle bénéficie des services déjà installés dans son bâtiment. Le second entrepôt démarre sans séchoir, solaire ni sécurité : ces services s’y achètent une fois pour ses quatre places.":""} Les machines de transformation de l’atelier commun restent disponibles pour toutes les récoltes.</p>
      {notice ? <p role="status" className={styles.notice}><Check size={15} aria-hidden="true" />{notice}</p> : null}
      {error ? <p role="alert" className={styles.error}>{error} <button type="button" onClick={onUpdated}>Actualiser</button></p> : null}
    </div>
  </details>;
}
