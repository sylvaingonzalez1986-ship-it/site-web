"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Check, ChevronDown, Clock3, PackageCheck, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { KQ_STORAGE_CONTAINERS, KQ_STORAGE_METHODS, getKqStorageInventory } from "@/lib/kanab-quest-storage";
import { KQ_STORAGE_CONTAINER_ARTWORK } from "@/lib/kanab-quest-storage-artwork";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { createClientRequestKey } from "@/lib/client-request-key";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqCannabinoidReport } from "./KqCannabinoidReport";
import { KqStorageStatus } from "./KqStorageStatus";
import styles from "./KqWarehouseStorage.module.css";

type StorageAction = { action: "buy"; containerCode: string; quantity: number }
  | { action: "select-default"; methodCode: string }
  | { action: "assign"; methodCode: string; flowerId: string }
  | { action: "sell-overflow"; flowerId: string };
const METHOD_PRESENTATION = {
  "STORAGE-GLASS": { family: "Verre à vis", protection: "Standard", level: 1, detail: "Un bocal réutilisable pour accueillir tes premières récoltes." },
  "STORAGE-GROVE": { family: "Sachet TerpLoc", protection: "Améliorée", level: 2, detail: "Un format souple et refermable pour préserver tes fleurs." },
  "STORAGE-BOVEDA": { family: "Verre & régulation", protection: "Régulée", level: 3, detail: "Un bocal et un sachet qui régule l’humidité dans les deux sens." },
  "STORAGE-CVAULT": { family: "Inox & régulation", protection: "Renforcée", level: 4, detail: "Un contenant opaque en inox, accompagné d’un régulateur." },
  "STORAGE-CANNATROL": { family: "Conservation contrôlée", protection: "Optimale", level: 5, detail: "Une armoire dédiée à la conservation de tes plus beaux lots." },
} as const;
const grams = (units: number) => `${(units / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;

export function KqWarehouseStorage({ onChanged, onBusyChange }: { onChanged?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const api = useKqTutorialApi();
  const heading = useRef<HTMLHeadingElement>(null);
  const [snapshot, setSnapshot] = useState<KqStorageSnapshot | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const requestVersion = useRef(0);
  const receipt = useRef<{ fingerprint: string; key: string } | null>(null);
  const load = useCallback(async () => {
    if (lock.current) return;
    const version = ++requestVersion.current;
    try {
      const response = await api.request("/api/arena/placard/storage", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Stockage indisponible.");
      if (version === requestVersion.current) { setSnapshot(result); setError(""); }
    } catch (reason) { if (version === requestVersion.current) setError(reason instanceof Error ? reason.message : "Stockage indisponible."); }
  }, [api]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  const act = async (body: StorageAction) => {
    if (lock.current) return;
    lock.current = true; ++requestVersion.current; onBusyChange?.(true);
    setPending(body.action === "buy" ? body.containerCode : body.action === "select-default" ? "default" : body.flowerId); setNotice(""); setError("");
    try {
      const fingerprint = JSON.stringify(body);
      if (receipt.current?.fingerprint !== fingerprint) receipt.current = { fingerprint, key: createClientRequestKey() };
      const response = await api.request("/api/arena/placard/storage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, requestKey: receipt.current.key }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Modification du stockage impossible.");
      receipt.current = null; setSnapshot(result);
      setNotice(body.action === "buy" ? "Contenants ajoutés. La place disponible est attribuée aux lots qui en ont besoin." : body.action === "assign" ? "Répartition actualisée. Les pertes passées et les échéances restent inchangées." : body.action === "sell-overflow" ? "Surplus vendu au grossiste. La partie stockée est conservée." : "Préférence enregistrée pour les prochains lots.");
      api.notify("kq:storage-updated"); api.notify("kq:equipment-updated"); onChanged?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Modification impossible."); }
    finally { lock.current = false; setPending(null); onBusyChange?.(false); }
  };
  const containers = snapshot?.containers ?? KQ_STORAGE_CONTAINERS;
  const nowMs = snapshot ? Date.parse(snapshot.serverNow) : undefined;
  const inventory = getKqStorageInventory(snapshot?.ownedContainers ?? {}, (snapshot?.lots ?? []).flatMap(lot => lot.projection.capacity?.allocations ?? []));
  const capacity = snapshot?.capacity;
  const firstOverflowDeadline = snapshot?.lots.filter(lot => (lot.projection.capacity?.overflowUnits ?? 0) > 0)
    .map(lot => lot.projection.capacity?.overflowDeadlineAt).filter((date): date is string => Boolean(date))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  return <section className={styles.section} aria-labelledby="warehouse-storage-title" data-warehouse-storage>
    <header className={styles.heading}><div><small>Ton entrepôt · après le jury et le duel</small><h3 id="warehouse-storage-title" ref={heading} tabIndex={-1}>Stockage & curing</h3><p>À chaque récolte, le bon contenant. Protège tes fleurs et leurs arômes jusqu’à la vente.</p></div><button type="button" onClick={() => void load()} disabled={!!pending} aria-label="Actualiser le stockage"><RefreshCw size={18} /></button></header>
    <div className={styles.timeline} aria-label="Parcours de la récolte"><span><Check size={15} /> Récolte</span><span><Check size={15} /> Jury et duel</span><strong><Clock3 size={15} /> Curing · 6 heures réelles</strong><span>Vente</span></div>
    <p className={styles.help}>Le curing dure <strong>6 heures réelles</strong> après le verdict. Un surplus sans contenant doit être stocké ou vendu au plus tard <strong>1 heure réelle</strong> après le verdict, puis il est vendu automatiquement au grossiste.</p>
    {error ? <p className={styles.error} role="alert">{error}<button type="button" onClick={() => void load()} disabled={!!pending}>Réessayer</button></p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    {capacity ? <section className={styles.capacity} aria-label="Capacité de stockage" data-storage-capacity>
      <div className={styles.capacityMain}><div className={styles.capacityLabel}><PackageCheck size={18} aria-hidden="true" /> Place disponible</div><strong className={styles.availableCapacity}>{grams(capacity.freeUnits)}</strong><span className={styles.totalCapacity}>sur {grams(capacity.totalUnits)} de capacité achetée</span><div className={styles.capacityTrack} role="progressbar" aria-label="Capacité réservée" aria-valuemin={0} aria-valuemax={Math.max(1, capacity.totalUnits)} aria-valuenow={capacity.reservedUnits} aria-valuetext={`${grams(capacity.reservedUnits)} réservés sur ${grams(capacity.totalUnits)}`}><span style={{ width: `${Math.min(100, capacity.reservedUnits / Math.max(1, capacity.totalUnits) * 100)}%` }} /></div></div>
      <dl className={styles.capacityDetails}><div><dt>Contenants réservés</dt><dd>{grams(capacity.reservedUnits)}</dd><small>{grams(capacity.usedUnits)} de récolte protégés</small></div><div data-alert={capacity.overflowUnits > 0 || undefined}><dt>Surplus sans contenant</dt><dd>{grams(capacity.overflowUnits)}</dd><small>{capacity.overflowUnits > 0 ? "À stocker ou à vendre" : "Tout est à sa place"}</small></div></dl>
      <p className={styles.starterNote}>Deux bocaux de 1 L offerts au départ · 100 g de capacité dans le jeu.</p>
      {firstOverflowDeadline ? <div className={styles.overflowDeadline}><Clock3 size={20} aria-hidden="true" /><div><strong>Première vente automatique : {new Date(firstOverflowDeadline).toLocaleString("fr-FR")}.</strong><a href="#storage-lots-title">Voir les lots et vendre le surplus <ArrowUpRight size={15} aria-hidden="true" /></a></div></div> : null}
    </section> : null}
    <section className={styles.lots} aria-labelledby="storage-lots-title"><h4 id="storage-lots-title">Mes fleurs stockées & en curing {snapshot ? `· ${snapshot.lots.length}` : ""}</h4>
      {!snapshot ? <p role="status">Chargement des lots…</p> : !snapshot.lots.length ? <p className={styles.empty}>Après une récolte, passe le jury et le duel. Le jeu répartira le lot dans tes contenants disponibles.</p> : snapshot.lots.map(lot => {
        const placement = lot.projection.capacity;
        return <article key={lot.flowerId} className={styles.lot}><header><div><h5>{lot.varietyName}</h5><small>Récolte initiale {lot.harvestGrams.toLocaleString("fr-FR")} g · lot {lot.flowerId.slice(0, 8)}</small></div><span>Expression des terpènes <b>{lot.projection.terpenes.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}/99</b></span></header><KqStorageStatus storage={lot.projection} nowMs={nowMs} />
          {placement ? <><p><strong>{grams(placement.protectedUnits)} stockés</strong> sur {grams(placement.totalUnits)} restants.</p><ul className={styles.allocations}>{placement.allocations.map(allocation => <li key={allocation.containerCode}><span>{allocation.quantity} × {containers.find(container => container.code === allocation.containerCode)?.name ?? allocation.containerCode}</span><strong>{grams(allocation.storedUnits)}</strong></li>)}</ul>
            {placement.overflowUnits > 0 ? <div className={styles.overflow} data-storage-overflow><strong>{grams(placement.overflowUnits)} sans contenant</strong><p>Achète des contenants avant l’échéance pour conserver ce surplus, ou vends-le maintenant au tarif grossiste. Le reste du lot demeure stocké.</p>{lot.overflowOffer ? <p>{formatKqCash(lot.overflowOffer.payoutCents)} TTC · environ <strong>{formatKqCash(lot.overflowOffer.netPayoutCents)} versés</strong> après TVA et charges échues. Le net est recalculé à la vente.</p> : null}<button type="button" disabled={!!pending} onClick={() => void act({ action: "sell-overflow", flowerId: lot.flowerId })}>{pending === lot.flowerId ? "Enregistrement…" : `Vendre les ${grams(placement.overflowUnits)} de surplus`}</button></div> : null}</> : null}
          <label>Répartir ce lot en privilégiant<select value={lot.projection.methodCode} disabled={!!pending} onChange={event => void act({ action: "assign", methodCode: event.target.value, flowerId: lot.flowerId })}>{KQ_STORAGE_METHODS.filter(method => snapshot.ownedMethodCodes.includes(method.code)).map(method => <option key={method.code} value={method.code}>{method.name}</option>)}</select></label><small>Changer de contenant ne prolonge pas ce délai d’une heure et ne restaure pas les pertes passées. Après transformation, la place reste calculée en équivalent fleurs et se libère au fil des ventes.</small><KqCannabinoidReport report={lot.projection.cannabinoidReport} /></article>;
      })}
    </section>
    <details className={styles.purchasePanel} data-storage-shop>
    <summary className={styles.catalogHeading}><div><small>Besoin de plus de place ?</small><span className={styles.catalogTitle}>Acheter des contenants</span></div><span className={styles.balance}><Wallet size={18} aria-hidden="true" /><span><small>Ton solde</small><strong>{snapshot ? formatKqCash(snapshot.cashCents) : "Chargement…"}</strong></span></span><ChevronDown className={styles.catalogChevron} size={20} aria-hidden="true" /></summary>
    <div className={styles.purchaseContent}>
    <p className={styles.help}>Prix, capacités en fleurs sèches et niveaux de protection : valeurs du jeu. Pour les bocaux, le poids réel varie avec la densité des fleurs.</p>
    <div className={styles.catalog}>{containers.map(container => {
      const item = inventory.find(item => item.code === container.code);
      const owned = item?.ownedQuantity ?? 0, occupied = item?.occupiedQuantity ?? 0, free = item?.freeQuantity ?? 0;
      const quantity = Number(quantities[container.code] ?? "1");
      const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 100;
      const total = validQuantity ? quantity * container.priceCents : 0;
      const presentation = METHOD_PRESENTATION[container.methodCode];
      const artwork = KQ_STORAGE_CONTAINER_ARTWORK[container.code];
      return <article key={container.code} className={styles.productCard} data-container-code={container.code} data-protection={presentation.level}>
        <div className={styles.productVisual}><Image src={artwork.src} alt={artwork.alt} fill sizes="96px" className={styles.productImage} /></div>
        <div className={styles.productBody}><span className={styles.family}>{presentation.family}</span><h5>{container.name}</h5><span className={styles.capacityBadge}><strong>{grams(container.capacityUnits)}</strong><small>par contenant</small></span><div className={styles.protection}><span><ShieldCheck size={16} aria-hidden="true" /> Protection · jeu</span><strong>{presentation.protection}</strong><span className={styles.protectionScale} role="img" aria-label={`Niveau de protection de jeu : ${presentation.level} sur 5`}>{[1, 2, 3, 4, 5].map(level => <i key={level} data-filled={level <= presentation.level || undefined} />)}</span></div><div className={styles.productMeta}><p className={styles.containerCount}><strong>{owned} possédé{owned > 1 ? "s" : ""}</strong><span>{occupied} réservé{occupied > 1 ? "s" : ""} · {free} libre{free > 1 ? "s" : ""}</span></p><a href={container.sourceUrl} target="_blank" rel="noreferrer">Produit de référence <ArrowUpRight size={13} aria-hidden="true" /></a></div></div>
          <footer><div className={styles.purchaseRow}><div className={styles.unitPrice}><strong>{formatKqCash(container.priceCents)}</strong><small>par contenant</small></div><label className={styles.quantity}>Quantité<input aria-label={`Quantité · ${container.name}`} type="number" min="1" max="100" step="1" value={quantities[container.code] ?? "1"} disabled={!!pending} onChange={event => setQuantities(current => ({ ...current, [container.code]: event.target.value }))} /></label></div><small className={styles.purchaseCapacity}>{validQuantity ? `+ ${grams(quantity * container.capacityUnits)} de place` : "Choisis de 1 à 100 contenants."}</small><button type="button" disabled={!!pending || !snapshot || !validQuantity || snapshot.cashCents < total} onClick={() => void act({ action: "buy", containerCode: container.code, quantity })}>{pending === container.code ? "Achat…" : `Acheter${validQuantity ? ` · ${formatKqCash(total)}` : ""}`}</button>{snapshot && validQuantity && snapshot.cashCents < total ? <small className={styles.insufficientFunds}>Solde insuffisant pour cette quantité</small> : null}</footer>
      </article>;
    })}</div>
    {snapshot ? <label className={styles.defaultChoice}>Protection préférée pour les prochains lots<select value={snapshot.defaultMethodCode} disabled={!!pending} onChange={event => void act({ action: "select-default", methodCode: event.target.value })}>{KQ_STORAGE_METHODS.filter(method => snapshot.ownedMethodCodes.includes(method.code)).map(method => <option key={method.code} value={method.code}>{method.name}</option>)}</select><small>Le jeu utilise d’abord cette famille, puis les autres contenants libres. Deux récoltes différentes ne partagent pas un contenant.</small></label> : null}
    </div>
    </details>
    {snapshot?.overflowSales?.length ? <section className={styles.receipts} aria-label="Reprises de surplus"><h4>Dernières reprises au grossiste</h4><ul>{snapshot.overflowSales.map(sale => <li key={`${sale.flowerId}:${sale.soldAt}`}><span><strong>{sale.automatic ? "Vente automatique" : "Surplus vendu"} · {grams(sale.units)}</strong><small>{new Date(sale.soldAt).toLocaleString("fr-FR")} · lot {sale.flowerId.slice(0, 8)}</small></span><span><strong>{formatKqCash(sale.netPayoutCents)} versés</strong><small>{formatKqCash(sale.payoutCents)} TTC avant TVA et charges</small></span></li>)}</ul></section> : null}
  </section>;
}
