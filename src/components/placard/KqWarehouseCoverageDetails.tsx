import { getKqWarehouseZoneQuote, type KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { getKqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseZoneLightingLayout } from "@/lib/kanab-quest-warehouse-fixtures";
import type { getKqWarehouseAirCoverage } from "@/lib/kanab-quest-warehouse-air";
import type { KqWarehouseCondition } from "@/lib/kanab-quest-warehouse-condition";
import { getKqWarehouseOption, getKqWarehouseZoneOptionQuantity, isKqWarehouseZoneDevice } from "@/lib/kanab-quest-warehouse-options";
import { KQ_WAREHOUSE_STATIONS, type getKqWarehouseStationCoverage } from "@/lib/kanab-quest-warehouse-stations";
import { KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT } from "@/lib/kanab-quest-warehouse-preparations";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import styles from "./KqWarehouse.module.css";

export type WarehouseCoverageSelection = { kind: "air" | "station" | "zone"; id: string }
  | { kind: "lighting"; id: string; index?: number };
type Props = {
  state: KqWarehouseState;
  selection: WarehouseCoverageSelection;
  air?: ReturnType<typeof getKqWarehouseAirCoverage>;
  stations?: ReturnType<typeof getKqWarehouseStationCoverage>;
  condition?: KqWarehouseCondition;
  onInspectLamp: (zoneId: string, index?: number) => void;
  onClose: () => void;
};
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function KqWarehouseCoverageDetails({ state, selection, air, stations, condition, onInspectLamp, onClose }: Props) {
  const close = <button type="button" className={styles.secondary} onClick={onClose}>Masquer la portée</button>;
  if (selection.kind === "lighting") {
    const zone = state.zones.find(item => item.id === selection.id);
    if (!zone) return null;
    const lamps = getKqWarehouseZoneLightingLayout(zone);
    const rows = new Set(lamps.map(lamp => lamp.row)).size;
    const area = zone.width * zone.height;
    const chosen = selection.index === undefined ? undefined : lamps[selection.index];
    const singleLamp = chosen ?? (lamps.length === 1 ? lamps[0] : undefined);
    const lampArea = singleLamp && singleLamp.width * singleLamp.depth;
    const device = getKqWarehouseDevice(zone.lightingCode);
    return <section className={styles.airPanel} data-coverage-details="lighting" aria-label="Couverture de l’éclairage" data-sylvain-target="coverage" tabIndex={-1}
      data-lighting-count={lamps.length} data-lighting-area={lamps.length ? area : 0} data-lighting-rows={rows}>
      <h3>Éclairage · {getKqZoneIdentity(state, zone.id)?.label ?? zone.name}</h3>
      {lamps.length ? <>
        <p><strong>{area} / {area} m² {zone.active ? "couverts" : "équipés"}</strong> · {lamps.length} lampe{lamps.length > 1 ? "s" : ""} · {rows} rangée{rows > 1 ? "s" : ""}</p>
        <p>{device?.name}{zone.active ? "" : " · Zone en pause"}</p>
        {lamps.length > 1 && <label className={styles.field}>Lampe à examiner
          <select data-lighting-pick value={chosen ? selection.index : ""} onChange={event => onInspectLamp(zone.id, event.target.value === "" ? undefined : Number(event.target.value))}>
            <option value="">Toutes les lampes</option>
            {lamps.map((lamp, index) => <option key={index} value={index}>Lampe {index + 1} · Rangée {lamp.row + 1}</option>)}
          </select>
        </label>}
        {lampArea !== undefined && <p>{lampArea.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m² {zone.active ? "couverts par cette lampe" : "affectés à cette lampe"}.</p>}
      </> : <p>0 / {area} m² couverts. Choisis un éclairage dans Aménager pour équiper cette zone.</p>}
      {close}
    </section>;
  }
  if (selection.kind === "zone") {
    const zone = [...state.zones, ...(state.serviceZones ?? [])].find(item => item.id === selection.id);
    if (!zone) return null;
    const devices = "kind" in zone ? [getKqWarehouseDevice(zone.deviceCode)?.name] : [
      getKqWarehouseDevice(zone.lightingCode)?.name,
      ...(!state.airPlacements ? [getKqWarehouseDevice(zone.airCode)?.name] : []),
      ...(zone.optionCodes ?? []).map(code => {
        const option = getKqWarehouseOption(code);
        return option && isKqWarehouseZoneDevice(option)
          ? `${getKqWarehouseZoneOptionQuantity(code, zone.width * zone.height)} × ${option.name}`
          : option?.description.split(". ")[0];
      }),
    ];
    return <section data-coverage-details="zone" className={styles.airPanel} data-sylvain-target="zones" tabIndex={-1}>
      <h3>{getKqZoneIdentity(state, zone.id)?.label} · {zone.width * zone.height} m²</h3>
      <p>Équipement de cette surface · {devices.filter(Boolean).join(", ") || "Aucun matériel local"}</p>{close}
    </section>;
  }
  const fan = selection.kind === "air" ? air?.placements.find(item => item.id === selection.id) : undefined;
  const station = selection.kind === "station" ? stations?.placements.find(item => item.id === selection.id) : undefined;
  if (station?.code === "SIM-HYGIENE-03") return <section className={styles.airPanel} data-coverage-details="station" aria-label="Protection du sas d’entretien">
    <h3>{KQ_WAREHOUSE_STATIONS[station.code].name} · Porte sud</h3>
    <p>Une fois installé, le sas réduit de <strong>{KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT} %</strong> le risque d’infections, de ravageurs et de virus dans tout l’entrepôt dès le prochain semis.</p>
    <button type="button" className={styles.secondary} onClick={onClose}>Masquer la protection</button>
  </section>;
  const device = fan ?? station;
  if (!device) return null;
  const cells = fan ? air?.cells : stations?.cells;
  const served = new Map<string, number>();
  for (const cell of cells ?? []) {
    if (cell.placementId === device.id) served.set(cell.zoneId, (served.get(cell.zoneId) ?? 0) + 1);
  }
  const missed = state.zones.filter(zone => !served.has(zone.id));
  return <section className={styles.airPanel} data-coverage-details={selection.kind} aria-label="Couverture de l’appareil" data-sylvain-target="coverage" tabIndex={-1}>
    <h3>{station ? KQ_WAREHOUSE_STATIONS[station.code].name : getKqWarehouseDevice(device.code)?.name}</h3>
    <p>{device.rangeM} m de portée · {device.coveredAreaM2} / {device.capacityM2} m² desservis</p>
    {served.size ? <ul className={styles.airRegister}>{state.zones.filter(zone => served.has(zone.id)).map(zone => {
      const quote = getKqWarehouseZoneQuote(zone, 2, condition, state.airPlacements ? air?.zones[zone.id] : undefined, stations?.zones[zone.id], 1);
      return <li key={zone.id} data-service-zone={zone.id}><div>
        <strong>{getKqZoneIdentity(state, zone.id)?.label} · {served.get(zone.id)} / {quote.areaM2} m² desservis par cet appareil</strong>
        <small>{zone.active ? `Prévision de la zone, tous équipements compris · ${number(quote.estimatedHarvestGrams)} g · +${number(quote.qualityBonus)} pts de qualité` : "Effets disponibles à l’activation de la zone."}</small>
      </div></li>;
    })}</ul> : <p>Aucune zone de culture desservie à cet emplacement.</p>}
    {missed.length > 0 && <details><summary>Zones non desservies ({missed.length})</summary>
      <p>{missed.map(zone => getKqZoneIdentity(state, zone.id)?.label).join(", ")}</p>
    </details>}{close}
  </section>;
}
