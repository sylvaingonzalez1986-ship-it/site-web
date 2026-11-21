"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowRight, Droplets, Fan, FlaskConical, Flower2, LampDesk, Package, Shield, SlidersHorizontal, Sparkles, Thermometer, Wind, Wrench, X, type LucideIcon } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_WAREHOUSE_CATALOG, KQ_WAREHOUSE_TIERS, getKqWarehouseDeviceQualityBonus, type KqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { KQ_STORAGE_CLIMATE_KWH_PER_M2_MONTH, KQ_WAREHOUSE_SIMULATION, getKqWarehouseEquipmentDemand, getKqWarehouseOptionDemand, validateKqWarehouseState, type KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { getKqWarehouseShopTarget, type KqWarehouseDepartment } from "@/lib/kanab-quest-warehouse-shop-target";
import { KQ_WAREHOUSE_OPTIONS, KQ_WAREHOUSE_OPTION_FAMILIES, getKqWarehouseOption, getKqWarehouseZoneModuleEffect, isKqWarehouseLegacyZoneOption, isKqWarehouseZoneDevice, type KqWarehouseHandlingCartConversion, type KqWarehouseOption, type KqWarehouseOptionFamily } from "@/lib/kanab-quest-warehouse-options";
import { getKqTrimTimeFactor, getKqWarehouseHandlingSaving, hasKqWarehouseHandling, isKqWarehouseHandlingCode, KQ_WAREHOUSE_HANDLING, KQ_WAREHOUSE_HANDLING_CART, type KqWarehouseHandling } from "@/lib/kanab-quest-warehouse-handling";
import { getKqWarehouseProductArtwork } from "@/lib/kanab-quest-warehouse-product-artwork";
import { isKqWarehouseStationCode, KQ_WAREHOUSE_STATIONS } from "@/lib/kanab-quest-warehouse-stations";
import { KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT } from "@/lib/kanab-quest-warehouse-preparations";
import { getKqWarehouseAirRange } from "@/lib/kanab-quest-warehouse-air";
import { KqChapterHeading } from "./KqChapterHeading";
import styles from "./KqWarehouseShop.module.css";
import { KqWarehouseSupplies } from "./KqWarehouseSupplies";
import KqWarehouseSecurity from "./KqWarehouseSecurity";

type Product = KqWarehouseDevice | KqWarehouseOption;
const FAMILY_ICONS: Record<KqWarehouseOptionFamily, LucideIcon> = {
  water: Droplets, climate: Thermometer, control: SlidersHorizontal, hygiene: Sparkles, logistics: Package,
  security: Shield, substrate: Flower2, nutrition: FlaskConical,
};
const DEPARTMENTS: { code: KqWarehouseDepartment; label: string; icon: LucideIcon }[] = [
  { code: "substrate", label: "Support", icon: Flower2 },
  { code: "lighting", label: "Éclairage", icon: LampDesk },
  { code: "air", label: "Extraction", icon: Fan },
  ...KQ_WAREHOUSE_OPTION_FAMILIES.filter(family => family.code !== "substrate").map(family =>
    ({ code: family.code, label: family.code === "nutrition" ? "Intrants et provisions" : family.code === "hygiene" ? "Nettoyage" : family.label, icon: FAMILY_ICONS[family.code] })),
  { code: "drying", label: "Séchage", icon: Wind },
  { code: "storage", label: "Stockage", icon: Package },
  { code: "workshop", label: "Machines d’atelier", icon: Wrench },
];
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const mass = (grams: number) => grams >= 1000 ? `${number(grams / 1000)} kg` : `${number(grams)} g`;

function getReserve(state: KqWarehouseState, owned: KqWarehouseState | undefined) {
  if (!owned || validateKqWarehouseState(state).length) return null;
  const devices = getKqWarehouseEquipmentDemand(state.zones, state.serviceZones, state.storageClimateCode, state.airPlacements);
  const options = getKqWarehouseOptionDemand(state.zones, state.stationPlacements);
  const installed = new Map([...devices, ...options].map(item => [item.code, item.quantity]));
  return new Map([...owned.equipment, ...(owned.optionInventory ?? [])]
    .map(item => [item.code, Math.max(0, item.quantity - (installed.get(item.code) ?? 0))]));
}

function ProductMetrics({ product, modern, handling, owned }: { product: Product; modern: boolean; handling: KqWarehouseHandling; owned: boolean }) {
  if (isKqWarehouseHandlingCode(product.code)) {
    const code = product.code, item = KQ_WAREHOUSE_HANDLING[code], wear = handling[code];
    const without = { ...handling, [code]: undefined };
    const withItem = { ...handling, [code]: wear ?? 0 };
    const cart = code === KQ_WAREHOUSE_HANDLING_CART;
    const before = cart ? 5 : 10 * getKqTrimTimeFactor("manual", without);
    const after = cart ? before * (1 - getKqWarehouseHandlingSaving(code, withItem[code])) : 10 * getKqTrimTimeFactor("manual", withItem);
    const canEstimate = !owned || wear !== undefined;
    return <dl className={styles.metrics}>
      <div><dt>{item.operation}</dt><dd>Jusqu’à −{number(item.saving * 100)} %</dd></div>
      {canEstimate && <div><dt>{cart ? "Une charge · chargement estimé" : "60 g · trim manuel estimé au niv. 1"}</dt><dd>{number(before)} → {number(after)} min réelles</dd></div>}
      {canEstimate && code === "SIM-LOGISTICS-01" && <div><dt>60 g · trim machine estimé au niv. 1</dt>
        <dd>{number(2.5 * getKqTrimTimeFactor("machine", without))} → {number(2.5 * getKqTrimTimeFactor("machine", withItem))} min réelles</dd></div>}
      {owned && <div><dt>Usure</dt><dd>{wear === undefined ? "À vérifier" : `${number(wear)} %`}</dd></div>}
    </dl>;
  }

  if (isKqWarehouseStationCode(product.code)) {
    const station = KQ_WAREHOUSE_STATIONS[product.code];
    if (station.code === "SIM-HYGIENE-03") return <dl className={styles.metrics}>
      <div><dt>Emplacement</dt><dd>Entrée du bâtiment · 1 m²</dd></div>
      <div><dt>Zone protégée</dt><dd>Tout l’entrepôt</dd></div>
      <div><dt>Risques d’infection, de ravageurs et de virus</dt><dd>−{KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT} %</dd></div>
    </dl>;
    return <dl className={styles.metrics}>
      <div><dt>Emprise au sol</dt><dd>1 m²</dd></div>
      <div><dt>Portée sur la grille</dt><dd>{station.rangeM} m</dd></div>
      <div><dt>Surface desservie</dt><dd>Jusqu’à {station.capacityM2} m²</dd></div>
      <div><dt>Volume préparé par zone</dt><dd>1 dose / m² servi</dd></div>
      <div><dt>Validité du mélange</dt><dd>7 jours de jeu</dd></div>
    </dl>;
  }

  if ("family" in product) {
    const effect = getKqWarehouseZoneModuleEffect(product, modern);
    return <dl className={styles.metrics}>
      {isKqWarehouseZoneDevice(product) && <div><dt>Surface de jeu par appareil</dt><dd>Jusqu’à {product.capacityM2} m²</dd></div>}
      {effect.yieldBonusPercent > 0 && <div><dt>Récolte potentielle</dt><dd>+{effect.yieldBonusPercent} %</dd></div>}
      {effect.qualityBonus > 0 && <div><dt>Qualité au départ</dt><dd>+{effect.qualityBonus} {effect.qualityBonus === 1 ? "pt" : "pts"}</dd></div>}
      <div><dt>Fournitures / m² / cycle</dt><dd>{formatKqCash(product.consumablesCentsPerM2)}</dd></div>
      {effect.supplySavingCentsPerM2 > 0 && <div><dt>Économie sur les fournitures de base / m² / cycle</dt><dd>{formatKqCash(effect.supplySavingCentsPerM2)}</dd></div>}
    </dl>;
  }

  if (product.kind === "climate") return <dl className={styles.metrics}>
    <div><dt>Électricité / m² / mois de jeu</dt><dd>{formatKqCash(KQ_STORAGE_CLIMATE_KWH_PER_M2_MONTH[product.code] * KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh)}</dd></div>
  </dl>;

  const quality = getKqWarehouseDeviceQualityBonus(product.code);
  return <dl className={styles.metrics}>
    {product.zoneLayout
      ? <div><dt>Capacité par unité</dt><dd>{mass(product.zoneLayout.capacityGramsPerUnit)}</dd></div>
      : <div><dt>{product.kind === "lighting" ? "Surface par lampe" : "Surface maximale"}</dt><dd>{number(product.gameCapacity.value)} m²</dd></div>}
    {product.kind === "air" && <div><dt>Portée</dt><dd>{getKqWarehouseAirRange(product.gameCapacity.value)} m</dd></div>}
    {quality > 0 && <div><dt>Qualité au départ</dt><dd>+{quality} pts</dd></div>}
    {(product.kind === "lighting" || product.kind === "air") && <div><dt>Puissance en service</dt><dd>{number(product.watts)} W</dd></div>}
    {product.zoneLayout && <div><dt>Unités par m² aménagé</dt><dd>{product.zoneLayout.unitsPerM2}</dd></div>}
  </dl>;
}

function clickedBackdrop(event: MouseEvent<HTMLDialogElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
}

export function KqWarehouseShop({
  open, onClose, state, installedState, handlingCartConversion, handling, initialDepartment = "substrate", initialEquipmentCode, locked,
  cashCents, migrationCreditCents, onChooseProduct, onOpenWorkshop, planReview, onPaid,
}: {
  open: boolean;
  onClose: () => void;
  state: KqWarehouseState;
  installedState?: KqWarehouseState;
  handlingCartConversion?: KqWarehouseHandlingCartConversion;
  handling: KqWarehouseHandling;
  initialDepartment?: KqWarehouseDepartment;
  initialEquipmentCode?: string | null;
  locked: boolean;
  cashCents: number;
  migrationCreditCents: number;
  onChooseProduct: (code: string) => void;
  onOpenWorkshop: () => void;
  onPaid?: (cashCents: number) => void;
  planReview?: { payableCents: number | null; onOpen: () => void };
}) {
  const id = `warehouse-shop-${useId()}`;
  const dialog = useRef<HTMLDialogElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const content = useRef<HTMLElement>(null);
  const [cameraPlacement, setCameraPlacement] = useState(false);
  const target = getKqWarehouseShopTarget(initialEquipmentCode);
  const targetedCode = target?.kind === "catalog" || target?.kind === "storage-climate" ? target.code : undefined;
  const [department, setDepartment] = useState<KqWarehouseDepartment>(() => target?.kind === "catalog" ? target.department
    : target?.kind === "storage-climate" ? "storage" : initialDepartment);
  const reserve = useMemo(() => open ? getReserve(state, installedState) : null, [open, state, installedState]);
  const payable = planReview ? planReview.payableCents : 0;
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
    return () => {
      cancelAnimationFrame(frame);
      element?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, targetedCode]);

  const zoneDevices = department === "climate" || department === "control";
  const legacyReserve = zoneDevices ? [...(reserve ?? [])].filter(([code, quantity]) =>
    quantity > 0 && isKqWarehouseLegacyZoneOption(code) && getKqWarehouseOption(code)?.family === department) : [];
  const products: Product[] = [
    ...KQ_WAREHOUSE_OPTIONS.filter(option => option.family === department && option.family !== "security" && option.family !== "nutrition"
      && (option.family !== "hygiene" || isKqWarehouseStationCode(option.code))),
    ...KQ_WAREHOUSE_CATALOG.filter(device => device.purchasable !== false
      && (device.kind === department && (device.kind === "lighting" || device.kind === "air" || !!device.zoneLayout)
        || department === "storage" && device.kind === "climate" && device.room === "storage")),
  ];

  function changeDepartment(value: KqWarehouseDepartment) {
    setDepartment(value);
    content.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = DEPARTMENTS.length;
    const next = event.key === "ArrowDown" || event.key === "ArrowRight" ? (index + 1) % count
      : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (index + count - 1) % count
      : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : null;
    if (next === null) return;
    event.preventDefault();
    changeDepartment(DEPARTMENTS[next].code);
    tabs.current[next]?.focus();
  }

  return <dialog ref={dialog} className={styles.dialog} data-warehouse-shop aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (clickedBackdrop(event)) onClose(); }}>
    <div className={styles.header}>
      <KqChapterHeading title={cameraPlacement ? "Plan de l’entrepôt" : "Aménager"} titleId={`${id}-title`} compact />
      <button type="button" className={styles.close} aria-label="Fermer le catalogue" onClick={onClose}><X size={22} /></button>
    </div>
    <div className={styles.layout} data-camera-placement={cameraPlacement || undefined}>
      {!cameraPlacement && <div role="tablist" aria-label="Rayons" className={styles.departments}>
        {DEPARTMENTS.map(({ code, label, icon: Icon }, index) => <button key={code} type="button" role="tab"
          ref={element => { tabs.current[index] = element; }} id={`${id}-${code}`} aria-controls={`${id}-products`}
          aria-selected={code === department} tabIndex={code === department ? 0 : -1} data-warehouse-shop-category={code}
          data-sylvain-target={code !== department && (code === "lighting" && state.zones.length > 0 || code === "substrate") ? code === "lighting" ? "install-lighting" : "install-support" : undefined}
          onClick={() => changeDepartment(code)} onKeyDown={event => navigate(event, index)}>
          <Icon size={17} aria-hidden="true" />{label}
        </button>)}
      </div>}
      <section ref={content} className={styles.content} role={cameraPlacement ? undefined : "tabpanel"} id={`${id}-products`} aria-labelledby={cameraPlacement ? undefined : `${id}-${department}`}>
        {open && (department === "nutrition" || department === "hygiene" || department === "water") && <KqWarehouseSupplies section={department} initialCode={targetedCode} layout={installedState} onPaid={onPaid} />}
        {open && department === "security" && <KqWarehouseSecurity onChanged={onPaid} onPlacementChange={setCameraPlacement} />}
        {zoneDevices && <details className={styles.fittingCosts}><summary>Comment se calcule le devis ?</summary>
          <p>Choisis une zone sur le plan. Le devis compte les appareils entiers nécessaires à sa surface et utilise d’abord la réserve. La préparation du sol coûte {formatKqCash(KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2)}/m² supplémentaire à aménager.</p>
        </details>}
        {products.length > 0 && !zoneDevices && department !== "logistics" && department !== "hygiene" && <details className={styles.fittingCosts}><summary>Préparation du sol · {formatKqCash(KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2)}/m² neuf · pose {KQ_WAREHOUSE_SIMULATION.installationPercent} %</summary>
          <p>Seule la surface supplémentaire à préparer est facturée. Les équipements communs de manutention et les articles repris de la réserve sont dispensés de frais de pose.</p>
        </details>}
        {department === "workshop" ? <div className={styles.workshop}>
          <button type="button" data-warehouse-shop-workshop onClick={onOpenWorkshop}>Ouvrir l’atelier <ArrowRight size={16} /></button>
        </div> : <div className={styles.products}>{products.map(product => {
          const handlingCode = isKqWarehouseHandlingCode(product.code) ? product.code : undefined;
          const handlingOwned = !!handlingCode && hasKqWarehouseHandling(installedState, handlingCode);
          const handlingPlanned = !!handlingCode && hasKqWarehouseHandling(state, handlingCode);
          const location = state.handlingPlacements?.find(item => item.code === handlingCode);
          const legacyHandling = !!handlingCode && !handlingOwned && !!installedState?.optionInventory?.some(item => item.code === handlingCode && item.quantity > 0);
          const isModule = "family" in product;
          const zoneDevice = isModule && isKqWarehouseZoneDevice(product) ? product : undefined;
          const station = isKqWarehouseStationCode(product.code) ? KQ_WAREHOUSE_STATIONS[product.code] : undefined;
          const isAirlock = product.code === "SIM-HYGIENE-03";
          const sasPlaced = isAirlock && state.stationPlacements?.some(item => item.code === product.code);
          const sasInstalled = isAirlock && installedState?.stationPlacements?.some(item => item.code === product.code);
          const price = station ? station.priceCents : isModule ? product.unitPriceCents : product.priceCents;
          const artwork = getKqWarehouseProductArtwork(product.code);
          const stock = reserve?.get(product.code) ?? 0;
          const needsStorage = !isModule && product.kind === "climate" && !state.serviceZones?.some(zone => zone.kind === "storage");
          const chosen = handlingOwned || handlingPlanned || !!sasPlaced;
          return <article className={styles.product} key={product.code} tabIndex={-1} data-warehouse-shop-product={product.code}
            data-tier={product.tier} data-chosen={chosen} data-targeted={targetedCode === product.code || undefined}>
            {artwork && <div className={styles.productArt}>
              <Image src={artwork.src} alt="" width={512} height={512} sizes="(max-width: 740px) 160px, 128px"
                className={styles.productImage} data-warehouse-product-artwork={product.code} />
            </div>}
            <div className={styles.productHeading}>
              {!handlingCode && !isAirlock && !zoneDevice && <small>{KQ_WAREHOUSE_TIERS.find(tier => tier.code === product.tier)?.label}</small>}
              <h4>{station ? station.name : isModule && !handlingCode && !zoneDevice ? product.description.split(". ")[0] : product.name}</h4>
              <p className={styles.price}>
                <strong data-warehouse-shop-price={price}>{formatKqCash(price)}</strong>
                <span>{zoneDevice ? zoneDevice.installationIncluded ? " TTC / appareil · sans frais de pose" : ` TTC / appareil · pose +${KQ_WAREHOUSE_SIMULATION.installationPercent} %` : isAirlock ? " · pose comprise" : handlingCode ? " · achat unique" : isModule && !station ? " / m² · hors pose" : " / unité · hors pose"}</span>
              </p>
            </div>
            {zoneDevice && <p className={styles.usage}>{zoneDevice.description}</p>}
            <ProductMetrics product={product} modern={state.airPlacements !== undefined} handling={handling} owned={handlingOwned} />
            {handlingCode && <p className={styles.usage}>Pour tout l’entrepôt. Le gain dépend de l’usure.</p>}
            {!isModule && product.kind === "lighting" && <p className={styles.usage}>Les lampes se placent en rangées au-dessus de toute la zone. Le devis ajuste leur nombre à sa surface.</p>}
            {!isModule && product.kind === "air" && <p className={styles.usage}>Au sol, l’extracteur aspire l’air autour de lui. Sur un mur ou une cloison, il aspire du côté choisi. Les flèches suivent l’air jusqu’à la bouche.</p>}
            {isAirlock && <p className={styles.usage}>Place le sas au seuil de la porte sud. Il protège chaque nouvelle culture dès le semis, même sans nettoyage.</p>}
            {station?.code === "SIM-WATER-03" && <p className={styles.usage}>À installer sur une case libre. Les cloisons arrêtent la portée. Un module local de la même famille équipe sa zone en priorité.</p>}
            {!isModule && (product.zoneLayout || product.kind === "climate") && <p className={styles.usage}>{product.specification}</p>}
            {handlingCode ? <p className={styles.stock} data-warehouse-shop-owned={handlingOwned ? product.code : undefined}>
              {location ? `${handlingOwned ? "Possédé" : "Au devis"} · colonne ${location.x + 1}, ligne ${location.y + 1}` : handlingOwned ? "Possédé · à placer" : legacyHandling ? "L’ancienne installation reste active jusqu’à la fin du cycle." : "1 case libre · sans frais de pose"}
            </p> : isAirlock ? <p className={styles.stock} data-warehouse-shop-owned={sasInstalled || stock > 0 ? product.code : undefined}>
              {sasPlaced ? sasInstalled ? "Installé à l’entrée" : "Au devis · entrée du bâtiment" : stock > 0 ? "En réserve · prêt à placer" : "Un seul sas par bâtiment"}
            </p> : reserve && <p className={styles.stock} data-warehouse-shop-owned={stock > 0 ? product.code : undefined}>
              {number(stock)} {zoneDevice ? stock > 1 ? "appareils" : "appareil" : isModule && !station ? "m²" : stock === 1 ? "unité" : "unités"} en réserve
            </p>}
            {handlingOwned && handlingCode === KQ_WAREHOUSE_HANDLING_CART && handlingCartConversion && <details className={styles.conversion}>
              <summary>Reprise de l’ancien matériel</summary>
              <p>{number(handlingCartConversion.quantity)} {handlingCartConversion.quantity === 1 ? "ancienne unité convertie" : "anciennes unités converties"} en un chariot commun.</p>
              {handlingCartConversion.creditCents > 0 && <p>{formatKqCash(handlingCartConversion.creditCents)} de crédit d’aménagement accordé pour les doublons.</p>}
              {handlingCartConversion.unknownBasisQuantity > 0 && <p>Prix inconnu pour {number(handlingCartConversion.unknownBasisQuantity)} {handlingCartConversion.unknownBasisQuantity === 1 ? "doublon archivé" : "doublons archivés"} sans crédit.</p>}
            </details>}
            <div className={styles.productActions}>
              <button type="button" data-warehouse-shop-choose={product.code} data-sylvain-target={isModule ? "install-support" : product.kind === "lighting" ? "install-lighting" : undefined} disabled={locked || legacyHandling || needsStorage || sasPlaced}
                onClick={() => onChooseProduct(product.code)}>
                {handlingCode ? location ? "Déplacer" : handlingOwned ? "Placer" : legacyHandling ? "Conversion en attente" : "Acheter" : sasPlaced ? "Sas déjà placé" : needsStorage ? "Rangement à placer d’abord" : !isModule && product.kind === "climate" ? "Équiper le stockage" : stock > 0 ? "Placer" : "Acheter"}
                {!chosen && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </div>
          </article>;
        })}
        {department === "substrate" && <article className={styles.product} data-warehouse-shop-product="PARTITION">
          <div className={styles.productHeading}>
            <h4>Paroi</h4>
            <p className={styles.price}><strong data-warehouse-shop-price={0}>{formatKqCash(0)}</strong><span> / paroi</span></p>
          </div>
          <p className={styles.usage}>Sépare deux espaces du plan et bloque l’extraction à travers la paroi.</p>
          <div className={styles.productActions}>
            <button type="button" disabled={locked} data-warehouse-shop-choose="PARTITION" onClick={() => onChooseProduct("PARTITION")}>
              Tracer sur le plan<ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </article>}
        </div>}
        {legacyReserve.length > 0 && <details className={styles.fittingCosts}><summary>Anciens modules disponibles en réserve</summary>
          <p>Tu peux réaffecter la surface déjà payée à une zone.</p>
          {legacyReserve.map(([code, quantity]) => <div key={code} className={styles.productActions}>
            <button type="button" disabled={locked} data-warehouse-shop-reuse={code} onClick={() => onChooseProduct(code)}>
              Placer · {getKqWarehouseOption(code)?.description.split(". ")[0]} · {number(quantity)} m² disponibles
            </button>
          </div>)}
        </details>}
      </section>
    </div>
    {!cameraPlacement && <footer className={styles.footer}>
      <dl className={styles.budget}>
        <div><dt>Trésorerie disponible</dt><dd>{formatKqCash(cashCents)}</dd></div>
        {migrationCreditCents > 0 && <div><dt>Crédit d’aménagement</dt><dd>{formatKqCash(migrationCreditCents)}</dd></div>}
        {(department !== "nutrition" || payable !== 0) && <div><dt>À payer au devis</dt><dd data-warehouse-shop-plan-payable={payable ?? undefined}>{payable === null ? "À calculer" : formatKqCash(payable)}</dd></div>}
        {payable !== null && payable > cashCents && <div className={styles.shortfall}><dt>Manque au devis</dt><dd>{formatKqCash(payable - cashCents)}</dd></div>}
      </dl>
      <button type="button" data-warehouse-shop-review={planReview ? true : undefined} onClick={planReview?.onOpen ?? onClose}>
        {planReview ? "Voir le devis" : "Retour au plan"}<ArrowRight size={16} aria-hidden="true" />
      </button>
    </footer>}
  </dialog>;
}
