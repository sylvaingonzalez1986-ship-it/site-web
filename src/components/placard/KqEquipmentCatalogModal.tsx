"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Check,
  ExternalLink,
  Lightbulb,
  Package,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Trash2,
  Wind,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getKqEquipmentArtwork } from "@/lib/kanab-quest-equipment-artwork";
import { createClientRequestKey } from "@/lib/client-request-key";
import {
  getKqEquipmentPaybackScenarios,
  getKqEquipmentInvestmentProgress,
  KQ_PLAYER_PAYBACK_REFERENCE,
} from "@/lib/kanab-quest-economy-balance";
import {
  getKqNewlyUnlockedMarketRoutes,
  type KqMarketRouteCode,
} from "@/lib/kanab-quest-market";
import {
  formatKqCash,
  getKqEquipmentDefinition,
  getKqEquipmentImpactLabels,
  getKqEquipmentRequirementState,
  isKqEquipmentImmediatelyPurchasable,
  isKqEquipmentSuperseded,
  KQ_EQUIPMENT_CATEGORY_LABELS,
  KQ_EQUIPMENT_CATEGORIES,
  KQ_EQUIPMENT_SLOT_LABELS,
  KQ_EQUIPMENT_UNLOCK_LABELS,
  projectKqEquipmentLoadout,
  sortKqEquipmentCatalog,
  summarizeKqEquipmentLoadout,
  validateKqEquipmentCart,
  type KqEquipmentCatalogSort,
  type KqEquipmentCategory,
  type KqEquipmentDefinition,
} from "@/lib/kanab-quest-equipment";
import styles from "./KqEquipmentCatalogModal.module.css";
import { KqEquipmentUpgrade } from "./KqEquipmentUpgrade";
import { KqEquipmentTierBadge } from "./KqEquipmentTierBadge";

type EquipmentSnapshot = {
  cashCents: number;
  levels: Record<string, number>;
  purchasedCodes: string[];
  reputation: number;
  ownedCodes: string[];
  equippedCodes: string[];
  routePlan: EquipmentRoutePlan | null;
  catalog: KqEquipmentDefinition[];
};

type PurchaseResult = {
  equipmentCodes: string[];
  totalPriceCents: number;
  cashAfterCents: number;
};

type EquipmentRoutePlan = {
  route: KqMarketRouteCode;
  equipmentCode: string;
};

const CATEGORY_ICONS: Record<KqEquipmentCategory, typeof Box> = {
  infrastructure: Box,
  lighting: Lightbulb,
  climate: Wind,
  processing: Settings,
  energy: Zap,
  security: Shield,
};

function EquipmentArtwork({ equipment, level = 1 }: { equipment: KqEquipmentDefinition; level?: number }) {
  const Icon = CATEGORY_ICONS[equipment.category];
  const artwork = getKqEquipmentArtwork(equipment.code, level);
  return (
    <span className={styles.productArtwork} data-category={equipment.category} data-has-artwork={artwork ? true : undefined}>
      {artwork ? (
        <Image
          className={styles.productArtworkImage}
          src={artwork.src}
          alt={artwork.alt}
          fill
          sizes="(max-width: 410px) 42vw, (max-width: 700px) 50vw, (max-width: 1050px) 38vw, 25vw"
        />
      ) : (
        <>
          <span className={styles.productArtworkGlow} />
          <Icon strokeWidth={1.55} aria-hidden="true" />
        </>
      )}
      <small>{equipment.specification}</small>
      <KqEquipmentTierBadge level={level} />
    </span>
  );
}

function EquipmentBenefits({ equipment, compact = false }: { equipment: KqEquipmentDefinition; compact?: boolean }) {
  const entries = getKqEquipmentImpactLabels(equipment);
  const strongestUnlock = equipment.unlocks.at(-1);
  const highlightedUnlock = strongestUnlock
    ? `Débloque : ${KQ_EQUIPMENT_UNLOCK_LABELS[strongestUnlock]}`
    : null;
  const visibleEntries = compact && highlightedUnlock
    ? [highlightedUnlock, ...entries.filter((entry) => entry !== highlightedUnlock)]
    : entries;
  return (
    <ul className={compact ? styles.compactBenefits : styles.benefitList}>
      {visibleEntries.slice(0, compact ? 2 : undefined).map((entry) => (
        <li key={entry}><Check aria-hidden="true" />{entry}</li>
      ))}
    </ul>
  );
}

type EquipmentLoadoutSummary = ReturnType<typeof summarizeKqEquipmentLoadout>;

function getLoadoutProjectionMetrics(current: EquipmentLoadoutSummary, projected: EquipmentLoadoutSummary) {
  return [
    { code: "power", label: "Puissance", before: current.powerWatts, after: projected.powerWatts, value: `${current.powerWatts} → ${projected.powerWatts} W` },
    { code: "quantity", label: "Quantité", before: current.quantityPercent, after: projected.quantityPercent, value: `+${current.quantityPercent} → +${projected.quantityPercent} %` },
    { code: "quality", label: "Qualité maximale", before: current.qualityMaxBonus, after: projected.qualityMaxBonus, value: `+${current.qualityMaxBonus} → +${projected.qualityMaxBonus}` },
    { code: "regularity", label: "Régularité", before: current.regularityPercent, after: projected.regularityPercent, value: `+${current.regularityPercent} → +${projected.regularityPercent} %` },
    { code: "capacity", label: "Capacité atelier", before: current.processingCapacityPercent, after: projected.processingCapacityPercent, value: `${current.processingCapacityPercent} → ${projected.processingCapacityPercent} %` },
    { code: "precision", label: "Précision atelier", before: current.processingPrecision, after: projected.processingPrecision, value: `${current.processingPrecision} → ${projected.processingPrecision} %` },
    { code: "energy", label: "Réduction facture", before: current.energyDiscountPercent, after: projected.energyDiscountPercent, value: `−${current.energyDiscountPercent} → −${projected.energyDiscountPercent} %` },
  ].filter((metric) => metric.before !== metric.after);
}

export function KqEquipmentCatalogModal({
  initialEquipmentCode = null,
  onClose,
}: {
  initialEquipmentCode?: string | null;
  onClose: () => void;
}) {
  const recommendedEquipmentCode = initialEquipmentCode && getKqEquipmentDefinition(initialEquipmentCode)
    ? initialEquipmentCode
    : null;
  const [snapshot, setSnapshot] = useState<EquipmentSnapshot | null>(null);
  const [pending, setPending] = useState<"load" | "purchase" | "equip" | null>("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<KqEquipmentCategory | "all" | "owned">("all");
  const [compatibleOnly, setCompatibleOnly] = useState(false);
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [sortMode, setSortMode] = useState<KqEquipmentCatalogSort>("progression");
  const [cartCodes, setCartCodes] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(recommendedEquipmentCode);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);
  const [routePlan, setRoutePlan] = useState<EquipmentRoutePlan | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/arena/placard/equipment", { cache: "no-store" });
    const payload = await response.json() as EquipmentSnapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Catalogue matériel indisponible.");
    setSnapshot(payload);
    setRoutePlan(payload.routePlan);
  }, []);

  useEffect(() => {
    setPending("load");
    refresh()
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Catalogue indisponible."))
      .finally(() => setPending(null));
  }, [refresh]);

  const filteredCatalog = useMemo(() => {
    if (!snapshot) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
    const visibleEquipment = snapshot.catalog.filter((equipment) => {
      if (category === "owned" && !snapshot.ownedCodes.includes(equipment.code)) return false;
      if (category !== "all" && category !== "owned" && equipment.category !== category) return false;
      if (normalizedQuery && !`${equipment.name} ${equipment.shortDescription} ${equipment.specification}`.toLocaleLowerCase("fr-FR").includes(normalizedQuery)) return false;
      if (compatibleOnly && !getKqEquipmentRequirementState({
        equipment,
        ownedCodes: snapshot.ownedCodes,
        cartCodes,
      }).compatible) return false;
      if (affordableOnly && !isKqEquipmentImmediatelyPurchasable({
        equipment,
        ownedCodes: snapshot.ownedCodes,
        cartCodes,
        cashCents: snapshot.cashCents,
      })) return false;
      return true;
    });
    return sortKqEquipmentCatalog({
      equipment: visibleEquipment,
      ownedCodes: snapshot.ownedCodes,
      cartCodes,
      cashCents: snapshot.cashCents,
      recommendedCode: recommendedEquipmentCode,
      sort: sortMode,
    });
  }, [affordableOnly, cartCodes, category, compatibleOnly, query, recommendedEquipmentCode, snapshot, sortMode]);

  const selectedEquipment = selectedCode && snapshot
    ? snapshot.catalog.find((equipment) => equipment.code === selectedCode) ?? null
    : null;
  const selectedRequirementState = selectedEquipment ? getKqEquipmentRequirementState({
    equipment: selectedEquipment,
    ownedCodes: snapshot?.ownedCodes ?? [],
    cartCodes,
  }) : null;
  const cartEquipment = cartCodes
    .map((code) => snapshot?.catalog.find((equipment) => equipment.code === code) ?? getKqEquipmentDefinition(code))
    .filter((equipment): equipment is KqEquipmentDefinition => Boolean(equipment));
  const cartValidation = snapshot ? validateKqEquipmentCart({
    cartCodes,
    ownedCodes: snapshot.ownedCodes,
    equippedCodes: snapshot.equippedCodes,
    cashCents: snapshot.cashCents,
  }) : null;
  const currentLoadout = summarizeKqEquipmentLoadout(snapshot?.equippedCodes ?? [], snapshot?.levels);
  const projectedLoadout = projectKqEquipmentLoadout({
    levels: snapshot?.levels,
    equippedCodes: snapshot?.equippedCodes ?? [],
    candidateCodes: cartCodes,
    ownedCodes: snapshot?.ownedCodes ?? [],
  });
  const projectionMetrics = getLoadoutProjectionMetrics(currentLoadout, projectedLoadout);
  const newlyUnlockedLabels = projectedLoadout.unlocks
    .filter((unlock) => !currentLoadout.unlocks.includes(unlock))
    .map((unlock) => KQ_EQUIPMENT_UNLOCK_LABELS[unlock]);
  const newlyUnlockedRoutes = getKqNewlyUnlockedMarketRoutes({
    currentUnlocks: currentLoadout.unlocks,
    projectedUnlocks: projectedLoadout.unlocks,
  });
  const selectedProjection = selectedEquipment ? projectKqEquipmentLoadout({
    levels: snapshot?.levels,
    equippedCodes: snapshot?.equippedCodes ?? [],
    candidateCodes: [...new Set([...cartCodes, selectedEquipment.code])],
    ownedCodes: snapshot?.ownedCodes ?? [],
  }) : null;
  const selectedProjectionMetrics = selectedProjection
    ? getLoadoutProjectionMetrics(currentLoadout, selectedProjection)
    : [];
  const selectedUnlockedRoutes = selectedProjection ? getKqNewlyUnlockedMarketRoutes({
    currentUnlocks: currentLoadout.unlocks,
    projectedUnlocks: selectedProjection.unlocks,
  }) : [];
  const selectedInstalledEquipment = selectedEquipment
    ? (snapshot?.equippedCodes ?? [])
      .map((code) => getKqEquipmentDefinition(code))
      .find((equipment) => equipment?.slot === selectedEquipment.slot && equipment.code !== selectedEquipment.code) ?? null
    : null;
  const selectedProjectionBlocked = Boolean(
    selectedEquipment
    && selectedProjection
    && (
      selectedProjection.blockedCodes.includes(selectedEquipment.code)
      || selectedProjection.ambiguousSlots.includes(selectedEquipment.slot)
    )
  );
  const selectedPaybackScenarios = useMemo(
    () => selectedEquipment ? getKqEquipmentPaybackScenarios(selectedEquipment.code, {
      levels: snapshot?.levels,
      ownedCodes: snapshot?.ownedCodes ?? [],
      cartCodes,
    }) : [],
    [cartCodes, selectedEquipment, snapshot?.ownedCodes, snapshot?.levels],
  );
  const plannedRouteScenario = useMemo(() => routePlan
    ? getKqEquipmentPaybackScenarios(routePlan.equipmentCode, {
      levels: snapshot?.levels,
      ownedCodes: snapshot?.ownedCodes ?? [],
      cartCodes,
    }).find((scenario) => scenario.route === routePlan.route) ?? null
    : null, [cartCodes, routePlan, snapshot?.ownedCodes, snapshot?.levels]);
  const plannedRouteProgress = plannedRouteScenario ? getKqEquipmentInvestmentProgress({
    investmentCents: plannedRouteScenario.remainingInvestmentCents,
    cashCents: snapshot?.cashCents ?? 0,
  }) : null;

  const addToCart = (code: string) => {
    if (!snapshot || snapshot.ownedCodes.includes(code) || cartCodes.includes(code)) return;
    setCartCodes((current) => [...current, code]);
    setNotice(`${getKqEquipmentDefinition(code)?.name ?? "Équipement"} ajouté au panier.`);
  };

  const updateRoutePlan = async (nextPlan: EquipmentRoutePlan | null) => {
    const previousPlan = routePlan;
    setRoutePlan(nextPlan);
    try {
      const response = await fetch("/api/arena/placard/equipment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "route-plan",
          route: nextPlan?.route ?? null,
          equipmentCode: nextPlan?.equipmentCode ?? null,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Objectif impossible à enregistrer.");
      window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch (reason) {
      setRoutePlan(previousPlan);
      setError(reason instanceof Error ? reason.message : "Objectif impossible à enregistrer.");
    }
  };

  const addEquipmentChainToCart = (input: {
    codes: string[];
    route: KqMarketRouteCode;
    routeName: string;
    equipmentCode: string;
  }) => {
    if (!snapshot) return;
    const additions = input.codes.filter((code) => (
      !snapshot.ownedCodes.includes(code)
      && !cartCodes.includes(code)
      && getKqEquipmentDefinition(code)?.purchasable
    ));
    if (additions.length === 0) return;
    setCartCodes((current) => [...new Set([...current, ...additions])]);
    void updateRoutePlan({ route: input.route, equipmentCode: input.equipmentCode });
    setSelectedCode(null);
    setCartOpen(true);
    setNotice(`${input.routeName} : ${additions.length} équipement${additions.length > 1 ? "s" : ""} ajouté${additions.length > 1 ? "s" : ""} au panier.`);
  };

  const removeFromCart = (code: string) => {
    setCartCodes((current) => current.filter((item) => item !== code));
  };

  const purchase = async () => {
    if (!snapshot || !cartValidation || cartValidation.errors.length > 0) return;
    setPending("purchase");
    setError("");
    try {
      const response = await fetch("/api/arena/placard/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestKey: createClientRequestKey(), equipmentCodes: cartValidation.uniqueCodes }),
      });
      const payload = await response.json() as PurchaseResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Achat impossible.");
      setPurchaseResult(payload);
      setCheckoutOpen(false);
      setCartOpen(false);
      setCartCodes([]);
      await refresh();
      window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Achat impossible.");
    } finally {
      setPending(null);
    }
  };

  const equip = async (equipmentCode: string) => {
    setPending("equip");
    setError("");
    try {
      const response = await fetch("/api/arena/placard/equipment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentCode }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Installation impossible.");
      await refresh();
      setNotice(`${getKqEquipmentDefinition(equipmentCode)?.name ?? "Équipement"} installé.`);
      window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Installation impossible.");
    } finally {
      setPending(null);
    }
  };

  return (
    <section className={styles.catalog} role="dialog" aria-modal="true" aria-labelledby="equipment-catalog-title">
      <header className={styles.catalogHeader}>
        <button type="button" onClick={onClose} className={styles.backButton}><ArrowLeft aria-hidden="true" />Boutique</button>
        <div className={styles.catalogBrand}>
          <small>La Botte · investissements durables</small>
          <h2 id="equipment-catalog-title">Catalogue matériel</h2>
        </div>
        <div className={styles.accountSummary}>
          <span><small>Trésorerie</small><strong>{formatKqCash(snapshot?.cashCents ?? 0)}</strong></span>
          <span><small>Réputation</small><strong>{snapshot?.reputation ?? 0}</strong></span>
          <button type="button" onClick={() => setCartOpen(true)} aria-label={`Ouvrir le panier, ${cartCodes.length} article(s)`}>
            <ShoppingCart aria-hidden="true" /><b>{cartCodes.length}</b>
          </button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <label><Search aria-hidden="true" /><span className="sr-only">Rechercher</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une tente, une LED, une presse…" /></label>
        <label className={styles.compatibilityToggle}><input type="checkbox" checked={compatibleOnly} onChange={(event) => setCompatibleOnly(event.target.checked)} /><span>Compatible seulement</span></label>
        <label className={`${styles.compatibilityToggle} ${styles.budgetToggle}`}><input type="checkbox" checked={affordableOnly} onChange={(event) => setAffordableOnly(event.target.checked)} /><span>Achetable maintenant</span></label>
        <label className={styles.sortControl}><span>Trier</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as KqEquipmentCatalogSort)}><option value="progression">Progression conseillée</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option></select></label>
      </div>

      {error ? <p className={styles.errorNotice} role="alert"><AlertTriangle aria-hidden="true" />{error}</p> : null}
      {notice ? <p className={styles.statusNotice} role="status">{notice}</p> : null}

      <div className={styles.catalogBody}>
        <nav className={styles.categoryNav} aria-label="Catégories du catalogue">
          <button type="button" data-active={category === "all" || undefined} onClick={() => setCategory("all")}><Package aria-hidden="true" /><span>Tout le matériel</span></button>
          {KQ_EQUIPMENT_CATEGORIES.map((item) => {
            const Icon = CATEGORY_ICONS[item];
            return <button key={item} type="button" data-active={category === item || undefined} onClick={() => setCategory(item)}><Icon aria-hidden="true" /><span>{KQ_EQUIPMENT_CATEGORY_LABELS[item]}</span></button>;
          })}
          <button type="button" data-active={category === "owned" || undefined} onClick={() => setCategory("owned")}><Check aria-hidden="true" /><span>Déjà possédés</span></button>
          <div className={styles.loadoutSummary}>
            <small>Installation active</small>
            <strong>{currentLoadout.powerWatts} W</strong>
            <span>Quantité +{currentLoadout.quantityPercent} %</span>
            <span>Qualité max +{currentLoadout.qualityMaxBonus}</span>
          </div>
        </nav>

        <main className={styles.productArea}>
          <div className={styles.productAreaHeader}>
            <div><small>{filteredCatalog.length} référence{filteredCatalog.length > 1 ? "s" : ""}</small><strong>{category === "all" ? "Tout le catalogue" : category === "owned" ? "Ton matériel" : KQ_EQUIPMENT_CATEGORY_LABELS[category]}</strong></div>
            <span>Prix publics US vérifiés · hors livraison et taxes locales</span>
          </div>

          {pending === "load" ? <div className={styles.loadingState}>Sylvain ouvre les cartons…</div> : null}
          {pending !== "load" && filteredCatalog.length === 0 ? <div className={styles.emptyState}>Aucun équipement ne correspond à ces filtres.</div> : null}
          <div className={styles.productGrid}>
            {filteredCatalog.map((equipment) => {
              const owned = snapshot?.ownedCodes.includes(equipment.code) ?? false;
              const equipped = snapshot?.equippedCodes.includes(equipment.code) ?? false;
              const inCart = cartCodes.includes(equipment.code);
              const alternative = isKqEquipmentSuperseded(equipment.code, snapshot?.ownedCodes ?? []);
              const requirementState = getKqEquipmentRequirementState({
                equipment,
                ownedCodes: snapshot?.ownedCodes ?? [],
                cartCodes,
              });
              return (
                <article
                  key={equipment.code}
                  className={styles.productCard}
                  data-owned={owned || undefined}
                  data-incompatible={!requirementState.compatible || undefined}
                  data-recommended={equipment.code === recommendedEquipmentCode || undefined}
                  data-alternative={alternative || undefined}
                >
                  <button type="button" className={styles.productMain} onClick={() => setSelectedCode(equipment.code)} aria-label={`Voir ${equipment.name}`}>
                    <EquipmentArtwork equipment={equipment} level={snapshot?.levels?.[equipment.code] ?? 1} />
                    <span className={styles.productCopy}>
                      {equipment.code === recommendedEquipmentCode ? <em className={styles.recommendedBadge}>Objectif conseillé</em> : alternative ? <em className={styles.alternativeBadge}>Modèle alternatif</em> : null}
                      <small>{KQ_EQUIPMENT_CATEGORY_LABELS[equipment.category]}</small>
                      <strong>{equipment.name}</strong>
                      <p>{equipment.shortDescription}</p>
                      <EquipmentBenefits equipment={equipment} compact />
                    </span>
                  </button>
                  <footer>
                    <span><strong>{equipment.purchasable ? formatKqCash(equipment.priceCents) : "Fourni"}</strong><small>{equipment.powerWatts > 0 ? `${equipment.powerWatts} W` : "Sans consommation"}</small></span>
                    {owned ? (
                      <button type="button" disabled={equipped || !equipment.purchasable || !requirementState.compatible || pending !== null} onClick={() => void equip(equipment.code)}>{equipped ? "Équipé" : !equipment.purchasable ? "Kit de départ" : !requirementState.compatible ? "Prérequis" : "Équiper"}</button>
                    ) : (
                      <button type="button" disabled={!equipment.purchasable || inCart || pending !== null} onClick={() => addToCart(equipment.code)}>{inCart ? "Au panier" : "Ajouter"}</button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        </main>

        <aside className={styles.cartPanel} data-open={cartOpen || undefined} aria-label="Panier matériel">
          <header><div><small>Commande en préparation</small><h3>Ton panier</h3></div><button type="button" onClick={() => setCartOpen(false)} aria-label="Fermer le panier"><X /></button></header>
          {plannedRouteScenario && plannedRouteProgress ? <section className={styles.cartRoutePlan} aria-label="Objectif de filière du panier">
            <header><span><small>Projet d’atelier sauvegardé</small><strong>{plannedRouteScenario.name}</strong></span><button type="button" onClick={() => void updateRoutePlan(null)} aria-label="Retirer l’objectif de filière"><X aria-hidden="true" /></button></header>
            <p>{plannedRouteScenario.projectedEquipmentNames.join(" · ")}</p>
            <dl>
              <div><dt>Jury minimum</dt><dd>{plannedRouteScenario.minimumJuryScore.toFixed(1)}/10</dd></div>
              <div><dt>Surplus témoin</dt><dd>+{formatKqCash(plannedRouteScenario.comparisonDeltaCents)}</dd></div>
              <div><dt>Capital restant</dt><dd>{formatKqCash(plannedRouteScenario.remainingInvestmentCents)}</dd></div>
              <div><dt>Amortissement</dt><dd>{plannedRouteScenario.personalizedPaybackHarvests === 0 ? "Atelier prêt" : `${plannedRouteScenario.personalizedPaybackHarvests?.toLocaleString("fr-FR")} récoltes`}</dd></div>
            </dl>
            {plannedRouteProgress.targetCents > 0 ? <div className={styles.cartRouteFunding} data-affordable={plannedRouteProgress.affordable || undefined}>
              <span>{plannedRouteProgress.affordable ? "Budget atteint" : `Encore ${formatKqCash(plannedRouteProgress.remainingCents)} à gagner`}</span>
              <progress max={100} value={plannedRouteProgress.progressPercent} aria-label={`Budget pour ${plannedRouteScenario.name}`} />
              <small>{formatKqCash(plannedRouteProgress.availableCents)} sur {formatKqCash(plannedRouteProgress.targetCents)}</small>
            </div> : null}
            {plannedRouteScenario.missingAfterCartCodes.length > 0 ? <button type="button" className={styles.completeRouteButton} disabled={pending !== null} onClick={() => addEquipmentChainToCart({
              codes: plannedRouteScenario.missingAfterCartCodes,
              route: plannedRouteScenario.route,
              routeName: plannedRouteScenario.name,
              equipmentCode: routePlan?.equipmentCode ?? plannedRouteScenario.projectedEquipmentCodes[0],
            })}><ShoppingCart aria-hidden="true" />Compléter le panier · {formatKqCash(plannedRouteScenario.missingAfterCartCents)}</button> : <small className={styles.routePlanReady}><Check aria-hidden="true" />Chaîne complète dans le panier et l’atelier.</small>}
          </section> : null}
          <div className={styles.cartItems}>
            {cartEquipment.length === 0 ? <div className={styles.emptyCart}><ShoppingCart aria-hidden="true" /><strong>Le chariot est vide</strong><span>Ajoute du matériel depuis le catalogue.</span></div> : null}
            {cartEquipment.map((equipment) => {
              const Icon = CATEGORY_ICONS[equipment.category];
              return <article key={equipment.code}><span data-category={equipment.category}><Icon aria-hidden="true" /></span><div><strong>{equipment.name}</strong><small>{equipment.specification}</small><b>{formatKqCash(equipment.priceCents)}</b></div><button type="button" onClick={() => removeFromCart(equipment.code)} aria-label={`Retirer ${equipment.name}`}><Trash2 /></button></article>;
            })}
          </div>
          {cartValidation?.warnings.length ? <div className={styles.cartWarnings}>{cartValidation.warnings.map((warning) => <p key={warning}><AlertTriangle aria-hidden="true" />{warning}</p>)}</div> : null}
          {cartCodes.length > 0 ? <div className={styles.cartProjection} aria-label="Impact du panier après installation">
            <header><small>Impact après installation</small><strong>{projectionMetrics.length} statistique{projectionMetrics.length > 1 ? "s" : ""} modifiée{projectionMetrics.length > 1 ? "s" : ""}</strong></header>
            {projectionMetrics.map((metric) => <span key={metric.code} data-improved={(metric.code === "power" ? metric.after < metric.before : metric.after > metric.before) || undefined}><small>{metric.label}</small><strong>{metric.value}</strong></span>)}
            {newlyUnlockedRoutes.length > 0 ? <section className={styles.cartRoutes}><small>Filières réellement ouvertes</small><ul>{newlyUnlockedRoutes.map((route) => <li key={route.code}><Check aria-hidden="true" /><span><strong>{route.name}</strong><em>Jury ≥ {route.minimumJuryScore.toFixed(1)}</em></span></li>)}</ul></section> : null}
            {newlyUnlockedLabels.length > 0 ? <section className={styles.cartUnlocks}><small>Nouvelles capacités techniques</small><ul>{newlyUnlockedLabels.map((label) => <li key={label}><Check aria-hidden="true" />{label}</li>)}</ul></section> : null}
            {projectedLoadout.ambiguousSlots.length > 0 || projectedLoadout.blockedCodes.length > 0 ? <p className={styles.projectionNote}><AlertTriangle aria-hidden="true" />Projection prudente : les conflits d’emplacement et les machines aux prérequis manquants ne sont pas ajoutés aux bonus.</p> : null}
          </div> : null}
          <footer className={styles.cartFooter}>
            <div><span>Sous-total</span><strong>{formatKqCash(cartValidation?.totalCents ?? 0)}</strong></div>
            <div><span>Solde après achat</span><strong data-negative={(cartValidation?.cashAfterCents ?? 0) < 0 || undefined}>{formatKqCash(cartValidation?.cashAfterCents ?? snapshot?.cashCents ?? 0)}</strong></div>
            <button type="button" disabled={!cartValidation || cartValidation.errors.length > 0 || pending !== null} onClick={() => setCheckoutOpen(true)}>Valider le panier</button>
            {cartValidation?.errors.map((cartError) => <small key={cartError}>{cartError}</small>)}
          </footer>
        </aside>

        {cartOpen ? <button type="button" className={styles.mobileScrim} aria-label="Fermer le panier" onClick={() => setCartOpen(false)} /> : null}
      </div>

      {selectedEquipment ? <aside className={styles.detailPanel} aria-label={`Détails de ${selectedEquipment.name}`}>
        <button type="button" onClick={() => setSelectedCode(null)} aria-label="Fermer la fiche"><X /></button>
        <EquipmentArtwork equipment={selectedEquipment} level={snapshot?.levels?.[selectedEquipment.code] ?? 1} />
        {selectedEquipment.code === recommendedEquipmentCode ? <em className={styles.recommendedBadge}>Objectif conseillé</em> : null}
        {selectedEquipment.code !== recommendedEquipmentCode && isKqEquipmentSuperseded(selectedEquipment.code, snapshot?.ownedCodes ?? []) ? <em className={styles.alternativeBadge}>Modèle alternatif · un modèle supérieur est déjà acquis</em> : null}
        <small>{KQ_EQUIPMENT_CATEGORY_LABELS[selectedEquipment.category]} · Durable</small>
        <h3>{selectedEquipment.name}</h3>
        <strong className={styles.detailPrice}>{selectedEquipment.purchasable ? formatKqCash(selectedEquipment.priceCents) : "Équipement fourni"}</strong>
        <p>{selectedEquipment.shortDescription}</p>
        <EquipmentBenefits equipment={selectedEquipment} />
        {snapshot?.purchasedCodes?.includes(selectedEquipment.code) ? <KqEquipmentUpgrade key={selectedEquipment.code} code={selectedEquipment.code} level={snapshot.levels?.[selectedEquipment.code] ?? 1} cashCents={snapshot.cashCents} disabled={pending !== null} onUpdated={refresh} /> : <p>Achat au niveau 1 · améliorable jusqu’au niveau 10 · nouvelle apparence aux niveaux 5 et 10.</p>}
        <section className={styles.detailProjection} aria-label="Projection personnalisée dans ton atelier" data-blocked={selectedProjectionBlocked || undefined}>
          <h4>Dans ton atelier</h4>
          {snapshot?.equippedCodes.includes(selectedEquipment.code) ? <p><Check aria-hidden="true" />Cette pièce est installée : ses bonus sont déjà actifs.</p> : selectedProjectionBlocked ? <p><AlertTriangle aria-hidden="true" />Projection suspendue : règle d’abord le prérequis ou le conflit d’emplacement signalé.</p> : (
            <>
              {selectedInstalledEquipment ? <p><Settings aria-hidden="true" />Remplacera {selectedInstalledEquipment.name} dans l’emplacement {KQ_EQUIPMENT_SLOT_LABELS[selectedEquipment.slot]}.</p> : null}
              {selectedProjectionMetrics.length > 0 ? <dl>{selectedProjectionMetrics.map((metric) => <div key={metric.code}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl> : <p>Cette pièce complète surtout une chaîne technique sans modifier les statistiques actives.</p>}
              {selectedUnlockedRoutes.length > 0 ? <div className={styles.detailRoutes}><small>Filières complétées</small>{selectedUnlockedRoutes.map((route) => <span key={route.code}><strong>{route.name}</strong><em>Jury ≥ {route.minimumJuryScore.toFixed(1)}</em></span>)}</div> : null}
            </>
          )}
          {!snapshot?.ownedCodes.includes(selectedEquipment.code) ? <small>Projection avec cette pièce et le contenu actuel du panier.</small> : null}
        </section>
        {selectedPaybackScenarios.length > 0 ? <section className={styles.detailPayback} aria-label="Amortissement indicatif de la machine">
          <h4>Repère de rentabilité</h4>
          <p>Lot témoin : {KQ_PLAYER_PAYBACK_REFERENCE.harvestGrams} g · jury {KQ_PLAYER_PAYBACK_REFERENCE.juryScore.toFixed(1)}/10</p>
          <div>{selectedPaybackScenarios.map((scenario) => {
            const investmentProgress = getKqEquipmentInvestmentProgress({
              investmentCents: scenario.remainingInvestmentCents,
              cashCents: snapshot?.cashCents ?? 0,
            });
            return <article key={scenario.route}>
              <header><strong>{scenario.name}</strong><span>{scenario.personalizedPaybackHarvests === 0 ? "Atelier prêt" : `${scenario.personalizedPaybackHarvests?.toLocaleString("fr-FR")} récoltes`}</span></header>
              <dl>
                <div><dt>Surplus par lot</dt><dd>+{formatKqCash(scenario.comparisonDeltaCents)}</dd></div>
                <div><dt>Capital restant</dt><dd>{formatKqCash(scenario.remainingInvestmentCents)}</dd></div>
                {scenario.cartInvestmentCents > 0 ? <div><dt>Déjà au panier</dt><dd>{formatKqCash(scenario.cartInvestmentCents)}</dd></div> : null}
                {scenario.missingAfterCartCents > 0 ? <div><dt>Encore à ajouter</dt><dd>{formatKqCash(scenario.missingAfterCartCents)}</dd></div> : null}
              </dl>
              {scenario.missingAfterCartNames.length > 0 ? <p><strong>Chaîne à compléter :</strong> {scenario.missingAfterCartNames.join(" · ")}</p> : <p><strong>Chaîne financée :</strong> tout le matériel requis est possédé ou au panier.</p>}
              {investmentProgress.targetCents > 0 ? <div className={styles.investmentGoal} data-affordable={investmentProgress.affordable || undefined}>
                <header><span>{investmentProgress.affordable ? "Finançable maintenant" : "Objectif d’épargne"}</span><strong>{investmentProgress.affordable ? "Budget atteint" : `Encore ${formatKqCash(investmentProgress.remainingCents)}`}</strong></header>
                <progress max={100} value={investmentProgress.progressPercent} aria-label={`Épargne pour ${scenario.name}`} />
                <small>{formatKqCash(investmentProgress.availableCents)} disponibles sur {formatKqCash(investmentProgress.targetCents)}</small>
              </div> : <p><strong>Aucun achat :</strong> la chaîne est déjà dans ton atelier.</p>}
              {scenario.missingAfterCartCodes.length > 0 ? <button type="button" className={styles.chainCartButton} disabled={pending !== null} onClick={() => addEquipmentChainToCart({ codes: scenario.missingAfterCartCodes, route: scenario.route, routeName: scenario.name, equipmentCode: selectedEquipment.code })}><ShoppingCart aria-hidden="true" />Préparer la chaîne · {formatKqCash(scenario.missingAfterCartCents)}</button> : null}
            </article>;
          })}</div>
          <small>Estimation face au lot brut, recalculée avec tes machines et ton panier. Le capital restant inclut les articles non encore achetés. La note, le poids, l’installation réelle et les incidents changent le résultat.</small>
        </section> : null}
        <section><h4>Contrepartie</h4><p>{selectedEquipment.tradeoff}</p></section>
        <section>
          <h4>Fiche matériel</h4>
          <p>{selectedEquipment.specification} · {selectedEquipment.powerWatts} W</p>
          <small>Emplacement : {KQ_EQUIPMENT_SLOT_LABELS[selectedEquipment.slot]} · une seule pièce active dans cet emplacement</small>
        </section>
        <section>
          <h4>Équivalent réel vérifié</h4>
          <p>{selectedEquipment.realWorldAnchor.label}</p>
          <small>
            Prix public US : {formatKqCash(selectedEquipment.realWorldAnchor.referencePriceCents)}
            {selectedEquipment.realWorldAnchor.priceKind === "starting-at" ? " · à partir de" : ""}
            {selectedEquipment.realWorldAnchor.observedPriceCents
              ? ` · promotion constatée : ${formatKqCash(selectedEquipment.realWorldAnchor.observedPriceCents)}`
              : ""}
            {` · relevé le ${selectedEquipment.realWorldAnchor.checkedAt}`}
          </small>
          <a className="mt-2 inline-flex items-center gap-1 text-[.62rem] font-black uppercase text-[#0c6f5b] underline" href={selectedEquipment.realWorldAnchor.sourceUrl} target="_blank" rel="noreferrer">
            Vérifier chez {selectedEquipment.realWorldAnchor.seller}<ExternalLink aria-hidden="true" />
          </a>
        </section>
        {(selectedEquipment.requirements ?? []).map((requirement) => <p className={styles.requirement} key={requirement.label}><AlertTriangle aria-hidden="true" />Nécessite : {requirement.label}</p>)}
        {snapshot?.ownedCodes.includes(selectedEquipment.code) ? <button type="button" className={styles.detailCta} disabled={snapshot.equippedCodes.includes(selectedEquipment.code) || !selectedEquipment.purchasable || !selectedRequirementState?.compatible || pending !== null} onClick={() => void equip(selectedEquipment.code)}>{snapshot.equippedCodes.includes(selectedEquipment.code) ? "Déjà équipé" : !selectedEquipment.purchasable ? "Équipement de départ fourni" : !selectedRequirementState?.compatible ? "Prérequis manquant" : "Équiper maintenant"}</button> : <button type="button" className={styles.detailCta} disabled={!selectedEquipment.purchasable || cartCodes.includes(selectedEquipment.code) || pending !== null} onClick={() => addToCart(selectedEquipment.code)}>{cartCodes.includes(selectedEquipment.code) ? "Déjà au panier" : "Ajouter au panier"}</button>}
      </aside> : null}

      {checkoutOpen && cartValidation ? <div className={styles.checkoutOverlay} role="presentation" onClick={() => setCheckoutOpen(false)}><section role="alertdialog" aria-modal="true" aria-labelledby="checkout-title" onClick={(event) => event.stopPropagation()}>
        <small>Dernière vérification</small><h3 id="checkout-title">Confirmer l’investissement</h3>
        <div>{cartEquipment.map((equipment) => <p key={equipment.code}><span>{equipment.name}</span><strong>{formatKqCash(equipment.priceCents)}</strong></p>)}</div>
        {cartValidation.warnings.map((warning) => <p className={styles.checkoutWarning} key={warning}><AlertTriangle aria-hidden="true" />{warning}</p>)}
        <section className={styles.checkoutImpact} aria-label="Bénéfices projetés après installation">
          <h4>Ce que cet investissement change</h4>
          {projectionMetrics.length > 0 ? <ul>{projectionMetrics.map((metric) => <li key={metric.code}><span>{metric.label}</span><strong>{metric.value}</strong></li>)}</ul> : null}
          {newlyUnlockedRoutes.length > 0 ? <div className={styles.checkoutRoutes}><small>Nouvelles filières</small>{newlyUnlockedRoutes.map((route) => <span key={route.code}><strong>{route.name}</strong><em>note jury ≥ {route.minimumJuryScore.toFixed(1)}</em></span>)}</div> : null}
          {newlyUnlockedLabels.length > 0 ? <p><Check aria-hidden="true" /><span><small>Nouvelles capacités</small><strong>{newlyUnlockedLabels.join(" · ")}</strong></span></p> : null}
          <em>L’achat réserve le matériel ; ses effets commencent après installation.</em>
        </section>
        <dl><div><dt>Total</dt><dd>{formatKqCash(cartValidation.totalCents)}</dd></div><div><dt>Solde après achat</dt><dd>{formatKqCash(cartValidation.cashAfterCents)}</dd></div></dl>
        <footer><button type="button" onClick={() => setCheckoutOpen(false)}>Retour au panier</button><button type="button" disabled={pending === "purchase"} onClick={() => void purchase()}>{pending === "purchase" ? "Commande en cours…" : "Confirmer l’achat"}</button></footer>
      </section></div> : null}

      {purchaseResult ? <div className={styles.purchaseOverlay}><section role="dialog" aria-modal="true" aria-labelledby="equipment-purchase-title">
        <span className={styles.purchaseIcon}><Package aria-hidden="true" /></span>
        <small>Commande validée</small><h3 id="equipment-purchase-title">Le matériel est à toi.</h3>
        <p>« Ça rentrait pas dans le coffre, mais j’ai signé quand même. » — Sylvain</p>
        <p className={styles.installHint}><Settings aria-hidden="true" /> Acheté ne veut pas dire installé : active chaque pièce pour appliquer ses bonus. Un équipement remplace l’ancien dans le même emplacement.</p>
        <div className={styles.purchaseEquipmentList}>{purchaseResult.equipmentCodes.map((code) => {
          const equipment = getKqEquipmentDefinition(code);
          const equipped = snapshot?.equippedCodes.includes(code) ?? false;
          const requirementState = equipment ? getKqEquipmentRequirementState({
            equipment,
            ownedCodes: snapshot?.ownedCodes ?? [],
          }) : null;
          return <article key={code} data-equipped={equipped || undefined} data-blocked={!requirementState?.compatible || undefined}>
            <span>
              <strong>{equipment?.name ?? code}</strong>
              <small>{equipment ? `${KQ_EQUIPMENT_SLOT_LABELS[equipment.slot]} · ${equipment.specification}` : "Équipement durable acquis."}</small>
              {equipment ? <ul>{getKqEquipmentImpactLabels(equipment).map((impact) => <li key={impact}><Check aria-hidden="true" />{impact}</li>)}</ul> : null}
              <em>{equipped ? "Bonus actifs dans l’atelier" : !requirementState?.compatible ? `En réserve · ${equipment?.requirements?.map((requirement) => requirement.label).join(" ou ") ?? "prérequis manquant"}` : "À installer pour activer ces avantages"}</em>
            </span>
            <button type="button" disabled={equipped || !requirementState?.compatible || pending !== null} onClick={() => void equip(code)}>{equipped ? <><Check aria-hidden="true" /> Installé</> : !requirementState?.compatible ? "Prérequis" : "Installer"}</button>
          </article>;
        })}</div>
        <b>{formatKqCash(purchaseResult.totalPriceCents)} investis · {formatKqCash(purchaseResult.cashAfterCents)} restants</b>
        <footer><button type="button" onClick={() => setPurchaseResult(null)}>Continuer les achats</button><button type="button" onClick={onClose}>Retour à la boutique</button></footer>
      </section></div> : null}
    </section>
  );
}
