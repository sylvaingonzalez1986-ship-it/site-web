"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Leaf, RefreshCw, Sun, Zap } from "lucide-react";
import { formatKqCash, getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import { KQ_ENERGY_MODES, quoteKqEnergy, type KqEnergyMode, type KqEnergyQuote, type KqEnergySnapshot } from "@/lib/kanab-quest-energy";
import { getKqProductionUnits } from "@/lib/kanab-quest-production";
import type { KqTentEquipmentProfile } from "@/lib/kanab-quest-production-scale";
import { getKqCultureWearPreview } from "@/lib/kanab-quest-culture-wear";
import styles from "./KqEnergyPanel.module.css";

export function KqEnergyPanel({ selectedMode, onModeChange, onQuoteChange, lockedQuote, lockedTents, lockedScope, runId, productionUnits = 1, disabled = false }: {
  productionUnits?: number;
  disabled?: boolean;
  selectedMode?: KqEnergyMode;
  onModeChange?: (mode: KqEnergyMode) => void;
  onQuoteChange?: (quote: KqEnergyQuote | null) => void;
  lockedQuote?: KqEnergyQuote;
  lockedTents?: KqTentEquipmentProfile[];
  lockedScope?: "tent" | "installation";
  runId?: string | null;
}) {
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
      const response = await fetch("/api/arena/placard/energy", { cache: "no-store" });
      const body = await response.json() as KqEnergySnapshot & { error?: string };
      if (!response.ok) throw new Error(body.error || "Compteur indisponible.");
      if (id === generation.current) { setSnapshot(body); setError(""); }
    } catch (reason) {
      if (id === generation.current) setError(reason instanceof Error ? reason.message : "Compteur indisponible.");
    }
  }, []);
  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    window.addEventListener("kq:equipment-updated", update);
    const invalidate = () => { generation.current++; };
    return () => { invalidate(); window.removeEventListener("kq:equipment-updated", update); };
  }, [refresh]);
  const quote = lockedQuote ?? (selectedMode ? snapshot?.quotes[selectedMode] : undefined);
  const sharedInstallation = Boolean(lockedQuote && lockedScope === "installation");
  const units = getKqProductionUnits(lockedQuote ? lockedQuote.productionUnits : quote?.productionUnits ?? snapshot?.productionUnits ?? productionUnits);
  const quotedTents = lockedQuote ? lockedTents : snapshot?.tents?.map(tent => ({
    tentNumber: tent.tentNumber, codes: tent.cultureOperationalCodes, levels: tent.levels,
  }));
  const tentQuotes = !sharedInstallation && quote && quotedTents?.length === units ? [...quotedTents]
    .sort((left, right) => left.tentNumber - right.tentNumber)
    .map(tent => ({ tentNumber: tent.tentNumber,
      starter: tent.codes.every(code => getKqEquipmentDefinition(code)?.purchasable === false),
      quote: quoteKqEnergy(tent.codes, tent.levels, quote.mode),
    })) : [];
  // A saved invoice must describe its frozen equipment, never today's installation.
  const showTentQuotes = units > 1 && quote && tentQuotes.length === units
    && tentQuotes.reduce((sum, tent) => sum + tent.quote.totalCents, 0) === quote.totalCents
    && tentQuotes.reduce((sum, tent) => sum + tent.quote.totalWattHours, 0) === quote.totalWattHours;
  const wearProfiles = snapshot?.tents?.length ? snapshot.tents : [{
    tentNumber: 1,
    equippedCodes: snapshot?.cultureEquipmentCodes ?? [],
    cultureWear: snapshot?.cultureWear ?? {},
    cultureOperationalCodes: snapshot?.cultureOperationalCodes ?? [],
  }];
  const equipmentName = (code: string) => getKqEquipmentDefinition(code)?.name ?? code;
  const tentEquipmentName = (tentNumber: number, code: string) => `Tente ${tentNumber} · ${equipmentName(code)}`;
  const getWearPreviews = (mode: KqEnergyMode) => wearProfiles.flatMap(tent => tent.equippedCodes.flatMap(code => {
    const condition = tent.cultureWear[code];
    const preview = condition && !condition.due ? getKqCultureWearPreview(code, condition, mode) : null;
    return preview ? [{ ...preview, key: `${tent.tentNumber}:${code}`, name: tentEquipmentName(tent.tentNumber, code) }] : [];
  }));
  const wearPreviews = selectedMode ? getWearPreviews(selectedMode) : [];
  const wearCostCents = wearPreviews.reduce((sum, item) => sum + item.wearCostCents, 0);
  const brokenEquipment = wearProfiles.flatMap(tent => tent.equippedCodes.filter(code => tent.cultureWear[code]?.due).map(code => tentEquipmentName(tent.tentNumber, code)));
  const fallbackEquipment = wearProfiles.flatMap(tent => tent.cultureOperationalCodes.filter(code => !tent.equippedCodes.includes(code)).map(code => tentEquipmentName(tent.tentNumber, code)));
  useEffect(() => { onQuoteChange?.(error ? null : quote ?? null); }, [quote, error, onQuoteChange]);
  const invoice = snapshot?.invoices.find((item) => item.runId === runId);
  const due = snapshot?.outstandingCents ?? 0;
  const pay = async () => {
    if (inFlight.current || !snapshot || due <= 0 || snapshot.cashCents < due) return;
    inFlight.current = true; setPending(true); setError(""); setNotice("");
    if (payment.current?.amount !== due) payment.current = { amount: due, key: crypto.randomUUID() };
    try {
      const response = await fetch("/api/arena/placard/energy", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestKey: payment.current.key, expectedCents: due }) });
      const result = await response.json() as { error?: string; paidCents: number };
      if (!response.ok) throw new Error(result.error || "Règlement impossible.");
      setNotice(`${formatKqCash(result.paidCents)} réglés. Factures acquittées !`);
      await refresh(); window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Règlement impossible."); }
    finally { inFlight.current = false; setPending(false); }
  };

  return <section className={styles.panel} aria-label="Charges du Placard">
    <header><Zap aria-hidden="true" /><div><small>{lockedQuote ? "Facture de fin de cycle" : selectedMode ? "Avant de lancer la culture" : "Charges du Placard"}</small><h3>{lockedQuote ? KQ_ENERGY_MODES[lockedQuote.mode].name : "Électricité et entretien"}</h3></div><button type="button" aria-label="Actualiser les charges" onClick={() => void refresh()}><RefreshCw size={16} /></button></header>
    {quote || snapshot ? <p><strong>{units} tente{units>1?"s":""} {lockedQuote ? "pour cette culture" : "dans ton installation"}</strong> · les montants couvrent toutes ces tentes.</p> : null}
    {selectedMode && snapshot?.chanvrierStrength === "green-thumb" ? <p><Leaf size={16} /> Main Verte · +2 XP au départ, en plus du bonus de ton Buddie.</p> : null}
    {selectedMode && !!snapshot?.maintenanceDueNext?.length ? <p><strong>Entretien à prévoir :</strong> {snapshot.maintenanceDueNext.join(", ")}. Consulte ton entrepôt avant la prochaine transformation.</p> : null}
    {selectedMode && onModeChange ? <div className={styles.modes} role="group" aria-label="Mode énergétique">
      {(Object.entries(KQ_ENERGY_MODES) as [KqEnergyMode, typeof KQ_ENERGY_MODES[KqEnergyMode]][]).map(([mode, config]) => <button type="button" key={mode} disabled={disabled} aria-pressed={selectedMode === mode} onClick={() => onModeChange(mode)}><strong>{config.name}</strong><small>{config.label}</small>{snapshot ? <><b>{formatKqCash(snapshot.quotes[mode].totalCents)} d’électricité</b>{wearPreviews.length > 0 ? <small>Usure estimée : {formatKqCash(getWearPreviews(mode).reduce((sum, item) => sum + item.wearCostCents, 0))}</small> : null}</> : null}</button>)}
    </div> : null}
    {quote ? <>
      <div className={styles.meter}><div><small>Consommation totale · {units} tente{units > 1 ? "s" : ""}</small><strong>{(quote.totalWattHours / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} <em>kWh</em></strong></div><div><small>{lockedQuote ? "Électricité totale" : "Électricité totale prévue"}</small><strong>{formatKqCash(quote.totalCents)}</strong></div></div>
      {showTentQuotes ? <div className={styles.tentTotals} aria-label="Électricité par tente">
        <strong>Les consommations de tes {units} tentes s’additionnent</strong>
        <dl>{tentQuotes.map(tent => <div key={tent.tentNumber}>
          <dt>Tente {tent.tentNumber}<small>{tent.starter ? "Kit de départ" : "Matériel aménagé"}</small></dt>
          <dd><b>{formatKqCash(tent.quote.totalCents)}</b><small>{(tent.quote.totalWattHours / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kWh</small></dd>
        </div>)}</dl>
        <p>Le total dépend du matériel installé dans chaque tente.</p>
      </div> : null}
      {quote.savingsCents > 0 ? <p className={styles.solar}><Sun size={16} /> Solaire : {quote.solarPercent} % couverts · {formatKqCash(quote.savingsCents)} économisés</p> : null}
      <details><summary>Détail par appareil</summary><ul>{quote.lines.map((line) => {
        const common = sharedInstallation && ["security", "flower-drying"].includes(getKqEquipmentDefinition(line.code)?.slot ?? "");
        return <li key={`${line.tentNumber ?? "legacy"}:${line.code}`}><span>{common ? "Installation · " : line.tentNumber ? `Tente ${line.tentNumber} · ` : ""}{getKqEquipmentDefinition(line.code)?.name ?? line.name} · niv. {line.level}{!common && !line.tentNumber && units > 1 ? ` ×${units}` : ""}</span><b>{(line.wattHours / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kWh</b></li>;
      })}</ul><p>0,30 € virtuel / kWh. Le temps hors ligne ne change pas le montant.{sharedInstallation ? " Cette ancienne culture conserve son devis : séchoir et sécurité comptés une seule fois, solaire appliqué à l’installation." : lockedQuote ? " Les consommations suivent le matériel enregistré au début de cette culture. Ce devis reste inchangé." : " Chaque tente paie ses appareils, y compris son séchoir à fleurs et sa sécurité. Son solaire réduit uniquement sa propre facture."}</p></details>
      {invoice ? <p className={styles.stamp} data-paid={invoice.remainingCents === 0}>{invoice.remainingCents === 0 ? <><Check size={17} /> Réglée</> : `Reste sur ce cycle : ${formatKqCash(invoice.remainingCents)}`}</p> : null}
      {lockedQuote && invoice && quote.totalWattHours > 0 ? <p><Leaf size={16} /> Rendement énergétique : {(invoice.harvestGrams * 1000 / quote.totalWattHours).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} g/kWh</p> : null}
    </> : !snapshot && !error ? <p role="status">Lecture du compteur…</p> : null}
    {selectedMode && brokenEquipment.length > 0 ? <p className={styles.error} role="status"><strong>Matériel hors service :</strong> {brokenEquipment.join(", ")}. Ses bonus sont désactivés.{fallbackEquipment.length > 0 ? ` Dépannage : ${fallbackEquipment.join(", ")}.` : ""} Remplace-le dans ton entrepôt pour retrouver ses bonus.</p> : null}
    {selectedMode && wearPreviews.length > 0 ? <section className={styles.wearPreview} aria-label="Usure prévue du matériel">
      <strong>Matériel de chaque tente après cette culture · {KQ_ENERGY_MODES[selectedMode].name}</strong>
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
      {snapshot.bestGramsPerKwh !== null ? <p><Leaf size={16} /> Record personnel : {Number(snapshot.bestGramsPerKwh).toLocaleString("fr-FR")} g/kWh</p> : null}
      {due > 0 ? <div className={styles.payment}><strong>Total restant dû : {formatKqCash(due)}</strong><button type="button" disabled={pending || snapshot.cashCents < due} onClick={() => void pay()}>{pending ? "Règlement…" : `Tout régler · ${formatKqCash(due)}`}</button><p>Sinon, tes prochaines ventes règlent automatiquement les factures, dans la limite de 50 % de chaque versement. Tu peux continuer à jouer.</p>{snapshot.cashCents < due ? <small>Trésorerie disponible : {formatKqCash(snapshot.cashCents)}</small> : null}</div> : <p className={styles.stamp} data-paid><Check size={17} /> Aucune facture en attente</p>}
      {!lockedQuote && snapshot.invoices.length > 0 ? <details><summary>Dernières factures · {snapshot.invoiceCount} cycles au total</summary><ul>{snapshot.invoices.map((item) => <li key={item.runId}><span>{new Date(item.createdAt).toLocaleDateString("fr-FR")} · {KQ_ENERGY_MODES[item.quote.mode].name}<small>Cycle {item.runId.slice(0, 8)}</small>{item.dogCare ? <small>Électricité : {formatKqCash(item.quote.totalCents)} · Nourriture : {formatKqCash(item.dogCare.foodCents)}{item.dogCare.vetCents > 0 ? ` · Vétérinaire : ${formatKqCash(item.dogCare.vetCents)}` : ""} · Soins prélevés à la récolte : {formatKqCash(item.dogCare.paidCents)}</small> : null}</span><b>{formatKqCash(item.totalCents)}<small>{item.remainingCents ? `${formatKqCash(item.remainingCents)} restants` : "Réglée"}</small></b></li>)}</ul></details> : null}
    </> : selectedMode ? <p>Facture à la récolte. Paiement immédiat ou prélèvement progressif sur tes ventes.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p className={styles.error} role="alert">{error} Utilise Actualiser pour réessayer.</p> : null}
  </section>;
}
