"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleAlert, Factory, Fan, Grid2X2, LoaderCircle, Package, Plus, RefreshCw, Ruler, Save, ShoppingBag, Sprout, Trash2, Warehouse, X, Zap } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { AppDialog } from "@/components/ui/AppDialog";
import { navigateWithDraftGuard, registerNavigationGuard } from "@/lib/navigation-guard";
import { navigateAfterOverlays } from "@/lib/overlay-history";
import { readWarehouseDraft, writeWarehouseDraft, warehouseDraftStorage, type WarehouseDraft } from "@/lib/warehouse-draft";
import { formatKqCash, isKqProcessingEquipment } from "@/lib/kanab-quest-equipment";
import { createClientRequestKey } from "@/lib/client-request-key";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { getKqStorageRefreshDelay, KQ_STORAGE_REFRESH_MS } from "@/lib/kanab-quest-storage-refresh";
import { KQ_WAREHOUSE_CATALOG, getKqWarehouseDevice, type KqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { KQ_WAREHOUSE_OPTIONS, KQ_WAREHOUSE_OPTION_FAMILIES, getKqWarehouseOption } from "@/lib/kanab-quest-warehouse-options";
import { getKqWarehouseDimensions, getKqWarehouseQuote, getKqWarehouseStorageClimateQuote, getKqWarehouseSummary, getKqWarehouseZoneQuote, getKqWarehouseServiceZoneQuote, isKqWarehouseState, validateKqWarehouseState, type KqWarehouseState, type KqWarehouseZone, type KqWarehouseServiceZone } from "@/lib/kanab-quest-warehouse";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import type { KqStorageClimateBilling } from "@/lib/kanab-quest-business";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqCommerceComputer, KqCommerceDesk } from "./KqCommerceDesk";
import { KqWarehouseHarvests } from "./KqWarehouseHarvests";
import { KqWarehouseEntry } from "./KqWarehouseEntry";
import { KqWarehousePlan } from "./KqWarehousePlan";
import { KqWarehousePostHarvest } from "./KqWarehousePostHarvest";
import { KqEquipmentCatalogModal } from "./KqEquipmentCatalogModal";
import { KqWarehouseShop } from "./KqWarehouseShop";
import { KqWarehouseCulture, warehouseCultureHref, warehouseCampaignHref, warehouseCultureStage, type KqWarehouseCultureSummary, type KqWarehouseBuddies } from "./KqWarehouseCulture";
import { KqWarehouseDashboard } from "./KqWarehouseDashboard";
import { KqWarehouseBuddieDock } from "./KqWarehouseBuddieDock";
import { getKqBuddieRotationRemaining } from "@/lib/kanab-quest-buddie-rotation";
import styles from "./KqWarehouse.module.css";

type Room = "culture" | "drying" | "processing" | "storage";
export type KqWarehouseViewSnapshot = {
  state: KqWarehouseState;
  revision: number;
  cashCents: number;
  activeRun: boolean;
  activeRuns?: KqWarehouseCultureSummary[];
  completedRuns?: Array<{ runId: string; zoneId: string; buddieCode: string; flowerId?: string | null }>;
  legacyActiveRun?: boolean;
  migrationCreditCents?: number;
  stockGrams: number | null;
  storageReservedGrams?: number | null;
  reservedHarvestGrams?: number;
  storageCapacityGrams?: number | null;
  storageClimateBilling?: KqStorageClimateBilling;
  salesGramsPerDay: number | null;
  context?: { available: boolean };
};
type Point = { x: number; y: number };
type ZoneKind = "culture" | "drying" | "storage";
type PlanZone = KqWarehouseZone | KqWarehouseServiceZone;
const ZONE_LABELS: Record<ZoneKind, string> = { culture: "Culture", drying: "Séchage", storage: "Stockage" };
const ROOMS = [
  { code: "culture", label: "Plan", icon: Sprout },
  { code: "drying", label: "Séchage", icon: Fan },
  { code: "storage", label: "Stockage", icon: Package },
  { code: "processing", label: "Atelier", icon: Factory },
] as const;
const mass = (grams: number) => grams >= 1_000 ? `${(grams / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg` : `${grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const decimal = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function KqWarehouse({ embedded = false, draftOwnerId, initialSection = "equipment", initialEquipmentCode, initialZoneId, initialShopOpen = false, draftStore, onOpenCulture, onClose }: {
  embedded?: boolean; draftOwnerId?: string; initialSection?: "equipment" | "storage"; initialEquipmentCode?: string | null; initialZoneId?: string | null; initialShopOpen?: boolean; onClose: () => void;
  draftStore?: { read: (revision: number) => KqWarehouseState | null; write: (state: KqWarehouseState) => void };
  onOpenCulture?: (href: string) => void;
}) {
  const api = useKqTutorialApi();
  const router = useRouter();
  const id = useId().replaceAll(":", "");
  const initialWorkshopShop = initialEquipmentCode === "COMPUTER" || isKqProcessingEquipment(initialEquipmentCode ?? "");
  const initialDevice = getKqWarehouseDevice(initialEquipmentCode ?? "") ?? KQ_WAREHOUSE_CATALOG.find(item => item.legacyCode === initialEquipmentCode);
  const [room, setRoom] = useState<Room>(initialSection === "storage" ? "storage" : initialWorkshopShop ? "processing" : initialDevice?.kind === "drying" ? "drying" : initialDevice?.room ?? "culture");
  const [snapshot, setSnapshot] = useState<KqWarehouseViewSnapshot | null>(null);
  const [draft, setDraft] = useState<KqWarehouseState | null>(null);
  const [staleDraft, setStaleDraft] = useState<WarehouseDraft | null>(null);
  const [draftStored, setDraftStored] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const owner = !api.isTutorial ? draftOwnerId : undefined;
  const loadedOwner = useRef(owner);
  const [storage, setStorage] = useState<KqStorageSnapshot | null>(null);
  const [storageError, setStorageError] = useState("");
  const [stockRefresh, setStockRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(initialZoneId ?? null);
  const [managing, setManaging] = useState(true);
  const [zoneDialogId, setZoneDialogId] = useState<string | null>(null);
  const [buddies, setBuddies] = useState<KqWarehouseBuddies | null>(null);
  const [pickedBuddie, setPickedBuddie] = useState<string | null>(null);
  const [buddiesOpen, setBuddiesOpen] = useState(false);
  const [buddieDrop, setBuddieDrop] = useState<{ zoneId: string | null; allowed: boolean } | null>(null);
  const pickedBuddieRef = useRef<string | null>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [drawingKind, setDrawingKind] = useState<ZoneKind>("culture");
  const [drawingDeviceCode, setDrawingDeviceCode] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point>({ x: 2, y: 2 });
  const [zoom, setZoom] = useState(100);
  const [showOperations, setShowOperations] = useState(false);
  const [workshopShop, setWorkshopShop] = useState(initialShopOpen && initialWorkshopShop);
  const [shopOpen, setShopOpen] = useState(initialShopOpen && !initialWorkshopShop);
  const [workshopEquipmentCode, setWorkshopEquipmentCode] = useState<string | undefined>(initialEquipmentCode ?? undefined);
  const [workshopBusy, setWorkshopBusy] = useState(false);
  const [processingFlowerId, setProcessingFlowerId] = useState<string | undefined>();
  const mutation = useRef(false);
  const readVersion = useRef(0);
  const storageVersion = useRef(0);
  const currentStorage = useRef<{ value: KqStorageSnapshot; receivedAt: number } | null>(null);
  const storagePolling = useRef<ReturnType<typeof startArenaVisiblePolling> | null>(null);
  const storageLoadFailed = useRef(false);
  const mounted = useRef(true);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const inspector = useRef<HTMLDivElement>(null);
  useBodyScrollLock(!embedded);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (mutation.current) return;
    const version = ++readVersion.current;
    setLoading(true);
    try {
      const response = await api.request("/api/arena/placard/warehouse", { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "L’entrepôt est momentanément indisponible.");
      if (!body || !isKqWarehouseState(body.state) || !Number.isSafeInteger(body.revision) || !Number.isSafeInteger(body.cashCents)) throw new Error("Les informations de l’entrepôt sont incomplètes.");
      if (!signal?.aborted && version === readVersion.current && mounted.current) {
        let saved: WarehouseDraft | null = null;
        if (owner) saved = readWarehouseDraft(warehouseDraftStorage(), owner);
        const restored = draftStore?.read(body.revision) ?? (saved && saved.revision === body.revision ? saved.state : body.state);
        setStaleDraft(saved && saved.revision !== body.revision ? saved : null);
        if (saved?.revision === body.revision) setNotice("Ton brouillon a été restauré. Enregistre pour appliquer les modifications.");
        loadedOwner.current = owner;
        setSnapshot(body); setDraft(restored); setSelectedId(current => [...restored.zones, ...(restored.serviceZones ?? [])].some((zone: PlanZone) => zone.id === current) ? current : restored.zones[0]?.id ?? restored.serviceZones?.[0]?.id ?? null); setError("");
      }
    } catch (reason) {
      if (!signal?.aborted && version === readVersion.current && mounted.current) setError(reason instanceof Error ? reason.message : "Lecture impossible.");
    } finally { if (!signal?.aborted && version === readVersion.current && mounted.current) setLoading(false); }
  }, [api, owner, draftStore]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void load(controller.signal);
    return () => { mounted.current = false; controller.abort(); readVersion.current += 1; };
  }, [load]);
  useEffect(() => {
    if (embedded) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [embedded]);
  const acceptStorage = useCallback((value: KqStorageSnapshot) => {
    currentStorage.current = { value, receivedAt: Date.now() };
    storageLoadFailed.current = false;
    setStorage(value); setStorageError("");
  }, []);
  useEffect(() => {
    if (room !== "storage") return;
    const controller = new AbortController();
    const stop = startArenaVisiblePolling(async () => {
      if (mutation.current || controller.signal.aborted) return;
      const version = ++storageVersion.current;
      try {
        const response = await api.request("/api/arena/placard/storage", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Les récoltes sont momentanément indisponibles.");
        if (!Array.isArray(body.lots) || !Number.isFinite(Date.parse(body.serverNow))) throw new Error("Les informations de conservation sont incomplètes.");
        if (!controller.signal.aborted && version === storageVersion.current && mounted.current && !mutation.current) acceptStorage(body);
      } catch (reason) {
        if (!controller.signal.aborted && version === storageVersion.current && mounted.current && !mutation.current) {
          storageLoadFailed.current = true;
          setStorageError(reason instanceof Error ? reason.message : "Lecture des récoltes impossible.");
        }
      }
    }, () => {
      if (storageLoadFailed.current || mutation.current) return KQ_STORAGE_REFRESH_MS;
      const current = currentStorage.current;
      return getKqStorageRefreshDelay(current?.value ?? null, current ? Date.now() - current.receivedAt : 0);
    });
    storagePolling.current = stop;
    return () => { stop(); controller.abort(); storageVersion.current += 1; storagePolling.current = null; };
  }, [api, room, snapshot?.revision, stockRefresh, acceptStorage]);

  const issues = draft ? validateKqWarehouseState(draft) : [];
  const quote = useMemo(() => {
    if (!draft || !snapshot || validateKqWarehouseState(draft).length) return null;
    return getKqWarehouseQuote(draft, snapshot.state);
  }, [draft, snapshot]);
  const summary = useMemo(() => quote ? getKqWarehouseSummary(quote.nextState) : snapshot ? getKqWarehouseSummary(snapshot.state) : null, [quote, snapshot]);
  const planZones = draft ? [...draft.zones, ...(draft.serviceZones ?? [])] : [];
  const dimensions = getKqWarehouseDimensions(draft ?? snapshot?.state);
  const selected = planZones.find(zone => zone.id === selectedId);
  const selectedKind: ZoneKind = selected && "kind" in selected ? selected.kind : "culture";
  const zoneQuote = selected && !issues.length ? "kind" in selected ? getKqWarehouseServiceZoneQuote(selected) : getKqWarehouseZoneQuote(selected) : null;
  const dirty = !!draft && !!snapshot && JSON.stringify(draft) !== JSON.stringify(snapshot.state);
  useEffect(() => { if (draft && snapshot) draftStore?.write(draft); }, [draft, snapshot, draftStore]);
  useEffect(() => {
    if (!owner || owner !== loadedOwner.current || !snapshot || !draft || staleDraft) return;
    let stored = false;
    stored = writeWarehouseDraft(warehouseDraftStorage(), owner, dirty ? { revision: snapshot.revision, state: draft } : null);
    const frame = requestAnimationFrame(() => setDraftStored(stored && dirty));
    return () => cancelAnimationFrame(frame);
  }, [owner, snapshot, draft, dirty, staleDraft]);
  useEffect(() => {
    if (!dirty || api.isTutorial) return;
    const unregister = registerNavigationGuard(action => setPendingLeave(() => action));
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const interceptLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.getAttribute("href")?.startsWith("#")) return;
      const target = new URL(link.href, window.location.href);
      if (!/^https?:$/.test(target.protocol) || target.href === window.location.href) return;
      event.preventDefault(); event.stopPropagation();
      setPendingLeave(() => () => target.origin === window.location.origin ? router.push(`${target.pathname}${target.search}${target.hash}`) : window.location.assign(target.href));
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", interceptLink, true);
    return () => { unregister(); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", interceptLink, true); };
  }, [dirty, api.isTutorial, router]);
  const zoneCultures = Array.isArray(snapshot?.activeRuns);
  const editing = managing || !zoneCultures;
  const showBuddieDock = zoneCultures && room === "culture" && !editing && !shopOpen;
  const activeRuns = snapshot?.activeRuns ?? [];
  const activeCampaign = activeRuns.find(run => run.campaignId);
  const campaignZones = draft?.zones.filter(zone => zone.active && zone.buddieCode) ?? [];
  const campaignReady = !!campaignZones.length && !!buddies && !activeRuns.length
    && new Set(campaignZones.map(zone => zone.buddieCode)).size === campaignZones.length
    && campaignZones.every(zone => buddies.ownedBuddieCodes.includes(zone.buddieCode!)
      && !getKqBuddieRotationRemaining(zone.buddieCode!, buddies.buddieRotation?.recentBuddieCodes ?? []));
  const occupiedZoneIds = activeRuns.flatMap(run => run.zoneId ? [run.zoneId] : []);
  const selectedRun = activeRuns.find(run => run.zoneId === selectedId);
  const locked = pending || loading || workshopBusy || (!zoneCultures && !!snapshot?.activeRun) || !!snapshot?.legacyActiveRun;
  const selectedLocked = locked || !!selectedRun;
  const creditUsed = Math.min(snapshot?.migrationCreditCents ?? 0, quote?.totalCostCents ?? 0);
  const payable = Math.max(0, (quote?.totalCostCents ?? 0) - creditUsed);
  const affordable = !!snapshot && payable <= snapshot.cashCents;
  useEffect(() => {
    if (!zoneCultures) return;
    const controller = new AbortController();
    void api.request("/api/arena/placard/collection", { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.ownedBuddieCodes)) throw new Error("Tes Buddies sont momentanément indisponibles.");
      if (!controller.signal.aborted) setBuddies(body);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Lecture des Buddies impossible."); });
    return () => controller.abort();
  }, [api, zoneCultures, snapshot]);
  useEffect(() => api.subscribe(["kq:equipment-updated", "kq:storage-updated", "kq:collection-updated"], () => {
    if (dirty || mutation.current) return;
    setStockRefresh(value => value + 1);
    void load();
  }), [api, dirty, load]);
  const save = async () => {
    if (!snapshot || !draft || !quote || !dirty || locked || !affordable || adoptionBlocked || mutation.current) return false;
    mutation.current = true; readVersion.current += 1; storageVersion.current += 1; setPending(true); setError(""); setNotice("");
    const body = { expectedRevision: snapshot.revision, state: draft, expectedCostCents: quote.totalCostCents };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: createClientRequestKey() };
    try {
      const response = await api.request("/api/arena/placard/warehouse", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, requestKey: request.current.key }), signal: AbortSignal.timeout(20_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cet aménagement n’a pas pu être enregistré.");
      if (!isKqWarehouseState(result.state) || !Number.isSafeInteger(result.revision) || !Number.isSafeInteger(result.cashCents)) throw new Error("Le reçu est incomplet. Actualise avant de réessayer.");
      if (mounted.current) {
        setSnapshot(result); setDraft(result.state); setDrawing(false); setAnchor(null);
        setNotice(quote.totalCostCents > 0 ? `Aménagement installé. ${formatKqCash(payable)} prélevés${creditUsed ? ` et ${formatKqCash(creditUsed)} de crédit de reprise utilisés` : ""}.` : "Plan enregistré. Le matériel retiré reste disponible en réserve.");
      }
      request.current = null;
      api.notify("kq:equipment-updated"); api.notify("kq:storage-updated");
      if (owner && mounted.current) writeWarehouseDraft(warehouseDraftStorage(), owner, null);
      return true;
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Enregistrement impossible."); return false; }
    finally { mutation.current = false; if (mounted.current) setPending(false); storagePolling.current?.reschedule(); }
  };

  const sellOverflow = async (flowerId: string) => {
    if (pending || loading || dirty || mutation.current) return;
    mutation.current = true; storageVersion.current += 1; readVersion.current += 1;
    setPending(true); setError(""); setNotice("");
    const body = { action: "sell-overflow", flowerId };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: createClientRequestKey() };
    let sold = false;
    try {
      const response = await api.request("/api/arena/placard/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, requestKey: request.current.key }), signal: AbortSignal.timeout(20_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "La reprise du surplus est indisponible.");
      if (!Array.isArray(result.lots)) throw new Error("Le reçu est incomplet. Actualise le stockage.");
      if (mounted.current) { acceptStorage(result); setNotice("Surplus vendu au grossiste. Le reste du lot est conservé."); }
      request.current = null; sold = true;
      api.notify("kq:storage-updated"); api.notify("kq:equipment-updated");
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Vente impossible."); }
    finally { mutation.current = false; if (mounted.current) setPending(false); storagePolling.current?.reschedule(); }
    if (sold && mounted.current) await load();
  };

  function updateZone(patch: Partial<KqWarehouseZone & KqWarehouseServiceZone>) {
    if (!selected || selectedLocked) return;
    setDraft(current => current ? "kind" in selected
      ? { ...current, serviceZones: (current.serviceZones ?? []).map(zone => zone.id === selected.id ? { ...zone, ...patch } : zone) }
      : { ...current, zones: current.zones.map(zone => zone.id === selected.id ? { ...zone, ...patch } : zone) } : current);
    setNotice("");
  }
  function transformZone(zoneId: string, patch: { x: number; y: number; width: number; height: number }) {
    if (!draft || locked || occupiedZoneIds.includes(zoneId) || !planZones.some(zone => zone.id === zoneId)) return;
    const next = {
      ...draft,
      zones: draft.zones.map(zone => zone.id === zoneId ? { ...zone, ...patch } : zone),
      ...(draft.serviceZones === undefined ? {} : { serviceZones: draft.serviceZones.map(zone => zone.id === zoneId ? { ...zone, ...patch } : zone) }),
    };
    const validation = validateKqWarehouseState(next);
    if (validation.length) { setError(validation[0]); return; }
    setDraft(next); setSelectedId(zoneId); setError(""); setNotice("");
  }
  function selectPoint(point: Point) {
    setCursor(point);
    if (!draft) return;
    if (!drawing || pickedBuddieRef.current) {
      const zone = planZones.find(zone => point.x >= zone.x && point.x < zone.x + zone.width && point.y >= zone.y && point.y < zone.y + zone.height);
      selectZone(zone);
      return;
    }
    if (locked) return;
    if (!anchor) { setAnchor(point); return; }
    drawZone(anchor, point);
  }
  function drawZone(start: Point, end: Point): boolean {
    if (!draft || locked || !drawing || pickedBuddieRef.current) return false;
    setCursor(end);
    const rectangle = { id: createClientRequestKey(), name: `${ZONE_LABELS[drawingKind]} ${planZones.length + 1}`, x: Math.min(end.x, start.x), y: Math.min(end.y, start.y), width: Math.abs(end.x - start.x) + 1, height: Math.abs(end.y - start.y) + 1 };
    const zone: PlanZone = drawingKind === "culture" ? { ...rectangle, active: true,
      lightingCode: KQ_WAREHOUSE_CATALOG.find(item => item.kind === "lighting")!.code,
      airCode: KQ_WAREHOUSE_CATALOG.find(item => item.kind === "air")!.code,
    } : { ...rectangle, kind: drawingKind, deviceCode: KQ_WAREHOUSE_CATALOG.find(item => item.kind === drawingKind && item.code === drawingDeviceCode)?.code ?? KQ_WAREHOUSE_CATALOG.find(item => item.kind === drawingKind)!.code };
    const next = "kind" in zone ? { ...draft, serviceZones: [...(draft.serviceZones ?? []), zone] } : { ...draft, zones: [...draft.zones, zone] };
    const validation = validateKqWarehouseState(next);
    if (validation.length) { setError(validation[0]); setAnchor(null); return false; }
    setDraft(next); setSelectedId(zone.id); setAnchor(null); setDrawing(false); setError(""); setNotice("");
    return true;
  }
  function showDrawingPlan() {
    requestAnimationFrame(() => {
      workspace.current?.querySelector("[data-warehouse-map-viewport]")?.scrollIntoView({ block: "center", behavior: "instant" });
      workspace.current?.querySelector<SVGSVGElement>("[data-warehouse-map]")?.focus({ preventScroll: true });
    });
  }
  function toggleDrawing() {
    if (locked && !drawing) return;
    setManaging(true); setDrawing(value => !value); setAnchor(null); setError("");
    if (!drawing) showDrawingPlan();
  }
  function startDrawingKind(kind: ZoneKind) {
    if (!draft || locked) return;
    setManaging(true);
    setDrawingDeviceCode(current => kind === drawingKind ? current : null);
    setDrawingKind(kind); setDrawing(true); setAnchor(null); setError(""); setNotice("");
    if (!drawing) showDrawingPlan();
  }
  function mapKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    const shift = event.shiftKey ? 5 : 1;
    const moves: Record<string, Point> = { ArrowLeft: { x: -shift, y: 0 }, ArrowRight: { x: shift, y: 0 }, ArrowUp: { x: 0, y: -shift }, ArrowDown: { x: 0, y: shift } };
    if (moves[event.key]) { event.preventDefault(); const delta = moves[event.key]; setCursor(p => ({ x: Math.max(0, Math.min(dimensions.columns - 1, p.x + delta.x)), y: Math.max(0, Math.min(dimensions.rows - 1, p.y + delta.y)) })); }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPoint(cursor); }
    if (event.key === "Escape") { event.preventDefault(); setDrawing(false); setAnchor(null); pickBuddie(null); }
  }
  function placeDevice(device: KqWarehouseDevice) {
    if (!draft || locked) return;
    if (device.kind !== "drying" && device.kind !== "storage") return;
    setManaging(true); setDrawingDeviceCode(device.code); setDrawingKind(device.kind); setDrawing(true); setAnchor(null); setRoom("culture"); setError(""); setNotice("");
    showDrawingPlan();
  }
  function configureZone(zoneId: string) {
    if (!editing || locked || pickedBuddieRef.current || occupiedZoneIds.includes(zoneId) || !planZones.some(zone => zone.id === zoneId)) return;
    setSelectedId(zoneId); setDrawing(false); setAnchor(null); setError(""); setZoneDialogId(zoneId);
  }
  function editServiceZone(zoneId: string) {
    if (locked || !draft?.serviceZones?.some(zone => zone.id === zoneId)) return;
    setManaging(true); setRoom("culture"); setSelectedId(zoneId); setDrawing(false); setAnchor(null); setError(""); setZoneDialogId(zoneId);
  }
  function upgradeServiceZone(zoneId: string, deviceCode: string) {
    const zone = draft?.serviceZones?.find(item => item.id === zoneId);
    const device = getKqWarehouseDevice(deviceCode);
    if (locked || !zone || !device?.zoneLayout || device.kind !== zone.kind) return;
    setDraft(current => current ? { ...current, serviceZones: current.serviceZones?.map(item => item.id === zoneId ? { ...item, deviceCode } : item) } : current);
    setError(""); setNotice("Amélioration ajoutée au devis. Installe-la pour l’appliquer.");
  }
  function setStorageClimate(code: string | null) {
    if (locked || code && (getKqWarehouseDevice(code)?.kind !== "climate" || getKqWarehouseDevice(code)?.room !== "storage")) return;
    setDraft(current => {
      if (!current) return current;
      const next = { ...current };
      if (code) next.storageClimateCode = code;
      else delete next.storageClimateCode;
      return next;
    });
    setError(""); setNotice("Climatisation ajoutée au devis. Enregistre pour l’appliquer à la conservation.");
  }
  async function confirmZone() {
    const zoneId = zoneDialogId;
    if (!zoneId || selectedLocked) return;
    if (!dirty || await save()) setZoneDialogId(current => current === zoneId ? null : current);
  }
  function removeSelectedZone() {
    if (!draft || !selected || selectedLocked) return;
    const next = "kind" in selected ? { ...draft, serviceZones: (draft.serviceZones ?? []).filter(zone => zone.id !== selected.id) } : { ...draft, zones: draft.zones.filter(zone => zone.id !== selected.id) };
    if ("kind" in selected && !next.serviceZones?.some(zone => zone.kind === "storage")) delete next.storageClimateCode;
    setDraft(next);
    setDrawingKind("kind" in selected ? selected.kind : "culture");
    setDrawingDeviceCode("kind" in selected ? selected.deviceCode : null);
    setDrawing(false); setAnchor(null); setError(""); setNotice("");
    setSelectedId(null); setZoneDialogId(null);
  }
  function selectZone(zone?: PlanZone) {
    if (pickedBuddieRef.current) {
      assignBuddie(pickedBuddieRef.current, zone);
      return;
    }
    setSelectedId(zone?.id ?? null);
    if (!zone || "kind" in zone || editing || dirty || locked) return;
    const run = activeRuns.find(item => item.zoneId === zone.id);
    const buddieAvailable = zone.buddieCode && buddies?.ownedBuddieCodes.includes(zone.buddieCode)
      && !activeRuns.some(item => item.buddieCode === zone.buddieCode)
      && !buddies.buddieRotation?.recentBuddieCodes.includes(zone.buddieCode);
    if (run) (onOpenCulture ?? router.push)(warehouseCultureHref(zone.id, run.leaderRunId ?? run.runId));
    else if (zone.active && buddieAvailable && !activeRuns.length) (onOpenCulture ?? router.push)(warehouseCampaignHref());
    else requestAnimationFrame(() => { if (window.matchMedia("(max-width: 1000px)").matches) inspector.current?.scrollIntoView({ block: "start", behavior: "smooth" }); });
  }
  function pickBuddie(code: string | null) {
    if (code && (!showBuddieDock || !buddiesOpen)) return;
    pickedBuddieRef.current = code;
    setPickedBuddie(code);
    if (code) { setDrawing(false); setAnchor(null); }
    else setBuddieDrop(null);
  }
  function placementError(code: string, zone?: PlanZone): string {
    if (!showBuddieDock || !buddiesOpen || locked || mutation.current) return "Placement momentanément indisponible.";
    if (!buddies?.ownedBuddieCodes.includes(code)) return "Ce Buddie ne figure pas dans ta collection.";
    if (activeRuns.some(run => run.buddieCode === code)) return "Ce Buddie est déjà en culture.";
    if (getKqBuddieRotationRemaining(code, buddies.buddieRotation?.recentBuddieCodes ?? [])) return "Ce Buddie est encore en rotation.";
    if (!zone || "kind" in zone) return "Dépose la carte dans une zone de culture.";
    if (occupiedZoneIds.includes(zone.id)) return "Cette zone est déjà en culture.";
    return "";
  }
  function assignBuddie(code: string, zone?: PlanZone) {
    const problem = placementError(code, zone);
    if (problem) { setNotice(problem); return; }
    const target = zone as KqWarehouseZone;
    setDraft(current => current ? { ...current, zones: current.zones.map(item => {
      if (item.id === target.id) return { ...item, buddieCode: code };
      if (item.buddieCode !== code) return item;
      const freed = { ...item };
      delete freed.buddieCode;
      return freed;
    }) } : current);
    setSelectedId(target.id); setError(""); setNotice(`Buddie affecté à ${target.name}. Enregistre pour valider.`);
    pickBuddie(null);
  }
  function zoneAtPointer(point: Point): PlanZone | undefined {
    const map = workspace.current?.querySelector<SVGSVGElement>("[data-warehouse-map]");
    const hit = document.elementFromPoint(point.x, point.y);
    if (!map || !hit || !map.contains(hit)) return undefined;
    const matrix = map.getScreenCTM();
    if (!matrix) return undefined;
    const local = new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse());
    const x = (local.x - Number(map.dataset.gridOriginX)) / Number(map.dataset.gridCellSize);
    const y = (local.y - Number(map.dataset.gridOriginY)) / Number(map.dataset.gridCellSize);
    return planZones.find(zone => x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height);
  }
  function dragBuddie(point: Point | null) {
    if (!point) { setBuddieDrop(null); return; }
    const zone = zoneAtPointer(point);
    const next = { zoneId: zone?.id ?? null, allowed: !!pickedBuddieRef.current && !placementError(pickedBuddieRef.current, zone) };
    setBuddieDrop(current => current?.zoneId === next.zoneId && current?.allowed === next.allowed ? current : next);
  }
  function dropBuddie(code: string, point: Point) {
    assignBuddie(code, zoneAtPointer(point));
  }
  function resetDraft() { if (snapshot) setDraft(snapshot.state); setStaleDraft(null); setDrawing(false); setAnchor(null); setError(""); }
  function continueLeaving() {
    if (!pendingLeave) return;
    const action = pendingLeave;
    navigateAfterOverlays(() => { setPendingLeave(null); action(); });
  }
  function changeRoom(nextRoom: Room) {
    setBuddiesOpen(false);
    if (nextRoom === "culture") setManaging(true);
    setRoom(nextRoom);
  }
  function keyTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (workshopBusy) return;
    const next = event.key === "ArrowRight" ? (index + 1) % ROOMS.length : event.key === "ArrowLeft" ? (index + ROOMS.length - 1) % ROOMS.length : event.key === "Home" ? 0 : event.key === "End" ? ROOMS.length - 1 : null;
    if (next !== null) { event.preventDefault(); changeRoom(ROOMS[next].code); tabs.current[next]?.focus(); }
  }

  const openWorkshopShop = (code?: string) => { setWorkshopEquipmentCode(code); setWorkshopShop(true); };
  const demand = snapshot?.salesGramsPerDay;
  const stock = snapshot?.stockGrams;
  const storageReserved = snapshot?.storageReservedGrams ?? stock;
  const reservedHarvest = snapshot?.reservedHarvestGrams ?? 0;
  const savedStorageCapacity = snapshot ? getKqWarehouseSummary(snapshot.state).storageCapacityGrams : 0;
  const savedActualStorageCapacity = snapshot?.storageCapacityGrams ?? savedStorageCapacity;
  const storageCapacity = summary ? draft?.serviceZones !== undefined ? summary.storageCapacityGrams : savedActualStorageCapacity + summary.storageCapacityGrams - savedStorageCapacity : 0;
  const adoptingServicePlan = !!snapshot && snapshot.state.serviceZones === undefined && draft?.serviceZones !== undefined;
  const storageMaterials = (state?: KqWarehouseState | null) => [...new Set(state?.serviceZones?.filter(zone => zone.kind === "storage").map(zone => zone.deviceCode))].sort().join("|");
  const reallocatingStorage = adoptingServicePlan || storageMaterials(draft) !== storageMaterials(snapshot?.state);
  const requiredStorage = reallocatingStorage ? stock : storageReserved;
  const adoptionBlocked = typeof requiredStorage === "number" && Math.max(0, requiredStorage - storageCapacity) > Math.max(0, requiredStorage - savedActualStorageCapacity);
  const selectedCapacity = zoneQuote ? "capacityGrams" in zoneQuote ? zoneQuote.capacityGrams : zoneQuote.estimatedHarvestGrams : 0;
  const selectedCapacityPerM2 = zoneQuote ? "capacityGramsPerM2" in zoneQuote ? zoneQuote.capacityGramsPerM2 : selectedCapacity / zoneQuote.areaM2 : 0;
  const dryShort = !!summary && summary.estimatedHarvestGrams > summary.dryingCapacityGrams;
  const storeShort = !!summary && typeof storageReserved === "number" && storageReserved + summary.estimatedHarvestGrams > storageCapacity;
  const investment = quote?.totalCostCents ?? 0;
  const draftClimateCost = draft ? getKqWarehouseStorageClimateQuote(draft).monthlyCents : 0;
  const installedClimateCost = snapshot ? getKqWarehouseStorageClimateQuote(snapshot.state).monthlyCents : 0;

  const zoneDialogOpen = !!zoneDialogId && zoneDialogId === selectedId && !!selected && room === "culture" && editing;
  const zoneDialogError = error || issues[0] || (!affordable && snapshot ? `Il manque ${formatKqCash(payable - snapshot.cashCents)} pour cet aménagement.` : "") || (adoptionBlocked ? "Stockage insuffisant pour tes lots. Agrandis la zone ou change de gamme." : "");
  const zoneEditor = selected && draft && snapshot ? <>
    <div className={styles.zoneDialogSummary}><strong>{selected.name}</strong><span>{ZONE_LABELS[selectedKind]} · {selected.width * selected.height} m²</span></div>
    <div className={styles.inspectorBody} data-warehouse-zone-kind={selectedKind}>
                  <details className={styles.zoneSettings} data-warehouse-zone-settings key={selected.id}><summary>Ajuster la zone</summary><div>
                  <label className={styles.field}>Nom de la zone<input value={selected.name} maxLength={80} disabled={selectedLocked} onChange={event => updateZone({ name: event.target.value })} /></label>
                  <div className={styles.dimensions}><label className={styles.field}>Largeur (m)<input type="number" min="1" max={dimensions.columns - selected.x} step="1" value={selected.width} disabled={selectedLocked} onChange={event => updateZone({ width: Number(event.target.value) })} /></label><label className={styles.field}>Profondeur (m)<input type="number" min="1" max={dimensions.rows - selected.y} step="1" value={selected.height} disabled={selectedLocked} onChange={event => updateZone({ height: Number(event.target.value) })} /></label></div>
                  <div className={styles.dimensions}><label className={styles.field}>Position X (m)<input type="number" min="0" max={dimensions.columns - selected.width} step="1" value={selected.x} disabled={selectedLocked} onChange={event => updateZone({ x: Number(event.target.value) })} /></label><label className={styles.field}>Position Y (m)<input type="number" min="0" max={dimensions.rows - selected.height} step="1" value={selected.y} disabled={selectedLocked} onChange={event => updateZone({ y: Number(event.target.value) })} /></label></div>
                  </div></details>
                  {"kind" in selected ? <label className={styles.field}>Matériel de {selected.kind === "drying" ? "séchage" : "stockage"}<select value={selected.deviceCode} disabled={selectedLocked} onChange={event => updateZone({ deviceCode: event.target.value })}>{KQ_WAREHOUSE_CATALOG.filter(item => item.kind === selected.kind && item.zoneLayout).map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label> : <>
                    <label className={styles.field}>Éclairage<select value={selected.lightingCode} disabled={selectedLocked} onChange={event => updateZone({ lightingCode: event.target.value })}>{KQ_WAREHOUSE_CATALOG.filter(item => item.kind === "lighting" && (item.purchasable !== false || item.code === selected.lightingCode)).map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
                    <label className={styles.field}>Extraction<select value={selected.airCode} disabled={selectedLocked} onChange={event => updateZone({ airCode: event.target.value })}>{KQ_WAREHOUSE_CATALOG.filter(item => item.kind === "air").map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
                    <details className={styles.zoneModules} data-warehouse-zone-modules><summary>Options supplémentaires · {selected.optionCodes?.length ?? 0}</summary><div className={styles.zoneOptionFields}>
                      {KQ_WAREHOUSE_OPTION_FAMILIES.map(family => <label key={family.code} className={styles.field}>{family.label}<select data-warehouse-zone-option={family.code} value={selected.optionCodes?.find(code => getKqWarehouseOption(code)?.family === family.code) ?? ""} disabled={selectedLocked} onChange={event => {
                        const kept = (selected.optionCodes ?? []).filter(code => getKqWarehouseOption(code)?.family !== family.code);
                        updateZone({ optionCodes: event.target.value ? [...kept, event.target.value] : kept });
                      }}><option value="">Aucune option</option>{KQ_WAREHOUSE_OPTIONS.filter(option => option.family === family.code).map(option => <option key={option.code} value={option.code}>{option.name} · {formatKqCash(option.equipmentCentsPerM2)}/m²</option>)}</select></label>)}
                    </div></details>
                    <label className={styles.check}><input type="checkbox" checked={selected.active} disabled={selectedLocked} onChange={event => updateZone({ active: event.target.checked })} />Active à la prochaine culture</label>
                  </>}
                  <div className={styles.quote} data-warehouse-zone-quote>
                    {zoneQuote && <>
                      <div className={styles.quoteLine}><span>Coût neuf / m²</span><strong>{formatKqCash(zoneQuote.costPerM2Cents)}/m²</strong></div>
                      <div className={styles.quoteLine}><span>{selectedKind === "culture" ? "Récolte estimée" : "Capacité totale"}</span><strong data-warehouse-capacity-grams={selectedCapacity}>{mass(selectedCapacity)}<small>{decimal(selectedCapacityPerM2)} g/m²</small></strong></div>
                      {"qualityBonus" in zoneQuote && <div className={styles.quoteLine}><span>Qualité au départ</span><strong data-warehouse-zone-quality={zoneQuote.qualityBonus}>+{zoneQuote.qualityBonus} pts<small>Récolte potentielle +{zoneQuote.yieldBonusPercent} %</small></strong></div>}
                      {"operatingCostCents" in zoneQuote && <div className={styles.quoteLine}><span>Charges / m² / cycle</span><strong>{formatKqCash(Math.round(zoneQuote.operatingCostCents / zoneQuote.areaM2))}</strong></div>}
                    </>}
                    <details data-warehouse-quote-details><summary>Détail du devis</summary>
                      {zoneQuote && <>
                        <div className={styles.quoteLine}><span>Surface · {ZONE_LABELS[selectedKind]}</span><strong>{zoneQuote.areaM2} m²</strong></div>
                        <div className={styles.quoteLine}><span>Coût complet de la zone</span><strong>{formatKqCash(zoneQuote.totalCostCents)}</strong></div>
                        <div className={styles.quoteLine}><span>{selectedKind === "culture" ? "Rendement estimé" : "Capacité par m²"}</span><strong>{decimal(selectedCapacityPerM2)} g/m²</strong></div>
                        {"volumeLitres" in zoneQuote && zoneQuote.volumeLitres > 0 && <div className={styles.quoteLine}><span>Volume des contenants</span><strong>{decimal(zoneQuote.volumeLitres)} L</strong></div>}
                        {"usableSurfaceM2" in zoneQuote && zoneQuote.usableSurfaceM2 > 0 && <div className={styles.quoteLine}><span>Surface utile des filets</span><strong>{decimal(zoneQuote.usableSurfaceM2)} m²</strong></div>}
                        {"operatingCostCents" in zoneQuote && <><div className={styles.quoteLine}><span>Charges / culture</span><strong>{formatKqCash(zoneQuote.operatingCostCents)}</strong></div><div className={styles.quoteLine}><span>Dont fournitures / m²</span><strong>{formatKqCash(Math.round(zoneQuote.consumablesCostCents / zoneQuote.areaM2))}</strong></div></>}
                        <ul>{zoneQuote.devices.map(line => <li key={line.code}>{line.quantity} × {line.device.name} · {formatKqCash(line.device.priceCents)}/unité</li>)}{"options" in zoneQuote && zoneQuote.options.map(line => <li key={line.code}>{line.option.name} · {line.quantity} m² × {formatKqCash(line.option.equipmentCentsPerM2)}/m² · {formatKqCash(line.option.consumablesCentsPerM2)}/m²/cycle</li>)}</ul>
                      </>}
                      <div className={styles.quoteLine}><span>Nouveaux équipements</span><strong>{formatKqCash(quote?.equipmentCostCents ?? 0)}</strong></div>{!!quote?.optionEquipmentCostCents && <div className={styles.quoteLine}><span>Dont équipements au m²</span><strong>{formatKqCash(quote.optionEquipmentCostCents)}</strong></div>}<div className={styles.quoteLine}><span>Aménagement et pose</span><strong>{formatKqCash((quote?.preparationCostCents ?? 0) + (quote?.installationCostCents ?? 0))}</strong></div>
                      {creditUsed > 0 && <div className={styles.quoteLine}><span>Crédit de reprise</span><strong>− {formatKqCash(creditUsed)}</strong></div>}
                      <p>Le matériel en réserve est réutilisé avant tout achat.</p>
                    </details>
                  </div>
                  <button className={styles.danger} type="button" disabled={selectedLocked} onClick={removeSelectedZone}><Trash2 size={13} />Libérer cette zone</button>
                </div>
  </> : null;

  const purchaseActions = <div className={styles.buttons}>
    <button className={styles.secondary} type="button" disabled={pending} data-warehouse-action="reset" onClick={resetDraft}>Annuler</button>
    <button className={styles.primary} type="button" disabled={!dirty || locked || !quote || !affordable || adoptionBlocked} data-warehouse-action="save" onClick={() => void save()}>{pending ? <LoaderCircle size={15} /> : <Save size={15} />} {investment ? `Installer · ${formatKqCash(payable)}` : "Enregistrer le plan"}</button>
  </div>;

  return <div className={embedded ? undefined : styles.overlay}>
    <section className={styles.page} aria-labelledby={`${id}-title`} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} data-warehouse-v4 data-arena-tour-surface="warehouse" onKeyDown={event => {
      if (event.key === "Escape" && pickedBuddieRef.current) { event.preventDefault(); event.stopPropagation(); pickBuddie(null); return; }
      if (embedded || shopOpen || event.target instanceof Element && event.target.closest("[data-app-dialog]")) return;
      if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); navigateWithDraftGuard(onClose); }
      if (event.key !== "Tab") return;
      const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')).filter(node => node.getClientRects().length);
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
    }}>
      <header className={styles.header}>
        <div className={styles.workshopSign}><span className={styles.signMark} aria-hidden="true"><Warehouse size={25} strokeWidth={1.5} /></span><h2 id={`${id}-title`} data-arena-tour="warehouse">Entrepôt</h2></div>
        <div className={styles.headerActions}><div className={styles.cash}><small>Trésorerie</small><strong>{snapshot ? formatKqCash(snapshot.cashCents) : "—"}</strong></div><button className={styles.shopButton} type="button" data-warehouse-action="shop" data-warehouse-shop-counter disabled={!draft || loading || pending || workshopBusy} onClick={() => setShopOpen(true)}><ShoppingBag size={17} /><span>Boutique</span></button><button className={styles.iconButton} type="button" aria-label="Actualiser l’entrepôt" disabled={pending || loading || dirty || workshopBusy} onClick={() => void load()}><RefreshCw size={16} /></button>{!embedded && <button ref={close} className={styles.iconButton} type="button" onClick={() => navigateWithDraftGuard(onClose)} aria-label="Fermer l’entrepôt"><X size={18} /></button>}</div>
      </header>
      <nav className={styles.tabs} role="tablist" aria-label="L’entrepôt et ses activités">{ROOMS.map((item, index) => <button type="button" ref={node => { tabs.current[index] = node; }} key={item.code} className={styles.tab} id={`${id}-${item.code}-tab`} data-warehouse-room={item.code} aria-controls={`${id}-${item.code}-panel`} role="tab" disabled={workshopBusy} aria-selected={room === item.code} tabIndex={room === item.code ? 0 : -1} onKeyDown={event => keyTab(event, index)} onClick={() => changeRoom(item.code)}><item.icon size={17} />{item.label}</button>)}</nav>
      <div className={styles.content}>
        {error && (room !== "culture" || !snapshot || !draft) && <p className={styles.error} role="alert"><CircleAlert size={17} />{error}<button type="button" onClick={() => void load()} disabled={pending}>Recharger</button></p>}
        {notice && (room !== "culture" || !snapshot || !draft) && <p className={styles.notice} role="status"><Check size={17} />{notice}</p>}
        {dirty && room !== "culture" && <p className={styles.notice} role="status" data-warehouse-draft>{draftStored ? "Brouillon conservé dans cet onglet. Enregistre pour appliquer tes modifications." : "Modifications non enregistrées. Enregistre avant de quitter pour les conserver."}</p>}
        {staleDraft && <div className={styles.warning} role="status"><p>Un ancien brouillon est disponible, mais le plan enregistré a changé. Tu peux le reprendre et vérifier le nouveau devis avant de l’enregistrer.</p><div className={styles.buttons}><button type="button" className={styles.secondary} onClick={() => { setDraft(staleDraft.state); setStaleDraft(null); }}>Examiner le brouillon</button><button type="button" className={styles.secondary} onClick={() => setStaleDraft(null)}>Garder le plan enregistré</button></div></div>}
        {snapshot?.activeRun && !zoneCultures && <p className={styles.warning}><CircleAlert size={17} />Culture en cours : aménagement verrouillé jusqu’à la récolte.</p>}
        {snapshot?.legacyActiveRun && <p className={styles.warning}>Termine ta culture en cours pour ouvrir les cultures par zone. <Link href="/arene/placard?view=game">Reprendre</Link></p>}
        {adoptingServicePlan && <p className={styles.warning} data-warehouse-adoption>Seul le matériel affecté aux zones comptera dans la capacité. Le reste sera conservé en réserve.{adoptionBlocked && " Agrandis le stockage pour accueillir tes lots."}</p>}
        {adoptionBlocked && !adoptingServicePlan && <p className={styles.warning} data-warehouse-capacity-blocked>Stockage insuffisant pour tes lots. Agrandis la zone ou change de gamme.</p>}
        {!snapshot || !draft || !summary ? <div className={styles.loading} role="status">{loading ? <><LoaderCircle size={25} />Chargement de ton installation…</> : "L’entrepôt n’est pas disponible. Tu peux réessayer avec le bouton Actualiser."}</div> : <>
          <div className={styles.stats} aria-label="Repères de ton installation">
            <div className={styles.stat}><small><Ruler size={13} />Surface</small><strong>{summary.allocatedAreaM2} <span>m²</span><span className={styles.statTotal}> / {decimal(summary.totalAreaM2)}</span></strong><em>{dimensions.columns} × {dimensions.rows} m</em></div>
            <div className={styles.stat}><small><Package size={13} />En stock</small><strong>{typeof stock === "number" ? mass(stock) : "—"}</strong><em>{typeof storageReserved === "number" ? `${mass(Math.max(0, storageCapacity - storageReserved - reservedHarvest))} de place libre` : "Occupation en cours de lecture"}</em></div>
            <div className={styles.stat}><small><Zap size={13} />Charges / cycle</small><strong>{formatKqCash(summary.operatingCostCents)}</strong><em>{formatKqCash(summary.activeAreaM2 ? Math.round(summary.operatingCostCents / summary.activeAreaM2) : 0)}/m² actif</em></div>
            <div className={styles.stat}><small><Sprout size={13} />Récolte estimée</small><strong>{mass(summary.estimatedHarvestGrams)}</strong><em>{decimal(summary.activeAreaM2 ? summary.estimatedHarvestGrams / summary.activeAreaM2 : 0)} g/m² actif</em></div>
          </div>
          <div role="tabpanel" id={`${id}-${room}-panel`} aria-labelledby={`${id}-${room}-tab`}>
            {room === "culture" ? <div className={styles.workspace} ref={workspace} data-warehouse-cultures={zoneCultures || undefined}>
              <div className={styles.sceneColumn}>
                {zoneCultures && <div className={styles.cultureToolbar}><div role="group" aria-label="Mode du plan"><button type="button" aria-pressed={editing} disabled={pending} onClick={() => { setManaging(true); setBuddiesOpen(false); }}>Aménager</button><button type="button" aria-pressed={!editing} disabled={dirty || pending} onClick={() => { setManaging(false); setBuddiesOpen(false); setDrawing(false); setAnchor(null); }}>Cultures</button></div><span>{activeRuns.length} en cours</span></div>}
                {zoneCultures && !editing && <div className={styles.campaignLaunch} data-warehouse-campaign>
                  <span>{activeCampaign ? "Une campagne · tous tes Buddies" : activeRuns.length ? "Termine tes cultures en cours" : `${campaignZones.length} Buddie${campaignZones.length > 1 ? "s" : ""} placé${campaignZones.length > 1 ? "s" : ""} pour la campagne`}</span>
                  {dirty ? <button type="button" className={styles.primary} data-warehouse-campaign-action="save" disabled={locked || !affordable || adoptionBlocked} onClick={() => void save()}>Enregistrer le plan</button>
                    : activeCampaign && !locked ? <Link className={styles.primary} data-warehouse-campaign-action="resume" href={warehouseCampaignHref(activeCampaign.leaderRunId ?? activeCampaign.runId)}>Reprendre la campagne<ArrowRight size={15} /></Link>
                      : campaignReady && !locked ? <Link className={styles.primary} data-warehouse-campaign-action="start" href={warehouseCampaignHref()}>Lancer mes cultures<ArrowRight size={15} /></Link>
                        : <button type="button" className={styles.primary} disabled>Lancer mes cultures</button>}
                </div>}
                <div className={styles.zoneNavigation}>
                  <div className={styles.zones} aria-label="Sélection des zones">{planZones.map((zone, index) => <button key={zone.id} type="button" className={styles.zoneChip} data-zone-kind={"kind" in zone ? zone.kind : "culture"} aria-pressed={selectedId === zone.id} onClick={() => selectZone(zone)}><span>{String(index + 1).padStart(2, "0")}</span><span>{zone.name}<small>{activeRuns.find(run => run.zoneId === zone.id) ? warehouseCultureStage(activeRuns.find(run => run.zoneId === zone.id)!) : ZONE_LABELS["kind" in zone ? zone.kind : "culture"]} · {zone.width * zone.height} m²</small></span></button>)}</div>
                  {editing && <button type="button" className={`${styles.primary} ${styles.newZone}`} data-warehouse-action="draw" aria-pressed={drawing} disabled={locked} onClick={toggleDrawing}>{drawing ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}{drawing ? "Annuler le tracé" : "Nouvelle zone"}</button>}
                </div>
                <KqWarehousePlan dimensions={dimensions} zones={draft.zones} serviceZones={draft.serviceZones ?? []} selectedId={selectedId} drawing={drawing} drawingKind={drawingKind} anchor={anchor} cursor={cursor} zoom={zoom} locked={locked} growing={snapshot.activeRun} managing={editing} activeZoneIds={zoneCultures ? occupiedZoneIds : undefined} lockedZoneIds={occupiedZoneIds} placingBuddie={!!pickedBuddie} buddieDrop={buddieDrop}
                  onZoom={setZoom} onCursor={setCursor} onSelectPoint={selectPoint} onDrawZone={drawZone} onConfigureZone={configureZone} onKeyDown={mapKeyboard} onTransformZone={transformZone}
                  onDrawingKind={startDrawingKind}
                  onToggleDrawing={toggleDrawing} />
                <div className={styles.activity} data-warehouse-activity={snapshot.activeRun ? "growing" : "idle"}><span role="status" data-warehouse-draft={dirty || undefined}>{dirty ? draftStored ? "Brouillon conservé dans cet onglet. Enregistre pour appliquer tes modifications." : "Modifications non enregistrées. Enregistre avant de quitter pour les conserver." : snapshot.activeRun ? `${zoneCultures ? activeRuns.length : 1} culture${activeRuns.length > 1 ? "s" : ""} en cours.` : dryShort ? "Séchage à agrandir avant la récolte." : storeShort ? "Stockage à agrandir avant la récolte." : "Installation prête."}</span>{!zoneCultures && !dirty && !snapshot.legacyActiveRun && <Link className={styles.primary} href="/arene/placard?view=game">{snapshot.activeRun ? "Reprendre" : "Cultiver"}<ArrowRight size={15} /></Link>}</div>
                {error && <p className={styles.error} role="alert"><CircleAlert size={17} />{error}</p>}
                {notice && <p className={styles.notice} role="status"><Check size={17} />{notice}</p>}
              </div>
              <div className={styles.inspector} ref={inspector} tabIndex={-1}>
                {selected && !("kind" in selected) && !editing ? <KqWarehouseCulture key={selected.id} zone={selected} run={selectedRun} previewBuddieCode={pickedBuddie} runs={activeRuns} buddies={buddies} disabled={locked || !affordable || adoptionBlocked} dirty={dirty} legacy={!!snapshot.legacyActiveRun} onSave={() => void save()} onManage={() => setManaging(true)} completedRunId={snapshot.completedRuns?.find(run => run.zoneId === selected.id)?.runId} /> : selected ? <><div className={styles.inspectorHeader}><div><small>{ZONE_LABELS[selectedKind]} · {[...snapshot.state.zones, ...(snapshot.state.serviceZones ?? [])].some(zone => zone.id === selected.id) ? "Zone installée" : "Avant achat"}</small><h3>{selected.name}</h3><span>{selected.width * selected.height} m² · {selectedKind === "culture" ? (zoneCultures ? !!selectedRun : snapshot.activeRun) && "active" in selected && selected.active ? "Culture en cours" : "active" in selected && !selected.active ? "En pause" : "Prête à cultiver" : selectedKind === "drying" ? "Filets de séchage" : "Réserve de stockage"}</span></div><Grid2X2 size={22} /></div><div className={styles.inspectorBody}>
                  <p className={styles.zoneEditorHint}>Double-tape cette zone sur le plan pour choisir son équipement et la valider.</p>
                  <button type="button" className={styles.primary} disabled={selectedLocked} data-warehouse-action="configure-selected" onClick={() => configureZone(selected.id)}>Configurer cette zone</button>
                  {dirty && purchaseActions}
                </div></> : <div className={styles.inspectorEmpty}><Ruler size={30} /><h3>Aucune zone sélectionnée</h3><p>Sélectionne une zone ou traces-en une nouvelle.</p>{!editing && <button className={styles.primary} type="button" disabled={locked} onClick={toggleDrawing}>Nouvelle zone</button>}{dirty && purchaseActions}</div>}
              </div>
              {showBuddieDock && <KqWarehouseBuddieDock buddies={buddies} runs={activeRuns} zones={draft.zones} disabled={locked} open={buddiesOpen} onOpenChange={setBuddiesOpen} selectedCode={pickedBuddie} onPick={pickBuddie} onDragPoint={dragBuddie} onDrop={dropBuddie} />}
            </div> : <>
              {dirty && <div className={`${styles.equipmentBasket} ${room !== "processing" ? styles.postHarvestBasket : ""}`} data-postharvest-basket><p><strong>{formatKqCash(investment)} d’investissement</strong><small>Appareils, aménagement et pose inclus{creditUsed ? ` · ${formatKqCash(creditUsed)} de crédit de reprise` : ""}. Solde après achat : {formatKqCash(snapshot.cashCents - payable)}.</small>{(draftClimateCost > 0 || installedClimateCost > 0) && <small className={styles.basketClimateCost}><Zap size={13} aria-hidden="true" />Climatisation après installation : {formatKqCash(draftClimateCost)} / mois de jeu{draftClimateCost !== installedClimateCost ? ` (actuellement ${formatKqCash(installedClimateCost)})` : ""}.</small>}</p>{purchaseActions}</div>}
              {(room === "drying" || room === "storage") && (issues.length ? <div role="alert"><p>{issues[0]}</p><button type="button" className={styles.secondary} onClick={() => setRoom("culture")}>Corriger les dimensions sur le plan</button></div> : <KqWarehousePostHarvest kind={room} state={draft} installedState={snapshot.state} billing={snapshot.storageClimateBilling} disabled={locked} onPlaceDevice={placeDevice} onEditZone={editServiceZone} onUpgradeZone={upgradeServiceZone} onSetStorageClimate={setStorageClimate} />)}
              {room === "processing" && <>
                <div className={styles.roomIntro}><div><h3>Transformation</h3><p>Transforme tes lots séchés et stockés.</p></div></div>
                {dirty ? <p className={styles.warning}>Enregistre ou annule ton aménagement avant de modifier les machines de l’atelier.</p> : <div className={styles.workshop} data-warehouse-workshop>
                  {workshopShop ? <>
                    <button className={styles.secondary} type="button" disabled={workshopBusy} onClick={() => setWorkshopShop(false)}>Retour à mes machines</button>
                    {workshopEquipmentCode === "COMPUTER" ? <KqCommerceComputer onBusyChange={setWorkshopBusy} /> : <KqEquipmentCatalogModal embedded workshopOnly initialEquipmentCode={workshopEquipmentCode} onBusyChange={setWorkshopBusy} onClose={() => setWorkshopShop(false)} />}
                  </> : <KqWarehouseEntry embedded workshopOnly initialEquipmentCode={workshopEquipmentCode} onBusyChange={setWorkshopBusy} onClose={() => setRoom("storage")} onOpenShop={openWorkshopShop} />}
                </div>}
                <div className={styles.lots}><div className={styles.sectionTitle}><h3>Lots à transformer</h3><button className={styles.secondary} type="button" disabled={workshopBusy || dirty} onClick={() => { setProcessingFlowerId(undefined); setShowOperations(value => !value); }}>{showOperations ? "Replier" : "Ouvrir les lots"}<ArrowRight size={13} /></button></div>{showOperations && !dirty && <KqCommerceDesk key={processingFlowerId ?? "all"} initialFlowerId={processingFlowerId} mode="sales" onOpenShop={openWorkshopShop} onOpenStorage={() => setRoom("storage")} />}</div>
              </>}
              {room === "storage" && <KqWarehouseHarvests storage={storage} stockGrams={stock} storageReservedGrams={storageReserved} storageCapacityGrams={savedActualStorageCapacity}
                disabled={pending || loading || dirty} error={storageError} onRetry={() => void storagePolling.current?.refresh()}
                onOpenWorkshop={flowerId => { setProcessingFlowerId(flowerId); setShowOperations(true); setRoom("processing"); }}
                onSellOverflow={flowerId => void sellOverflow(flowerId)} />}
            </>}
          </div>
          <KqWarehouseDashboard summary={summary} quote={quote} dirty={dirty} migrationCreditCents={snapshot.migrationCreditCents ?? 0} storageCapacity={storageCapacity} storageReserved={storageReserved} reservedHarvest={reservedHarvest} salesGramsPerDay={demand} />
        </>}
      </div>
      <AppDialog open={zoneDialogOpen} onClose={() => setZoneDialogId(null)} title="Équiper la zone" className={styles.zoneDialog} bodyClassName={styles.zoneDialogBody} dialogProps={{ "data-warehouse-zone-dialog": true }} footer={
        <div className={styles.zoneDialogFooter}>
          {zoneDialogError && <p className={styles.zoneDialogError} role="alert">{zoneDialogError}</p>}
          <div className={styles.zoneDialogTotal}><span>À payer pour le plan</span><strong>{formatKqCash(payable)}</strong></div>
          <button type="button" className={styles.primary} data-warehouse-action="save" disabled={selectedLocked || !quote || !affordable || adoptionBlocked} onClick={() => void confirmZone()}>{pending ? <LoaderCircle size={16} /> : <Check size={16} />}{pending ? "Validation…" : dirty ? "Valider et installer" : "Terminer"}</button>
          <small>Toutes les modifications du plan seront enregistrées.</small>
        </div>
      }>{zoneEditor}</AppDialog>
      {draft && <KqWarehouseShop open={shopOpen} onClose={() => setShopOpen(false)} zone={selected && !("kind" in selected) ? selected : null} state={draft} locked={locked} zoneLocked={!!selectedRun} onChangeZone={patch => { setManaging(true); updateZone(patch); }} onPlaceDevice={device => { placeDevice(device); setShopOpen(false); }} onOpenWorkshop={() => { setShopOpen(false); setRoom("processing"); openWorkshopShop(); }} />}
    </section>
    <AppDialog open={!!pendingLeave} onClose={() => setPendingLeave(null)} title="Modifications en cours">
      <div className={styles.leaveDraft}>
        <p>{draftStored ? "Ton brouillon restera disponible dans cet onglet. Les modifications ne seront appliquées qu’après enregistrement." : "Ton brouillon ne peut pas être conservé dans ce navigateur. Enregistre pour ne pas perdre tes modifications."}</p>
        {pending && <p>Une demande est en cours. Quitter cet écran ne l’annule pas.</p>}
        {error && <p role="alert">{error}</p>}
        <button type="button" className={styles.primary} disabled={locked || !quote || !affordable || adoptionBlocked} onClick={async () => { if (await save()) continueLeaving(); }}>{investment ? `Installer · ${formatKqCash(payable)} et quitter` : "Enregistrer et quitter"}</button>
        <button type="button" className={styles.secondary} onClick={() => setPendingLeave(null)}>Continuer à modifier</button>
        <button type="button" className={styles.secondary} onClick={continueLeaving}>{draftStored ? "Quitter en gardant le brouillon" : "Quitter sans enregistrer"}</button>
      </div>
    </AppDialog>
  </div>;
}
