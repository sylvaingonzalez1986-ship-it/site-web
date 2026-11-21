"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Camera, RadioTower, Siren } from "lucide-react";
import { createClientRequestKey } from "@/lib/client-request-key";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqBusinessClock, KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";
import { getKqWarehouseDimensions, type KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { getKqWarehouseStationEntrance } from "@/lib/kanab-quest-warehouse-stations";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import {
  getKqWarehouseCameraCoverage, getKqWarehouseSecurityCoverage, getKqWarehouseSecurityObstacles,
  KQ_CAMERA_SPEC, KQ_WAREHOUSE_CAMERA_BEARINGS, kqSecurityCellKey,
  type KqWarehouseCamera, type KqWarehouseCameraPlacement, type KqWarehouseSecurityAction, type KqWarehouseSecuritySnapshot,
} from "@/lib/kanab-quest-warehouse-security";
import { KqProgressMeter } from "./KqVisuals";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqWarehouseSecurity.module.css";

const endpoint = "/api/arena/placard/warehouse/security";
const pageError = "La sécurité de l’entrepôt est momentanément indisponible.";
const dates = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
const steps: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
type Proposal = { command: KqWarehouseSecurityAction; label: string; expectedChargeCents: number };
type Request = Proposal & { requestKey: string; revision: number; layoutRevision: number };
const newCamera = "new-camera";

function CameraPlan({ layout, cameras, selectedId, draft, alarm, onSelect, focusFirstFree = false }: {
  layout: KqWarehouseState; cameras: KqWarehouseCamera[]; selectedId: string;
  draft: KqWarehouseCameraPlacement | null; alarm: boolean;
  onSelect: (x: number, y: number, cameraId?: string) => void;
  focusFirstFree?: boolean;
}) {
  const { columns, rows } = getKqWarehouseDimensions(layout);
  const { visible } = useMemo(() => getKqWarehouseSecurityCoverage(layout, cameras), [layout, cameras]);
  const preview = useMemo(() => draft && getKqWarehouseCameraCoverage(layout, draft), [layout, draft]);
  const [focused, setFocused] = useState(0);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!focusFirstFree) return;
    const first = cells.current.find(cell => cell && !cell.hasAttribute("aria-disabled"));
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [focusFirstFree]);
  const entrance = getKqWarehouseStationEntrance({ columns, rows });
  const zones = [...layout.zones, ...(layout.serviceZones ?? [])];

  function navigate(event: KeyboardEvent<HTMLButtonElement>, x: number, y: number) {
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    const column = Math.max(0, Math.min(columns - 1, x + step[0]));
    const row = Math.max(0, Math.min(rows - 1, y + step[1]));
    cells.current[row * columns + column]?.focus();
  }

  return <figure className={styles.figure}>
    <figcaption>Plan enregistré · 1 case = 1 m²</figcaption>
    <div className={styles.mapScroll}>
      <div className={styles.map} style={{ "--columns": columns } as CSSProperties} role="group" aria-label="Plan de sécurité, navigation avec les flèches">
        {Array.from({ length: columns * rows }, (_, index) => {
          const x = index % columns, y = Math.floor(index / columns);
          const key = kqSecurityCellKey({ x, y });
          const obstacle = getKqWarehouseSecurityObstacles(layout, { x, y });
          const installed = cameras.find(item => item.placement?.x === x && item.placement.y === y);
          const chosen = draft?.x === x && draft?.y === y;
          const direction = chosen ? draft.bearing : installed?.placement?.bearing;
          const bearing = direction === undefined ? undefined : KQ_WAREHOUSE_CAMERA_BEARINGS[direction];
          const zone = zones.find(item => item.x <= x && x < item.x + item.width && item.y <= y && y < item.y + item.height);
          const identity = zone && getKqZoneIdentity(layout, zone.id);
          const threshold = x === entrance.x && y === entrance.y;
          const selected = chosen || installed?.id === selectedId;
          const blocked = Boolean(obstacle || selectedId && installed && installed.id !== selectedId);
          const label = [`Colonne ${x + 1}, ligne ${y + 1}`, identity?.label, threshold && (alarm ? "Porte sud, alarme installée" : "Porte sud"),
            obstacle, visible.has(key) && "filmée", preview?.has(key) && "dans l’aperçu", bearing && `caméra orientée ${bearing.name}`, blocked && "pose indisponible"].filter(Boolean).join(" · ");
          return <button key={key} type="button" ref={element => { cells.current[index] = element; }}
            className={styles.cell} aria-label={label} aria-disabled={blocked || undefined} tabIndex={focused === index ? 0 : -1}
            data-filmed={visible.has(key) || undefined} data-preview={preview?.has(key) || undefined} data-obstacle={obstacle ? true : undefined}
            data-placed={bearing ? true : undefined} data-picked={selected || undefined} data-entry={threshold || undefined}
            style={identity ? { "--zone-tint": identity.tint } as CSSProperties : undefined}
            onFocus={() => setFocused(index)} onKeyDown={event => navigate(event, x, y)}
            onClick={() => { if (!blocked) onSelect(x, y, installed?.id); }}>
            {bearing ? <span aria-hidden="true">{bearing.arrow}</span> : obstacle ? <span aria-hidden="true">×</span>
              : threshold ? <span aria-hidden="true">{alarm ? "♯" : "↓"}</span> : zone && zone.x === x && zone.y === y ? <span aria-hidden="true">{identity?.number}</span> : null}
          </button>;
        })}
      </div>
    </div>
    <ul className={styles.legend} aria-label="Légende du plan">
      <li><span className={styles.filmedMark} aria-hidden="true" /> Case filmée</li>
      {draft && <li><span className={styles.previewMark} aria-hidden="true" /> Aperçu</li>}
      <li><span aria-hidden="true">×</span> Obstacle</li>
      <li><span aria-hidden="true">↓</span> Porte sud</li>
    </ul>
  </figure>;
}

export default function KqWarehouseSecurity({ onChanged, onPlacementChange, active = true, variant = "full", layoutRevision,
  onSnapshotChange, selectedCameraId, onSelectCamera, coverageVisible, onToggleCoverage, onSelectZone, onBusyChange, calendarOrigin }: {
  onChanged?: (cashCents: number) => void; onPlacementChange?: (active: boolean) => void;
  active?: boolean; variant?: "full" | "inline"; layoutRevision?: number;
  onSnapshotChange?: (snapshot: KqWarehouseSecuritySnapshot) => void;
  selectedCameraId?: string | null; onSelectCamera?: (id: string | null) => void;
  coverageVisible?: boolean; onToggleCoverage?: () => void; onSelectZone?: (zoneId: string) => void;
  onBusyChange?: (busy: boolean) => void; calendarOrigin?: string | null;
}) {
  const id = useId();
  const api = useKqTutorialApi();
  const [snapshot, setSnapshot] = useState<KqWarehouseSecuritySnapshot | null>(null);
  const [readAt, setReadAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [retry, setRetry] = useState<Request | null>(null);
  const [localSelection, setLocalSelection] = useState("");
  const [buyingCamera, setBuyingCamera] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const selectedId = selectedCameraId === undefined ? localSelection : selectedCameraId ?? "";
  useEffect(() => {
    onPlacementChange?.(active && buyingCamera);
    return () => onPlacementChange?.(false);
  }, [active, buyingCamera, onPlacementChange]);
  useEffect(() => { if (snapshot) onSnapshotChange?.(snapshot); }, [snapshot, onSnapshotChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const purchaseButton = useRef<HTMLButtonElement>(null);
  const [edit, setEdit] = useState<{ id: string; bearing: number; draft: KqWarehouseCameraPlacement | null }>();
  const submitting = useRef(false);
  const publishing = useRef(false);
  const refreshWaiting = useRef(false);
  const readVersion = useRef(0);
  const confirmation = useRef<HTMLButtonElement>(null);
  const confirmationOpener = useRef<HTMLElement>(null);
  const receipt = useRef<HTMLParagraphElement>(null);
  const coverage = useMemo(() => snapshot?.layout ? getKqWarehouseSecurityCoverage(snapshot.layout, snapshot.cameras) : null, [snapshot]);

  useEffect(() => {
    if (submitting.current) {
      refreshWaiting.current = true;
      return;
    }
    const abort = new AbortController();
    const version = ++readVersion.current;
    const current = () => !abort.signal.aborted && version === readVersion.current && !submitting.current;
    void api.request(endpoint, { cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]) }).then(async response => {
      if (!response.ok) throw new Error(pageError);
      const data: KqWarehouseSecuritySnapshot = await response.json();
      if (current()) {
        setReadAt(Date.parse(response.headers.get("date") ?? "") || Date.now());
        setSnapshot(data);
        setError("");
      }
    }).catch(() => {
      if (current()) setError(pageError);
    }).finally(() => { if (current()) setLoading(false); });
    return () => abort.abort();
  }, [api, layoutRevision, refresh]);

  const refreshSecurity = useCallback(() => {
    if (publishing.current) return;
    if (submitting.current) {
      refreshWaiting.current = true;
      return;
    }
    setLoading(true);
    setRefresh(value => value + 1);
  }, []);
  useEffect(() => api.subscribe(["kq:warehouse-security-updated", "kq:treasury-updated", "kq:preparations-updated"], refreshSecurity), [api, refreshSecurity]);
  const expiry = Date.parse(snapshot?.monitoring.paidUntil ?? "");
  useEffect(() => {
    if (!(expiry > readAt)) return;
    const timer = window.setTimeout(refreshSecurity, Math.max(300, expiry - readAt + 200));
    return () => window.clearTimeout(timer);
  }, [expiry, readAt, refreshSecurity]);

  useEffect(() => {
    if (active && (proposal || retry)) confirmation.current?.focus();
  }, [active, proposal, retry]);

  useEffect(() => { if (status) receipt.current?.focus(); }, [status]);

  function selectCamera(cameraId: string) {
    setLocalSelection(cameraId);
    onSelectCamera?.(cameraId || null);
    setEdit(undefined);
  }

  async function submit(choice: Proposal, request = snapshot && {
    ...choice, requestKey: createClientRequestKey(), revision: snapshot.revision, layoutRevision: snapshot.layoutRevision,
  }) {
    if (!request || submitting.current) return;
    submitting.current = true;
    readVersion.current++;
    setBusy(true);
    setError("");
    setStatus("");
    setRetry(null);
    try {
      const { label, ...body } = request;
      const response = await api.request(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? pageError);
        if (response.status === 409) {
          setProposal(null);
          selectCamera("");
          setLoading(true);
          setRefresh(value => value + 1);
        } else if (response.status >= 500 || response.status === 429) setRetry(request);
        return;
      }
      const next = data as KqWarehouseSecuritySnapshot;
      setReadAt(Date.parse(response.headers.get("date") ?? "") || Date.now());
      setSnapshot(next);
      setProposal(null);
      const charged = next.receipt?.chargedCents ?? 0;
      setStatus(charged ? `${label} · ${formatKqCash(charged)} débités.` : `${label} · Aucun débit.`);
      if (choice.command.action === "buy-place-camera") {
        setBuyingCamera(false);
        selectCamera(request.requestKey);
      }
      if (["place-camera", "stow-camera"].includes(choice.command.action)) setEdit(undefined);
      onChanged?.(next.cashCents);
      publishing.current = true;
      api.notify("kq:warehouse-security-updated");
      if (charged) api.notify("kq:treasury-updated");
    } catch {
      setError("La réponse est indisponible. Réessaie la même opération pour vérifier son résultat.");
      setRetry(request);
    } finally {
      publishing.current = false;
      submitting.current = false;
      setBusy(false);
      if (refreshWaiting.current) {
        refreshWaiting.current = false;
        refreshSecurity();
      }
    }
  }

  if (!active) return null;
  if (!snapshot) return <div className={styles.root} aria-busy={loading}>
    {error ? <><p role="alert">{error}</p><button type="button" onClick={() => { setError(""); refreshSecurity(); }}>Réessayer</button></>
      : <p role="status">Chargement de la sécurité…</p>}
  </div>;
  if (!snapshot.layout) return <p>Ouvre l’entrepôt pour enregistrer son plan avant d’installer la sécurité.</p>;

  const { layout, cameras, alarm, monitoring, prices, cashCents } = snapshot;
  const hasPaidPeriod = expiry > readAt;
  const monitoringCharge = hasPaidPeriod ? 0 : prices.monitoringCents;
  const monitoringLabel = monitoring.status === "active" ? "Active" : monitoring.status === "suspended" ? "Suspendue"
    : monitoring.status === "cancelled" ? monitoring.enabled ? "Résiliée à l’échéance" : "Résiliée" : "Sans abonnement";
  const selected = cameras.find(camera => camera.id === selectedId);
  const editId = buyingCamera ? newCamera : selectedId;
  const currentEdit = edit?.id === editId ? edit : undefined;
  const draft = currentEdit?.draft ?? null;
  const position = draft ?? selected?.placement;
  const bearing = currentEdit?.bearing ?? (buyingCamera ? 0 : selected?.placement?.bearing ?? 0);
  const setDraft = (placement: KqWarehouseCameraPlacement) => setEdit({ id: editId, bearing: placement.bearing, draft: placement });
  const installed = cameras.filter(camera => camera.placement).length;
  const blocked = busy || loading || !!proposal || !!retry;
  const guideReady = !api.isTutorial && !blocked && !error;
  const activeZones = coverage?.zones.filter(zone => zone.active) ?? [];
  const activeArea = activeZones.reduce((total, zone) => total + zone.area, 0);
  const filmedArea = activeZones.reduce((total, zone) => total + zone.covered, 0);
  const needsCoverage = activeZones.filter(zone => zone.covered < zone.area);
  const gameDeadline = calendarOrigin && monitoring.paidUntil ? getKqBusinessClock(calendarOrigin, expiry) : null;
  const placementPlan = variant === "full" || planOpen ? <CameraPlan key={snapshot.layoutRevision} layout={layout} cameras={cameras}
    selectedId={selected?.id ?? ""} draft={draft} alarm={alarm === "installed"} onSelect={(x, y, cameraId) => {
      if (blocked) return;
      if (selected) setDraft({ x, y, bearing });
      else if (cameraId) selectCamera(cameraId);
    }} /> : null;
  const confirm = (command: KqWarehouseSecurityAction, label: string, expectedChargeCents: number) => {
    confirmationOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setProposal({ command, label, expectedChargeCents });
  };

  return <div className={styles.root} data-variant={variant} aria-busy={busy || loading} data-warehouse-security>
    {!buyingCamera && <div className={styles.summary}>
      {variant === "full" && <div><span>Trésorerie</span><strong>{formatKqCash(cashCents)}</strong></div>}
      <div><span>Caméras posées</span><strong>{installed} / {cameras.length}</strong></div>
      {variant === "inline" ? <div><span>Alarme</span><strong>{alarm === "installed" ? "Installée" : alarm === "owned" ? "En réserve" : "Absente"}</strong></div>
        : <div><span>Télésurveillance</span><strong>{monitoringLabel}</strong></div>}
    </div>}
    {error && <div className={styles.actions}><p className={styles.error} role="alert">{error}</p>
      {!retry && <button type="button" disabled={loading || busy} onClick={refreshSecurity}>Relire la sécurité</button>}
    </div>}
    <div className={styles.announcement} role="status" aria-live="polite">{status && <p ref={receipt} className={styles.status} tabIndex={-1}>{status}</p>}</div>

    {(proposal || retry) && <section className={styles.confirm} aria-labelledby={`${id}-confirm`}>
      <h4 id={`${id}-confirm`}>{proposal?.label ?? retry?.label}</h4>
      <p>{retry ? "La même demande sera vérifiée." : proposal?.command.action === "cancel"
        ? "Les prélèvements s’arrêtent. Si la télésurveillance est active, elle continue jusqu’à l’échéance payée."
        : `Débit immédiat · ${formatKqCash(proposal?.expectedChargeCents ?? 0)}`}</p>
      <div className={styles.actions}>
        {retry ? <button type="button" ref={confirmation} data-primary onClick={() => void submit(retry, retry)} disabled={busy}>Vérifier la demande</button>
          : <button type="button" ref={confirmation} data-primary onClick={() => { if (proposal) void submit(proposal); }} disabled={busy}>Confirmer</button>}
        <button type="button" onClick={() => {
          setProposal(null);
          if (retry) { setRetry(null); refreshSecurity(); }
          requestAnimationFrame(() => confirmationOpener.current?.focus());
        }} disabled={busy}>Retour</button>
      </div>
    </section>}

    {buyingCamera ? <section className={styles.sheet} data-camera-install aria-labelledby={`${id}-install`}>
      <h4 id={`${id}-install`}>Installer une caméra dans l’entrepôt</h4>
      <p>Choisis une case libre puis son orientation. La caméra coûte {formatKqCash(prices.cameraCents)} à la confirmation.</p>
      <CameraPlan key={snapshot.layoutRevision} layout={layout} cameras={cameras} selectedId={newCamera} draft={draft}
        alarm={alarm === "installed"} focusFirstFree onSelect={(x,y) => { if (!blocked) setDraft({x,y,bearing}); }} />
      <label>Orientation <select aria-label="Orientation de la nouvelle caméra" value={bearing} disabled={blocked} onChange={event => {
        const angle = Number(event.target.value);
        setEdit({ id: editId, bearing: angle, draft: draft && { ...draft, bearing: angle } });
      }}>{KQ_WAREHOUSE_CAMERA_BEARINGS.map((direction,index) => <option key={direction.name} value={index}>{direction.arrow} {direction.name}</option>)}</select></label>
      {draft && <p aria-live="polite">Colonne {draft.x+1}, ligne {draft.y+1} · {KQ_WAREHOUSE_CAMERA_BEARINGS[draft.bearing].name}</p>}
      <div className={styles.actions}>
        <button type="button" data-primary disabled={!draft || blocked || cashCents < prices.cameraCents} onClick={() => {
          if (draft) void submit({ command: { action: "buy-place-camera", placement: draft }, label: "Caméra achetée et installée", expectedChargeCents: prices.cameraCents });
        }}>Confirmer l’achat et la pose · {formatKqCash(prices.cameraCents)}</button>
        <button type="button" disabled={blocked} onClick={() => {
          setBuyingCamera(false); setEdit(undefined); requestAnimationFrame(() => purchaseButton.current?.focus());
        }}>{variant === "inline" ? "Retour à la sécurité" : "Retour à la boutique"}</button>
      </div>
    </section> : <><section className={styles.sheet} aria-labelledby={`${id}-camera`} data-sylvain-target="camera"
      data-sylvain-seen={guideReady && installed > 0 && (coverageVisible || planOpen || variant === "full") ? "camera" : undefined}
      data-sylvain-installed-cameras={guideReady ? installed : undefined} tabIndex={-1}>
      <h4 id={`${id}-camera`}><Camera size={22} aria-hidden="true" /> Caméras</h4>
      {variant === "inline" && <>
        {activeArea > 0 ? <KqProgressMeter label="Culture active filmée" value={filmedArea} max={activeArea} valueLabel={`${filmedArea} / ${activeArea} m²`} />
          : <p>Aucune zone de culture active.</p>}
        {activeArea > 0 && (needsCoverage.length ? <p>{activeArea - filmedArea} m² de culture active hors caméra.</p> : <p>Toutes les surfaces de culture active sont filmées.</p>)}
        {onToggleCoverage && <div className={styles.actions}><button type="button" data-sylvain-target={installed && !coverageVisible ? "camera-coverage" : undefined} aria-pressed={!!coverageVisible} onClick={onToggleCoverage} disabled={!installed}>
          {coverageVisible ? "Masquer la couverture" : "Afficher la couverture"}
        </button>{!installed && <p>Installe une caméra pour voir son champ.</p>}</div>}
      </>}
      <div className={styles.placement}>
        <div className={styles.controls}>
          <p>{KQ_CAMERA_SPEC.angle}° · Portée {KQ_CAMERA_SPEC.rangeM} m · {formatKqCash(prices.cameraCents)} par caméra</p>
          <button type="button" ref={purchaseButton} onClick={() => {
            selectCamera(""); setError(""); setStatus(""); setBuyingCamera(true);
          }} disabled={blocked || cameras.length >= KQ_CAMERA_SPEC.maximum || cashCents < prices.cameraCents}>Acheter une caméra</button>
          {cameras.length >= KQ_CAMERA_SPEC.maximum && <p>Limite de {KQ_CAMERA_SPEC.maximum} caméras atteinte.</p>}
          {cashCents < prices.cameraCents && cameras.length < KQ_CAMERA_SPEC.maximum && <p>Trésorerie insuffisante pour cet achat.</p>}
          {cameras.length > 0 && <label>Caméra à régler
            <select value={selected?.id ?? ""} onChange={event => selectCamera(event.target.value)} disabled={blocked}>
              <option value="">Toutes les caméras</option>
              {cameras.map((camera, index) => <option key={camera.id} value={camera.id}>Caméra {index + 1} · {camera.placement ? variant === "full"
                ? `C${camera.placement.x + 1}, L${camera.placement.y + 1}` : KQ_WAREHOUSE_CAMERA_BEARINGS[camera.placement.bearing].name : "En réserve"}</option>)}
            </select>
          </label>}
          {selected && <>
            <label>Orientation
              <select value={bearing} disabled={blocked} onChange={event => {
                const angle = Number(event.target.value);
                setEdit({ id: editId, bearing: angle, draft: position ? { ...position, bearing: angle } : null });
              }}>
                {KQ_WAREHOUSE_CAMERA_BEARINGS.map((direction, index) => <option key={direction.name} value={index}>{direction.arrow} {direction.name}</option>)}
              </select>
            </label>
            {position && variant === "full" ? <p>Colonne {position.x + 1}, ligne {position.y + 1}</p> : !position && <p>Ouvre le plan de placement et choisis une case libre.</p>}
            <div className={styles.actions}>
              <button type="button" data-primary disabled={!draft || blocked} onClick={() => { if (draft) void submit({
                command: { action: "place-camera", cameraId: selected.id, placement: draft }, label: "Position enregistrée", expectedChargeCents: 0,
              }); }}>Enregistrer la position</button>
              {selected.placement && <button type="button" disabled={blocked} onClick={() => void submit({
                command: { action: "stow-camera", cameraId: selected.id }, label: "Caméra remise en réserve", expectedChargeCents: 0,
              })}>Remettre en réserve</button>}
            </div>
          </>}
        </div>
        {variant === "inline" ? (!!cameras.length && <details data-camera-placement-plan open={planOpen} onToggle={event => setPlanOpen(event.currentTarget.open)}>
          <summary>Plan de placement</summary>{placementPlan}
        </details>) : placementPlan}
      </div>
      {variant === "full" && (activeArea > 0 ? <KqProgressMeter label="Culture active filmée" value={filmedArea} max={activeArea} valueLabel={`${filmedArea} / ${activeArea} m²`} />
        : <p>Aucune zone de culture active.</p>)}
      {!!coverage?.zones.length && <details><summary>Couverture par zone</summary>
        <ul className={styles.coverage}>{coverage.zones.map(zone => <li key={zone.id}>
          <span>{getKqZoneIdentity(layout, zone.id)?.label} · {zone.name}{zone.active ? "" : " (inactive)"}</span><strong>{zone.covered} / {zone.area} m²</strong>
          {onSelectZone && <button type="button" onClick={() => onSelectZone(zone.id)}>Localiser {zone.name}</button>}
        </li>)}</ul>
      </details>}
    </section>

    <div className={styles.services}>
      <section className={styles.sheet} aria-labelledby={`${id}-alarm`} data-sylvain-target="alarm"
        data-sylvain-seen={guideReady && alarm === "installed" ? "alarm" : undefined} data-sylvain-alarm={guideReady ? alarm : undefined} tabIndex={-1}>
        <h4 id={`${id}-alarm`}><Siren size={22} aria-hidden="true" /> Alarme</h4>
        <p>{alarm === "installed" ? "Installée à la porte sud · active" : alarm === "owned" ? "En réserve · installation gratuite" : `${formatKqCash(prices.alarmCents)} · achat unique`}</p>
        <p>La sirène réduit les pertes de vol de 25 % sur toutes les zones de culture.</p>
        {alarm === "none" && <button type="button" disabled={blocked || cashCents < prices.alarmCents} onClick={() => confirm({ action: "buy-install-alarm" }, "Achat et installation de l’alarme à la porte sud", prices.alarmCents)}>Acheter et installer à la porte sud</button>}
        {alarm === "none" && cashCents < prices.alarmCents && <p>Trésorerie insuffisante pour cet achat.</p>}
        {alarm === "owned" && <button type="button" data-primary disabled={blocked} onClick={() => void submit({ command: { action: "install-alarm" }, label: "Alarme installée", expectedChargeCents: 0 })}>Installer à la porte sud</button>}
      </section>
      <section className={styles.sheet} aria-labelledby={`${id}-monitoring`} data-sylvain-target="subscription"
        data-sylvain-seen={guideReady && monitoring.status === "active" && hasPaidPeriod ? "subscription" : undefined}
        data-sylvain-monitoring={guideReady ? monitoring.status : undefined} data-sylvain-period-paid={guideReady && hasPaidPeriod || undefined} tabIndex={-1}>
        <h4 id={`${id}-monitoring`}><RadioTower size={22} aria-hidden="true" /> Télésurveillance</h4>
        <p><strong>{formatKqCash(prices.monitoringCents)} / mois de jeu</strong> · {monitoringLabel}</p>
        {monitoring.paidUntil && <p>{hasPaidPeriod ? "Échéance payée" : "Dernière échéance"} · <time dateTime={monitoring.paidUntil}>
          {gameDeadline && `jour ${gameDeadline.dayOfMonth} du mois ${gameDeadline.month} · `}{dates.format(new Date(monitoring.paidUntil))}</time> (Paris)
          {hasPaidPeriod && expiry - readAt <= KQ_GAME_DAY_MS && " · Moins d’un jour de jeu restant"}</p>}
        {alarm !== "installed" ? <p>Installe d’abord l’alarme.</p> : <p>Réduit les pertes de vol de 25 % supplémentaires tant que le service est actif.</p>}
        {monitoring.status === "suspended" && hasPaidPeriod && <p>La période payée reste disponible. Reprise sans nouveau débit.</p>}
        {monitoring.status === "suspended" && !hasPaidPeriod && <p>La reprise démarre une nouvelle période payante.</p>}
        <div className={styles.actions}>
          {monitoring.status !== "active" && <button type="button" data-primary disabled={blocked || alarm !== "installed" || cashCents < monitoringCharge}
            onClick={() => confirm({ action: "subscribe" }, monitoring.status === "none" ? "Activation de la télésurveillance" : "Reprise de la télésurveillance", monitoringCharge)}>
            {monitoring.status === "none" ? "Activer" : "Reprendre"} · {formatKqCash(monitoringCharge)}
          </button>}
          {monitoring.status === "active" && <button type="button" disabled={blocked} onClick={() => void submit({ command: { action: "pause" }, label: "Télésurveillance suspendue", expectedChargeCents: 0 })}>Suspendre</button>}
          {(monitoring.status === "active" || monitoring.status === "suspended") && <button type="button" disabled={blocked}
            onClick={() => confirm({ action: "cancel" }, "Résiliation de la télésurveillance", 0)}>Résilier</button>}
        </div>
        {alarm === "installed" && monitoring.status !== "active" && cashCents < monitoringCharge && <p>Trésorerie insuffisante pour démarrer un mois de jeu.</p>}
        <details><summary>Échéances et suspension</summary><p>Un mois de jeu dure cinq jours réels. Si le solde est insuffisant à l’échéance, l’abonnement se suspend. La sirène continue de fonctionner.</p></details>
      </section>
    </div>
    <details><summary>Effet lors d’un vol</summary><p>La caméra réduit la perte de moitié sur la surface filmée. Les cloisons et la centrale d’irrigation bloquent son champ. Les réductions de la caméra, de la sirène et de la télésurveillance s’additionnent. Le résultat est arrondi au point de pourcentage.</p></details>
    </>}
  </div>;
}
