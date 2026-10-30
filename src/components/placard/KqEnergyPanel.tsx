"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Leaf, RefreshCw, Zap } from "lucide-react";
import { createClientRequestKey } from "@/lib/client-request-key";
import { formatKqCash, getKqEquipmentBuildingNumber, getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import { KQ_ENERGY_MODES, quoteKqEnergy, quoteKqTentEnergy, type KqEnergyMode, type KqEnergyQuote, type KqEnergySnapshot } from "@/lib/kanab-quest-energy";
import { getKqEffectiveTentProfiles, getKqProductionUnits } from "@/lib/kanab-quest-production";
import type { KqTentEquipmentProfile } from "@/lib/kanab-quest-production-scale";
import { getKqCultureWearPreview } from "@/lib/kanab-quest-culture-wear";
import styles from "./KqEnergyPanel.module.css";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import type { KqWarehouseRunSnapshot } from "@/lib/kanab-quest-warehouse";
import { getKqCampaignTotals, type KqCampaignMember } from "@/lib/kanab-quest-campaign";
import { KqAllocationBar, KqBarChart, KqProgressMeter } from "./KqVisuals";

const kwh = (wattHours: number) => `${(wattHours / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kWh`;
const finiteNonNegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function KqEnergyPanel({ selectedMode, onModeChange, onQuoteChange, lockedQuote, lockedTents, lockedScope, lockedWarehouse, runId, zoneId, campaign = false, campaignMembers, productionUnits = 1, disabled = false }: {
  campaign?: boolean;
  campaignMembers?: KqCampaignMember[];
  lockedWarehouse?: KqWarehouseRunSnapshot;
  productionUnits?: number;
  disabled?: boolean;
  selectedMode?: KqEnergyMode;
  onModeChange?: (mode: KqEnergyMode) => void;
  onQuoteChange?: (quote: KqEnergyQuote | null) => void;
  lockedQuote?: KqEnergyQuote;
  lockedTents?: KqTentEquipmentProfile[];
  lockedScope?: "tent" | "installation" | "building";
  runId?: string | null;
  zoneId?: string;
}) {
  const api = useKqTutorialApi();
  const [snapshot, setSnapshot] = useState<KqEnergySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const payment = useRef<{ amount: number; key: string } | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (zoneId) params.set("zoneId", zoneId);
      if (runId) params.set("runId", runId);
      if (campaign) params.set("campaign", "true");
      const response = await api.request(`/api/arena/placard/energy${params.size ? `?${params}` : ""}`, { cache: "no-store" });
      const body = await response.json() as KqEnergySnapshot & { error?: string };
      if (!response.ok) throw new Error(body.error || "Compteur indisponible.");
      if (id === generation.current) { setSnapshot(body); setError(""); }
    } catch (reason) {
      if (id === generation.current) setError(reason instanceof Error ? reason.message : "Compteur indisponible.");
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }, [api, campaign, runId, zoneId]);
  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    const unsubscribe = api.subscribe(["kq:equipment-updated"], update);
    const invalidate = () => { generation.current++; };
    return () => { invalidate(); unsubscribe(); };
  }, [refresh, api]);
  const quote = lockedQuote ?? (campaign ? snapshot?.quotes?.balanced : selectedMode ? snapshot?.quotes?.[selectedMode] : undefined);
  const warehouse = lockedQuote ? lockedWarehouse : snapshot?.warehouse;
  const recordedCampaign = Boolean(campaignMembers?.length);
  const campaignTotals = campaign && campaignMembers?.length ? getKqCampaignTotals(campaignMembers) : null;
  const campaignEnergy = campaignTotals?.energyCostCents ?? quote?.totalCents;
  const campaignConsumables = campaignTotals?.consumablesCostCents ?? warehouse?.consumablesCostCents;
  const campaignArea = campaignTotals?.areaM2 ?? warehouse?.activeAreaM2;
  const campaignBudget = finiteNonNegative(campaignEnergy) && finiteNonNegative(campaignConsumables)
    && finiteNonNegative(campaignArea) && Number.isFinite(campaignEnergy + campaignConsumables)
    ? { energy: campaignEnergy, consumables: campaignConsumables, area: campaignArea, total: campaignEnergy + campaignConsumables } : null;
  const campaignQuoteIncomplete = campaign && !recordedCampaign && !campaignBudget;
  const physicalQuote = !!warehouse || quote?.lines.some(line => line.code === "WAREHOUSE-CULTURE");
  useEffect(() => { if (warehouse && selectedMode && selectedMode !== "balanced") onModeChange?.("balanced"); }, [warehouse, selectedMode, onModeChange]);
  const sharedInstallation = Boolean(lockedQuote && lockedScope === "installation");
  const buildingInstallation = lockedQuote ? lockedScope === "building" : snapshot?.equipmentScopeVersion === 3;
  const units = getKqProductionUnits(lockedQuote ? lockedQuote.productionUnits : quote?.productionUnits ?? snapshot?.productionUnits ?? productionUnits);
  const quotedTents = lockedQuote ? lockedTents : snapshot?.tents ? getKqEffectiveTentProfiles({ ...snapshot, tents: snapshot.tents }) : undefined;
  const tentQuotes = !sharedInstallation && !buildingInstallation && quote && quotedTents?.length === units ? [...quotedTents]
    .sort((left, right) => left.tentNumber - right.tentNumber)
    .map(tent => ({ tentNumber: tent.tentNumber,
      starter: tent.codes.every(code => getKqEquipmentDefinition(code)?.purchasable === false),
      quote: quoteKqEnergy(tent.codes, tent.levels, quote.mode),
    })) : [];
  // A saved invoice must describe its frozen equipment, never today's installation.
  const showTentQuotes = units > 1 && quote && tentQuotes.length === units
    && tentQuotes.reduce((sum, tent) => sum + tent.quote.totalCents, 0) === quote.totalCents
    && tentQuotes.reduce((sum, tent) => sum + tent.quote.totalWattHours, 0) === quote.totalWattHours;
  const buildingQuotes = buildingInstallation && quote && quotedTents?.length === units ? [...new Set(quotedTents.map(tent => getKqEquipmentBuildingNumber(tent.tentNumber)))].map(buildingNumber => ({
    buildingNumber, quote: quoteKqTentEnergy(quotedTents.filter(tent => getKqEquipmentBuildingNumber(tent.tentNumber) === buildingNumber), quote.mode, "building"),
  })) : [];
  const showBuildingQuotes = buildingQuotes.length > 0 && quote
    && buildingQuotes.reduce((sum, building) => sum + building.quote.totalCents, 0) === quote.totalCents;
  const tentWearProfiles = snapshot?.tents?.length ? snapshot.tents : [{
    tentNumber: 1,
    equippedCodes: snapshot?.cultureEquipmentCodes ?? [],
    cultureWear: snapshot?.cultureWear ?? {},
    cultureOperationalCodes: snapshot?.cultureOperationalCodes ?? [],
  }];
  const wearProfiles = [
    ...tentWearProfiles.map(tent => ({...tent, destination: `Tente ${tent.tentNumber}`})),
    ...(snapshot?.equipmentScopeVersion === 3 ? snapshot.buildings ?? [] : []).map(building => ({...building, destination: `Entrepôt ${building.buildingNumber}`})),
  ];
  const equipmentName = (code: string) => getKqEquipmentDefinition(code)?.name ?? code;
  const scopedEquipmentName = (destination: string, code: string) => `${destination} · ${equipmentName(code)}`;
  const getWearPreviews = (mode: KqEnergyMode) => wearProfiles.flatMap(tent => tent.equippedCodes.flatMap(code => {
    const condition = tent.cultureWear[code];
    const preview = condition && !condition.due ? getKqCultureWearPreview(code, condition, mode) : null;
    return preview ? [{ ...preview, key: `${tent.destination}:${code}`, name: scopedEquipmentName(tent.destination, code) }] : [];
  }));
  const wearPreviews = selectedMode ? getWearPreviews(selectedMode) : [];
  const wearCostCents = wearPreviews.reduce((sum, item) => sum + item.wearCostCents, 0);
  const brokenEquipment = wearProfiles.flatMap(tent => tent.equippedCodes.filter(code => tent.cultureWear[code]?.due).map(code => scopedEquipmentName(tent.destination, code)));
  const fallbackEquipment = wearProfiles.flatMap(tent => tent.cultureOperationalCodes.filter(code => !tent.equippedCodes.includes(code)).map(code => scopedEquipmentName(tent.destination, code)));
  useEffect(() => { onQuoteChange?.(error || campaignQuoteIncomplete || campaign && !recordedCampaign && loading ? null : quote ?? null); }, [quote, error, campaignQuoteIncomplete, campaign, recordedCampaign, loading, onQuoteChange]);
  const invoice = snapshot?.invoices?.find((item) => item.runId === runId);
  const supplierInvoice = lockedQuote ? snapshot?.supplierInvoices?.find(item => item.runId === runId)
    ?? (snapshot?.supplierInvoice && snapshot.supplierInvoice.runId === runId ? snapshot.supplierInvoice : null) : null;
  const consumptionByEquipment = new Map<string, { label: string; value: number }>();
  for (const line of quote?.lines ?? []) {
    const current = consumptionByEquipment.get(line.code);
    consumptionByEquipment.set(line.code, { label: getKqEquipmentDefinition(line.code)?.name ?? line.name, value: (current?.value ?? 0) + line.wattHours });
  }
  const consumption = [...consumptionByEquipment.values()].filter(item => item.value > 0).sort((left, right) => right.value - left.value);
  const consumptionItems = consumption.slice(0, 5).map(item => ({ ...item, displayValue: kwh(item.value), tone: "gold" as const }));
  if (consumption.length > 5) {
    const remaining = consumption.slice(5).reduce((sum, item) => sum + item.value, 0);
    consumptionItems.push({ label: "Autres appareils", value: remaining, displayValue: kwh(remaining), tone: "gold" });
  }
  const due = snapshot?.outstandingCents ?? 0;
  const pay = async () => {
    if (inFlight.current || !snapshot || due <= 0 || snapshot.cashCents < due) return;
    inFlight.current = true; setPending(true); setError(""); setNotice("");
    if (payment.current?.amount !== due) payment.current = { amount: due, key: createClientRequestKey() };
    try {
      const response = await api.request("/api/arena/placard/energy", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestKey: payment.current.key, expectedCents: due }) });
      const result = await response.json() as { error?: string; paidCents: number };
      if (!response.ok) throw new Error(result.error || "Règlement impossible.");
      setNotice(`${formatKqCash(result.paidCents)} réglés. Factures acquittées !`);
      await refresh(); api.notify("kq:equipment-updated");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Règlement impossible."); }
    finally { inFlight.current = false; setPending(false); }
  };

  if (campaign) {
    const invoices = (snapshot?.supplierInvoices ?? []).filter(item => campaignMembers?.some(member => member.runId === item.runId));
    const visibleBudget = recordedCampaign || !loading && !error ? campaignBudget : null;
    const chargeStatus = visibleBudget ? "ready" : loading ? "loading" : error ? "error" : "incomplete";
    return <section className={styles.panel} aria-label="Charges de la campagne" data-campaign-energy data-campaign-charge-status={chargeStatus} aria-busy={loading}>
      <header><Zap aria-hidden="true" /><div><h3>{recordedCampaign ? "Charges enregistrées" : "Charges prévues"}</h3></div><button type="button" aria-label="Actualiser les charges" disabled={disabled} onClick={() => void refresh()}><RefreshCw size={16} /></button></header>
      {visibleBudget ? <><div className={styles.budgetHeader}><span>{visibleBudget.area.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m² engagés</span><strong data-campaign-budget>{formatKqCash(visibleBudget.total)}<small>Électricité et consommables</small></strong></div>
        <dl className={styles.campaignBilling} data-campaign-billing>
          <div><dt>Électricité</dt><dd>{formatKqCash(visibleBudget.energy)}</dd><dd className={styles.billingTiming}>Facturée à la récolte.</dd></div>
          <div><dt>Consommables</dt><dd>{formatKqCash(visibleBudget.consumables)}</dd><dd className={styles.billingTiming}>À régler sous 5 jours réels après le lancement.</dd></div>
        </dl>
        <details><summary>Répartition des charges</summary><KqAllocationBar label="Répartition des charges" items={[
          { label: "Électricité", value: visibleBudget.energy, displayValue: formatKqCash(visibleBudget.energy), tone: "gold" },
          { label: "Consommables", value: visibleBudget.consumables, displayValue: formatKqCash(visibleBudget.consumables), tone: "teal" },
        ]} /><p>Les cartes jouées et les soins sont consommés une seule fois pour toutes les cultures réunies. Les soins choisis pendant la culture ne sont pas compris dans ces charges.</p></details>
      </> : loading ? <p role="status">{snapshot ? "Actualisation des charges…" : "Calcul des charges…"}</p>
        : !error ? <p className={styles.error} role="alert">Les charges sont incomplètes. Actualise pour vérifier les montants et la surface avant de commencer.</p> : null}
      {campaignMembers && <details><summary>Détail par zone</summary><ul>{campaignMembers.map(member => <li key={member.runId}><span>{member.warehouse.zones[0]?.name}</span><b>{formatKqCash(member.warehouse.operatingCostCents)}</b></li>)}</ul>{invoices.map(item => <p key={item.runId}>{campaignMembers.find(member => member.runId === item.runId)?.warehouse.zones[0]?.name} : {formatKqCash(item.remainingCents)} restant.</p>)}</details>}
      {campaignMembers && <p><Link href="/arene/placard?view=treasury&pole=accounting">Consulter les factures</Link></p>}
      {error && !loading && <p className={styles.error} role="alert">{error} Actualise les charges pour réessayer.</p>}
    </section>;
  }
  return <section className={styles.panel} aria-label="Charges de Kanab Quest">
    <header><Zap aria-hidden="true" /><div><small>{lockedQuote ? physicalQuote ? "Charges de cette culture" : "Facture de fin de cycle" : selectedMode ? "Avant de lancer la culture" : "Charges de Kanab Quest"}</small><h3>{physicalQuote ? "Charges de la chambre de culture" : lockedQuote ? KQ_ENERGY_MODES[lockedQuote.mode].name : "Électricité et entretien"}</h3></div><button type="button" aria-label="Actualiser les charges" onClick={() => void refresh()}><RefreshCw size={16} /></button></header>
    {warehouse ? <><div className={styles.budgetHeader}><span>{warehouse.activeAreaM2} m² engagés</span><strong>{formatKqCash(warehouse.operatingCostCents)}<small>Budget {lockedQuote ? "de cette culture" : "prévu"}</small></strong></div><KqAllocationBar label="Répartition des charges" items={[
      { label: "Électricité", value: warehouse.energyCostCents, displayValue: formatKqCash(warehouse.energyCostCents), tone: "gold" },
      { label: "Consommables", value: warehouse.consumablesCostCents, displayValue: formatKqCash(warehouse.consumablesCostCents), tone: "teal" },
    ]} />{lockedQuote ? <>{supplierInvoice ? <p>{supplierInvoice.remainingCents === 0 ? "Facture fournisseur réglée." : <>Facture fournisseur : <strong>{formatKqCash(supplierInvoice.remainingCents)}</strong> à régler avant le <time dateTime={supplierInvoice.dueAt}>{new Date(supplierInvoice.dueAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</time>.</>}</p> : null}<p><Link href="/arene/placard?view=treasury&pole=accounting">Consulter les factures fournisseur</Link></p></> : <details><summary>Quand les consommables sont-ils facturés ?</summary><p>À 30 jours de jeu, soit <strong>5 jours réels</strong> après le lancement. Aucun débit immédiat pour les consommables.</p></details>}</> : !physicalQuote && (quote || snapshot) ? <p><strong>{units} tente{units>1?"s":""} {lockedQuote ? "pour cette culture" : "dans ton installation"}</strong></p> : null}
    {selectedMode && snapshot?.chanvrierStrength === "green-thumb" ? <p><Leaf size={16} /> Main Verte · +2 XP au départ, en plus du bonus de ton Buddie.</p> : null}
    {selectedMode && !!snapshot?.maintenanceDueNext?.length ? <p><strong>Entretien à prévoir :</strong> {snapshot.maintenanceDueNext.join(", ")}. Consulte ton entrepôt avant la prochaine transformation.</p> : null}
    {selectedMode && onModeChange && !physicalQuote ? <div className={styles.modes} role="group" aria-label="Mode énergétique">
      {(Object.entries(KQ_ENERGY_MODES) as [KqEnergyMode, typeof KQ_ENERGY_MODES[KqEnergyMode]][]).map(([mode, config]) => <button type="button" key={mode} disabled={disabled} aria-pressed={selectedMode === mode} onClick={() => onModeChange(mode)}><strong>{config.name}</strong><small>{config.label}</small>{snapshot ? <><b>{formatKqCash(snapshot.quotes[mode].totalCents)} d’électricité</b>{wearPreviews.length > 0 ? <small>Usure estimée : {formatKqCash(getWearPreviews(mode).reduce((sum, item) => sum + item.wearCostCents, 0))}</small> : null}</> : null}</button>)}
    </div> : null}
    {quote ? <>
      <div className={styles.meter}><div><small>Consommation totale · {warehouse ? `${warehouse.activeAreaM2} m²` : physicalQuote ? "chambre de culture" : `${units} tente${units > 1 ? "s" : ""}`}</small><strong>{(quote.totalWattHours / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} <em>kWh</em></strong></div><div><small>{lockedQuote ? "Électricité totale" : "Électricité totale prévue"}</small><strong>{formatKqCash(quote.totalCents)}</strong></div></div>
      {consumptionItems.length > 1 ? <KqBarChart title="Consommation par équipement" items={consumptionItems} /> : null}
      {showTentQuotes ? <details aria-label="Électricité par tente"><summary>Comparer les tentes</summary><KqBarChart title="Coût de l’électricité par tente" items={tentQuotes.map(tent => ({
        label: `Tente ${tent.tentNumber} · ${tent.starter ? "kit de départ" : "matériel aménagé"}`,
        value: tent.quote.totalCents, displayValue: `${formatKqCash(tent.quote.totalCents)} · ${kwh(tent.quote.totalWattHours)}`, tone: "gold",
      }))} /></details> : null}
      {showBuildingQuotes ? <details aria-label="Électricité par bâtiment"><summary>Comparer les entrepôts</summary><KqBarChart title="Coût de l’électricité par entrepôt" items={buildingQuotes.map(building => ({
        label: `Entrepôt ${building.buildingNumber}`, value: building.quote.totalCents,
        displayValue: `${formatKqCash(building.quote.totalCents)} · ${kwh(building.quote.totalWattHours)}`, tone: "gold",
      }))} /></details> : null}
      {quote.savingsCents > 0 ? <div className={styles.solar}><KqProgressMeter label="Couverture solaire" value={quote.solarPercent} max={100} valueLabel={`${quote.solarPercent} %`} hint={`${formatKqCash(quote.savingsCents)} économisés`} /></div> : null}
      <details><summary>Détail par appareil</summary><ul>{quote.lines.map((line) => {
        const common = sharedInstallation && ["security", "flower-drying"].includes(getKqEquipmentDefinition(line.code)?.slot ?? "");
        return <li key={`${line.buildingNumber ? `building:${line.buildingNumber}` : line.tentNumber ?? "legacy"}:${line.code}`}><span>{common ? "Installation · " : line.buildingNumber ? `Entrepôt ${line.buildingNumber} · ` : line.tentNumber ? `Tente ${line.tentNumber} · ` : ""}{getKqEquipmentDefinition(line.code)?.name ?? line.name}{!physicalQuote ? ` · niv. ${line.level}` : ""}{!physicalQuote && !common && !line.tentNumber && !line.buildingNumber && units > 1 ? ` ×${units}` : ""}</span><b>{(line.wattHours / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kWh</b></li>;
      })}</ul><p>{formatKqCash(quote.tariffCentsPerKwh)} virtuel / kWh. Le temps hors ligne ne change pas le montant.{physicalQuote ? " La consommation découle des appareils entiers et des heures équivalentes simulées. L’installation est figée pour toute la culture." : sharedInstallation ? " Cette ancienne culture conserve son devis : séchoir et sécurité comptés une seule fois, solaire appliqué à l’installation." : lockedQuote ? " Les consommations suivent le matériel enregistré au début de cette culture. Ce devis reste inchangé." : buildingInstallation ? " Chaque tente consomme pour sa culture ; séchoir et sécurité sont comptés une fois par bâtiment. Le solaire réduit la facture de son bâtiment." : " Chaque tente paie ses appareils, y compris son séchoir à fleurs et sa sécurité. Son solaire réduit uniquement sa propre facture."}</p></details>
      {invoice ? <p className={styles.stamp} data-paid={invoice.remainingCents === 0}>{invoice.remainingCents === 0 ? <><Check size={17} /> Réglée</> : `Reste sur ce cycle : ${formatKqCash(invoice.remainingCents)}`}</p> : null}
      {lockedQuote && invoice && quote.totalWattHours > 0 ? <p><Leaf size={16} /> Rendement énergétique : {(invoice.harvestGrams * 1000 / quote.totalWattHours).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} g/kWh</p> : null}
    </> : !snapshot && !error ? <p role="status">Lecture du compteur…</p> : null}
    {selectedMode && brokenEquipment.length > 0 ? <p className={styles.error} role="status"><strong>Matériel hors service :</strong> {brokenEquipment.join(", ")}. Ses bonus sont désactivés.{fallbackEquipment.length > 0 ? ` Dépannage : ${fallbackEquipment.join(", ")}.` : ""} Remplace-le dans ton entrepôt pour retrouver ses bonus.</p> : null}
    {selectedMode && wearPreviews.length > 0 ? <section className={styles.wearPreview} aria-label="Usure prévue du matériel">
      <strong>État du matériel après cette culture · {KQ_ENERGY_MODES[selectedMode].name}</strong>
      <ul>{wearPreviews.map((item) => <li key={item.key}>
        <div><span>{item.name}</span><b>{item.conditionBefore.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % → {item.conditionAfter.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</b></div>
        <progress value={item.conditionAfter} max={100} aria-label={`État prévu de ${item.name}`} />
        <small>Durée restante dans ce mode : {item.cyclesRemaining} culture{item.cyclesRemaining > 1 ? "s" : ""}, celle-ci comprise · remplacement {formatKqCash(item.replacementCents)}.</small>
        {item.accelerated ? <small className={styles.error}>Intensif sur un appareil sous 30 % : usure accélérée.</small> : null}
        {item.conditionAfter === 0 ? <small className={styles.error}>Termine cette culture, puis devra être remplacé pour apporter ses bonus.</small> : null}
      </li>)}</ul>
      <p><strong>Usure estimée : {formatKqCash(wearCostCents)}</strong> · non prélevée.</p>
      <details><summary>Comprendre l’usure</summary><p>Cette estimation aide à prévoir les futurs rachats ; seul le remplacement débite ta trésorerie. L’éco prolonge la durée de vie. L’état du matériel ne remonte jamais entre deux cultures. Le kit de départ reste disponible pour le dépannage.</p></details>
    </section> : null}
    {invoice?.dogCare ? <div className={styles.dogCare}>
      <Image src="/app/kanab-quest/equipment/equipment-SECURITY-DOG-hero-v1.webp" alt="" width={88} height={88} />
      <div><strong>Soins du compagnon · cycle {invoice.dogCare.cycle}</strong>
        <p>Nourriture : {formatKqCash(invoice.dogCare.foodCents)}{invoice.dogCare.vetCents > 0 ? ` · Vétérinaire : ${formatKqCash(invoice.dogCare.vetCents)}` : ""}</p>
        <small>Prélevé en fin de culture : {formatKqCash(invoice.dogCare.paidCents)}.{invoice.dogCare.paidCents < invoice.dogCare.totalCents ? " Le reste a été ajouté aux factures à régler." : ""}</small>
      </div>
    </div> : null}
    {snapshot?.dogCare ? <div className={styles.dogCare}>
      {!invoice?.dogCare ? <Image src="/app/kanab-quest/equipment/equipment-SECURITY-DOG-hero-v1.webp" alt="" width={88} height={88} /> : null}
      <div><strong>Compagnon · prochaine culture : {formatKqCash(snapshot.dogCare.nextTotalCents)}</strong>
        <p>{formatKqCash(snapshot.dogCare.foodCents)} de nourriture par cycle. Vétérinaire : {formatKqCash(snapshot.dogCare.vetCents)}{snapshot.dogCare.cyclesUntilVet === 1 ? " à la prochaine récolte" : ` dans ${snapshot.dogCare.cyclesUntilVet} cultures`}.</p>
        <small>Prélevés à la récolte, même avec une autre protection installée. Aucun frais lié au temps hors ligne.</small>
      </div>
    </div> : null}
    {selectedMode && quote && snapshot?.dogCare ? <p><strong>Total prévu : {formatKqCash(quote.totalCents + snapshot.dogCare.nextTotalCents)}</strong> · électricité et soins du compagnon.</p> : null}
    {snapshot && !selectedMode ? <>
      {snapshot.storageClimate && (snapshot.storageClimate.code || snapshot.storageClimate.outstandingCents > 0) && <p><strong>Climatisation du stockage : {formatKqCash(snapshot.storageClimate.monthlyCostCents)} / mois de jeu</strong> · {snapshot.storageClimate.areaM2} m². Facturée séparément des cultures, tous les 5 jours réels.{snapshot.storageClimate.outstandingCents > 0 ? ` ${formatKqCash(snapshot.storageClimate.outstandingCents)} d’impayés inclus dans le solde ci-dessous.` : ""} <Link href="/arene/placard?view=treasury&pole=accounting">Voir les factures</Link></p>}
      {snapshot.bestGramsPerKwh !== null ? <p><Leaf size={16} /> Record personnel : {Number(snapshot.bestGramsPerKwh).toLocaleString("fr-FR")} g/kWh</p> : null}
      {due > 0 ? <div className={styles.payment}><strong>Électricité et soins restant dus : {formatKqCash(due)}</strong><button type="button" disabled={pending || snapshot.cashCents < due} onClick={() => void pay()}>{pending ? "Règlement…" : `Régler l’électricité et les soins · ${formatKqCash(due)}`}</button><p>Sinon, tes prochaines ventes règlent automatiquement les factures, dans la limite de 50 % de chaque versement. Tu peux continuer à jouer.</p>{snapshot.cashCents < due ? <small>Trésorerie disponible : {formatKqCash(snapshot.cashCents)}</small> : null}</div> : <p className={styles.stamp} data-paid><Check size={17} /> Aucune facture d’électricité ou de soins en attente</p>}
      {!lockedQuote && snapshot.invoices.length > 0 ? <details><summary>Dernières factures d’énergie et de soins · {snapshot.invoiceCount} cycles au total</summary><ul>{snapshot.invoices.map((item) => <li key={item.runId}><span>{new Date(item.createdAt).toLocaleDateString("fr-FR")} · {KQ_ENERGY_MODES[item.quote.mode].name}<small>Cycle {item.runId.slice(0, 8)}</small>{item.dogCare ? <small>Électricité : {formatKqCash(item.quote.totalCents)} · Nourriture : {formatKqCash(item.dogCare.foodCents)}{item.dogCare.vetCents > 0 ? ` · Vétérinaire : ${formatKqCash(item.dogCare.vetCents)}` : ""} · Soins prélevés à la récolte : {formatKqCash(item.dogCare.paidCents)}</small> : null}</span><b>{formatKqCash(item.totalCents)}<small>{item.remainingCents ? `${formatKqCash(item.remainingCents)} restants` : "Réglée"}</small></b></li>)}</ul></details> : null}
    </> : selectedMode ? <p>Électricité facturée à la récolte. Paiement immédiat ou prélèvement progressif sur tes ventes.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p className={styles.error} role="alert">{error} Utilise Actualiser pour réessayer.</p> : null}
  </section>;
}
