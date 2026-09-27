"use client";

import Image from "next/image";
import { ArrowRight, Building2, Check, ChevronDown, LoaderCircle, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqProductionExpansion } from "@/lib/kanab-quest-production";
import styles from "./KqProductionCapacity.module.css";

export type KqProductionSnapshot = ReturnType<typeof getKqProductionExpansion>;

export function KqProductionCapacity({ production, cashCents, activeRun, disabled, onUpdated, onPendingChange, tents, tentArtwork = "tent-pro" }: {
  tents?: Array<{ tentNumber: number; equippedCodes: string[] }>;
  tentArtwork?: "tent-starter" | "tent-pro";
  production: KqProductionSnapshot;
  cashCents: number;
  activeRun: boolean;
  disabled: boolean;
  onUpdated: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [completedUnits, setCompletedUnits] = useState<number | null>(null);
  const inFlight = useRef(false);
  const request = useRef<{ units: number; cost: number; key: string } | null>(null);
  const isFinalWarehouse = production.nextUnits === 8;
  const shortfall = Math.max(0, production.totalCostCents - cashCents);
  const unavailable = disabled || pending || activeRun || shortfall > 0 || completedUnits === production.units;

  const expand = async () => {
    if (inFlight.current || unavailable || production.nextUnits === null) return;
    inFlight.current = true;
    setPending(true); onPendingChange(true); setError(""); setNotice("");
    if (request.current?.units !== production.units || request.current.cost !== production.totalCostCents) {
      request.current = { units: production.units, cost: production.totalCostCents, key: crypto.randomUUID() };
    }
    try {
      const response = await fetch("/api/arena/placard/equipment", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expand-production", requestKey: request.current.key,
          expectedUnits: production.units, expectedCostCents: production.totalCostCents }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Agrandissement impossible.");
      setCompletedUnits(production.units);
      setNotice(`${isFinalWarehouse ? "Entrepôt final ouvert" : "Nouvelle tente installée"} : ${production.nextUnits} tentes prêtes pour la prochaine culture.`);
      window.dispatchEvent(new Event("kq:equipment-updated"));
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
            {Array.from({ length: visibleWarehouses }, (_, warehouse) => <div key={warehouse} className={styles.warehouse} data-new={warehouse === 1 && isFinalWarehouse}>
              <div className={styles.roomLabel}><span>{warehouse === 0 ? "Entrepôt 01" : "Entrepôt 02"}</span><small>{warehouse === 1 && isFinalWarehouse ? "+ 4 tentes" : warehouse === 0 && isFinalWarehouse ? "Conservé" : ""}</small></div>
              <ol aria-label={warehouse === 0 ? "Tentes du premier entrepôt" : "Tentes du second entrepôt"}>
                {Array.from({ length: 4 }, (_, index) => {
                  const number = warehouse * 4 + index + 1;
                  const owned = number <= production.units;
                  const next = !owned && number <= targetUnits;
                  const tent = tents?.find(item => item.tentNumber === number);
                  const artwork = !owned || tent?.equippedCodes.includes("TENT-080-STARTER") ? "tent-starter" : tent ? "tent-pro" : tentArtwork;
                  return <li key={number} data-owned={owned} data-next={next} aria-label={`Tente ${number} · ${owned ? "installée" : next ? "prochain agrandissement" : "emplacement libre"}`}>
                    {owned || next ? <Image src={`/placard/warehouse-v2/${artwork}.webp`} width={366} height={488} sizes="80px" alt={owned ? `Tente ${number} · ${artwork === "tent-starter" ? "modèle de départ" : "modèle aménagé"}` : "Tente en kit de départ"} draggable={false} /> : <span className={styles.emptySlot} aria-hidden="true" />}
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
          <h4>{production.nextUnits === null ? "Les deux entrepôts sont à toi." : isFinalWarehouse ? "Un second entrepôt." : `Une ${production.nextUnits === 2 ? "deuxième" : production.nextUnits === 3 ? "troisième" : "quatrième"} tente.`}</h4>
          <p>{production.nextUnits === null ? "Tes huit tentes contribuent au même lot, chacune avec son propre matériel." : isFinalWarehouse ? "Quatre tentes supplémentaires en kit de départ, à aménager séparément." : "Une tente supplémentaire en kit de départ. Les améliorations des autres tentes ne sont pas copiées."}</p>
          {production.nextUnits !== null ? <>
            <div className={styles.capacityChange}><span>{production.units}<small>tente{production.units > 1 ? "s" : ""}</small></span><ArrowRight size={19} aria-hidden="true" /><strong>{production.nextUnits}<small>tentes</small></strong></div>
            <details className={styles.quote}>
              <summary><span>Détail du devis</span><ChevronDown size={13} aria-hidden="true" /></summary>
              <dl>{production.propertyCostCents > 0 ? <div><dt>Second entrepôt</dt><dd>{formatKqCash(production.propertyCostCents)}</dd></div> : null}<div><dt>Installation de {production.addedUnits} tente{production.addedUnits > 1 ? "s" : ""}</dt><dd>{formatKqCash(production.equipmentCostCents)}</dd></div></dl>
            </details>
            <div className={styles.purchase}>
              <div className={styles.price}><small>Investissement total</small><strong>{formatKqCash(production.totalCostCents)}</strong></div>
              <button type="button" disabled={unavailable} onClick={() => void expand()} aria-label={`${isFinalWarehouse ? "Acheter l’entrepôt final" : "Ajouter cette tente"} · ${formatKqCash(production.totalCostCents)}`}>
                {pending ? <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}{pending ? "Agrandissement…" : isFinalWarehouse ? "Acheter l’entrepôt final" : "Ajouter cette tente"}
              </button>
            </div>
            {activeRun ? <p className={styles.constraint}>Disponible après la culture en cours.</p> : shortfall > 0 ? <p className={styles.constraint}>Il te manque {formatKqCash(shortfall)}.</p> : null}
          </> : <p className={styles.complete}><Check size={16} aria-hidden="true" />Deux entrepôts, huit tentes : capacité maximale atteinte.</p>}
        </div>
      </div>
      <p className={styles.footnote}>Les récoltes et la consommation des tentes s’additionnent. Les bonus de culture dépendent du matériel réellement installé dans chacune.</p>
      {notice ? <p role="status" className={styles.notice}><Check size={15} aria-hidden="true" />{notice}</p> : null}
      {error ? <p role="alert" className={styles.error}>{error} <button type="button" onClick={onUpdated}>Actualiser</button></p> : null}
    </div>
  </details>;
}
