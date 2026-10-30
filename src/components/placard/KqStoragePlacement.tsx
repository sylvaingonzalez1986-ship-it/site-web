"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { Check, ChevronDown, PackageCheck } from "lucide-react";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { getKqStorageContainer, isKqStorageCapacity } from "@/lib/kanab-quest-storage";
import { getKqStoragePlacementAvailability } from "@/lib/kanab-quest-storage-placement";
import { KQ_STORAGE_CONTAINER_ARTWORK } from "@/lib/kanab-quest-storage-artwork";
import styles from "./KqStoragePlacement.module.css";

const grams = (units: number) => `${(units / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
type Confirmation = { code: string; units: number; quantity: number; previousAllocation: string };

/** Open the requested lot's editor without choosing a model or submitting a placement. */
export function openKqStoragePlacement(root: ParentNode | null | undefined, flowerId: string): boolean {
  const editor = Array.from(root?.querySelectorAll<HTMLDetailsElement>('[data-storage-placement]') ?? [])
    .find(element => element.dataset.storagePlacement === flowerId);
  if (!editor) return false;
  editor.open = true;
  const control = editor.querySelector<HTMLElement>('select:not(:disabled)') ?? editor.querySelector<HTMLElement>('summary');
  control?.focus({ preventScroll: true });
  editor.scrollIntoView({ block: 'start', behavior: 'instant' });
  return true;
}

/** A placement reserves installed containers for this harvest only, with no purchase. */
export function KqStoragePlacement({ snapshot, flowerId, disabled = false, onPlace, onRetry }: {
  snapshot: KqStorageSnapshot;
  flowerId: string;
  disabled?: boolean;
  onPlace: (flowerId: string, containerCode: string) => Promise<boolean>;
  onRetry?: () => void;
}) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const inFlight = useRef(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lot = Array.isArray(snapshot.lots) ? snapshot.lots.find(item => item.flowerId === flowerId) : undefined;
  const capacity = lot?.projection?.capacity;
  const allocations = Array.isArray(capacity?.allocations) ? capacity.allocations : null;
  const { inventory } = getKqStoragePlacementAvailability(snapshot, flowerId);
  const options = inventory?.filter(item => item.ownedQuantity > 0) ?? [];
  const units = capacity?.totalUnits;
  const knownUnits = Number.isSafeInteger(units) && Number(units) >= 0;
  const currentCode = allocations?.length === 1 ? allocations[0].containerCode : undefined;
  const preferredCode = currentCode ?? options.find(item => knownUnits && Math.ceil(units! / item.capacityUnits) <= item.freeQuantity)?.code ?? options[0]?.code;
  const container = options.find(item => item.code === selectedCode) ?? options.find(item => item.code === preferredCode);
  const quantity = container && knownUnits ? Math.ceil(units! / container.capacityUnits) : null;
  const reusable = container ? allocations?.find(item => item.containerCode === container.code)?.quantity ?? 0 : 0;
  const enough = container && quantity !== null && quantity > 0 && quantity <= container.freeQuantity;
  const alreadyPlaced = Boolean(container && currentCode === container.code && allocations?.[0].storedUnits === units && allocations?.[0].quantity === quantity);
  const locked = disabled || pending;
  const canPlace = Boolean(inventory && enough && !alreadyPlaced && !locked);
  const allocationFingerprint = JSON.stringify(allocations);
  const confirmationCurrent = Boolean(confirmation && container && confirmation.code === container.code && confirmation.units === units && confirmation.quantity === quantity && confirmation.previousAllocation === allocationFingerprint && enough && !alreadyPlaced);
  const artwork = container ? KQ_STORAGE_CONTAINER_ARTWORK[container.code] : undefined;
  const currentPlacement = !isKqStorageCapacity(capacity) ? "Rangement à confirmer"
    : !allocations?.length ? "Aucun contenant attribué"
      : allocations.map(item => `${item.quantity} × ${getKqStorageContainer(item.containerCode)?.name ?? item.containerCode}`).join(" · ");

  async function confirmPlacement() {
    if (!confirmationCurrent || !container || !canPlace || inFlight.current) return;
    inFlight.current = true; setPending(true); setError("");
    try {
      const placed = await onPlace(flowerId, container.code);
      if (placed) {
        setConfirmation(null);
        if (details.current) {
          details.current.open = false;
          details.current.querySelector("summary")?.focus({ preventScroll: true });
        }
      } else setError("Le rangement n’a pas été confirmé. Vérifie le message du stockage avant de réessayer.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le rangement est indisponible. Réessaie après actualisation du stockage.");
    } finally { inFlight.current = false; setPending(false); }
  }

  return <details ref={details} className={styles.placement} data-storage-placement={flowerId} onToggle={event => { if (!event.currentTarget.open && !pending) { setConfirmation(null); setError(""); } }}>
    <summary><PackageCheck size={18} aria-hidden="true" /><span className={styles.summaryCopy}><strong>Choisir un contenant</strong><small>{currentPlacement}</small></span><ChevronDown size={17} aria-hidden="true" /></summary>
    <div className={styles.editor}>
      {!lot || !knownUnits || !inventory ? <><p className={styles.notice}>La quantité du lot ou les réservations sont indisponibles. Actualise le stockage avant de choisir un contenant.</p>{onRetry ? <button type="button" disabled={locked} onClick={onRetry}>Actualiser les disponibilités</button> : null}</>
        : units === 0 ? <p className={styles.notice}>Ce lot ne contient plus de stock à ranger.</p>
          : !options.length ? <p className={styles.notice}>Aucun contenant installé. Installe les contenants dans ta zone de stockage, puis reviens ranger ce lot.</p>
            : container && quantity !== null ? <>
              <label className={styles.field} htmlFor={`${id}-container`}>Modèle pour ce lot<select id={`${id}-container`} value={container.code} disabled={locked} aria-describedby={`${id}-scope`} onChange={event => { setSelectedCode(event.target.value); setConfirmation(null); setError(""); }}>
                {options.map(item => <option key={item.code} value={item.code}>{item.name} · {grams(item.capacityUnits)} · {item.freeQuantity} disponible{item.freeQuantity > 1 ? "s" : ""}</option>)}
              </select></label>
              <p id={`${id}-scope`} className={styles.scope}>{lot.varietyName} · {grams(units!)} à conserver. Le lot entier utilisera ce modèle ; chaque contenant reste réservé à cette récolte. Après transformation, ce volume est exprimé en équivalent fleurs.</p>
              <div className={styles.preview}>
                {artwork ? <Image src={artwork.src} alt="" width={70} height={78} className={styles.art} /> : null}
                <dl><div><dt>Contenants nécessaires</dt><dd>{quantity}</dd></div><div><dt>Disponibles pour ce lot</dt><dd>{container.freeQuantity}</dd></div><div><dt>Capacité réservée après rangement</dt><dd>{grams(quantity * container.capacityUnits)}</dd></div></dl>
              </div>
              {reusable > 0 ? <p className={styles.help}>La disponibilité inclut {reusable} contenant{reusable > 1 ? "s" : ""} déjà réservé{reusable > 1 ? "s" : ""} à ce lot.</p> : null}
              {!enough ? <p className={styles.warning} role="status">Il manque {Math.max(0, quantity - container.freeQuantity)} contenant{quantity - container.freeQuantity > 1 ? "s" : ""} de ce modèle pour ranger tout le lot. Choisis un autre modèle ou installe davantage de contenants.</p>
                : alreadyPlaced ? <p className={styles.help}><Check size={16} aria-hidden="true" />Ce lot est déjà rangé dans {quantity} contenant{quantity > 1 ? "s" : ""} de ce modèle.</p> : null}
              {!confirmation ? <button type="button" className={styles.primary} disabled={!canPlace} onClick={() => { setError(""); setConfirmation({ code: container.code, units: units!, quantity, previousAllocation: allocationFingerprint }); }}>Ranger ce lot</button> : <section className={styles.confirmation} aria-labelledby={`${id}-confirm`}>
                <h4 id={`${id}-confirm`}>Confirmer le rangement</h4>
                <p><strong>{grams(confirmation.units)}</strong> de {lot.varietyName} seront rangés dans <strong>{confirmation.quantity} × {container.name}</strong>.</p>
                <p>Les anciens contenants de ce lot seront libérés. Les autres récoltes gardent leurs réservations. Aucun achat ni débit ; l’âge du lot, les pertes passées et les échéances restent inchangés.</p>
                {!confirmationCurrent ? <p className={styles.warning} role="status">Le stock ou les disponibilités ont changé. Reviens au choix du contenant pour vérifier le nouveau rangement.</p> : null}
                <div className={styles.actions}><button type="button" disabled={locked} onClick={() => { setConfirmation(null); setError(""); }}>Revenir au choix</button><button type="button" className={styles.primary} disabled={locked || !confirmationCurrent} onClick={() => void confirmPlacement()}>{pending ? "Rangement…" : "Confirmer le rangement"}</button></div>
              </section>}
            </> : null}
      {error ? <p className={styles.warning} role="alert">{error}</p> : null}
    </div>
  </details>;
}
