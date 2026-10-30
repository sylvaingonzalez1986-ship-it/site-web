"use client";

import Image from "next/image";
import { useId, useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, Factory, Grid2X2, Leaf, Package, Plus, ShieldCheck, Snowflake, Sparkles, Sun, Swords, Wind, Zap } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import type { KqStorageClimateBilling } from "@/lib/kanab-quest-business";
import { getKqPostHarvestDeviceBenefits, getKqPostHarvestTierBenefits, getKqWarehousePostHarvestProfile } from "@/lib/kanab-quest-post-harvest";
import { getKqWarehouseServiceZoneQuote, getKqWarehouseStorageClimateQuote, getKqWarehouseSummary, KQ_STORAGE_CLIMATE_KWH_PER_M2_MONTH, KQ_WAREHOUSE_SIMULATION, type KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { KQ_WAREHOUSE_CATALOG, KQ_WAREHOUSE_TIERS, getKqWarehouseDevice, type KqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseProductArtwork } from "@/lib/kanab-quest-warehouse-product-artwork";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import styles from "./KqWarehousePostHarvest.module.css";

type Props = {
  kind: "drying" | "storage";
  state: KqWarehouseState;
  installedState?: KqWarehouseState;
  billing?: KqStorageClimateBilling;
  disabled: boolean;
  onPlaceDevice: (device: KqWarehouseDevice) => void;
  onEditZone: (id: string) => void;
  onUpgradeZone: (id: string, deviceCode: string) => void;
  onSetStorageClimate?: (code: string | null) => void;
  beforeConfiguration?: ReactNode;
};

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const mass = (grams: number) => grams >= 1_000 ? `${number(grams / 1_000)} kg` : `${number(grams)} g`;
const tierIndex = (device: KqWarehouseDevice) => KQ_WAREHOUSE_TIERS.findIndex(tier => tier.code === device.tier);
const tierLabel = (device: KqWarehouseDevice) => KQ_WAREHOUSE_TIERS.find(tier => tier.code === device.tier)?.label ?? device.name;
const capacityPerM2 = (device: KqWarehouseDevice) => (device.zoneLayout?.unitsPerM2 ?? 0) * (device.zoneLayout?.capacityGramsPerUnit ?? 0);
const electricityCentsPerKwh = KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh;

function DeviceArt({ device, className, sizes = "180px" }: { device: KqWarehouseDevice; className?: string; sizes?: string }) {
  const artwork = getKqWarehouseProductArtwork(device.code);
  return artwork ? <Image src={artwork.src} alt="" width={512} height={512} sizes={sizes} className={className} /> : <Package size={64} aria-hidden="true" className={className} />;
}

function QualityBar({ value, max, label }: { value: number; max: number; label: string }) {
  return <div className={styles.qualityBar} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(max, Math.max(0, value))} aria-valuetext={`+${number(value)} point sur 10`}>
    <span style={{ width: `${Math.max(0, Math.min(100, value / max * 100))}%` }} />
  </div>;
}

function QualityComparison({ kind }: { kind: "drying" | "storage" }) {
  const [startingQuality, setStartingQuality] = useState(6);
  const inputId = useId();
  const drying = kind === "drying";
  return <section className={styles.comparison} aria-label="Comparer les gains de qualité" data-postharvest-comparison={kind}>
    <div className={styles.comparisonHeading}><div><h4>{drying ? "Le séchage fait la différence" : "Ce que chaque gamme apporte"}</h4><p>{drying ? "Compare le gain de chaque salle de séchage, pour la même qualité de départ." : "Compare une installation complète : séchage, stockage et climatiseur de la même gamme."}</p></div>
      <label className={styles.comparisonControl} htmlFor={inputId}><span>Qualité de départ <output htmlFor={inputId}>{number(startingQuality)} / 10</output></span><input id={inputId} type="range" min={0} max={10} step={.1} value={startingQuality} onChange={event => setStartingQuality(Number(event.target.value))} aria-valuetext={`${number(startingQuality)} sur 10`} data-quality-start /><small>Déplace le curseur pour comparer</small></label>
    </div>
    <div className={styles.comparisonTiers}>{KQ_WAREHOUSE_TIERS.map(tier => {
      const benefits = getKqPostHarvestTierBenefits(tier.code);
      const bonus = drying ? benefits.dryingQualityBonus : benefits.qualityBonus;
      const score = Math.min(10, Math.round((startingQuality + bonus) * 100) / 100);
      return <article className={styles.comparisonTier} key={tier.code} data-quality-tier={tier.code} data-result-score={score} data-quality-bonus={bonus} data-retention-percent={drying ? 0 : benefits.retentionPercent}>
        <h5>{tier.label}</h5><div className={styles.comparisonScore}><strong>{number(score)}<small> / 10</small></strong><span>{bonus > 0 ? `+${number(bonus)} ${bonus > 1 ? "points" : "point"} max.` : "Sans bonus"}</span></div>
        <div className={styles.comparisonTrack} role="meter" aria-label={`Qualité simulée, gamme ${tier.label}`} aria-valuemin={0} aria-valuemax={10} aria-valuenow={score}><span className={styles.comparisonBase} style={{ width: `${startingQuality * 10}%` }} /><span className={styles.comparisonGain} style={{ width: `${Math.max(0, score - startingQuality) * 10}%` }} /></div>
        <p>{drying ? "À la sortie du séchage" : "Après un affinage complet"}{startingQuality + bonus > 10 && <b>Plafond de 10 atteint</b>}</p>
        {!drying && <span className={styles.comparisonProtection}><ShieldCheck size={15} aria-hidden="true" /><strong>{benefits.retentionPercent} %</strong> de pertes en moins</span>}
      </article>;
    })}</div>
    <div className={styles.comparisonLegend}><span><i className={styles.comparisonBase} />Qualité de départ</span><span><i className={styles.comparisonGain} />Gain d’équipement</span></div>
    <p className={styles.comparisonFootnote}>{drying ? "Simulation pour les prochaines cultures, avec une salle entièrement équipée dans la gamme choisie." : "Simulation avant vieillissement, pour un lot entièrement protégé pendant tout l’affinage. Hors bonus des contenants individuels. Les protections du stockage et du climat se combinent ; leurs pourcentages ne s’additionnent pas."} La qualité finale reste plafonnée à 10.</p>
  </section>;
}

export function KqWarehousePostHarvest({ kind, state, installedState = state, billing, disabled, onPlaceDevice, onEditZone, onUpgradeZone, onSetStorageClimate, beforeConfiguration }: Props) {
  const drying = kind === "drying";
  const devices = KQ_WAREHOUSE_CATALOG.filter(device => device.kind === kind && device.zoneLayout && device.purchasable !== false);
  const zones = (state.serviceZones ?? []).filter(zone => zone.kind === kind);
  const summary = getKqWarehouseSummary(state);
  const profile = getKqWarehousePostHarvestProfile(state);
  const capacity = drying ? summary.dryingCapacityGrams : summary.storageCapacityGrams;
  const area = drying ? summary.dryingAreaM2 : summary.storageAreaM2;
  const qualityBonus = drying ? profile.dryingQualityBonus : profile.storageQualityBonus;
  const maxBonus = Math.max(.01, ...devices.map(device => getKqPostHarvestDeviceBenefits(device.code).qualityBonus));
  const dominantZone = [...zones].sort((a, b) => getKqWarehouseServiceZoneQuote(b).capacityGrams - getKqWarehouseServiceZoneQuote(a).capacityGrams)[0];
  const representative = getKqWarehouseDevice(dominantZone?.deviceCode ?? "") ?? devices[0];
  const climateDevices = KQ_WAREHOUSE_CATALOG.filter(device => device.room === "storage" && device.kind === "climate" && device.purchasable !== false);
  const currentClimate = climateDevices.find(device => device.code === state.storageClimateCode);
  const climateQuote = getKqWarehouseStorageClimateQuote(state);
  const installedClimate = getKqWarehouseStorageClimateQuote(installedState);
  const climateChanged = climateQuote.code !== installedClimate.code || climateQuote.areaM2 !== installedClimate.areaM2;
  const installedMonthlyCents = billing?.monthlyCostCents ?? installedClimate.monthlyCents;
  const nextBilling = billing?.nextBillingAt ? new Date(billing.nextBillingAt) : null;
  const totalBonus = profile.dryingQualityBonus + profile.storageQualityBonus + profile.climateQualityBonus;

  return <section className={styles.section} data-post-harvest={kind} data-postharvest-room={kind} aria-label={drying ? "Salle de séchage" : "Salle de stockage et affinage"}>
    {beforeConfiguration}
    <div className={styles.sectionHeading}><div><h4>{drying ? "Mes zones de séchage" : "Mes zones de stockage"}</h4></div><span className={styles.count}>{zones.length} zone{zones.length > 1 ? "s" : ""}</span></div>
    {zones.length > 0 ? <div className={styles.zones}>{zones.map(zone => {
      const identity = getKqZoneIdentity(state, zone.id);
      const device = getKqWarehouseDevice(zone.deviceCode)!;
      const quote = getKqWarehouseServiceZoneQuote(zone);
      const benefit = getKqPostHarvestDeviceBenefits(device.code);
      const upgrades = devices.filter(candidate => tierIndex(candidate) > tierIndex(device));
      return <article className={styles.zone} key={zone.id} data-post-harvest-zone={zone.id}>
        <div className={styles.zoneIdentity}><DeviceArt device={device} className={styles.zoneArt} sizes="96px" /><div><small>{tierLabel(device)}</small><h5><b className={styles.zoneNumber} style={{ backgroundColor: identity?.color }} aria-label={identity?.label ?? "Zone"} data-zone-number={identity?.number}>{identity?.number ?? "Zone"}</b><span>{number(quote.areaM2)} m²</span></h5><span>{mass(quote.capacityGrams)} de capacité</span></div><button className={styles.iconButton} type="button" disabled={disabled} onClick={() => onEditZone(zone.id)} aria-label={`Configurer la ${(identity?.label ?? "zone").toLowerCase()}`}><Grid2X2 size={18} aria-hidden="true" /></button></div>
        <div className={styles.zoneBonus}><Sparkles size={15} aria-hidden="true" /><span>Bonus de cette gamme</span><strong>+{number(benefit.qualityBonus)} / 10</strong></div>
        {upgrades.length > 0 ? <div className={styles.upgrades}>{upgrades.map(upgrade => <button type="button" className={styles.upgradeButton} key={upgrade.code} disabled={disabled} onClick={() => onUpgradeZone(zone.id, upgrade.code)} data-postharvest-upgrade={zone.id} data-device-code={upgrade.code}><span><ArrowUp size={15} aria-hidden="true" />Améliorer · {tierLabel(upgrade)}</span><small>{mass(capacityPerM2(upgrade) * quote.areaM2)} · +{number(getKqPostHarvestDeviceBenefits(upgrade.code).qualityBonus)} / 10</small></button>)}</div> : <div className={styles.maximum}><Check size={16} aria-hidden="true" />Meilleure gamme installée sur le plan</div>}
      </article>;
    })}</div> : <div className={styles.empty}><Grid2X2 size={28} aria-hidden="true" /><div><strong>{drying ? "Ta salle de séchage reste à dessiner" : "Organise tes contenants dans une salle dédiée"}</strong><p>{state.serviceZones === undefined ? "Le matériel historique reste comptabilisé. Choisis une gamme ci-dessous pour organiser les salles sur le plan." : "Choisis une gamme ci-dessous, puis dessine la zone sur le plan."}</p></div><ArrowDown size={21} aria-hidden="true" /></div>}

    <div className={styles.sectionHeading}><div><h4>{drying ? "Quelle gamme de séchage ?" : "Quelle gamme de stockage ?"}</h4><p>Compare la capacité, la qualité et le prix par m².</p></div></div>
    <div className={styles.catalog}>{devices.map(device => {
      const benefit = getKqPostHarvestDeviceBenefits(device.code);
      const owned = state.equipment.find(item => item.code === device.code)?.quantity ?? 0;
      const placed = zones.filter(zone => zone.deviceCode === device.code).reduce((sum, zone) => sum + getKqWarehouseServiceZoneQuote(zone).devices.reduce((total, line) => total + line.quantity, 0), 0);
      return <article className={styles.product} key={device.code} data-post-harvest-device={device.code}>
        <div className={styles.productVisual}><DeviceArt device={device} className={styles.productArt} /><span className={styles.tierBadge}>{tierIndex(device) + 1}<small>/ 3</small></span><span className={styles.productOwned}>{placed} sur le plan · {owned} possédé{owned > 1 ? "s" : ""}</span></div>
        <div className={styles.productBody}><h5>{tierLabel(device)}</h5><div className={styles.productCapacity}><Package size={17} aria-hidden="true" /><strong>{mass(capacityPerM2(device))}<small> / m²</small></strong></div><div className={styles.productQuality}><span><Sparkles size={14} aria-hidden="true" />Qualité à la sortie</span><strong>+{number(benefit.qualityBonus)} / 10</strong></div><QualityBar value={benefit.qualityBonus} max={maxBonus} label={`Bonus de qualité, ${device.name}`} />{!drying && <p className={styles.protection}><ShieldCheck size={14} aria-hidden="true" />{benefit.retentionPercent > 0 ? `${number(benefit.retentionPercent)} % de pertes en moins` : "Protection de base"}</p>}<p className={styles.productDescription}>{drying ? device.tier === "economy" ? "Une première salle à petit budget." : device.tier === "standard" ? "Plus de capacité et un premier gain de qualité." : "Le meilleur bonus de séchage de la gamme." : device.tier === "economy" ? "Les premiers contenants pour tes lots." : device.tier === "standard" ? "Un affinage amélioré dans moins d’espace." : "Une grande capacité et la meilleure qualité de cette gamme."}</p></div>
        <footer className={styles.productFooter}><div><strong>{formatKqCash(device.priceCents * (device.zoneLayout?.unitsPerM2 ?? 1))}</strong><small>par m² de matériel · hors pose</small></div><button type="button" className={styles.primary} disabled={disabled} onClick={() => onPlaceDevice(device)} data-warehouse-place-device={device.code}><Plus size={16} aria-hidden="true" />Tracer cette zone</button></footer>
      </article>;
    })}</div>

    {!drying && onSetStorageClimate && <section className={styles.climate} aria-label="Climatisation du stockage" data-storage-climate-section>
      <div className={styles.climateIntro}><div className={styles.climateMark}><Snowflake size={29} aria-hidden="true" /></div><div><h4>Une température mieux régulée</h4><p>Le climatiseur complète les contenants : il soutient l’affinage et ralentit les pertes de qualité pendant la conservation. Son électricité se paie chaque mois, selon la surface de stockage.</p></div><span className={styles.climateStatus}>{currentClimate ? <><Check size={15} aria-hidden="true" />{tierLabel(currentClimate)} · sur le plan</> : "Sans climatiseur sur le plan"}</span></div>
      <div className={styles.climateBilling}>
        <div className={styles.climateCurrent} data-storage-climate-current data-monthly-cents={installedMonthlyCents} data-area-m2={billing?.areaM2 ?? installedClimate.areaM2}>
          <span className={styles.eyebrow}><Zap size={14} aria-hidden="true" />Installation actuelle</span>
          <strong>{formatKqCash(installedMonthlyCents)}<small> / mois de jeu</small></strong>
          <p>{installedClimate.code ? `${number(installedClimate.areaM2)} m² × ${formatKqCash(installedClimate.centsPerM2)} / m² · ${number(installedClimate.monthlyKwh)} kWh par mois` : "Aucun climatiseur installé : aucune consommation. Le matériel en réserve ne consomme pas."}</p>
          {billing && (installedClimate.code || billing.accruedCents > 0 || billing.outstandingCents > 0) && <div className={styles.climateDue}>
            <span>Consommation engagée <b>{formatKqCash(billing.accruedCents)}</b></span>
            {(billing.transitionCreditCents ?? 0) > 0 && <span>Crédit sur les prochaines factures <b>{formatKqCash(billing.transitionCreditCents!)}</b></span>}
            {nextBilling && Number.isFinite(nextBilling.getTime()) && <span>Prochaine facture <b>{nextBilling.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b></span>}
            {billing.outstandingCents > 0 && <span className={styles.climateDebt}>Factures restant à payer <b>{formatKqCash(billing.outstandingCents)}</b></span>}
          </div>}
        </div>
        {climateChanged && <div className={styles.climatePreview} data-storage-climate-preview data-monthly-cents={climateQuote.monthlyCents} data-area-m2={climateQuote.areaM2}>
          <span className={styles.eyebrow}>Après enregistrement du plan</span>
          <strong>{formatKqCash(climateQuote.monthlyCents)}<small> / mois de jeu</small></strong>
          <p>{climateQuote.code ? `${number(climateQuote.areaM2)} m² × ${formatKqCash(climateQuote.centsPerM2)} / m² · ${number(climateQuote.monthlyKwh)} kWh par mois` : "Le retrait arrête la consommation à l’enregistrement. L’électricité déjà consommée reste à payer."}</p>
          <small>Prévision · les modifications ne sont pas encore installées.</small>
        </div>}
        <p className={styles.climateBillingNote}>Un mois de jeu = 30 jours de jeu = 120 heures réelles. Électricité : {formatKqCash(electricityCentsPerKwh)} / kWh. Facturation au prorata du temps installé, même sans culture active. Débit automatique à l’échéance ; tout impayé rejoint les charges d’électricité à régler.{(billing?.transitionCreditCents ?? 0) > 0 ? " Le crédit déduit la climatisation déjà incluse dans tes anciennes cultures en cours." : ""}</p>
      </div>
      {zones.length === 0 && <p className={styles.climateRequirement}>Place d’abord une zone de stockage sur le plan pour y installer un climatiseur.</p>}
      <div className={styles.climateChoices}>{climateDevices.map(device => {
        const benefits = getKqPostHarvestDeviceBenefits(device.code);
        const selected = device.code === currentClimate?.code;
        const owned = (state.equipment.find(item => item.code === device.code)?.quantity ?? 0) > 0;
        const consumption = KQ_STORAGE_CLIMATE_KWH_PER_M2_MONTH[device.code];
        const monthly = getKqWarehouseStorageClimateQuote({ ...state, storageClimateCode: device.code });
        return <article className={styles.climateCard} data-selected={selected} data-storage-climate-card={device.code} data-monthly-cents={monthly.monthlyCents} data-area-m2={area} data-kwh-per-m2={consumption} data-cents-per-m2={consumption * electricityCentsPerKwh} key={device.code}>
          <DeviceArt device={device} className={styles.climateArt} sizes="110px" /><div><h5>{tierLabel(device)}</h5><span className={styles.climatePower}><Zap size={12} aria-hidden="true" />{number(consumption)} kWh / m² / mois</span></div>
          <div className={styles.climateBenefit}><span><Sparkles size={14} aria-hidden="true" />+{number(benefits.qualityBonus)} / 10</span><span><ShieldCheck size={14} aria-hidden="true" />{number(benefits.retentionPercent)} % de pertes en moins</span></div>
          <div className={styles.climateRunningCost}><span>Électricité · chaque mois de jeu</span><strong>{formatKqCash(consumption * electricityCentsPerKwh)}<small> / m²</small></strong><p>{area > 0 ? `${formatKqCash(monthly.monthlyCents)} pour tes ${number(area)} m²` : "Le total dépend de la surface à aménager"}</p></div>
          <strong className={styles.climatePrice}>{owned ? "Déjà possédé" : formatKqCash(device.priceCents)}<small>{owned ? "Réutilisable dans le plan" : "Matériel · hors pose"}</small></strong>
          <button type="button" className={selected ? styles.selectedButton : styles.primary} aria-pressed={selected} disabled={disabled || selected || zones.length === 0} onClick={() => onSetStorageClimate(device.code)} data-storage-climate={device.code}>{selected ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}{selected ? "Choisi sur le plan" : owned ? "Installer" : "Ajouter à la salle"}</button>
        </article>;
      })}</div>
      {currentClimate && <button type="button" className={styles.removeClimate} disabled={disabled} onClick={() => onSetStorageClimate(null)} data-storage-climate-remove>Retirer le climatiseur du plan · conserver en réserve</button>}
    </section>}
    <details className={styles.qualityGuide} data-postharvest-guide={kind}>
      <summary>Comprendre les gammes et les gains de qualité</summary>
      <div className={styles.qualityGuideBody}>
        <ol className={styles.journey} aria-label="Parcours après la récolte">
          <li><span><Leaf size={18} aria-hidden="true" /></span><div><strong>Récolte</strong><small>La qualité de départ</small></div><ArrowRight className={styles.journeyArrow} size={17} aria-hidden="true" /></li>
          <li aria-current={drying ? "step" : undefined} data-current={drying}><span><Sun size={18} aria-hidden="true" /></span><div><strong>Séchage</strong><small>Préparer la qualité</small></div><ArrowRight className={styles.journeyArrow} size={17} aria-hidden="true" /></li>
          <li aria-current={!drying ? "step" : undefined} data-current={!drying}><span><Package size={18} aria-hidden="true" /></span><div><strong>Stockage · affinage</strong><small>Affiner et conserver</small></div><ArrowRight className={styles.journeyArrow} size={17} aria-hidden="true" /></li>
          <li><span><Swords size={18} aria-hidden="true" /></span><div><strong>Jury</strong><small>Évaluer le lot affiné</small></div><ArrowRight className={styles.journeyArrow} size={17} aria-hidden="true" /></li>
          <li><span><Factory size={18} aria-hidden="true" /></span><div><strong>Atelier</strong><small>Transformer le lot</small></div></li>
        </ol>

        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{drying ? "01 · Après la récolte" : "02 · Après le séchage"}</span>
            <h3>{drying ? "Salle de séchage" : "Stockage & affinage"}</h3>
            <p>{drying ? "Améliore ta salle pour préparer des récoltes de meilleure qualité avant leur affinage." : "Des contenants adaptés et une salle climatisée pour développer la qualité pendant l’affinage, puis mieux la préserver."}</p>
            <span className={styles.roomTag}>{drying ? <Sun size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}{drying ? "Le matériel prépare la qualité" : "Contenants + climat = conservation"}</span>
          </div>
          <div className={styles.roomVisual} data-has-climate={!drying && !!currentClimate} aria-hidden="true">
            <span className={styles.wallSign}>{drying ? "SÉCHAGE" : "CONSERVATION"}</span>
            <div className={styles.window}><i /><i /></div>
            <div className={styles.floor} />
            {representative && <DeviceArt device={representative} className={styles.roomDevice} sizes="(max-width: 640px) 180px, 230px" />}
            {!drying && currentClimate ? <DeviceArt device={currentClimate} className={styles.roomClimate} sizes="110px" /> : <div className={styles.roomSymbol}>{drying ? <Wind size={27} /> : <Snowflake size={27} />}</div>}
            <span className={styles.visualCaption}>{zones.length > 0 ? `${zones.length} zone${zones.length > 1 ? "s" : ""} sur le plan` : "À aménager sur le plan"}</span>
          </div>
        </div>

        <div className={styles.metrics} aria-label="Configuration de la salle">
          <div><span><Grid2X2 size={15} aria-hidden="true" />Surface aménagée</span><strong>{number(area)} <small>m²</small></strong><small>Configuration du plan</small></div>
          <div><span><Package size={15} aria-hidden="true" />{drying ? "Capacité de séchage" : "Capacité des contenants"}</span><strong>{mass(capacity)}</strong><small>{drying ? "Par passage en salle" : "Équivalent fleurs"}</small></div>
          <div><span><Sparkles size={15} aria-hidden="true" />{drying ? "Bonus de séchage" : "Bonus d’affinage"}</span><strong>+{number(qualityBonus)} <small>/ 10</small></strong><QualityBar value={qualityBonus} max={maxBonus} label={drying ? "Bonus de qualité du séchage" : "Bonus de qualité des contenants"} /></div>
        </div>

        <div className={styles.qualityNote}><Sparkles size={18} aria-hidden="true" /><p>{drying ? "La gamme de séchage améliore la qualité des récoltes issues des cultures lancées après son installation. Le bonus dépend du matériel et de sa capacité dans la salle." : "Les gains d’affinage s’acquièrent progressivement. Une gamme supérieure apporte un meilleur bonus et ralentit les pertes à partir de son installation."}<span>{drying ? "Qualité finale plafonnée à 10. Les cultures déjà lancées conservent leur bonus de séchage." : "Qualité finale plafonnée à 10. Les améliorations profitent aussi au temps d’affinage restant des lots en cours."}</span></p></div>
        <QualityComparison kind={kind} />
        {!drying && <>
          <div className={styles.qualityEquation} aria-label="Bonus de qualité de la configuration"><span><Sun size={17} aria-hidden="true" />Séchage <b>+{number(profile.dryingQualityBonus)}</b></span><i>+</i><span><Package size={17} aria-hidden="true" />Stockage <b>+{number(profile.storageQualityBonus)}</b></span><i>+</i><span><Snowflake size={17} aria-hidden="true" />Climat <b>+{number(profile.climateQualityBonus)}</b></span><i>=</i><span className={styles.qualityTotal}>Bonus potentiel<strong>+{number(totalBonus)} / 10</strong></span></div>
          <p className={styles.climateFootnote}>Hors bonus des contenants individuels des lots. Les gains d’affinage s’acquièrent progressivement, avec une qualité finale limitée à 10. Les améliorations agissent à partir de leur installation. Les protections du stockage et du climat se combinent sans additionner leurs pourcentages.</p>
        </>}
      </div>
    </details>
  </section>;
}
