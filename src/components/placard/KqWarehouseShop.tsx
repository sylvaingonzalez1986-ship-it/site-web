"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowRight, Check, ChevronRight, Droplets, Fan, FlaskConical, Flower2, LampDesk, Package, PackageCheck, Shield, ShoppingBag, SlidersHorizontal, Sparkles, Thermometer, Warehouse, Wind, Wrench, X, type LucideIcon } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_WAREHOUSE_CATALOG, type KqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseEquipmentDemand, getKqWarehouseOptionDemand, getKqWarehouseServiceZoneQuote, getKqWarehouseZoneQuote, validateKqWarehouseZones, type KqWarehouseState, type KqWarehouseZone } from "@/lib/kanab-quest-warehouse";
import { type KqWarehouseCondition } from "@/lib/kanab-quest-warehouse-condition";
import { getKqWarehouseReusePreview, type KqWarehouseReusePreview } from "@/lib/kanab-quest-warehouse-reuse";
import { getKqWarehouseShopTarget, type KqWarehouseDepartment } from "@/lib/kanab-quest-warehouse-shop-target";
import { KQ_WAREHOUSE_OPTIONS, KQ_WAREHOUSE_OPTION_FAMILIES, KQ_WAREHOUSE_OPTION_LIMITS, getKqWarehouseOption, type KqWarehouseOption, type KqWarehouseOptionFamily } from "@/lib/kanab-quest-warehouse-options";
import { getKqWarehouseProductArtwork } from "@/lib/kanab-quest-warehouse-product-artwork";
import styles from "./KqWarehouseShop.module.css";

type Department = KqWarehouseDepartment;
type Product = { code: string; name: string; device: KqWarehouseDevice; option?: never } | { code: string; name: string; option: KqWarehouseOption; device?: never };
type ProductQuote = { equipmentCents: number; equipmentPerM2: number; operatingPerM2: number; harvestPerM2: number | null; harvestBasis: "tracked" | "new" | "unknown"; capacityPerM2: number | null; qualityBonus: number | null; yieldBonusPercent: number | null; quantity: number; zoneArea: number; reuse?: KqWarehouseReusePreview | null };
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
const quantityLabel = (quantity: number, isModule: boolean) => `${number(quantity)} ${isModule ? "m²" : `appareil${quantity > 1 ? "s" : ""}`}`;
const originLabels = { kept: "Conservés sur place", reused: "Réutilisés", new: "À acheter neufs" } as const;

function ReuseDetails({ reuse, product }: { reuse: KqWarehouseReusePreview; product: Product }) {
  const existing = reuse.groups.filter(group => group.origin !== "new");
  const wears = existing.flatMap(group => group.wearPercent === null ? [] : [group.wearPercent]);
  const low = Math.min(...wears), high = Math.max(...wears);
  const stateLabel = existing.some(group => group.wearPercent === null) ? "Usure inconnue"
    : !existing.length ? "Matériel neuf" : low === high ? `Usure ${number(low)} %` : `Usure de ${number(low)} à ${number(high)} %`;
  return <details className={styles.reuseDetails} data-warehouse-shop-condition={product.code}>
    <summary>État du matériel prévu <span>{stateLabel}</span></summary>
    <ul>{reuse.groups.map(group => <li key={`${group.origin}-${group.wearPercent}`}>
      <span>{originLabels[group.origin]} · {quantityLabel(group.quantity, !!product.option)}</span>
      <strong>{group.wearPercent === null ? "Usure inconnue" : `Usure ${number(group.wearPercent)} %`}</strong>
    </li>)}</ul>
    <p>Le matériel conservé ou réutilisé garde son usure. Il peut venir de la réserve ou d’une autre zone modifiée dans le devis.</p>
    {reuse.planPurchaseQuantity !== reuse.newQuantity && <p>Achats de ce modèle dans le plan entier : {quantityLabel(reuse.planPurchaseQuantity, !!product.option)} · {formatKqCash(reuse.planPurchaseCents)}, hors pose.</p>}
  </details>;
}

function optionPatch(zone: KqWarehouseZone, option: KqWarehouseOption): Partial<KqWarehouseZone> {
  return { optionCodes: [...(zone.optionCodes ?? []).filter(code => getKqWarehouseOption(code)?.family !== option.family), option.code] };
}

function priceProduct(product: Product, zone: KqWarehouseZone, context: { state: KqWarehouseState; installedState?: KqWarehouseState; condition?: KqWarehouseCondition }): ProductQuote {
  if (product.device && (product.device.kind === "drying" || product.device.kind === "storage")) {
    const quote = getKqWarehouseServiceZoneQuote({ id: "shop-service", name: "Zone de 1 m²", x: 0, y: 0, width: 1, height: 1, kind: product.device.kind, deviceCode: product.code });
    return { equipmentCents: quote.equipmentCostCents, equipmentPerM2: quote.equipmentCostCents, operatingPerM2: 0, harvestPerM2: null, harvestBasis: "unknown", capacityPerM2: quote.capacityGramsPerM2, qualityBonus: null, yieldBonusPercent: null, quantity: quote.devices.reduce((sum, line) => sum + line.quantity, 0), zoneArea: 1 };
  }
  const candidate = { ...zone, active: true, ...(product.option ? optionPatch(zone, product.option) : product.device.kind === "lighting" ? { lightingCode: product.code } : { airCode: product.code }) };
  let reuse: KqWarehouseReusePreview | null = null;
  if (context.installedState && context.state.zones.some(item => item.id === zone.id)) {
    const candidateState = { ...context.state, zones: context.state.zones.map(item => item.id === zone.id ? candidate : item) };
    reuse = getKqWarehouseReusePreview(context.installedState, candidateState, zone.id, product.option ? "option" : "device", product.code, context.condition);
  }
  const projectedCondition = reuse?.condition;
  const harvestBasis = projectedCondition ? "tracked" : context.condition ? "unknown" : "new";
  const quote = getKqWarehouseZoneQuote(candidate, 2, projectedCondition);
  const line = product.option ? quote.options.find(item => item.code === product.code)! : quote.devices.find(item => item.code === product.code)!;
  return { equipmentCents: line.totalCents, equipmentPerM2: Math.round(line.totalCents / quote.areaM2), operatingPerM2: Math.round(quote.operatingCostCents / quote.areaM2), harvestPerM2: harvestBasis === "unknown" ? null : quote.estimatedHarvestGrams / quote.areaM2, harvestBasis, capacityPerM2: null, qualityBonus: quote.qualityBonus, yieldBonusPercent: quote.yieldBonusPercent, quantity: line.quantity, zoneArea: quote.areaM2, reuse };
}

function benefitsComparedWithEconomy(quote: ProductQuote, economy: ProductQuote): string[] {
  if (quote.capacityPerM2 !== null && economy.capacityPerM2 !== null) {
    return [`×${number(quote.capacityPerM2 / economy.capacityPerM2)} de capacité par m²`];
  }
  const qualityGain = (quote.qualityBonus ?? 0) - (economy.qualityBonus ?? 0);
  const harvestGain = quote.harvestPerM2 !== null && economy.harvestPerM2 !== null ? quote.harvestPerM2 - economy.harvestPerM2 : 0;
  const savings = economy.operatingPerM2 - quote.operatingPerM2;
  return [
    ...(qualityGain > 0 ? [`+${qualityGain} point${qualityGain > 1 ? "s" : ""} de qualité au départ`] : []),
    ...(harvestGain > 0 ? [`+${mass(harvestGain)} de récolte potentielle / m²`] : []),
    ...(savings > 0 ? [`−${formatKqCash(savings)} de charges / m² / cycle`] : []),
  ];
}

function tradeoff(product: Product, quote: ProductQuote) {
  if (product.option) return `+${formatKqCash(product.option.consumablesCentsPerM2)} de fournitures / m² / cycle.`;
  if (quote.capacityPerM2 !== null) return product.device.kind === "drying" ? "Zone dédiée. Même durée de séchage pour les trois gammes." : `${product.device.specification} Un contenant entamé reste réservé à son lot.`;
  const spare = quote.quantity * product.device.gameCapacity.value - quote.zoneArea;
  return `${number(product.device.gameCapacity.value)} m² couverts par appareil · ${number(product.device.watts * quote.quantity)} W pour la zone.${spare > 0 ? ` Dont ${number(spare)} m² de couverture inutilisés.` : ""}`;
}

function ProductArt({ product, index }: { product: Product; index: number }) {
  const artwork = getKqWarehouseProductArtwork(product.code);
  return <div className={styles.productArt} aria-hidden="true"><span className={styles.serial}>{String(index + 1).padStart(2, "0")}</span>{artwork && <Image src={artwork.src} alt="" width={512} height={512} sizes="(max-width: 700px) 180px, 160px" className={styles.productImage} data-warehouse-product-artwork={product.code} />}</div>;
}

function clickedBackdrop(event: MouseEvent<HTMLDialogElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
}

export function KqWarehouseShop({ open, onClose, zone, state, installedState, condition, initialDepartment = "lighting", initialEquipmentCode, locked, zoneLocked = false, onChangeZone, onPlaceDevice, onOpenWorkshop, planReview }: {
  open: boolean;
  onClose: () => void;
  zone: KqWarehouseZone | null;
  state: KqWarehouseState;
  installedState?: KqWarehouseState;
  condition?: KqWarehouseCondition;
  initialDepartment?: Department;
  initialEquipmentCode?: string | null;
  locked: boolean;
  zoneLocked?: boolean;
  onChangeZone: (patch: Partial<KqWarehouseZone>) => void;
  onPlaceDevice: (device: KqWarehouseDevice) => void;
  onOpenWorkshop: () => void;
  planReview?: { payableCents: number | null; onOpen: () => void };
}) {
  const id = `warehouse-shop-${useId().replaceAll(":", "")}`;
  const dialog = useRef<HTMLDialogElement>(null);
  const departments = useRef<(HTMLButtonElement | null)[]>([]);
  const content = useRef<HTMLDivElement>(null);
  const target = getKqWarehouseShopTarget(initialEquipmentCode);
  const targetedCode = target?.kind === "catalog" ? target.code : undefined;
  const [department, setDepartment] = useState<Department>(() => target?.kind === "catalog" ? target.department : initialDepartment);
  const [notice, setNotice] = useState("");
  const installedQuantities = useMemo(() => {
    if (!installedState) return null;
    try {
      return { devices: new Map(getKqWarehouseEquipmentDemand(installedState.zones, installedState.serviceZones, installedState.storageClimateCode).map(item => [item.code, item.quantity])),
        options: new Map(getKqWarehouseOptionDemand(installedState.zones).map(item => [item.code, item.quantity])) };
    } catch { return null; }
  }, [installedState]);
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) element.showModal();
    const frame = requestAnimationFrame(() => {
      if (!targetedCode) return;
      const product = element?.querySelector<HTMLElement>(`[data-warehouse-shop-product="${CSS.escape(targetedCode)}"]`);
      product?.scrollIntoView({ block: "start", behavior: "instant" });
      product?.focus({ preventScroll: true });
    });
    return () => { cancelAnimationFrame(frame); element?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open, targetedCode]);

  const validZone = zone && validateKqWarehouseZones([zone]).length === 0 ? zone : null;
  const sampleZone: KqWarehouseZone = validZone ?? { id: "shop-sample", name: "Zone de 1 m²", x: 0, y: 0, width: 1, height: 1, active: true,
    lightingCode: KQ_WAREHOUSE_CATALOG.find(device => device.kind === "lighting")!.code, airCode: KQ_WAREHOUSE_CATALOG.find(device => device.kind === "air")!.code };
  const currentDepartment = DEPARTMENTS.find(item => item.code === department)!;
  const products: Product[] = KQ_WAREHOUSE_OPTION_FAMILIES.some(family => family.code === department)
    ? KQ_WAREHOUSE_OPTIONS.filter(option => option.family === department).map(option => ({ code: option.code, name: option.name, option }))
    : KQ_WAREHOUSE_CATALOG.filter(device => device.purchasable !== false && device.kind === department && (device.kind === "lighting" || device.kind === "air" || !!device.zoneLayout)).map(device => ({ code: device.code, name: device.name, device }));
  products.sort((a, b) => TIERS[tierOf(a)].order - TIERS[tierOf(b)].order);
  const offers = products.map(product => ({ product, quote: priceProduct(product, sampleZone, { state, installedState, condition }) }));
  const economyQuote = offers.find(({ product }) => tierOf(product) === "economy")?.quote;
  const selectedOption = zone?.optionCodes?.map(code => getKqWarehouseOption(code)).find(option => option?.family === department);
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
          {target?.kind === "unavailable" && <p className={styles.warning} role="status" data-warehouse-target-unavailable>Le modèle demandé{target.name ? ` « ${target.name} »` : ""} n’est pas proposé dans ce catalogue. Compare les équipements actuels dans les rayons ; aucun modèle n’a été ajouté au devis.</p>}
          {locked && <p className={styles.warning} role="status">Achats indisponibles pendant l’opération en cours.</p>}
          {!locked && zoneLocked && !services && department !== "workshop" && <p className={styles.warning} role="status">Cette zone est en culture. Son équipement reste figé jusqu’à la récolte.</p>}
          {!validZone && !services && department !== "workshop" && <p className={styles.warning}>{zone ? "Corrige les dimensions de la zone pour l’équiper." : "Sélectionne une zone sur le plan pour l’équiper."}</p>}
          {notice && <p className={styles.notice} role="status"><Check size={16} />{notice}</p>}
          {department === "workshop" ? <div className={styles.workshop}><Wrench size={48} strokeWidth={1.1} /><p>Choisis tes machines et leurs trois gammes à l’atelier.</p><button type="button" disabled={locked} onClick={() => { onOpenWorkshop(); onClose(); }}>Ouvrir l’atelier <ArrowRight size={16} /></button></div>
          : <>
            {(services || selectedOption) && <div className={styles.choiceHint}>{services && <span>Choisis un modèle, puis trace sa zone.</span>}{selectedOption && <button type="button" data-warehouse-shop-remove={selectedOption.family} disabled={locked || zoneLocked || !validZone} onClick={() => { onChangeZone({ optionCodes: (zone?.optionCodes ?? []).filter(code => code !== selectedOption.code) }); setNotice("Équipement retiré. Le matériel acheté reste en réserve."); }}>Retirer</button>}</div>}
            <p className={styles.comparisonHint}>{services ? "Compare la capacité et le prix pour 1 m²." : "Compare le matériel pour cette zone."} Le devis final regroupe tous les équipements, la pose et l’aménagement.</p>
            <div className={styles.products}>{offers.map(({ product, quote }, index) => {
              const chosen = isChosen(product);
              const tier = tierOf(product);
              const owned = installedState ? (product.option ? installedState.optionInventory?.find(line => line.code === product.code)?.quantity : installedState.equipment.find(line => line.code === product.code)?.quantity) ?? 0 : null;
              const installed = installedQuantities && (!services || installedState?.serviceZones !== undefined) ? (product.option ? installedQuantities.options : installedQuantities.devices).get(product.code) ?? 0 : null;
              const inventory = owned !== null && installed !== null && owned >= installed ? { installed, reserve: owned - installed } : null;
              const gains = economyQuote ? benefitsComparedWithEconomy(quote, economyQuote) : [];
              const extraCharges = economyQuote ? quote.operatingPerM2 - economyQuote.operatingPerM2 : 0;
              return <article key={product.code} tabIndex={-1} className={styles.product} data-warehouse-shop-product={product.code} data-tier={tier} data-chosen={chosen} data-targeted={targetedCode === product.code || undefined}>
                <div className={styles.tier}><span>{TIERS[tier].label}</span>{chosen && <Check size={15} aria-label="Modèle choisi" />}</div>
                <ProductArt product={product} index={index} />
                <div className={styles.productHeading}><h4>{product.name}</h4>
                  {quote.reuse && <>
                    <span className={styles.priceLabel}>Achat neuf pour cette zone · hors pose</span>
                    <strong data-warehouse-shop-new-cost={quote.reuse.newCostCents}>{formatKqCash(quote.reuse.newCostCents)}</strong>
                    <dl className={styles.reuse} data-warehouse-shop-reuse={product.code} data-kept={quote.reuse.keptQuantity} data-reused={quote.reuse.reusedQuantity} data-new={quote.reuse.newQuantity} aria-label="Pour cette zone">
                      {quote.reuse.keptQuantity > 0 && <div><dt>Conservés sur place</dt><dd>{quantityLabel(quote.reuse.keptQuantity, !!product.option)}</dd></div>}
                      {quote.reuse.reusedQuantity > 0 && <div><dt>Réutilisés</dt><dd>{quantityLabel(quote.reuse.reusedQuantity, !!product.option)}</dd></div>}
                      <div><dt>À acheter neufs</dt><dd>{quantityLabel(quote.reuse.newQuantity, !!product.option)}</dd></div>
                    </dl>
                  </>}
                  {quote.reuse ? <details className={styles.referencePrice}><summary>Prix neuf de référence</summary>
                    <span className={styles.priceLabel}>Si tout était acheté neuf · hors pose</span>
                    <strong data-warehouse-shop-price={quote.equipmentPerM2}>{formatKqCash(quote.equipmentPerM2)}<small> / m²</small></strong>
                    <p className={styles.zonePrice}><b data-warehouse-shop-zone-price={quote.equipmentCents}>{formatKqCash(quote.equipmentCents)}</b> pour {quote.zoneArea} m²</p>
                    {product.device && <p className={styles.unitPrice}>{quote.quantity} appareil{quote.quantity > 1 ? "s" : ""} × {formatKqCash(product.device.priceCents)} / unité</p>}
                  </details> : <>
                    <span className={styles.priceLabel}>Prix neuf · hors pose</span><strong data-warehouse-shop-price={quote.equipmentPerM2}>{formatKqCash(quote.equipmentPerM2)}<small> / m²</small></strong>
                    <p className={styles.zonePrice}><b data-warehouse-shop-zone-price={quote.equipmentCents}>{formatKqCash(quote.equipmentCents)}</b> pour {quote.zoneArea} m²</p>
                    {product.device && <p className={styles.unitPrice}>{quote.quantity} appareil{quote.quantity > 1 ? "s" : ""} × {formatKqCash(product.device.priceCents)} / unité</p>}
                  </>}
                </div>
                <dl className={styles.metrics} aria-label={services ? "Capacité et coûts" : "Résultat pour cette zone"}>
                  <div><dt>{quote.capacityPerM2 !== null ? "Capacité / m²" : quote.harvestBasis === "new" ? "Récolte avec du matériel neuf / m²" : "Récolte potentielle / m²"}{quote.yieldBonusPercent !== null && <small>{quote.harvestBasis === "tracked" ? "Usure de ton matériel prise en compte" : quote.harvestBasis === "unknown" ? "Vérifie le plan pour l’estimer" : `Bonus de rendement : +${quote.yieldBonusPercent} %`}</small>}</dt><dd data-warehouse-shop-harvest={quote.harvestPerM2 ?? undefined} data-warehouse-shop-capacity={quote.capacityPerM2 ?? undefined}>{quote.capacityPerM2 !== null ? mass(quote.capacityPerM2) : quote.harvestPerM2 !== null ? mass(quote.harvestPerM2) : "—"}</dd></div>
                  {quote.qualityBonus !== null && <div className={styles.quality}><dt>Qualité au départ</dt><dd data-warehouse-shop-quality={quote.qualityBonus}>+{quote.qualityBonus} pts</dd></div>}
                  <div><dt>{services ? "Électricité / cycle" : "Charges de la zone / m² / cycle"}</dt><dd data-warehouse-shop-operating={quote.operatingPerM2}>{formatKqCash(quote.operatingPerM2)}</dd></div>
                  {quote.capacityPerM2 !== null && quote.capacityPerM2 > 0 && <div><dt>Achat / kg de capacité</dt><dd>{formatKqCash(Math.round(quote.equipmentPerM2 * 1000 / quote.capacityPerM2))}</dd></div>}
                </dl>
                <div className={styles.benefits} data-warehouse-shop-benefits>{tier === "economy" ? <><span>Le point de départ</span><p>La référence pour comparer les gains des autres gammes.</p></> : <><span>Face à l’économique</span>{gains.length > 0 ? <ul>{gains.map(gain => <li key={gain}>{gain}</li>)}</ul> : <p>Bonus déjà plafonnés avec les autres modules de cette zone.</p>}</>}</div><p className={styles.tradeoff}><b>À prévoir</b>{tradeoff(product, quote)}{extraCharges > 0 && <span className={styles.extraCharges}>Charges de la zone : +{formatKqCash(extraCharges)} / m² / cycle face à l’économique.</span>}</p>
                {owned !== null && owned > 0 && <p className={styles.owned} data-warehouse-shop-owned={product.code}><PackageCheck size={13} />{inventory ? product.option ? `${inventory.installed} m² installés · ${inventory.reserve} m² en réserve` : `${inventory.installed} installé${inventory.installed > 1 ? "s" : ""} · ${inventory.reserve} en réserve` : product.option ? `${owned} m² déjà financés` : `${owned} appareil${owned > 1 ? "s" : ""} possédé${owned > 1 ? "s" : ""}`}</p>}
                {quote.reuse && <ReuseDetails reuse={quote.reuse} product={product} />}
                <div className={styles.productActions}><button type="button" data-warehouse-shop-choose={product.code} disabled={locked || chosen || (!services && (!validZone || zoneLocked))} onClick={() => choose(product)}>{chosen ? <><Check size={16} />Choisi</> : services ? <>Placer <ArrowRight size={16} /></> : <>Ajouter au devis <ArrowRight size={16} /></>}</button></div>
              </article>;
            })}</div>
            <details className={styles.method} data-warehouse-quote-details><summary>Détails du devis</summary><p>{services ? "Le prix neuf de référence est affiché pour 1 m², hors pose et aménagement. Ta réserve sera réutilisée selon la surface tracée." : "Les achats affichés pour cette zone concernent ce modèle, hors pose et aménagement."} Le devis final regroupe les achats de toutes les zones et les frais de pose, puis déduit les crédits éventuels.{!services && " La répartition du matériel tient compte de toutes tes modifications. Les charges incluent tous les équipements de la zone pour un cycle. Les appareils s’achètent entiers : un grand modèle peut consommer davantage dans une petite zone."}</p><p>Prix, capacités et récoltes sont des valeurs de simulation.{!services ? ` Bonus des modules : maximum +${KQ_WAREHOUSE_OPTION_LIMITS.yieldBonusPercent} % de récolte et +${KQ_WAREHOUSE_OPTION_LIMITS.qualityBonus} points de qualité, auxquels s’ajoute la qualité de l’éclairage et de l’extraction. Les chiffres affichés tiennent compte des plafonds. La qualité au départ améliore les conditions de la culture ; la récolte finale dépend aussi de tes soins.` : ""}</p></details>
          </>}
        </section>
      </div>
    </div>
    <footer className={styles.footer}>
      <span id={`${id}-payment`}>{planReview ? <>Devis du plan : <strong data-warehouse-shop-plan-payable={planReview.payableCents ?? undefined}>{planReview.payableCents === null ? "À calculer" : formatKqCash(planReview.payableCents)}</strong></> : "Paiement à la validation du devis."}</span>
      <button type="button" data-warehouse-shop-review={planReview ? true : undefined} onClick={planReview?.onOpen ?? onClose}>{planReview ? "Voir le devis" : "Retour à l’entrepôt"}<ArrowRight size={16} /></button>
    </footer>
  </dialog>;
}
