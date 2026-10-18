"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Leaf, RefreshCw, Sun, Zap } from "lucide-react";
import { formatKqCash, getKqEquipmentBuildingNumber, getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import { KQ_ENERGY_MODES, quoteKqEnergy, quoteKqTentEnergy, type KqEnergyMode, type KqEnergyQuote, type KqEnergySnapshot } from "@/lib/kanab-quest-energy";
import { getKqEffectiveTentProfiles, getKqProductionUnits } from "@/lib/kanab-quest-production";
import type { KqTentEquipmentProfile } from "@/lib/kanab-quest-production-scale";
import { getKqCultureWearPreview } from "@/lib/kanab-quest-culture-wear";
import styles from "./KqEnergyPanel.module.css";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import type { KqWarehouseRunSnapshot } from "@/lib/kanab-quest-warehouse";
import { getKqCampaignTotals, type KqCampaignMember } from "@/lib/kanab-quest-campaign";

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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const payment = useRef<{ amount: number; key: string } | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
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
    }
  }, [api, campaign, runId, zoneId]);
  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    const unsubscribe = api.subscribe(["kq:equipment-updated"], update);
    const invalidate = () => { generation.current++; };
    return () => { invalidate(); unsubscribe(); };
  }, [refresh, api]);
  const quote = lockedQuote ?? (campaign ? snapshot?.quotes.balanced : selectedMode ? snapshot?.quotes[selectedMode] : undefined);
  const warehouse = lockedQuote ? lockedWarehouse : snapshot?.warehouse;
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
  useEffect(() => { onQuoteChange?.(error ? null : quote ?? null); }, [quote, error, onQuoteChange]);
  const invoice = snapshot?.invoices.find((item) => item.runId === runId);
  const supplierInvoice = lockedQuote ? snapshot?.supplierInvoices?.find(item => item.runId === runId)
    ?? (snapshot?.supplierInvoice && snapshot.supplierInvoice.runId === runId ? snapshot.supplierInvoice : null) : null;
  const due = snapshot?.outstandingCents ?? 0;
  const pay = async () => {
    if (inFlight.current || !snapshot || due <= 0 || snapshot.cashCents < due) return;
    inFlight.current = true; setPending(true); setError(""); setNotice("");
    if (payment.current?.amount !== due) payment.current = { amount: due, key: crypto.randomUUID() };
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
    const totals = campaignMembers?.length ? getKqCampaignTotals(campaignMembers) : null;
    const energy = totals?.energyCostCents ?? quote?.totalCents;
    const consumables = totals?.consumablesCostCents ?? warehouse?.consumablesCostCents;
    const area = totals?.areaM2 ?? warehouse?.activeAreaM2;
    const invoices = (snapshot?.supplierInvoices ?? []).filter(item => campaignMembers?.some(member => member.runId === item.runId));
    return <section className={styles.panel} aria-label="Charges de la campagne" data-campaign-energy>
      <header><Zap aria-hidden="true" /><div><small>{campaignMembers ? "Installation enregistrée" : "Avant de commencer"}</small><h3>Charges de la campagne</h3></div><button type="button" aria-label="Actualiser les charges" disabled={disabled} onClick={() => void refresh()}><RefreshCw size={16} /></button></header>
      {energy !== undefined && consumables !== undefined ? <><p>{area} m² engagés · <strong>{formatKqCash(energy + consumables)}</strong> pour toutes les cultures.</p><div className={styles.meter}><div><small>Électricité</small><strong>{formatKqCash(energy)}</strong></div><div><small>Consommables</small><strong>{formatKqCash(consumables)}</strong></div></div><p>Consommables facturés à 5 jours réels. Les cartes jouées et les soins sont consommés une seule fois pour la campagne.</p></> : <p role="status">Calcul des charges…</p>}
      {campaignMembers && <details><summary>Détail par zone</summary><ul>{campaignMembers.map(member => <li key={member.runId}><span>{member.warehouse.zones[0]?.name}</span><b>{formatKqCash(member.warehouse.operatingCostCents)}</b></li>)}</ul>{invoices.map(item => <p key={item.runId}>{campaignMembers.find(member => member.runId === item.runId)?.warehouse.zones[0]?.name} : {formatKqCash(item.remainingCents)} restant.</p>)}</details>}
      {campaignMembers && <p><Link href="/arene/placard?view=treasury&pole=accounting">Consulter les factures</Link></p>}
      {error && <p role="alert">{error}</p>}
    </section>;
  }
  return <section className={styles.panel} aria-label="Charges de Kanab Quest">
    <header><Zap aria-hidden="true" /><div><small>{lockedQuote ? physicalQuote ? "Charges de cette culture" : "Facture de fin de cycle" : selectedMode ? "Avant de lancer la culture" : "Charges de Kanab Quest"}</small><h3>{physicalQuote ? "Charges de la chambre de culture" : lockedQuote ? KQ_ENERGY_MODES[lockedQuote.mode].name : "Électricité et entretien"}</h3></div><button type="button" aria-label="Actualiser les charges" onClick={() => void refresh()}><RefreshCw size={16} /></button></header>
    {warehouse ? <><p><strong>{warehouse.activeAreaM2} m² engagés</strong> · appareils et consommation enregistrés pour cette culture.</p><p>Consommables {lockedQuote ? "de cette culture" : "prévus"} : <strong>{formatKqCash(warehouse.consumablesCostCents)}</strong>. Budget total avec l’énergie : <strong>{formatKqCash(warehouse.operatingCostCents)}</strong>.</p>{lockedQuote ? <>{supplierInvoice ? <p>{supplierInvoice.remainingCents === 0 ? "Facture fournisseur réglée." : <>Facture fournisseur : <strong>{formatKqCash(supplierInvoice.remainingCents)}</strong> à régler avant le <time dateTime={supplierInvoice.dueAt}>{new Date(supplierInvoice.dueAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</time>.</>}</p> : null}<p><Link href="/arene/placard?view=treasury&pole=accounting">Consulter les factures fournisseur dans Trésorerie</Link>.</p></> : <p>Les consommables sont facturés à 30 jours de jeu, soit <strong>5 jours réels</strong> après le lancement. Aucun débit immédiat pour les consommables.</p>}</> : !physicalQuote && (quote || snapshot) ? <p><strong>{units} tente{units>1?"s":""} {lockedQuote ? "pour cette culture" : "dans ton installation"}</strong> · les montants couvrent toutes ces tentes.</p> : null}
    {selectedMode && snapshot?.chanvrierStrength === "green-thumb" ? <p><Leaf size={16} /> Main Verte · +2 XP au départ, en plus du bonus de ton Buddie.</p> : null}
    {selectedMode && !!snapshot?.maintenanceDueNext?.length ? <p><strong>Entretien à prévoir :</strong> {snapshot.maintenanceDueNext.join(", ")}. Consulte ton entrepôt avant la prochaine transformation.</p> : null}
    {selectedMode && onModeChange && !physicalQuote ? <div className={styles.modes} role="group" aria-label="Mode énergétique">
      {(Object.entries(KQ_ENERGY_MODES) as [KqEnergyMode, typeof KQ_ENERGY_MODES[KqEnergyMode]][]).map(([mode, config]) => <button type="button" key={mode} disabled={disabled} aria-pressed={selectedMode === mode} onClick={() => onModeChange(mode)}><strong>{config.name}</strong><small>{config.label}</small>{snapshot ? <><b>{formatKqCash(snapshot.quotes[mode].totalCents)} d’électricité</b>{wearPreviews.length > 0 ? <small>Usure estimée : {formatKqCash(getWearPreviews(mode).reduce((sum, item) => sum + item.wearCostCents, 0))}</small> : null}</> : null}</button>)}
    </div> : null}
    {quote ? <>
      <div className={styles.meter}><div><small>Consommation totale · {warehouse ? `${warehouse.activeAreaM2} m²` : physicalQuote ? "chambre de culture" : `${units} tente${units > 1 ? "s" : ""}`}</small><strong>{(quote.totalWattHours / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} <em>kWh</em></strong></div><div><small>{lockedQuote ? "Électricité totale" : "Électricité totale prévue"}</small><strong>{formatKqCash(quote.totalCents)}</strong></div></div>
      {showTentQuotes ? <div className={styles.tentTotals} aria-label="Électricité par tente">
        <strong>Les consommations de tes {units} tentes s’additionnent</strong>
        <dl>{tentQuotes.map(tent => <div key={tent.tentNumber}>
          <dt>Tente {tent.tentNumber}<small>{tent.starter ? "Kit de départ" : "Matériel aménagé"}</small></dt>
          <dd><b>{formatKqCash(tent.quote.totalCents)}</b><small>{(tent.quote.totalWattHours / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kWh</small></dd>
        </div>)}</dl>
        <p>Le total dépend du matériel installé dans chaque tente.</p>
      </div> : null}
      {showBuildingQuotes ? <div className={styles.tentTotals} aria-label="Électricité par bâtiment">
        <strong>Consommation des tentes et services de chaque entrepôt</strong>
        <dl>{buildingQuotes.map(building => <div key={building.buildingNumber}><dt>Entrepôt {building.buildingNumber}<small>Tentes et services partagés</small></dt><dd><b>{formatKqCash(building.quote.totalCents)}</b><small>{(building.quote.totalWattHours / 1000).toLocaleString("fr-FR", {maximumFractionDigits: 2})} kWh</small></dd></div>)}</dl>
        <p>Séchoir et sécurité comptés une fois par bâtiment. Le solaire couvre les appareils de son bâtiment.</p>
      </div> : null}
      {quote.savingsCents > 0 ? <p className={styles.solar}><Sun size={16} /> Solaire : {quote.solarPercent} % couverts · {formatKqCash(quote.savingsCents)} économisés</p> : null}
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
      <p><strong>Usure estimée : {formatKqCash(wearCostCents)}</strong> de matériel consommé. À prévoir pour les futurs rachats ; seul le remplacement débite ta trésorerie.</p>
      <p>L’éco prolonge la durée de vie. L’état du matériel ne remonte jamais entre deux cultures. Le kit de départ reste disponible pour le dépannage.</p>
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
