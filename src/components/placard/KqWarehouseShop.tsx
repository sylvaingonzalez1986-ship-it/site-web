"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowRight, Check, ChevronRight, Droplets, Fan, FlaskConical, Flower2, LampDesk, Package, PackageCheck, Shield, ShoppingBag, SlidersHorizontal, Sparkles, Thermometer, Warehouse, Wind, Wrench, X, type LucideIcon } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_WAREHOUSE_CATALOG, type KqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseServiceZoneQuote, getKqWarehouseZoneQuote, validateKqWarehouseZones, type KqWarehouseState, type KqWarehouseZone } from "@/lib/kanab-quest-warehouse";
import { KQ_WAREHOUSE_OPTIONS, KQ_WAREHOUSE_OPTION_FAMILIES, KQ_WAREHOUSE_OPTION_LIMITS, getKqWarehouseOption, type KqWarehouseOption, type KqWarehouseOptionFamily } from "@/lib/kanab-quest-warehouse-options";
import { getKqWarehouseProductArtwork } from "@/lib/kanab-quest-warehouse-product-artwork";
import styles from "./KqWarehouseShop.module.css";

type Department = KqWarehouseOptionFamily | "lighting" | "air" | "drying" | "storage" | "workshop";
type Product = { code: string; name: string; device: KqWarehouseDevice; option?: never } | { code: string; name: string; option: KqWarehouseOption; device?: never };
type ProductQuote = { equipmentCents: number; equipmentPerM2: number; operatingPerM2: number; harvestPerM2: number | null; capacityPerM2: number | null; quantity: number; zoneArea: number };
const TIERS = { economy: { label: "Économique", order: 0 }, standard: { label: "Standard", order: 1 }, premium: { label: "Haut de gamme", order: 2 } } as const;
const FAMILY_ICONS: Record<KqWarehouseOptionFamily, LucideIcon> = { water: Droplets, climate: Thermometer, control: SlidersHorizontal, hygiene: Sparkles, logistics: PackageCheck, security: Shield, substrate: Flower2, nutrition: FlaskConical };
const DEPARTMENTS: { code: Department; label: string; icon: LucideIcon }[] = [
  { code: "lighting", label: "Éclairage", icon: LampDesk },
  { code: "air", label: "Extraction", icon: Fan },
  ...KQ_WAREHOUSE_OPTION_FAMILIES.map(family => ({ code: family.code, label: family.label, icon: FAMILY_ICONS[family.code] })),
  { code: "drying", label: "Séchage", icon: Wind },
  { code: "storage", label: "Stockage", icon: Package },
  { code: "workshop", label: "Machines d’atelier", icon: Wrench },
];
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const mass = (grams: number) => grams >= 1000 ? `${number(grams / 1000)} kg` : `${number(grams)} g`;
const tierOf = (product: Product) => product.option?.tier ?? product.device!.tier;

function optionPatch(zone: KqWarehouseZone, option: KqWarehouseOption): Partial<KqWarehouseZone> {
  return { optionCodes: [...(zone.optionCodes ?? []).filter(code => getKqWarehouseOption(code)?.family !== option.family), option.code] };
}

function priceProduct(product: Product, zone: KqWarehouseZone): ProductQuote {
  if (product.device && (product.device.kind === "drying" || product.device.kind === "storage")) {
    const quote = getKqWarehouseServiceZoneQuote({ id: "shop-service", name: "Zone de 1 m²", x: 0, y: 0, width: 1, height: 1, kind: product.device.kind, deviceCode: product.code });
    return { equipmentCents: quote.equipmentCostCents, equipmentPerM2: quote.equipmentCostCents, operatingPerM2: 0, harvestPerM2: null, capacityPerM2: quote.capacityGramsPerM2, quantity: quote.devices.reduce((sum, line) => sum + line.quantity, 0), zoneArea: 1 };
  }
  const candidate = { ...zone, active: true, ...(product.option ? optionPatch(zone, product.option) : product.device.kind === "lighting" ? { lightingCode: product.code } : { airCode: product.code }) };
  const quote = getKqWarehouseZoneQuote(candidate);
  const line = product.option ? quote.options.find(item => item.code === product.code)! : quote.devices.find(item => item.code === product.code)!;
  return { equipmentCents: line.totalCents, equipmentPerM2: Math.round(line.totalCents / quote.areaM2), operatingPerM2: Math.round(quote.operatingCostCents / quote.areaM2), harvestPerM2: quote.estimatedHarvestGrams / quote.areaM2, capacityPerM2: null, quantity: line.quantity, zoneArea: quote.areaM2 };
}

function benefit(product: Product, quote: ProductQuote) {
  if (product.option) return [product.option.yieldBonusPercent ? `+${product.option.yieldBonusPercent} % de récolte potentielle` : "", product.option.qualityBonus ? `+${product.option.qualityBonus} Qualité au départ` : ""].filter(Boolean).join(" · ");
  if (quote.capacityPerM2 !== null) return `${mass(quote.capacityPerM2)} de capacité par m², sans électricité.`;
  return `${number(product.device.gameCapacity.value)} m² par appareil · ${quote.quantity} nécessaire${quote.quantity > 1 ? "s" : ""}.`;
}

function tradeoff(product: Product, quote: ProductQuote) {
  if (product.option) return `+${formatKqCash(product.option.consumablesCentsPerM2)} de fournitures / m² / cycle.`;
  if (quote.capacityPerM2 !== null) return "Une zone dédiée sur le plan.";
  const spare = quote.quantity * product.device.gameCapacity.value - quote.zoneArea;
  return `${number(product.device.watts * quote.quantity)} W pour la zone.${spare > 0 ? ` ${number(spare)} m² de couverture inutilisés.` : ""}`;
}

function ProductArt({ product, index }: { product: Product; index: number }) {
  const artwork = getKqWarehouseProductArtwork(product.code);
  return <div className={styles.productArt} aria-hidden="true"><span className={styles.serial}>{String(index + 1).padStart(2, "0")}</span>{artwork && <Image src={artwork.src} alt="" width={512} height={512} sizes="(max-width: 700px) 180px, 160px" className={styles.productImage} data-warehouse-product-artwork={product.code} />}</div>;
}

function clickedBackdrop(event: MouseEvent<HTMLDialogElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
}

export function KqWarehouseShop({ open, onClose, zone, state, locked, zoneLocked = false, onChangeZone, onPlaceDevice, onOpenWorkshop }: {
  open: boolean;
  onClose: () => void;
  zone: KqWarehouseZone | null;
  state: KqWarehouseState;
  locked: boolean;
  zoneLocked?: boolean;
  onChangeZone: (patch: Partial<KqWarehouseZone>) => void;
  onPlaceDevice: (device: KqWarehouseDevice) => void;
  onOpenWorkshop: () => void;
}) {
  const id = `warehouse-shop-${useId().replaceAll(":", "")}`;
  const dialog = useRef<HTMLDialogElement>(null);
  const departments = useRef<(HTMLButtonElement | null)[]>([]);
  const content = useRef<HTMLDivElement>(null);
  const [department, setDepartment] = useState<Department>("lighting");
  const [notice, setNotice] = useState("");
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) element.showModal();
    return () => { element?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open]);

  const validZone = zone && validateKqWarehouseZones([zone]).length === 0 ? zone : null;
  const sampleZone: KqWarehouseZone = validZone ?? { id: "shop-sample", name: "Zone de 1 m²", x: 0, y: 0, width: 1, height: 1, active: true,
    lightingCode: KQ_WAREHOUSE_CATALOG.find(device => device.kind === "lighting")!.code, airCode: KQ_WAREHOUSE_CATALOG.find(device => device.kind === "air")!.code };
  const currentDepartment = DEPARTMENTS.find(item => item.code === department)!;
  const products: Product[] = KQ_WAREHOUSE_OPTION_FAMILIES.some(family => family.code === department)
    ? KQ_WAREHOUSE_OPTIONS.filter(option => option.family === department).map(option => ({ code: option.code, name: option.name, option }))
    : KQ_WAREHOUSE_CATALOG.filter(device => device.purchasable !== false && device.kind === department && (device.kind === "lighting" || device.kind === "air" || !!device.zoneLayout)).map(device => ({ code: device.code, name: device.name, device }));
  products.sort((a, b) => TIERS[tierOf(a)].order - TIERS[tierOf(b)].order);
  const selectedOption = zone?.optionCodes?.map(getKqWarehouseOption).find(option => option?.family === department);
  const services = department === "storage" || department === "drying";

  function changeDepartment(value: Department) {
    setDepartment(value); setNotice(""); content.current?.scrollTo({ top: 0, behavior: "instant" });
  }
  function navigateDepartment(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === "ArrowDown" || event.key === "ArrowRight" ? (index + 1) % DEPARTMENTS.length : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (index + DEPARTMENTS.length - 1) % DEPARTMENTS.length : event.key === "Home" ? 0 : event.key === "End" ? DEPARTMENTS.length - 1 : null;
    if (target === null) return;
    event.preventDefault(); changeDepartment(DEPARTMENTS[target].code); departments.current[target]?.focus();
  }
  function choose(product: Product) {
    if (locked) return;
    if (product.device && (product.device.kind === "drying" || product.device.kind === "storage")) { onPlaceDevice(product.device); onClose(); return; }
    if (!validZone || zoneLocked) return;
    onChangeZone(product.option ? optionPatch(validZone, product.option) : product.device.kind === "lighting" ? { lightingCode: product.code } : { airCode: product.code });
    setNotice(`${product.name} ajouté au devis.`);
  }
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") { event.stopPropagation(); return; }
    if (event.key !== "Tab") return;
    event.stopPropagation();
    const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')).filter(node => node.getClientRects().length > 0);
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
    if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
  }
  function isChosen(product: Product) {
    return product.option ? Boolean(zone?.optionCodes?.includes(product.code)) : product.device.kind === "lighting" ? zone?.lightingCode === product.code : product.device.kind === "air" ? zone?.airCode === product.code : false;
  }

  if (!open) return null;
  return <dialog ref={dialog} className={styles.dialog} data-warehouse-shop aria-labelledby={`${id}-title`} aria-describedby={`${id}-payment`} onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }} onKeyDown={trapFocus} onClick={event => { event.stopPropagation(); if (clickedBackdrop(event)) onClose(); }}>
    <header className={styles.header}><div className={styles.sign}><ShoppingBag size={26} strokeWidth={1.3} /><h2 id={`${id}-title`}>Boutique</h2></div><button type="button" className={styles.close} onClick={onClose} aria-label="Fermer la boutique"><X size={21} /></button></header>
    <div className={styles.layout}>
      <nav className={styles.departments} role="tablist" aria-label="Rayons de la boutique" aria-orientation="vertical">{DEPARTMENTS.map((item, index) => <button key={item.code} type="button" ref={node => { departments.current[index] = node; }} id={`${id}-${item.code}-tab`} role="tab" aria-controls={`${id}-products`} aria-selected={department === item.code} tabIndex={department === item.code ? 0 : -1} data-warehouse-shop-category={item.code} onClick={() => changeDepartment(item.code)} onKeyDown={event => navigateDepartment(event, index)}><item.icon size={17} /><span>{item.label}</span><ChevronRight size={12} /></button>)}</nav>
      <div className={styles.content} ref={content}>
        <section id={`${id}-products`} role="tabpanel" aria-labelledby={`${id}-${department}-tab`}>
          <div className={styles.departmentHeading}><h3>{currentDepartment.label}</h3>{department !== "workshop" && <div className={styles.zoneTag}><Warehouse size={17} /><span>{services ? "Zone à tracer" : validZone ? validZone.name : "Aperçu"}<strong>{services ? "Prix pour 1 m²" : `${sampleZone.width * sampleZone.height} m²`}</strong></span></div>}</div>
          {locked && <p className={styles.warning} role="status">Achats indisponibles pendant l’opération en cours.</p>}
          {!locked && zoneLocked && !services && department !== "workshop" && <p className={styles.warning} role="status">Cette zone est en culture. Son équipement reste figé jusqu’à la récolte.</p>}
          {!validZone && !services && department !== "workshop" && <p className={styles.warning}>{zone ? "Corrige les dimensions de la zone pour l’équiper." : "Sélectionne une zone sur le plan pour l’équiper."}</p>}
          {notice && <p className={styles.notice} role="status"><Check size={16} />{notice}</p>}
          {department === "workshop" ? <div className={styles.workshop}><Wrench size={48} strokeWidth={1.1} /><p>Choisis tes machines et leurs trois gammes à l’atelier.</p><button type="button" disabled={locked} onClick={() => { onOpenWorkshop(); onClose(); }}>Ouvrir l’atelier <ArrowRight size={16} /></button></div>
          : <>
            {(services || selectedOption) && <div className={styles.choiceHint}>{services && <span>Choisis un modèle, puis trace sa zone.</span>}{selectedOption && <button type="button" data-warehouse-shop-remove={selectedOption.family} disabled={locked || zoneLocked || !validZone} onClick={() => { onChangeZone({ optionCodes: (zone?.optionCodes ?? []).filter(code => code !== selectedOption.code) }); setNotice("Équipement retiré. Le matériel acheté reste en réserve."); }}>Retirer</button>}</div>}
            <div className={styles.products}>{products.map((product, index) => {
              const quote = priceProduct(product, sampleZone);
              const chosen = isChosen(product);
              const tier = tierOf(product);
              const owned = product.option ? state.optionInventory?.find(line => line.code === product.code)?.quantity ?? 0 : state.equipment.find(line => line.code === product.code)?.quantity ?? 0;
              return <article key={product.code} className={styles.product} data-warehouse-shop-product={product.code} data-tier={tier} data-chosen={chosen}>
                <div className={styles.tier}><span>{TIERS[tier].label}</span>{chosen && <Check size={15} aria-label="Modèle choisi" />}</div>
                <ProductArt product={product} index={index} />
                <div className={styles.productHeading}><h4>{product.name}</h4><strong data-warehouse-shop-price={quote.equipmentPerM2}>{formatKqCash(quote.equipmentPerM2)}<small> / m²</small></strong><p className={styles.zonePrice}><b data-warehouse-shop-zone-price={quote.equipmentCents}>{formatKqCash(quote.equipmentCents)}</b> pour {quote.zoneArea} m²</p></div>
                <dl className={styles.metrics}><div><dt>Charges / m² / cycle</dt><dd>{formatKqCash(quote.operatingPerM2)}</dd></div><div><dt>{quote.capacityPerM2 !== null ? "Capacité / m²" : "Récolte potentielle / m²"}</dt><dd>{mass(quote.capacityPerM2 ?? quote.harvestPerM2 ?? 0)}</dd></div></dl>
                <div className={styles.benefits}><span>Le plus</span><p>{benefit(product, quote)}</p></div><p className={styles.tradeoff}><b>À prévoir</b>{tradeoff(product, quote)}</p>
                {owned > 0 && <p className={styles.owned}><PackageCheck size={13} />{product.option ? `${owned} m² déjà financés` : `${owned} appareil${owned > 1 ? "s" : ""} déjà possédé${owned > 1 ? "s" : ""}`}</p>}
                <div className={styles.productActions}><button type="button" data-warehouse-shop-choose={product.code} disabled={locked || chosen || (!services && (!validZone || zoneLocked))} onClick={() => choose(product)}>{chosen ? <><Check size={16} />Choisi</> : services ? <>Placer <ArrowRight size={16} /></> : <>Ajouter au devis <ArrowRight size={16} /></>}</button></div>
              </article>;
            })}</div>
            <details className={styles.method}><summary>Détails du devis</summary><p>Prix du matériel neuf, hors pose et aménagement. Le devis réutilise ta réserve et calcule le montant à payer.{services ? " Le prix final dépend de la surface tracée." : " Les charges incluent tous les équipements de la zone pour un cycle."}</p><p>Prix, capacités et récoltes sont des valeurs de simulation.{products[0]?.option ? ` Bonus cumulés : maximum +${KQ_WAREHOUSE_OPTION_LIMITS.yieldBonusPercent} % de récolte et +${KQ_WAREHOUSE_OPTION_LIMITS.qualityBonus} Qualité. La qualité de départ est pondérée par les surfaces actives.` : ""}</p></details>
          </>}
        </section>
      </div>
    </div>
    <footer className={styles.footer}><span id={`${id}-payment`}>Paiement à la validation du devis.</span><button type="button" onClick={onClose}>Retour à l’entrepôt <ArrowRight size={16} /></button></footer>
  </dialog>;
}
