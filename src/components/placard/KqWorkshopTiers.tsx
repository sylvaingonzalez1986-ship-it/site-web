"use client";

import Image from "next/image";
import { getKqWorkshopPriceList } from "@/lib/kanab-quest-warehouse-retail";
import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, ShoppingCart } from "lucide-react";
import { createClientRequestKey } from "@/lib/client-request-key";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getChanvrierCareerGate, getChanvrierEquipmentAccess, getChanvrierEquipmentUpgradeRequiredLevel, type ChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import { getKqWorkshopMachineSpecification, getKqWorkshopTierPrice, KQ_WORKSHOP_MACHINE_TIERS, type KqWorkshopTierLevel } from "@/lib/kanab-quest-workshop-machines";
import { getKqWorkshopProductArtwork } from "@/lib/kanab-quest-warehouse-product-artwork";
import { getKqProcessingMachineReference } from "@/lib/kanab-quest-processing-profiles";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqWorkshopInvestmentComparison } from "./KqWorkshopInvestmentComparison";
import styles from "./KqWorkshopTiers.module.css";

export function KqWorkshopTiers({ code, level = 0, cashCents, career, maintenanceDue = false, disabled = false, onUpdated, onBusyChange }: {
  code: string; level?: number; cashCents: number; career?: ChanvrierCareerSnapshot;
  maintenanceDue?: boolean; disabled?: boolean; onUpdated: () => void | Promise<void>; onBusyChange?: (busy: boolean) => void;
}) {
  const api = useKqTutorialApi();
  const [selected, setSelected] = useState<KqWorkshopTierLevel | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [completedLevel, setCompletedLevel] = useState(0);
  const inFlight = useRef(false);
  const confirmation = useRef<HTMLDivElement>(null);
  const offerButton = useRef<HTMLButtonElement>(null);
  const request = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => { onBusyChange?.(pending); }, [pending, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  useEffect(() => { if (selected !== null) confirmation.current?.focus(); }, [selected]);
  if (!getKqWorkshopPriceList(code) || !getKqWorkshopMachineSpecification(code)) return null;
  const currentLevel = Math.max(level, completedLevel);
  const acquisition = career ? getChanvrierEquipmentAccess(career, code) : null;
  const offers = KQ_WORKSHOP_MACHINE_TIERS.map(tier => {
    const isCurrentTier = currentLevel >= tier.level && currentLevel < (tier.level === 1 ? 4 : tier.level === 4 ? 7 : 11);
    const machine = getKqWorkshopMachineSpecification(code, isCurrentTier ? currentLevel : tier.level)!;
    const price = getKqWorkshopTierPrice(code, tier.level, currentLevel);
    const gate = tier.level > 1 && career ? getChanvrierCareerGate(career.xp, getChanvrierEquipmentUpgradeRequiredLevel(code, tier.level)) : acquisition;
    const reason = currentLevel === 0 && !acquisition?.allowed ? acquisition?.reason ?? "Progression du joueur indisponible."
      : !gate?.allowed ? gate?.reason ?? "Progression du joueur indisponible."
        : maintenanceDue ? "Entretiens la machine avant de changer de gamme."
          : price !== null && cashCents < price ? `Il manque ${formatKqCash(price - cashCents)}.` : null;
    const attained = currentLevel >= tier.level;
    return { ...tier, machine, price, reason, attained, isCurrentTier, priceLabel: attained ? "Acquise" : price === null ? "Indisponible" : formatKqCash(price), artwork: getKqWorkshopProductArtwork(code, tier.level), reference: getKqProcessingMachineReference(code, isCurrentTier ? currentLevel : tier.level) };
  });
  const chosen = offers.find(tier => tier.level === selected);
  const buy = async () => {
    if (!chosen || chosen.price === null || chosen.reason || inFlight.current || disabled || pending) return;
    const expectedLevel = currentLevel;
    const signature = `${code}:${expectedLevel}:${chosen.level}:${chosen.price}`;
    if (request.current?.signature !== signature) request.current = { signature, key: createClientRequestKey() };
    inFlight.current = true;
    setPending(true); setError(""); setNotice("");
    try {
      const response = await api.request("/api/arena/placard/equipment", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "workshop-tier", equipmentCode: code, targetLevel: chosen.level,
          expectedLevel, expectedPriceCents: chosen.price, requestKey: request.current.key }),
      });
      const result = await response.json() as { error?: string; level: number; priceCents: number };
      if (!response.ok) throw new Error(result.error || "Achat de gamme impossible.");
      setCompletedLevel(result.level);
      setSelected(null);
      setNotice(`${chosen.label} acquise · ${formatKqCash(result.priceCents)}.${expectedLevel === 0 ? " Installe la machine pour l’utiliser." : " Son installation et son entretien sont conservés."}`);
      api.notify("kq:equipment-updated");
      await onUpdated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Achat de gamme impossible.");
    } finally { setPending(false); inFlight.current = false; }
  };
  return <section className={styles.tiers} aria-label="Choisir une gamme de machine" data-workshop-tiers={code}>
    <header><h4>Trois gammes</h4><p>{currentLevel > 0 ? "Tu paies uniquement les améliorations manquantes." : "La machine rejoint ton inventaire dans la gamme choisie. Installe-la ensuite pour l’utiliser."}</p></header>
    <table className={styles.comparison} aria-label="Comparer les prix, capacités et précisions">
      <thead><tr><th scope="col">Gamme</th><th scope="col">g / lot</th><th scope="col">Précision</th><th scope="col">{currentLevel > 0 ? "À payer" : "Prix"}</th></tr></thead>
      <tbody>{offers.map(offer => <tr key={offer.code} data-current-tier={offer.isCurrentTier || undefined}>
        <th scope="row">{offer.label}{offer.isCurrentTier && <small>Actuelle</small>}</th>
        <td>{offer.machine.capacityGrams.toLocaleString("fr-FR")}</td>
        <td>{offer.machine.precision.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</td>
        <td>{offer.priceLabel}</td>
      </tr>)}</tbody>
    </table>
    <div className={styles.grid}>{offers.map(offer => <article key={offer.code} data-tier={offer.code} data-workshop-tier={offer.level} data-selected={selected === offer.level || undefined} data-attained={offer.attained || undefined}>
      <small>{offer.label}</small><strong>{offer.machine.name}</strong>
      {offer.artwork && <Image className={styles.artwork} src={offer.artwork.src} alt="" width={512} height={512} sizes="(max-width: 700px) 160px, 180px" data-workshop-tier-artwork={offer.level} />}
      <dl>
        <div><dt>Capacité de jeu</dt><dd>{offer.machine.capacityGrams} g / lot</dd></div>
        <div><dt>Précision de jeu</dt><dd>{offer.machine.precision.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</dd></div>
        {offer.reference && <div><dt>Cadence de base estimée</dt>
          <dd>{offer.reference.gramsPerHour === null ? "Attente autonome" : `${offer.reference.gramsPerHour.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g/h de jeu`} · {offer.reference.material}</dd></div>}
      </dl>
      <b>{offer.price === null && !offer.attained ? "Prix indisponible" : offer.priceLabel}</b>
      <span>{offer.attained ? `Niveau actuel ${currentLevel}` : currentLevel > 0 ? "Passage de gamme · achat unique" : "Machine complète · achat unique"}</span>
      {offer.attained ? <p className={styles.owned}><Check size={16} aria-hidden="true" />{offer.isCurrentTier ? "Ta gamme actuelle" : "Incluse dans ta machine"}</p>
        : <button type="button" disabled={disabled || pending || offer.price === null || !!offer.reason} data-workshop-tier-choose={offer.level} aria-pressed={selected === offer.level} onClick={event => { offerButton.current = event.currentTarget; setSelected(offer.level); setError(""); }}><ShoppingCart size={16} aria-hidden="true" />Choisir {offer.label.toLocaleLowerCase("fr-FR")}</button>}
      {!offer.attained && offer.reason ? <p className={styles.reason}>{offer.reason}</p> : null}
    </article>)}</div>
    {chosen && !chosen.attained && chosen.price !== null ? <div className={styles.confirm} ref={confirmation} tabIndex={-1} role="group" aria-label="Confirmer la gamme">
      <strong>{chosen.machine.name} · {formatKqCash(chosen.price)}</strong>
      <p>{currentLevel > 0 ? `Passage du niveau ${currentLevel} au niveau ${chosen.level}.` : `Achat direct au niveau ${chosen.level}.`} Solde prévu : {formatKqCash(Math.max(0, cashCents - chosen.price))}.</p>
      {currentLevel > 0 && <KqWorkshopInvestmentComparison key={chosen.level} code={code} level={currentLevel} targetLevel={chosen.level} priceCents={chosen.price} />}
      <div><button type="button" disabled={pending} onClick={() => { setSelected(null); offerButton.current?.focus(); }}>Annuler</button><button type="button" data-workshop-tier-confirm disabled={pending || disabled || !!chosen.reason || chosen.price === null} onClick={() => void buy()}>{pending ? <><LoaderCircle size={16} aria-hidden="true" />Achat…</> : `Confirmer · ${formatKqCash(chosen.price)}`}</button></div>
    </div> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    {error ? <p className={styles.error} role="alert">{error} <button type="button" disabled={pending} onClick={() => void onUpdated()}>Actualiser</button></p> : null}
  </section>;
}
