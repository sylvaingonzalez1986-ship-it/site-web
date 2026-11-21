"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqCareProductArtwork } from "@/lib/kanab-quest-care-artwork";
import { getKqWarehouseInputPack, type KqWarehousePreparationItem } from "@/lib/kanab-quest-warehouse-preparations";
import type { useWarehousePreparations } from "./useWarehousePreparations";
import styles from "./KqWarehouseSupplies.module.css";

type Register = ReturnType<typeof useWarehousePreparations>;
type Input = Extract<KqWarehousePreparationItem, { kind: "consumable" }>;
type Pack = NonNullable<ReturnType<typeof getKqWarehouseInputPack>>;
const families = { nutrition: "Nutrition", amendment: "Sol et racines", pbi: "Auxiliaires", prevention: "Prévention" } as const;
const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
const charges = (count: number) => `${count.toLocaleString("fr-FR")} utilisation${count > 1 ? "s" : ""}`;

function InputCard({ item, pack, register }: { item: Input; pack: Pack; register: Register }) {
  const [quantity, setQuantity] = useState("1");
  const count = Number(quantity);
  const packPrice = item.packPriceCents;
  const uses = item.chargesPerPack;
  const quoted = typeof packPrice === "number" && Number.isSafeInteger(packPrice) && packPrice > 0
    && typeof uses === "number" && Number.isSafeInteger(uses) && uses > 0;
  const valid = Number.isInteger(count) && count >= 1 && count <= 100;
  const total = valid && quoted ? count * packPrice : null;
  const affordable = total !== null && !!register.state && register.state.cashCents >= total;
  const art = getKqCareProductArtwork(item.code);
  const receipt = register.lastPackPurchase;
  return <article className={`${styles.sheet} ${styles.productCard}`} data-warehouse-supply={item.code} data-warehouse-shop-product={item.code} tabIndex={-1}>
    {art && <div className={styles.productImage}><Image src={art.src} width={140} height={110} sizes="140px" alt="" /></div>}
    <header><h4>{pack.name}</h4><p className={styles.format}>{pack.format}</p></header>
    <p className={styles.use}>{pack.usage}</p>
    <div className={styles.productNumbers}>
      <strong>{quoted ? `${formatKqCash(packPrice)} TTC` : "Tarif indisponible"}</strong>
      {quoted && <span>{charges(uses)} en jeu par conditionnement</span>}
    </div>
    <p className={styles.onHand} data-supply-stock={item.availableQuantity}>En stock · <strong>{charges(item.availableQuantity)}</strong>
      {item.reservedQuantity > 0 && <small>{charges(item.reservedQuantity)} déjà affectées en plus</small>}
      {!!item.legacyPassQuantity && <small>{item.legacyPassQuantity} traitement(s) de zone en réserve</small>}</p>
    <div className={styles.purchase}>
      <label>Quantité à acheter<input type="number" inputMode="numeric" min={1} max={100} step={1} value={quantity}
        aria-label={`Nombre de conditionnements de ${pack.name}`} onChange={e => setQuantity(e.target.value)} /></label>
      {quoted && valid && count > 1 && <small>{count} conditionnements · {charges(count * uses)}</small>}
      <button type="button" data-warehouse-buy-pack={item.code} disabled={!affordable || register.busy || register.uncertain}
        onClick={() => { if (total !== null) register.act({ action: "purchasePack", code: item.code, quantity: count, expectedCents: total }); }}>
        {total === null ? valid ? "Tarif à vérifier" : "Choisir de 1 à 100" : `Acheter · ${formatKqCash(total)}`}
      </button>
      {total !== null && !affordable && <small>Trésorerie insuffisante pour cet achat.</small>}
      {receipt?.code === item.code && <p role="status" className={styles.receipt}>{charges(receipt.charges)} ajoutées au stock.</p>}
    </div>
  </article>;
}

export function KqWarehouseInputCatalog({ register, initialCode }: { register: Register; initialCode?: string }) {
  const [family, setFamily] = useState<"all" | keyof typeof families>("all");
  const [query, setQuery] = useState("");
  const [onlyOwned, setOnlyOwned] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const focused = useRef<string | undefined>(undefined);
  const entries = (register.state?.items ?? []).flatMap(item => {
    const pack = item.kind === "consumable" && getKqWarehouseInputPack(item.code);
    return item.kind === "consumable" && pack ? [{ item, pack }] : [];
  });
  const needle = searchable(query.trim());
  const visible = entries.filter(({ item, pack }) =>
    (family === "all" || family === pack.family) && (!onlyOwned || item.availableQuantity > 0 || (item.legacyPassQuantity ?? 0) > 0)
    && (!needle || searchable([pack.name, pack.format, pack.usage, item.name, families[pack.family]].join(" ")).includes(needle)))
    .sort((a,b) => a.pack.name.localeCompare(b.pack.name, "fr"));
  useEffect(() => {
    if (!initialCode || focused.current === initialCode || !register.state) return;
    const card = panel.current?.querySelector<HTMLElement>(`[data-warehouse-supply="${CSS.escape(initialCode)}"]`);
    if (card) { focused.current = initialCode; card.scrollIntoView({ block: "start", behavior: "instant" }); card.focus({ preventScroll: true }); }
  }, [initialCode, register.state]);
  return <div className={styles.catalog} ref={panel}>
    <p>Achète tes produits en flacons, sacs ou boîtes. En culture, ouvre <strong>Santé → Produits de soin</strong> pour traiter un problème avec le stock présent au semis.</p>
    <div className={styles.filters} role="group" aria-label="Famille de produits">
      <button type="button" aria-pressed={family === "all"} onClick={() => setFamily("all")}>Tout le catalogue</button>
      {(Object.keys(families) as Array<keyof typeof families>).map(key => <button key={key} type="button" aria-pressed={family === key} onClick={() => setFamily(key)}>{families[key]}</button>)}
    </div>
    <div className={styles.searchRow}>
      <label>Rechercher<input type="search" value={query} placeholder="Produit, ravageur ou symptôme" onChange={e => setQuery(e.target.value)} /></label>
      <label><input type="checkbox" checked={onlyOwned} onChange={e => setOnlyOwned(e.target.checked)} /> En stock</label>
      <span aria-live="polite">{visible.length} produit{visible.length > 1 ? "s" : ""}</span>
    </div>
    <div className={styles.cards}>{visible.map(({ item, pack }) => <InputCard key={item.code} item={item} pack={pack} register={register} />)}</div>
    {!visible.length && <p>{onlyOwned && !query ? "Aucun produit en stock pour cette sélection." : "Aucun produit ne correspond à cette recherche."}</p>}
  </div>;
}
