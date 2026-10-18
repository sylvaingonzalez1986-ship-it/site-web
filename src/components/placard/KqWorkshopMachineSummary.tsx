"use client";

import Image from "next/image";
import { Check, Package, RefreshCw, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { getKqWorkshopMachineSpecification } from "@/lib/kanab-quest-workshop-machines";
import { getKqWorkshopProductArtwork } from "@/lib/kanab-quest-warehouse-product-artwork";
import { KqEquipmentUpgrade } from "./KqEquipmentUpgrade";
import { KqMachineMaintenance } from "./KqMachineMaintenance";
import { KqWorkshopTiers } from "./KqWorkshopTiers";
import styles from "./KqWorkshopMachineSummary.module.css";

export function KqWorkshopMachineSummary({ code, level, condition, cashCents, career, installed = false, tentNumber = 1, productionUnits = 1, equipmentScopeVersion = 2, disabled = false, showTiers = false, onUpdated, onBusyChange }: {
  code: string;
  level: number;
  condition?: KqMachineCondition;
  cashCents: number;
  career?: ChanvrierCareerSnapshot;
  installed?: boolean;
  tentNumber?: number;
  productionUnits?: number;
  equipmentScopeVersion?: 2 | 3;
  disabled?: boolean;
  showTiers?: boolean;
  onUpdated: () => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [tierBusy, setTierBusy] = useState(false);
  const busy = upgradeBusy || maintenanceBusy || tierBusy;
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const machine = getKqWorkshopMachineSpecification(code, level);
  const artwork = getKqWorkshopProductArtwork(code, level);
  if (!machine || !artwork) return null;
  return <section className={styles.summary} aria-label="Résumé du niveau et de l’entretien" data-workshop-machine-summary={code}>
    <header className={styles.header}>
      <Image src={artwork.src} alt="" width={160} height={160} sizes="110px" className={styles.artwork} data-workshop-inventory-artwork={code} />
      <div className={styles.identity}><small>Niveau & entretien · {machine.tier.label}</small><h4>{machine.name}</h4>
        <span className={styles.status} data-due={condition?.due || undefined}>{condition?.due ? <><Wrench size={14} aria-hidden="true" />À entretenir · à l’arrêt</> : installed ? <><Check size={14} aria-hidden="true" />Installée dans l’atelier</> : <><Package size={14} aria-hidden="true" />Acquise · en réserve</>}</span>
      </div>
    </header>
    <div className={styles.grid}>
      <KqEquipmentUpgrade compact workshopOnly code={code} level={level} cashCents={cashCents} career={career}
        tentNumber={tentNumber} productionUnits={productionUnits} equipmentScopeVersion={equipmentScopeVersion}
        maintenanceDue={condition?.due} disabled={disabled || maintenanceBusy || tierBusy} onUpdated={onUpdated} onBusyChange={setUpgradeBusy} />
      {condition ? <KqMachineMaintenance compact code={code} condition={condition} cashCents={cashCents} tentNumber={tentNumber} productionUnits={productionUnits}
        disabled={disabled || upgradeBusy || tierBusy} onUpdated={onUpdated} onBusyChange={setMaintenanceBusy} />
        : <section className={styles.unavailable} aria-label="Entretien de la machine"><Wrench size={22} aria-hidden="true" /><h5>Entretien</h5><p>État d’usure indisponible.</p><button type="button" disabled={disabled || busy} onClick={() => void onUpdated()}><RefreshCw size={16} aria-hidden="true" />Actualiser l’état</button></section>}
    </div>
    <p className={styles.note}>{installed ? "Améliorations actives dès la prochaine transformation." : "Installe la machine pour utiliser ses améliorations."}</p>
    {showTiers ? <div className={styles.tiers}><KqWorkshopTiers code={code} level={level} cashCents={cashCents} career={career} maintenanceDue={condition?.due}
      disabled={disabled || upgradeBusy || maintenanceBusy} onUpdated={onUpdated} onBusyChange={setTierBusy} /></div> : null}
  </section>;
}
