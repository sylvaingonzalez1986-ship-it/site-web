"use client";

import { useEffect, useRef, useState } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import { getKqBusinessClock, KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KqWarehouseInputCatalog } from "./KqWarehouseInputCatalog";
import Image from "next/image";
import { getKqCareProductArtwork } from "@/lib/kanab-quest-care-artwork";
import { getKqWarehouseInputPack, KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT, KQ_WAREHOUSE_PREPARATION_CATALOG as catalog, type KqWarehouseCleaningRecord, type KqWarehousePreparationItem, type KqWarehousePreparations, type KqWarehouseInputCode } from "@/lib/kanab-quest-warehouse-preparations";
import type { KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { KQ_WAREHOUSE_STATIONS } from "@/lib/kanab-quest-warehouse-stations";
import { useWarehousePreparations } from "./useWarehousePreparations";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import styles from "./KqWarehouseSupplies.module.css";

const base = "WAREHOUSE-NUTRITION-BASE";
const supplement = "WAREHOUSE-NUTRITION-SUPPLEMENT";
const irrigationCode = "SIM-WATER-03";
const airlockCode = "SIM-HYGIENE-03";
export const doseCount = (quantity: number) => `${quantity.toLocaleString("fr-FR")} dose${quantity > 1 ? "s" : ""}`;
const provisions = ["WAREHOUSE-NUTRITION-BASE", "WAREHOUSE-NUTRITION-SUPPLEMENT", "WAREHOUSE-PBI", "WAREHOUSE-MAINTENANCE"] as const;
const descriptions: Record<string,string> = {
  "WAREHOUSE-VACUUM": "Retire les débris avant le lavage. Un seul aspirateur équipe tout l’entrepôt.",
  "WAREHOUSE-MOP": "Lave le sol après le passage de l’aspirateur. Réutilisable dans tout l’entrepôt.",
};
export function preparationDate(value: string, state: KqWarehousePreparations) {
  const time = new Date(value);
  if (!Number.isFinite(+time)) return "Date indisponible";
  const origin = "calendarOrigin" in state && typeof state.calendarOrigin === "string" && state.calendarOrigin;
  const date = time.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (!origin) return date;
  const clock = getKqBusinessClock(origin, +time);
  return `jour ${clock.dayOfMonth} du mois ${clock.month} (${date})`;
}

export type KqWarehousePreparationRegister = ReturnType<typeof useWarehousePreparations>;
type Register = KqWarehousePreparationRegister;
type OpenShop = (code?: string) => void;

const cleaningTools = {
  vacuum: { code: "WAREHOUSE-VACUUM", label: "Aspirer", action: "Passer l’aspirateur · ½ h de jeu" },
  mop: { code: "WAREHOUSE-MOP", label: "Laver le sol", action: "Passer la serpillière · 1 h de jeu" },
} as const;
const cleaningSteps = ["vacuum", "mop"] as const;

function usePreparationClock(state: KqWarehousePreparations | null) {
  const reference = state?.serverNow;
  const pending = Boolean(state?.cleaning.vacuum.pending || state?.cleaning.mop.pending);
  const hasValidPass = !!state && !!reference && Object.values(state.cleaning).some(pass => Date.parse(pass.expiresAt ?? "") > Date.parse(reference));
  const [clock, setClock] = useState<{ reference: string; elapsedMs: number }>();
  useEffect(() => {
    if (!reference || (!pending && !hasValidPass)) return;
    const start = performance.now();
    const timer = window.setInterval(() => setClock({ reference, elapsedMs: performance.now() - start }), pending ? 1_000 : 15_000);
    return () => window.clearInterval(timer);
  }, [reference, pending, hasValidPass]);
  return Date.parse(reference ?? "") + (clock?.reference === reference ? clock?.elapsedMs ?? 0 : 0);
}

function gameDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / (KQ_GAME_DAY_MS / 1440)));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor(totalMinutes % 1440 / 60);
  if (days > 0) return `${days} j ${hours} h de jeu`;
  if (hours > 0) return `${hours} h ${totalMinutes % 60} min de jeu`;
  return `${totalMinutes} min de jeu`;
}

function CleaningProgress({ record, state, now }: {
  record: KqWarehouseCleaningRecord; state: KqWarehousePreparations; now: number;
}) {
  const expiresAt = Date.parse(record.expiresAt ?? "");
  const completedAt = Date.parse(record.completedAt ?? "");
  if (record.pending) {
    const { startsAt, endsAt, workChoice } = record.pending;
    const assignee = workChoice === "player" ? "Toi" : workChoice.startsWith("employee:") ? "Un salarié" : "Affectation automatique";
    const end = Date.parse(endsAt);
    const start = Date.parse(startsAt);
    return <>
      <p role="status">En cours · {assignee} · fin prévue le <time dateTime={endsAt}>{preparationDate(endsAt, state)}</time></p>
      {Number.isFinite(now) && end > start && <KqProgressMeter label="Avancement du passage" value={Math.min(end, now) - start} max={end - start}
        valueLabel={now < end ? `${gameDuration(end - now)} restantes` : "Validation en cours"} tone="gold" />}
      {record.expiresAt && now < expiresAt && <p className={styles.note}>Le passage précédent reste valable jusqu’au {preparationDate(record.expiresAt, state)}.</p>}
    </>;
  }
  if (!record.expiresAt) return <p>Aucun passage validé.</p>;
  if (!Number.isFinite(now)) return <p>Échéance · <time dateTime={record.expiresAt}>{preparationDate(record.expiresAt, state)}</time></p>;
  if (expiresAt <= now) return <p className={styles.intervention}>À renouveler · précédent passage expiré le {preparationDate(record.expiresAt, state)}</p>;
  return <>
    <p>{expiresAt - now <= KQ_GAME_DAY_MS ? "À renouveler bientôt" : "Valide"} · jusqu’au <time dateTime={record.expiresAt}>{preparationDate(record.expiresAt, state)}</time></p>
    {expiresAt > completedAt && <KqProgressMeter label="Validité restante" value={expiresAt - now} max={expiresAt - completedAt} valueLabel={gameDuration(expiresAt - now)}
      tone={expiresAt - now <= KQ_GAME_DAY_MS ? "gold" : "teal"} />}
  </>;
}

export function KqWarehouseCleaningPanel({ register, airlockInstalled, onOpenShop, onInspectAirlock }: {
  register: Register; airlockInstalled: boolean; onOpenShop?: OpenShop; onInspectAirlock?: () => void;
}) {
  const [worker, setWorker] = useState<"player" | "auto">("player");
  const { state, busy, uncertain } = register;
  const now = usePreparationClock(state);
  const inProgress = state?.cleaning.vacuum.pending ?? state?.cleaning.mop.pending;
  const installed = state?.entranceAirlock ?? airlockInstalled;
  const cleaningKnown = !!state && !busy && !register.error && !uncertain;
  const vacuumExpiry = Date.parse(state?.cleaning.vacuum.expiresAt ?? "");
  const vacuumOwned = !!state?.items.find(item => item.code === cleaningTools.vacuum.code && item.availableQuantity > 0);
  return <div className={`${styles.panel} ${styles.inline}`} data-warehouse-cleaning data-sylvain-target="cleaning"
    data-sylvain-seen={cleaningKnown && Object.values(state.cleaning).some(record => !!record.completedAt) ? "cleaning" : undefined}
    data-sylvain-cleaning-renew={cleaningKnown && vacuumOwned && !inProgress && vacuumExpiry <= now || undefined} tabIndex={-1}>
    <RegisterStatus register={register} />
    {state && <>
      <label>Qui s’en charge ? <select value={worker} disabled={!!inProgress || busy || uncertain} onChange={event => setWorker(event.target.value === "auto" ? "auto" : "player")}>
        <option value="player">Moi</option><option value="auto">Affectation automatique</option>
      </select></label>
      {cleaningSteps.map(step => {
        const record = state.cleaning[step];
        const { code, label, action } = cleaningTools[step];
        const item = state.items.find(candidate => candidate.code === code);
        const owned = Boolean(item?.availableQuantity);
        const block = !owned ? `Achète ${step === "vacuum" ? "l’aspirateur" : "la serpillière"} dans le rayon Nettoyage.`
          : inProgress ? "Un nettoyage est en cours."
          : step === "mop" && (!Number.isFinite(vacuumExpiry) || Number.isFinite(now) && vacuumExpiry < now + KQ_GAME_DAY_MS / 24)
            ? "Une aspiration doit rester valide jusqu’à la fin du lavage." : "";
        return <section key={step} className={styles.registerLine}
          data-sylvain-cleaning-pending={cleaningKnown && record.pending ? step : undefined}>
          <h4>{label}</h4>
          <CleaningProgress record={record} state={state} now={now} />
          <p className={styles.note}>{item?.name ?? catalog[code].name} · {owned ? "Possédé" : "À acquérir"}</p>
          {!record.pending && block && <p className={styles.note}>{block}</p>}
          <div className={styles.actions}>
            <button type="button" data-primary data-warehouse-clean-step={step} disabled={!!block || busy || uncertain}
              onClick={() => register.act({ action: "clean", step, workChoice: worker })}>{action}</button>
            {!owned && onOpenShop && <button type="button" onClick={() => onOpenShop(code)}>Voir l’outil en boutique</button>}
          </div>
        </section>;
      })}
    </>}
    <section className={styles.registerLine}>
      <h4>Sas d’entretien</h4>
      <p>{installed ? "Installé au seuil sud" : "À installer au seuil sud"} · {KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT} % de réduction du risque sanitaire restant au prochain semis.</p>
      <div className={styles.actions}>
        {installed && onInspectAirlock && <button type="button" onClick={onInspectAirlock}>Localiser le sas</button>}
        {!installed && onOpenShop && <button type="button" onClick={() => onOpenShop(airlockCode)}>Voir le sas en boutique</button>}
      </div>
    </section>
    <details><summary>Effet des passages au semis</summary>
      <p className={styles.note}>L’aspiration réduit le risque sanitaire de 5 %, le lavage de 10 %. Chaque passage reste valable sept jours de jeu et leurs effets s’ajoutent quand les deux sont valides au semis. Le sas protège tout l’entrepôt.</p>
    </details>
  </div>;
}
function CleaningTool({ item, register, targeted }: {
  item: Extract<KqWarehousePreparationItem, { kind: "equipment" }>; register: Register; targeted: boolean;
}) {
  const owned = item.availableQuantity > 0;
  const affordable = !!register.state && item.priceCents <= register.state.cashCents;
  const art = getKqCareProductArtwork(item.code);
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!targeted) return;
    card.current?.scrollIntoView({ block: "start", behavior: "instant" });
    card.current?.focus({ preventScroll: true });
  }, [targeted]);
  return <article className={`${styles.sheet} ${styles.productCard}`} ref={card} tabIndex={-1}
    data-warehouse-supply={item.code} data-warehouse-shop-product={item.code}>
    {art && <Image src={art.src} alt="" width={80} height={80} style={{ objectFit: "contain" }} />}
    <h4>{item.name}</h4><p>{descriptions[item.code]}</p>
    <strong>{owned ? "Possédé" : "À acquérir"}</strong>
    <span>{formatKqCash(item.priceCents)} / {item.unit}</span>
    {!owned && <button type="button" disabled={!affordable || register.busy || register.uncertain}
      onClick={() => register.act({ action: "purchase", code: item.code, quantity: 1, expectedCents: item.priceCents })}>
      Acheter · {formatKqCash(item.priceCents)}
    </button>}
    {!owned && !affordable && <p className={styles.note}>Trésorerie insuffisante pour cet achat.</p>}
  </article>;
}

export function RegisterStatus({ register }: { register: Register }) {
  return <div aria-live="polite">{register.error ? <div className={styles.row}><p role="alert" className={styles.error}>{register.error}</p>
    <button type="button" disabled={register.busy} onClick={register.refresh}>{register.uncertain ? "Vérifier l’opération" : "Relire le registre"}</button></div>
    : register.busy ? <p>{register.state ? "Actualisation du registre…" : "Lecture du registre…"}</p> : null}</div>;
}

export function KqWarehouseCleaning({ open, onClose }: { open: boolean; onClose: () => void }) {
  const register = useWarehousePreparations(undefined, open);
  return <AppDialog open={open} onClose={onClose} title="Nettoyer l’entrepôt" bodyClassName={styles.cleaningPanel}>
    <KqWarehouseCleaningPanel register={register} airlockInstalled={!!register.state?.entranceAirlock} />
  </AppDialog>;
}

function StationProgram({ register, zoneId, stationId, served, area, name, stationName, zonePaused, onOpenShop, onSelectZone, inline }: {
  register: Register; zoneId: string; stationId: string; served: number; area: number; name: string; stationName?: string;
  zonePaused?: boolean; onOpenShop?: OpenShop; onSelectZone?: (zoneId: string) => void; inline?: boolean;
}) {
  const state = register.state!;
  const program = state.programs.find(p => p.stationId === stationId && p.zoneId === zoneId);
  const [amount, setAmount] = useState(() => String(program?.quantities[base] ?? 1));
  const [extra, setExtra] = useState(() => String(program?.quantities[supplement] ?? 0));
  const baseItem = state.items.find(item => item.code === base);
  const extraItem = state.items.find(item => item.code === supplement);
  const available = baseItem && baseItem.availableQuantity + (program?.quantities[base] ?? 0);
  const extraAvailable = extraItem && extraItem.availableQuantity + (program?.quantities[supplement] ?? 0);
  const maxBase = Math.min(100, served, available ?? 0);
  const count = Number(amount);
  const extraCount = Number(extra);
  const hasInjector = state.injectors?.some(i => i.stationId === stationId);
  const injectorCost = state.injectors?.some(i => i.stationId === null) ? 0 : state.injectorPriceCents;
  const zoneInUse = state.runs.some(run => !run.zoneId || run.zoneId === zoneId);
  const editingDisabled = register.busy || register.uncertain;
  const reason = zoneInUse ? "Une culture est en cours. Prépare le mélange après la fin du cycle."
    : zonePaused ? "Réactive la zone avant de préparer le mélange."
    : available === undefined ? "Stock de nutrition de base indisponible."
    : maxBase === 0 ? "Il faut de la nutrition de base pour préparer le mélange."
    : !Number.isInteger(count) || count < 1 || count > maxBase ? `Choisis entre 1 et ${maxBase} doses de base.`
    : hasInjector && (!Number.isInteger(extraCount) || extraCount < 0 || extraCount > Math.min(count, extraAvailable ?? 0))
      ? "Le complément doit tenir dans le stock et la quantité de base." : "";
  const firstDate = program && <time dateTime={program.startsAt}>{preparationDate(program.startsAt, state)}</time>;
  const lastDate = program && <time dateTime={program.expiresAt}>{preparationDate(program.expiresAt, state)}</time>;
  return <section className={inline ? styles.registerLine : styles.sheet}><h4>{name}</h4>
    {stationName && <p className={styles.note}>{stationName}</p>}
    <KqProgressMeter label="Surface desservie" value={served} max={area} valueLabel={`${served} / ${area} m²`} />
    {program ? <p><strong>{program.quantities[base] ?? 0} doses de base et {program.quantities[supplement] ?? 0} de complément</strong> · du {firstDate} au {lastDate}</p>
      : <p>Aucun mélange préparé pour cette zone.</p>}
    <p className={styles.note}>Stock mobilisable · {available === undefined ? "base indisponible" : `${doseCount(available)} de base`} · {extraAvailable === undefined ? "complément indisponible" : `${doseCount(extraAvailable)} de complément`}.</p>
    {reason && <p className={styles.note}>{reason}</p>}
    <div className={styles.actions}>
      <label>Doses de base<input type="number" inputMode="numeric" min={1} max={Math.max(1, maxBase)} value={amount} disabled={editingDisabled || zoneInUse || zonePaused || !maxBase} onChange={event => setAmount(event.target.value)} /></label>
      {hasInjector && <label>Complément<input type="number" inputMode="numeric" min={0} max={Math.max(0, Math.min(count || 0, extraAvailable ?? 0))} value={extra} disabled={editingDisabled || zoneInUse || zonePaused || !extraAvailable} onChange={event => setExtra(event.target.value)} /></label>}
      <button type="button" data-primary disabled={!!reason || editingDisabled} onClick={() => register.act({ action: "program", stationId, zoneId, quantities: { [base]: count, ...(hasInjector && extraCount ? { [supplement]: extraCount } : {}) } })}>{program ? "Remplacer le mélange" : "Préparer le mélange"}</button>
      {onOpenShop && available === 0 && <button type="button" onClick={() => onOpenShop(base)}>Voir la nutrition de base</button>}
      {onOpenShop && hasInjector && extraAvailable === 0 && <button type="button" onClick={() => onOpenShop(supplement)}>Voir le complément</button>}
      {onSelectZone && <button type="button" onClick={() => onSelectZone(zoneId)}>Localiser la zone</button>}
      {program && <button type="button" disabled={editingDisabled || zoneInUse} onClick={() => register.act({ action: "program", stationId, zoneId, quantities: {} })}>Libérer les doses du mélange</button>}
    </div>
    <details><summary>{hasInjector ? "Injecteur installé" : injectorCost === 0 ? "Injecteur en réserve" : injectorCost !== undefined
      ? `Injecteur · ${formatKqCash(injectorCost)}` : "Effet du mélange"}</summary>
      <p className={styles.note}>Au prochain semis, la centrale ajoute 3 % de rendement potentiel sur les m² alimentés. Après sept jours de jeu, les doses du mélange redeviennent disponibles.</p>
      {hasInjector ? <p>Injecteur installé · le complément peut être distribué au semis avec la base.</p> : injectorCost !== undefined && <div className={styles.row}>
      <span>Injecteur de complément · distribue les deux apports en un seul passage.</span>
      <button type="button" disabled={editingDisabled || state.cashCents < injectorCost}
        onClick={() => register.act({ action: "injector", stationId, expectedCents: injectorCost })}>{injectorCost ? `Acheter et installer · ${formatKqCash(injectorCost)}` : "Installer l’injecteur en réserve"}</button>
      {state.cashCents < injectorCost && <small>Trésorerie insuffisante pour cet injecteur.</small>}</div>}
    </details>
  </section>;
}

export function KqWarehouseIrrigationPanel({ register, layout, stationId, onOpenShop, onSelectZone, inline = true }: {
  register: Register; layout?: KqWarehouseState; stationId?: string; onOpenShop?: OpenShop;
  onSelectZone?: (zoneId: string) => void; inline?: boolean;
}) {
  const { state } = register;
  const installed = layout?.stationPlacements?.filter(station => station.code === irrigationCode) ?? [];
  const served = state?.coverage.flatMap(zone => zone.stations.filter(station =>
    station.kind === "irrigation" && station.servedM2 > 0 && (!stationId || station.stationId === stationId))
    .map(station => ({ ...station, zoneId: zone.zoneId, area: zone.areaM2 }))) ?? [];
  const stationNames = new Map(installed.map(({ id }, index) => [id, `Centrale ${index + 1}`]));
  const selectedCount = stationId ? Number(stationNames.has(stationId)) : installed.length;
  const selectedArea = served.reduce((total, station) => total + station.servedM2, 0);
  const irrigationKnown = !!state && !register.busy && !register.error && !register.uncertain;
  const programs = state?.programs.filter(program => !stationId || program.stationId === stationId) ?? [];
  return <div className={`${styles.panel} ${inline ? styles.inline : ""}`} data-warehouse-supplies="water" data-sylvain-target="irrigation"
    data-sylvain-seen={irrigationKnown && programs.length > 0 ? "irrigation" : undefined}
    data-sylvain-irrigation-unprogrammed={irrigationKnown && selectedCount > 0 && programs.length === 0 || undefined} tabIndex={-1}>
    <RegisterStatus register={register} />
    {state && <>
      {layout && selectedCount > 0 && <KqProgressMeter label={stationId ? "Capacité de la centrale" : `Capacité · ${selectedCount} centrale${selectedCount > 1 ? "s" : ""}`}
        value={selectedArea} max={selectedCount * KQ_WAREHOUSE_STATIONS[irrigationCode].capacityM2}
        valueLabel={`${selectedArea} / ${selectedCount * KQ_WAREHOUSE_STATIONS[irrigationCode].capacityM2} m² desservis`} />}
      {served.length ? served.map(station => {
        const zone = layout?.zones.find(candidate => candidate.id === station.zoneId);
        return <StationProgram key={`${station.stationId}/${station.zoneId}`} register={register} {...station}
          served={station.servedM2} name={zone?.name ?? station.zoneId} stationName={!stationId ? stationNames.get(station.stationId) : undefined}
          zonePaused={zone?.active === false} onOpenShop={onOpenShop} onSelectZone={onSelectZone} inline={inline} />;
      }) : <div className={styles.registerLine}>
        <p>{selectedCount ? "Aucune zone de culture desservie. Rapproche la centrale d’une zone active en mode Aménager."
          : "Installe une centrale à portée d’une zone de culture et confirme le devis pour préparer un mélange."}</p>
        {onOpenShop && !selectedCount && <div className={styles.actions}><button type="button" data-primary onClick={() => onOpenShop(irrigationCode)}>Voir la centrale en boutique</button></div>}
      </div>}
    </>}
  </div>;
}

export function KqWarehouseInputsPanel({ register, runs, selectedRunId, onSelectRun, onOpenShop, onOpenIrrigation, onOpenCulture }: {
  register: Register; runs: readonly { runId: string; name: string; zoneId?: string | null }[];
  selectedRunId?: string; onSelectRun: (runId: string) => void; onOpenShop: OpenShop;
  onOpenIrrigation: () => void; onOpenCulture?: (runId: string, zoneId?: string | null) => void;
}) {
  const [selection, setSelection] = useState<KqWarehouseInputCode>();
  const { state } = register;
  const items = state?.items.filter(item => item.kind === "consumable") ?? [];
  const sorted = [...items].sort((a, b) => (getKqWarehouseInputPack(a.code)?.name ?? a.name).localeCompare(getKqWarehouseInputPack(b.code)?.name ?? b.name, "fr"));
  const run = runs.find(candidate => candidate.runId === selectedRunId) ?? runs[0];
  const record = state?.runs.find(candidate => candidate.runId === run?.runId);
  const item = items.find(candidate => candidate.code === selection)
    ?? items.find(candidate => candidate.availableQuantity + candidate.reservedQuantity > 0 || (candidate.legacyPassQuantity ?? 0) > 0)
    ?? items.find(candidate => candidate.code === base);
  const accessible = item && record ? (record.available ?? record.reserved)[item.code] ?? 0 : undefined;
  const reservedForRun = item && record ? record.reserved[item.code] ?? 0 : undefined;
  const consumed = item && record ? record.consumed[item.code] ?? 0 : undefined;
  const name = item && (getKqWarehouseInputPack(item.code)?.name ?? item.name);
  return <div className={`${styles.panel} ${styles.inline}`} data-warehouse-inputs data-sylvain-target="inputs"
    data-sylvain-seen={item && !register.busy && !register.error && !register.uncertain ? "inputs" : undefined} tabIndex={-1}>
    <RegisterStatus register={register} />
    {state && <>
      {run ? <label>Culture <select value={run.runId} onChange={event => onSelectRun(event.target.value)}>
        {runs.map(candidate => <option key={candidate.runId} value={candidate.runId}>{candidate.name}</option>)}
      </select></label> : <p>Aucune culture en cours. Le stock libre est disponible pour les prochains semis.</p>}
      {item && <>
        <label>Produit <select value={item.code} onChange={event => setSelection(event.target.value as KqWarehouseInputCode)}>
          {sorted.map(candidate => <option key={candidate.code} value={candidate.code}>{getKqWarehouseInputPack(candidate.code)?.name ?? candidate.name}</option>)}
        </select></label>
        <div className={styles.registerLine} data-warehouse-input={item.code}>
          <h4>{name}</h4>
          <KqAllocationBar label="Stock de l’entrepôt" emptyLabel="Aucune dose en stock."
            items={[{ label: "Disponible", value: item.availableQuantity, displayValue: doseCount(item.availableQuantity), tone: "teal" },
              { label: "Réservé", value: item.reservedQuantity, displayValue: doseCount(item.reservedQuantity), tone: "gold" }]} />
          {run && <dl className={styles.cycleStats} aria-label={`Disponibilité pour ${run.name}`}>
            <div><dt>Accessible au cycle</dt><dd>{accessible === undefined ? "Indisponible" : doseCount(accessible)}</dd></div>
            {reservedForRun !== undefined && <div><dt>Dont réservé ici</dt><dd>{doseCount(reservedForRun)}</dd></div>}
            {consumed !== undefined && <div><dt>Déjà utilisé</dt><dd>{doseCount(consumed)}</dd></div>}
          </dl>}
          {!!item.legacyPassQuantity && <p className={styles.note}>En plus · {item.legacyPassQuantity} traitement{item.legacyPassQuantity > 1 ? "s" : ""} de zone en réserve.</p>}
          {run && accessible === undefined && <p className={styles.note}>Le registre ne fournit pas de disponibilité pour ce cycle.</p>}
          {run && accessible === 0 && item.availableQuantity > 0 && <p className={styles.intervention}>Ce cycle ne peut plus utiliser ce produit. Vérifie le stock présent au semis et la limite de la zone.</p>}
          {run && accessible !== undefined && accessible > 0 && accessible < item.availableQuantity && <p className={styles.note}>Une partie du stock est inaccessible à ce cycle.</p>}
          <div className={styles.actions}>
            {getKqWarehouseInputPack(item.code) && <button type="button" data-primary onClick={() => onOpenShop(item.code)} aria-label={`Voir ${name} en boutique`}>Voir le produit en boutique</button>}
            {run && onOpenCulture && <button type="button" onClick={() => onOpenCulture(run.runId, run.zoneId)}>Ouvrir la culture</button>}
            {(item.code === base || item.code === supplement) && <button type="button" onClick={onOpenIrrigation}>Préparer en centrale</button>}
          </div>
        </div>
        {run && <details><summary>Quels intrants puis-je utiliser ?</summary>
          <p className={styles.note}>Une culture accède au stock encore disponible qui était présent à son semis et à ses réserves. Les nouveaux achats servent aux prochains semis. En culture, ouvre Santé → Produits de soin pour traiter une case.</p>
        </details>}
      </>}
      <div className={styles.actions}><button type="button" onClick={() => onOpenShop()}>Tout le rayon Intrants</button></div>
    </>}
  </div>;
}

export function KqWarehouseSupplies({ section, layout, stationId, onPaid, initialCode }: { section: "nutrition" | "hygiene" | "water"; layout?: KqWarehouseState; stationId?: string; initialCode?: string; onPaid?: (cashCents: number) => void }) {
  const register = useWarehousePreparations(onPaid);
  const { state } = register;
  if (section === "water") return <KqWarehouseIrrigationPanel register={register} layout={layout} stationId={stationId} inline={false} />;
  return <div className={styles.panel} data-warehouse-supplies={section}>
    <RegisterStatus register={register} />
    {state && <>
      {section === "nutrition" ? <KqWarehouseInputCatalog register={register} initialCode={initialCode} /> :
          <div className={styles.cards}>{state.items.filter(item => item.kind === "equipment").map(item => <CleaningTool key={item.code} item={item} register={register} targeted={initialCode === item.code} />)}</div>}
    </>}
  </div>;
}

export function WarehouseRunSupplies({ runs, locked = false }: { runs: { runId: string; name: string }[]; locked?: boolean }) {
  const register = useWarehousePreparations();
  return <div className={styles.panel}><RegisterStatus register={register} />{register.state && runs.map(({ runId, name }) => {
    const record = register.state!.runs.find(r => r.runId === runId);
    const available = record?.available ?? record?.reserved ?? {};
    const usable = provisions.filter(code => (available[code] ?? 0) > 0);
    return <section className={styles.sheet} key={runId}><h4>{name}</h4>
      {usable.length ? usable.map(code => {
        const needsBase = code === "WAREHOUSE-NUTRITION-SUPPLEMENT" && (record?.consumed[base] ?? 0) <= (record?.consumed[code] ?? 0);
        return <div className={styles.row} key={code}><span>{getKqWarehouseInputPack(code)?.name ?? catalog[code].name} · {doseCount(available[code] ?? 0)} dans le stock utilisable ici</span>
          <button type="button" data-warehouse-use={code} disabled={locked || register.busy || register.uncertain || needsBase} onClick={() => register.act({ action: "use", runId, quantities: { [code]: 1 } })}>Utiliser une dose</button>
          {needsBase && <small>Applique d’abord une dose de nutrition de base dans cette zone.</small>}
        </div>;
      })
        : <p>Aucune provision générale du stock présent au semis ne reste disponible pour cette zone.</p>}
      {Object.entries(available).some(([code, quantity]) => code.startsWith("CARE-") && quantity > 0) && <p>Pour traiter un problème sur une case de cette zone, ouvre Santé → Produits de soin.</p>}
      {record && Object.entries(record.consumed).filter(([, count]) => count > 0).map(([code, count]) => <p className={styles.note} key={code}>{getKqWarehouseInputPack(code)?.name ?? catalog[code as KqWarehouseInputCode].name} · consommation de {doseCount(count)}</p>)}
    </section>;
  })}</div>;
}

export function WarehouseStockRegister() {
  const register = useWarehousePreparations();
  const items = register.state?.items.filter(i => i.availableQuantity + i.reservedQuantity > 0 || (i.kind === "consumable" && (i.legacyPassQuantity ?? 0) > 0)) ?? [];
  return <section className={styles.panel} aria-label="Stock des intrants et des outils"><h3>Stock des intrants et des outils</h3>
    <RegisterStatus register={register} />
    {register.state && <div className={styles.sheet}>
      {!items.length && <p>Réserve vide. Les achats du rayon Intrants et provisions apparaîtront ici.</p>}
      {items.map(i => <div className={styles.row} key={i.code}><strong>{getKqWarehouseInputPack(i.code)?.name ?? i.name}</strong>
        {i.kind === "equipment" ? <span>Possédé · tout l’entrepôt</span> : <span>{i.availableQuantity.toLocaleString("fr-FR")} utilisations en stock{i.reservedQuantity > 0 && ` · ${i.reservedQuantity} déjà affectées en plus`}{!!i.legacyPassQuantity && ` · ${i.legacyPassQuantity} traitement(s) de zone en réserve`}</span>}
      </div>)}
      {!!register.state.injectors?.length && <p>Injecteurs · {register.state.injectors.length} possédés, dont {register.state.injectors.filter(i => i.stationId === null).length} en réserve.</p>}
    </div>}
  </section>;
}
