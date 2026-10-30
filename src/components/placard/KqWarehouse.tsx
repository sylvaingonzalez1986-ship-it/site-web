"use client";

import type { KqHarvestMarketSection } from "@/lib/kanab-quest-harvests";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleAlert, Factory, Fan, LoaderCircle, Package, RefreshCw, Ruler, Save, ShoppingBag, Sprout, Trash2, X, Zap } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { AppDialog, useDialogNavigation } from "@/components/ui/AppDialog";
import { navigateWithDraftGuard, registerNavigationGuard } from "@/lib/navigation-guard";
import { navigateAfterOverlays } from "@/lib/overlay-history";
import { readWarehouseDraft, writeWarehouseDraft, warehouseDraftStorage, type WarehouseDraft } from "@/lib/warehouse-draft";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqWarehouseDepartment, getKqWarehouseShopTarget } from "@/lib/kanab-quest-warehouse-shop-target";
import { createClientRequestKey } from "@/lib/client-request-key";
import { KQ_WAREHOUSE_CATALOG, getKqWarehouseDevice, type KqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { KQ_WAREHOUSE_OPTIONS, KQ_WAREHOUSE_OPTION_FAMILIES, getKqWarehouseOption } from "@/lib/kanab-quest-warehouse-options";
import { getKqWarehouseDimensions, getKqWarehouseQuote, getKqWarehouseStorageClimateQuote, getKqWarehouseSummary, getKqWarehouseZoneQuote, getKqWarehouseServiceZoneQuote, isKqWarehouseState, validateKqWarehouseState, type KqWarehouseState, type KqWarehouseZone, type KqWarehouseServiceZone } from "@/lib/kanab-quest-warehouse";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import type { KqStorageClimateBilling } from "@/lib/kanab-quest-business";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqCommerceComputer } from "./KqCommerceDesk";
import { KqWarehouseEntry } from "./KqWarehouseEntry";
import { KqWarehousePlan } from "./KqWarehousePlan";
import { KqPrintedArt } from "./KqPrintedArt";
import { KqWarehousePostHarvest } from "./KqWarehousePostHarvest";
import { KqHarvestStorage } from "./KqHarvestStorage";
import { KqEquipmentCatalogModal } from "./KqEquipmentCatalogModal";
import { KqWarehouseShop } from "./KqWarehouseShop";
import { KqWarehousePlanQuote } from "./KqWarehousePlanQuote";
import { getKqWarehousePlanPayment } from "@/lib/kanab-quest-warehouse-plan-review";
import { KqWarehouseCulture, warehouseCultureHref, warehouseCampaignHref, warehouseCultureStage, type KqWarehouseCultureSummary, type KqWarehouseBuddies } from "./KqWarehouseCulture";
import { KqWarehouseDashboard, type KqWarehouseDashboardTab } from "./KqWarehouseDashboard";
import { KqWarehouseBuddieDock } from "./KqWarehouseBuddieDock";
import { KqBuddieCarousel } from "./KqBuddieCarousel";
import { KqWarehouseZoneRemoval, type KqWarehouseRemovalAttempt, type KqWarehouseRemovalReceipt } from "./KqWarehouseZoneRemoval";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { getKqWarehouseZoneCondition, reconcileKqWarehouseCondition, type KqWarehouseCondition } from "@/lib/kanab-quest-warehouse-condition";
import { getKqBuddieRotationRemaining } from "@/lib/kanab-quest-buddie-rotation";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
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
  cultureEquipment?: KqWarehouseCondition;
};
type Point = { x: number; y: number };
type ZoneKind = "culture" | "drying" | "storage";
type PlanZone = KqWarehouseZone | KqWarehouseServiceZone;
const ZONE_LABELS: Record<ZoneKind, string> = { culture: "Culture", drying: "Séchage", storage: "Stockage" };
const ZONE_ICONS = { culture: Sprout, drying: Fan, storage: Package };
const ROOMS = [
  { code: "culture", label: "Plan", icon: Sprout },
  { code: "drying", label: "Séchage", icon: Fan },
  { code: "storage", label: "Stockage", icon: Package },
  { code: "processing", label: "Atelier", icon: Factory },
] as const;
const mass = (grams: number) => grams >= 1_000 ? `${(grams / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg` : `${grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const decimal = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

function ZoneDialogAction({ onClick, children, disabled, action, className, leave = false }: { onClick: () => void; children: ReactNode; disabled?: boolean; action: string; className: string; leave?: boolean }) {
  const navigate = useDialogNavigation();
  return <button type="button" className={className} disabled={disabled} data-warehouse-zone-action={action} onClick={() => leave ? navigate(onClick) : onClick()}>{children}</button>;
}

export function KqWarehouse({ embedded = false, draftOwnerId, initialSection = "equipment", initialFlowerId, initialEquipmentCode, initialZoneId, initialShopOpen = false, initialStorageEquipmentOpen = false, draftStore, onOpenCulture, onOpenMarket, onOpenHarvests, onClose }: {
  embedded?: boolean; draftOwnerId?: string; initialSection?: "equipment" | "storage"; initialFlowerId?: string; initialEquipmentCode?: string | null; initialZoneId?: string | null; initialShopOpen?: boolean; initialStorageEquipmentOpen?: boolean; onClose: () => void;
  draftStore?: { read: (revision: number) => KqWarehouseState | null; write: (state: KqWarehouseState) => void };
  onOpenCulture?: (href: string) => void;
  onOpenMarket?: (flowerId?: string, section?: KqHarvestMarketSection) => void;
  onOpenHarvests?: (flowerId?: string) => void;
}) {
  const api = useKqTutorialApi();
  const router = useRouter();
  const id = useId().replaceAll(":", "");
  const initialTarget = getKqWarehouseShopTarget(initialEquipmentCode);
  const initialWorkshopCode = initialTarget?.kind === "workshop" ? initialTarget.code : undefined;
  const initialWorkshopShop = !!initialWorkshopCode;
  const initialDevice = getKqWarehouseDevice(initialEquipmentCode ?? "") ?? KQ_WAREHOUSE_CATALOG.find(item => item.legacyCode === initialEquipmentCode);
  const [room, setRoom] = useState<Room>(initialSection === "storage" ? "storage" : initialWorkshopShop ? "processing" : initialDevice?.kind === "drying" ? "drying" : initialDevice?.room ?? "culture");
  const page = useRef<HTMLElement>(null);
  const focusedInitialEquipment = useRef(false);
  const focusedInitialZone = useRef(false);
  const requestedStorageFlower = useRef(initialFlowerId);
  useEffect(() => {
    if (requestedStorageFlower.current === initialFlowerId) return;
    requestedStorageFlower.current = initialFlowerId;
    if (initialSection !== "storage" || !initialFlowerId) return;
    const frame = requestAnimationFrame(() => { setRoom("storage"); setProtectionFlowerId(initialFlowerId); });
    return () => cancelAnimationFrame(frame);
  }, [initialFlowerId, initialSection]);
  const [storageEquipmentOpen, setStorageEquipmentOpen] = useState(() => Boolean(
    (initialSection === "storage" && initialStorageEquipmentOpen) || (initialDevice?.room === "storage" && initialDevice.kind !== "drying"),
  ));
  const [protectionFlowerId, setProtectionFlowerId] = useState<string | null>(initialFlowerId ?? null);
  const storageProtectionTarget = useRef<HTMLElement>(null);
  const [snapshot, setSnapshot] = useState<KqWarehouseViewSnapshot | null>(null);
  const [draft, setDraft] = useState<KqWarehouseState | null>(null);
  const [staleDraft, setStaleDraft] = useState<WarehouseDraft | null>(null);
  const [draftStored, setDraftStored] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const owner = !api.isTutorial ? draftOwnerId : undefined;
  const loadedOwner = useRef(owner);
  const [storage, setStorage] = useState<KqStorageSnapshot | null>(null);
  const [storageError, setStorageError] = useState("");
  const [storageBusy, setStorageBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialZoneId ?? null);
  const [managing, setManaging] = useState(true);
  const [zoneDialogId, setZoneDialogId] = useState<string | null>(null);
  const [zoneMenuId, setZoneMenuId] = useState<string | null>(null);
  const [zoneMenuPage, setZoneMenuPage] = useState<"actions" | "buddies" | "remove">("actions");
  const zoneOrigin = useRef<HTMLElement | SVGSVGElement | null>(null);
  const [removalBusy, setRemovalBusy] = useState(false);
  const closeAfterRemoval = useRef(false);
  const removalAttempt = useRef<KqWarehouseRemovalAttempt | null>(null);
  const buddieSaveFocus = useRef<string | null>(null);
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
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<KqWarehouseDashboardTab>("performance");
  const dashboard = useRef<HTMLDivElement>(null);
  const planReview = useRef<HTMLDivElement>(null);
  const [workshopShop, setWorkshopShop] = useState(initialShopOpen && initialWorkshopShop);
  const [shopOpen, setShopOpen] = useState(initialShopOpen && !initialWorkshopShop && initialTarget?.kind !== "storage-climate");
  const [shopVisit, setShopVisit] = useState({ id: 0, department: getKqWarehouseDepartment(room), equipmentCode: initialShopOpen ? initialEquipmentCode : undefined });
  const [workshopEquipmentCode, setWorkshopEquipmentCode] = useState<string | undefined>(initialWorkshopCode);
  const [workshopBusy, setWorkshopBusy] = useState(false);
  const mutation = useRef(false);
  const readVersion = useRef(0);
  const mounted = useRef(true);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const inspector = useRef<HTMLDivElement>(null);
  useBodyScrollLock(!embedded);

  const load = useCallback(async (signal?: AbortSignal, background = false) => {
    if (mutation.current) return;
    const version = ++readVersion.current;
    if (!background) setLoading(true);
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
    setStorage(value); setStorageError("");
  }, []);

  const issues = draft ? validateKqWarehouseState(draft) : [];
  const quote = useMemo(() => {
    if (!draft || !snapshot || validateKqWarehouseState(draft).length) return null;
    return getKqWarehouseQuote(draft, snapshot.state);
  }, [draft, snapshot]);
  const previewCondition = useMemo(() => quote && snapshot?.cultureEquipment
    ? reconcileKqWarehouseCondition(snapshot.state, quote.nextState, snapshot.cultureEquipment, { requestKey: "preview", fundedFraction: 1 })
    : snapshot?.cultureEquipment, [quote, snapshot]);
  const summary = useMemo(() => quote ? getKqWarehouseSummary(quote.nextState, 2, 2, previewCondition) : snapshot ? getKqWarehouseSummary(snapshot.state, 2, 2, previewCondition) : null, [quote, snapshot, previewCondition]);
  const installedSummary = useMemo(() => snapshot ? getKqWarehouseSummary(snapshot.state, 2, 2, snapshot.cultureEquipment) : undefined, [snapshot]);
  function openReserve() {
    setDashboardTab("reserve");
    setDashboardOpen(true);
    requestAnimationFrame(() => {
      const target = dashboard.current?.querySelector<HTMLButtonElement>('[data-warehouse-summary-tab="reserve"]');
      target?.scrollIntoView({ block: "center", behavior: "instant" });
      target?.focus({ preventScroll: true });
    });
  }
  function reviewPlan() {
    setShopOpen(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      planReview.current?.scrollIntoView({ block: "center", behavior: "instant" });
      planReview.current?.focus({ preventScroll: true });
    }));
  }
  const planZones = draft ? [...draft.zones, ...(draft.serviceZones ?? [])] : [];
  const dimensions = getKqWarehouseDimensions(draft ?? snapshot?.state);
  const selected = planZones.find(zone => zone.id === selectedId);
  const menuZone = planZones.find(zone => zone.id === zoneMenuId);
  useEffect(() => {
    if (!initialZoneId || initialShopOpen || initialSection === "storage" || room !== "culture" || !snapshot || selected?.id !== initialZoneId || focusedInitialZone.current) return;
    const frame = requestAnimationFrame(() => {
      const panel = inspector.current;
      if (!panel) return;
      focusedInitialZone.current = true;
      panel.scrollIntoView({ block: "center", behavior: "instant" });
      const action = panel.querySelector<HTMLButtonElement>('[data-warehouse-action="configure-selected"]:not(:disabled)');
      (action ?? panel).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialZoneId, initialShopOpen, initialSection, room, snapshot, selected?.id]);
  const initialClimateCode = initialTarget?.kind === "storage-climate" ? initialTarget.code : undefined;
  useEffect(() => {
    if (!initialClimateCode || !snapshot || !storageEquipmentOpen || room !== "storage" || focusedInitialEquipment.current) return;
    const frame = requestAnimationFrame(() => {
      const target = page.current?.querySelector<HTMLElement>(`[data-storage-climate-card="${CSS.escape(initialClimateCode)}"]`);
      if (!target) return;
      focusedInitialEquipment.current = true;
      target.tabIndex = -1;
      target.scrollIntoView({ block: "center", behavior: "instant" });
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialClimateCode, snapshot, storageEquipmentOpen, room]);
  const selectedIdentity = draft && selected ? getKqZoneIdentity(draft, selected.id) : null;
  const selectedKind: ZoneKind = selected && "kind" in selected ? selected.kind : "culture";
  const zoneQuote = selected && !issues.length ? "kind" in selected ? getKqWarehouseServiceZoneQuote(selected) : getKqWarehouseZoneQuote(selected, 2, previewCondition) : null;
  const dirty = !!draft && !!snapshot && JSON.stringify(draft) !== JSON.stringify(snapshot.state);
  useEffect(() => {
    if (!buddieSaveFocus.current || pending || dirty) return;
    const zoneId = buddieSaveFocus.current;
    buddieSaveFocus.current = null;
    if (notice && zoneMenuPage === "buddies" && zoneMenuId === zoneId) {
      page.current?.querySelector<HTMLButtonElement>("[data-warehouse-zone-back]")?.focus();
    }
  }, [dirty, pending, notice, zoneMenuId, zoneMenuPage]);
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
  const activeRuns = snapshot?.activeRuns ?? [];
  const directPreparation = !api.isTutorial;
  const editing = managing || !zoneCultures || (directPreparation && activeRuns.length === 0);
  const showBuddieDock = !directPreparation && zoneCultures && room === "culture" && !editing && !shopOpen;
  const activeCampaign = activeRuns.find(run => run.campaignId);
  const campaignZones = draft?.zones.filter(zone => zone.active && zone.buddieCode) ?? [];
  const campaignReady = !!campaignZones.length && !!buddies && !activeRuns.length
    && new Set(campaignZones.map(zone => zone.buddieCode)).size === campaignZones.length
    && campaignZones.every(zone => buddies.ownedBuddieCodes.includes(zone.buddieCode!)
      && !getKqBuddieRotationRemaining(zone.buddieCode!, buddies.buddieRotation?.recentBuddieCodes ?? []));
  const occupiedZoneIds = activeRuns.flatMap(run => run.zoneId ? [run.zoneId] : []);
  const selectedRun = activeRuns.find(run => run.zoneId === selectedId);
  const removalLocked = pending || removalBusy || loading || workshopBusy || storageBusy || (!zoneCultures && !!snapshot?.activeRun) || !!snapshot?.legacyActiveRun;
  const locked = removalLocked || !!removalAttempt.current;
  const selectedLocked = locked || !!selectedRun;
  const payment = getKqWarehousePlanPayment(quote, snapshot?.cashCents ?? 0, snapshot?.migrationCreditCents ?? 0);
  const creditUsed = payment.creditUsedCents;
  const payable = payment.payableCents;
  const affordable = !!snapshot && payment.affordable;
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
    void load(undefined, true);
  }), [api, dirty, load]);
  const save = async () => {
    if (!snapshot || !draft || !quote || payable === null || !dirty || locked || !affordable || adoptionBlocked || mutation.current) return false;
    mutation.current = true; readVersion.current += 1; setPending(true); setError(""); setNotice("");
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
        setNotice(quote.totalCostCents > 0 ? `Aménagement installé. ${formatKqCash(payable)} prélevés${creditUsed ? ` et ${formatKqCash(creditUsed)} de crédit de reprise utilisés` : ""}.` : "Plan enregistré sans prélèvement.");
      }
      request.current = null;
      api.notify("kq:equipment-updated"); api.notify("kq:storage-updated");
      if (owner && mounted.current) writeWarehouseDraft(warehouseDraftStorage(), owner, null);
      return true;
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Enregistrement impossible."); return false; }
    finally { mutation.current = false; if (mounted.current) setPending(false); }
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
    if (locked || pickedBuddieRef.current || occupiedZoneIds.includes(zoneId) || !planZones.some(zone => zone.id === zoneId)) return;
    setManaging(true); setSelectedId(zoneId); setDrawing(false); setAnchor(null); setError(""); setZoneDialogId(zoneId);
  }
  function openZoneMenu(zoneId: string) {
    if (drawing || pickedBuddieRef.current || !planZones.some(zone => zone.id === zoneId)) return;
    const trigger = document.activeElement;
    if (trigger instanceof HTMLElement || trigger instanceof SVGSVGElement) zoneOrigin.current = trigger;
    setSelectedId(zoneId); setZoneMenuId(zoneId); setZoneMenuPage("actions"); setError("");
  }
  function restoreZoneFocus() {
    requestAnimationFrame(() => {
      const target = zoneOrigin.current?.isConnected ? zoneOrigin.current : workspace.current?.querySelector<SVGSVGElement>("[data-warehouse-map]");
      target?.focus({ preventScroll: true });
    });
  }
  function closeZoneMenu() {
    if (removalBusy) { closeAfterRemoval.current = true; return; }
    setZoneMenuId(null); restoreZoneFocus();
  }
  function furnishZone() {
    if (!menuZone || selectedLocked) return;
    setZoneMenuId(null); setManaging(true); setDrawing(false); setAnchor(null);
    if ("kind" in menuZone) { setZoneDialogId(menuZone.id); return; }
    setShopVisit(current => ({ id: current.id + 1, department: "lighting", equipmentCode: undefined }));
    setShopOpen(true);
  }
  function showZoneBuddies() {
    if (!menuZone || "kind" in menuZone || selectedLocked) return;
    setZoneMenuPage("buddies"); setNotice("");
    requestAnimationFrame(() => page.current?.querySelector<HTMLButtonElement>("[data-warehouse-zone-buddies] [data-buddie-select]:not(:disabled)")?.focus({ preventScroll: true }));
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
    setSelectedId(null); setZoneDialogId(null); setZoneMenuId(null);
    restoreZoneFocus();
  }
  function acceptZoneRemoval(value: KqWarehouseViewSnapshot, receipt: KqWarehouseRemovalReceipt) {
    setSnapshot(value); setDraft(value.state); setSelectedId(null); setZoneMenuId(null); setZoneDialogId(null);
    setDrawing(false); setAnchor(null); setError(""); setStaleDraft(null);
    setNotice(`Zone supprimée. ${receipt.soldCount ? `${formatKqCash(receipt.resaleCents)} versés au portefeuille. ` : ""}${receipt.keptCount ? `${receipt.keptCount} élément${receipt.keptCount > 1 ? "s" : ""} conservé${receipt.keptCount > 1 ? "s" : ""} en réserve.` : ""}`);
    restoreZoneFocus();
    if (owner) writeWarehouseDraft(warehouseDraftStorage(), owner, null);
    api.notify("kq:equipment-updated"); api.notify("kq:storage-updated");
  }
  function changeRemovalBusy(value: boolean) {
    mutation.current = value;
    readVersion.current += 1;
    setRemovalBusy(value);
    if (!value && closeAfterRemoval.current) { closeAfterRemoval.current = false; setZoneMenuId(null); restoreZoneFocus(); }
  }
  function selectZone(zone?: PlanZone) {
    if (pickedBuddieRef.current) {
      assignBuddie(pickedBuddieRef.current, zone);
      return;
    }
    setSelectedId(zone?.id ?? null);
    if (zone) openZoneMenu(zone.id);
    else setZoneMenuId(null);
  }
  function pickBuddie(code: string | null) {
    if (code && (!showBuddieDock || !buddiesOpen)) return;
    pickedBuddieRef.current = code;
    setPickedBuddie(code);
    if (code) { setDrawing(false); setAnchor(null); }
    else setBuddieDrop(null);
  }
  function placementError(code: string, zone?: PlanZone, fromMenu = false): string {
    if ((fromMenu ? zoneMenuPage !== "buddies" || zoneMenuId !== zone?.id : !showBuddieDock || !buddiesOpen) || locked || mutation.current) return "Placement momentanément indisponible.";
    if (!buddies?.ownedBuddieCodes.includes(code)) return "Ce Buddie ne figure pas dans ta collection.";
    if (!buddies.buddieRotation) return "La disponibilité des Buddies doit être vérifiée.";
    if (activeRuns.some(run => run.buddieCode === code)) return "Ce Buddie est déjà en culture.";
    if (getKqBuddieRotationRemaining(code, buddies.buddieRotation?.recentBuddieCodes ?? [])) return "Ce Buddie est encore en rotation.";
    if (!zone || "kind" in zone) return "Dépose la carte dans une zone de culture.";
    if (occupiedZoneIds.includes(zone.id)) return "Cette zone est déjà en culture.";
    return "";
  }
  function assignBuddie(code: string, zone?: PlanZone, fromMenu = false) {
    const problem = placementError(code, zone, fromMenu);
    if (problem) { setNotice(problem); return; }
    const target = zone as KqWarehouseZone;
    setDraft(current => current ? { ...current, zones: current.zones.map(item => {
      if (item.id === target.id) return { ...item, buddieCode: code };
      if (item.buddieCode !== code) return item;
      const freed = { ...item };
      delete freed.buddieCode;
      return freed;
    }) } : current);
    const identity = draft ? getKqZoneIdentity(draft, target.id) : null;
    setSelectedId(target.id); setError(""); setNotice(`Buddie affecté à la ${(identity?.label ?? "zone").toLowerCase()}. Enregistre pour valider.`);
    pickBuddie(null);
    if (fromMenu) setManaging(true);
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
  const openShop = () => {
    if (room === "processing") { openWorkshopShop(); return; }
    setShopVisit(current => ({ id: current.id + 1, department: getKqWarehouseDepartment(room), equipmentCode: undefined }));
    setShopOpen(true);
  };
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
  const installLabel = payable === null ? "Devis à vérifier" : payable > 0 ? `Installer le plan · ${formatKqCash(payable)}` : "Enregistrer le plan · 0 €";
  const draftClimateCost = draft ? getKqWarehouseStorageClimateQuote(draft).monthlyCents : 0;
  const installedClimateCost = snapshot ? getKqWarehouseStorageClimateQuote(snapshot.state).monthlyCents : 0;
  const protectionLot = storage?.lots.find(lot => lot.flowerId === protectionFlowerId);
  const protectionUnits = protectionLot?.projection.capacity?.overflowUnits;
  const protectionKnown = !storageError && typeof protectionUnits === "number" && Number.isFinite(protectionUnits) && protectionUnits >= 0;

  const destinationHref = (view: "market" | "harvests", flowerId?: string | null, marketSection: KqHarvestMarketSection = "sales") => `/arene/placard?view=${view}${view === "market" ? `&section=${marketSection}` : "&section=storage"}${flowerId ? `&flower=${encodeURIComponent(flowerId)}` : ""}`;
  const focusedProtection = useRef<string | null>(null);
  useEffect(() => {
    if (!protectionFlowerId || focusedProtection.current === protectionFlowerId || room !== "storage" || !storageEquipmentOpen || !snapshot || loading) return;
    const frame = requestAnimationFrame(() => {
      const element = storageProtectionTarget.current;
      if (!element) return;
      focusedProtection.current = protectionFlowerId;
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [protectionFlowerId, room, storageEquipmentOpen, snapshot, loading]);

  const zoneDialogOpen = !!zoneDialogId && zoneDialogId === selectedId && !!selected && room === "culture" && editing;
  const menuIdentity = menuZone && draft ? getKqZoneIdentity(draft, menuZone.id) : null;
  const menuSaved = !!menuZone && !!snapshot && [...snapshot.state.zones, ...(snapshot.state.serviceZones ?? [])].some(zone => zone.id === menuZone.id);
  const menuCondition = menuZone && !("kind" in menuZone) ? getKqWarehouseZoneCondition(menuZone.id, snapshot?.cultureEquipment?.assets ?? []) : null;
  const menuTitle = `${menuIdentity?.label ?? "Zone"} · ${menuZone ? menuZone.width * menuZone.height : 0} m²`;
  const zoneDialogError = error || issues[0] || (adoptionBlocked ? "Stockage insuffisant pour tes lots. Agrandis la zone ou change de gamme." : "");
  const zoneEditor = selected && draft && snapshot ? <>
    <div className={styles.zoneDialogSummary} style={{ backgroundColor: selectedIdentity?.tint }}><strong><span className={styles.zoneNumber} style={{ backgroundColor: selectedIdentity?.color }} aria-label={selectedIdentity?.label}>{selectedIdentity?.number ?? "—"}</span> {selected.width * selected.height} m²</strong><span>{ZONE_LABELS[selectedKind]}</span></div>
    <div className={styles.inspectorBody} data-warehouse-zone-kind={selectedKind}>
                  <details className={styles.zoneSettings} data-warehouse-zone-settings key={selected.id}><summary>Ajuster la zone</summary><div>
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
                    <details><summary>Références de cette zone</summary>
                      {zoneQuote && <>
                        <div className={styles.quoteLine}><span>Surface · {ZONE_LABELS[selectedKind]}</span><strong>{zoneQuote.areaM2} m²</strong></div>
                        <div className={styles.quoteLine}><span>Référence avec du matériel neuf</span><strong>{formatKqCash(zoneQuote.totalCostCents)}</strong></div>
                        <div className={styles.quoteLine}><span>{selectedKind === "culture" ? "Rendement estimé" : "Capacité par m²"}</span><strong>{decimal(selectedCapacityPerM2)} g/m²</strong></div>
                        {"volumeLitres" in zoneQuote && zoneQuote.volumeLitres > 0 && <div className={styles.quoteLine}><span>Volume des contenants</span><strong>{decimal(zoneQuote.volumeLitres)} L</strong></div>}
                        {"usableSurfaceM2" in zoneQuote && zoneQuote.usableSurfaceM2 > 0 && <div className={styles.quoteLine}><span>Surface utile des filets</span><strong>{decimal(zoneQuote.usableSurfaceM2)} m²</strong></div>}
                        {"operatingCostCents" in zoneQuote && <><div className={styles.quoteLine}><span>Charges / culture</span><strong>{formatKqCash(zoneQuote.operatingCostCents)}</strong></div><div className={styles.quoteLine}><span>Dont fournitures / m²</span><strong>{formatKqCash(Math.round(zoneQuote.consumablesCostCents / zoneQuote.areaM2))}</strong></div></>}
                        <ul>{zoneQuote.devices.map(line => <li key={line.code}>{line.quantity} × {line.device.name} · {formatKqCash(line.device.priceCents)}/unité</li>)}{"options" in zoneQuote && zoneQuote.options.map(line => <li key={line.code}>{line.option.name} · {line.quantity} m² × {formatKqCash(line.option.equipmentCentsPerM2)}/m² · {formatKqCash(line.option.consumablesCentsPerM2)}/m²/cycle</li>)}</ul>
                      </>}
                      <p>Ces références décrivent cette zone. Le devis du plan tient compte du matériel possédé et de toutes les modifications.</p>
                    </details>
                  </div>
                  <ZoneDialogAction className={styles.danger} action="remove" disabled={selectedLocked} onClick={() => { setZoneDialogId(null); setZoneMenuId(selected.id); setZoneMenuPage("remove"); }}><Trash2 size={13} />Supprimer cette zone</ZoneDialogAction>
                </div>
  </> : null;

  const cultureAccess = zoneCultures && !(editing && dirty) && (directPreparation || !editing) && <div className={`${styles.campaignLaunch} ${directPreparation ? styles.preparationAccess : ""}`} data-warehouse-campaign>
                  <span>{directPreparation ? <><strong>{activeRuns.length ? "Tes cultures en cours" : "Prêt à cultiver ?"}</strong><small>{activeRuns.length ? `${activeRuns.length} culture${activeRuns.length > 1 ? "s" : ""} à suivre.` : "Choisis tes Buddies et tes cartes sur la page de préparation."}</small></> : activeCampaign ? "Une campagne · tous tes Buddies" : activeRuns.length ? "Termine tes cultures en cours" : `${campaignZones.length} Buddie${campaignZones.length > 1 ? "s" : ""} placé${campaignZones.length > 1 ? "s" : ""} pour la campagne`}</span>
                  {dirty ? <button type="button" className={styles.primary} data-warehouse-campaign-action="review" onClick={reviewPlan}>Voir le devis du plan</button>
                    : activeCampaign && !locked ? onOpenCulture
                      ? <button type="button" className={styles.primary} data-warehouse-campaign-action="resume" onClick={() => onOpenCulture(warehouseCampaignHref(activeCampaign.leaderRunId ?? activeCampaign.runId))}>{directPreparation ? "Reprendre mes cultures" : "Reprendre la campagne"}<ArrowRight size={15} /></button>
                      : <Link className={styles.primary} data-warehouse-campaign-action="resume" href={warehouseCampaignHref(activeCampaign.leaderRunId ?? activeCampaign.runId)}>{directPreparation ? "Reprendre mes cultures" : "Reprendre la campagne"}<ArrowRight size={15} /></Link>
                      : directPreparation && !locked ? onOpenCulture
                        ? <button type="button" className={styles.primary} data-warehouse-campaign-action={activeRuns.length ? "resume" : "start"} onClick={() => onOpenCulture(warehouseCampaignHref())}>{activeRuns.length ? "Reprendre mes cultures" : "Préparer mes cultures"}<ArrowRight size={15} /></button>
                        : <Link className={styles.primary} data-warehouse-campaign-action={activeRuns.length ? "resume" : "start"} href={warehouseCampaignHref()}>{activeRuns.length ? "Reprendre mes cultures" : "Préparer mes cultures"}<ArrowRight size={15} /></Link>
                      : campaignReady && !locked ? onOpenCulture
                        ? <button type="button" className={styles.primary} data-warehouse-campaign-action="start" onClick={() => onOpenCulture(warehouseCampaignHref())}>Lancer mes cultures<ArrowRight size={15} /></button>
                        : <Link className={styles.primary} data-warehouse-campaign-action="start" href={warehouseCampaignHref()}>Lancer mes cultures<ArrowRight size={15} /></Link>
                        : <button type="button" className={styles.primary} disabled>{directPreparation ? "Préparer mes cultures" : "Lancer mes cultures"}</button>}
                </div>;

  const purchaseActions = <div className={styles.buttons}>
    <button className={styles.primary} type="button" disabled={!dirty || locked || !quote || !affordable || adoptionBlocked} data-warehouse-action="save" onClick={() => void save()}>{pending ? <LoaderCircle size={15} /> : <Save size={15} />} {pending ? "Enregistrement…" : installLabel}</button>
    <button className={styles.secondary} type="button" disabled={pending} data-warehouse-action="reset" onClick={resetDraft}>Annuler les modifications du plan</button>
  </div>;
  const quoteReview = (actions: ReactNode, compact = false) => snapshot && draft ? <KqWarehousePlanQuote previousState={snapshot.state} draftState={draft} quote={quote} cashCents={snapshot.cashCents} migrationCreditCents={snapshot.migrationCreditCents ?? 0} compact={compact} aside={<>
    {zoneDialogError && <p className={styles.error} role="alert">{zoneDialogError}</p>}
    {quote && (draftClimateCost > 0 || installedClimateCost > 0) && <p className={styles.basketClimateCost}><Zap size={13} aria-hidden="true" />Climatisation après installation : {formatKqCash(draftClimateCost)} / mois de jeu{draftClimateCost !== installedClimateCost ? ` (actuellement ${formatKqCash(installedClimateCost)})` : ""}. Facturée séparément.</p>}
  </>}>{actions}</KqWarehousePlanQuote> : null;
  const mainPlanReview = dirty && <div className={styles.planActions} ref={planReview} tabIndex={-1} data-warehouse-plan-actions data-warehouse-plan-review aria-label="Devis de toutes les modifications du plan">{quoteReview(purchaseActions)}</div>;

  const zoneInspector = snapshot ? <div className={styles.inspector} ref={inspector} tabIndex={-1} data-warehouse-zone-summary={editing && !!selected || undefined}>
                {selected && !("kind" in selected) && !editing ? <KqWarehouseCulture key={selected.id} zone={selected} condition={previewCondition} zoneIdentity={selectedIdentity} run={selectedRun} previewBuddieCode={pickedBuddie} runs={activeRuns} buddies={buddies} disabled={locked || !affordable || adoptionBlocked} dirty={dirty} legacy={!!snapshot.legacyActiveRun} onReviewPlan={reviewPlan} onManage={() => setManaging(true)} completedRunId={snapshot.completedRuns?.find(run => run.zoneId === selected.id)?.runId} /> : selected ? <><div className={styles.inspectorHeader} style={{ backgroundColor: selectedIdentity?.tint }}><div><h3><b className={styles.zoneNumber} style={{ backgroundColor: selectedIdentity?.color }} aria-label={selectedIdentity?.label}>{selectedIdentity?.number ?? "—"}</b> {ZONE_LABELS[selectedKind]} · {selected.width * selected.height} m²</h3><span>{![...snapshot.state.zones, ...(snapshot.state.serviceZones ?? [])].some(zone => zone.id === selected.id) ? "Avant achat" : selectedKind === "culture" ? (zoneCultures ? !!selectedRun : snapshot.activeRun) && "active" in selected && selected.active ? "Culture en cours" : "active" in selected && !selected.active ? "En pause" : "Zone active" : "Zone installée"}</span></div></div><div className={styles.inspectorBody}>
                  <button type="button" className={styles.primary} disabled={drawing} data-warehouse-action="configure-selected" aria-haspopup="dialog" onClick={() => openZoneMenu(selected.id)}>Actions de la zone</button>
                </div></> : <div className={styles.inspectorEmpty}><Ruler size={30} /><h3>Aucune zone sélectionnée</h3><p>Sélectionne une zone ou traces-en une nouvelle.</p>{!editing && <button className={styles.primary} type="button" disabled={locked} onClick={toggleDrawing}>Nouvelle zone</button>}</div>}
              </div> : null;

  return <div className={embedded ? undefined : styles.overlay}>
    <section ref={page} className={styles.page} aria-labelledby={`${id}-title`} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} data-warehouse-v4 data-arena-tour-surface="warehouse" onKeyDown={event => {
      if (event.key === "Escape" && pickedBuddieRef.current) { event.preventDefault(); event.stopPropagation(); pickBuddie(null); return; }
      if (embedded || shopOpen || event.target instanceof Element && event.target.closest("[data-app-dialog]")) return;
      if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); navigateWithDraftGuard(onClose); }
      if (event.key !== "Tab") return;
      const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')).filter(node => node.getClientRects().length);
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
    }}>
      <header className={styles.header}>
        <div className={styles.workshopSign}><KqPrintedArt kind="warehouse" className={styles.signMark} sizes="(max-width: 650px) 72px, 100px" /><h2 id={`${id}-title`} data-arena-tour="warehouse">Entrepôt</h2></div>
        <div className={styles.headerActions}>
          <div className={styles.cash}><small>Trésorerie</small><strong>{snapshot ? formatKqCash(snapshot.cashCents) : "—"}</strong></div>
          <button className={styles.secondary} type="button" data-warehouse-action="reserve" aria-controls={`${id}-dashboard`} disabled={!installedSummary || loading} onClick={openReserve}><Package size={17} aria-hidden="true" />Ma réserve</button>
          {room !== "culture" && <button className={styles.shopButton} type="button" data-warehouse-action="shop" data-warehouse-shop-counter disabled={!draft || locked} onClick={openShop}><ShoppingBag size={17} /><span>Boutique</span></button>}
          <button className={styles.iconButton} type="button" aria-label="Actualiser l’entrepôt" disabled={pending || removalBusy || loading || dirty || workshopBusy || !!removalAttempt.current} onClick={() => void load()}><RefreshCw size={16} /></button>
          {!embedded && <button ref={close} className={styles.iconButton} type="button" onClick={() => navigateWithDraftGuard(onClose)} aria-label="Fermer l’entrepôt"><X size={18} /></button>}
        </div>
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
          {room !== "storage" && <div className={styles.stats} aria-label="Repères de ton installation">
            <div className={styles.stat}><small><Ruler size={13} />Surface</small><strong>{summary.allocatedAreaM2} <span>m²</span><span className={styles.statTotal}> / {decimal(summary.totalAreaM2)}</span></strong><em>{dimensions.columns} × {dimensions.rows} m</em></div>
            <div className={styles.stat}><small><Package size={13} />En stock</small><strong>{typeof stock === "number" ? mass(stock) : "—"}</strong><em>{typeof storageReserved === "number" ? `${mass(Math.max(0, storageCapacity - storageReserved - reservedHarvest))} de place libre` : "Occupation en cours de lecture"}</em></div>
            <div className={styles.stat}><small><Zap size={13} />Charges / cycle</small><strong>{formatKqCash(summary.operatingCostCents)}</strong><em>{formatKqCash(summary.activeAreaM2 ? Math.round(summary.operatingCostCents / summary.activeAreaM2) : 0)}/m² actif</em></div>
            <div className={styles.stat}><small><Sprout size={13} />Récolte estimée</small><strong>{mass(summary.estimatedHarvestGrams)}</strong><em>{decimal(summary.activeAreaM2 ? summary.estimatedHarvestGrams / summary.activeAreaM2 : 0)} g/m² actif</em></div>
          </div>}
          <div role="tabpanel" id={`${id}-${room}-panel`} aria-labelledby={`${id}-${room}-tab`}>
            {room === "culture" ? <div className={styles.workspace} ref={workspace} data-warehouse-cultures={zoneCultures || undefined} data-warehouse-managing={editing || undefined}>
              {editing && zoneInspector}
              <div className={styles.sceneColumn}>
                {zoneCultures && (!directPreparation || activeRuns.length > 0) && <div className={styles.cultureToolbar}><div role="group" aria-label="Mode du plan"><button type="button" aria-pressed={editing} disabled={pending} onClick={() => { setManaging(true); setBuddiesOpen(false); }}>Aménager</button><button type="button" aria-pressed={!editing} disabled={dirty || pending} onClick={() => { setManaging(false); setBuddiesOpen(false); setDrawing(false); setAnchor(null); }}>{directPreparation ? "Suivre les cultures" : "Cultures"}</button></div><span>{activeRuns.length} en cours</span></div>}
                {!editing && cultureAccess}
                <div className={styles.zoneNavigation}>
                  <div className={styles.zones} aria-label="Sélection des zones">{planZones.map(zone => {
                    const identity = getKqZoneIdentity(draft, zone.id)!;
                    const kind = "kind" in zone ? zone.kind : "culture";
                    const ZoneIcon = ZONE_ICONS[kind];
                    const run = activeRuns.find(run => run.zoneId === zone.id);
                    const label = `${identity.label} · ${ZONE_LABELS[kind]} · ${zone.width * zone.height} m²${run ? ` · ${warehouseCultureStage(run)}` : ""}`;
                    return <button key={zone.id} type="button" className={styles.zoneChip} data-zone-kind={kind} data-zone-id={zone.id} data-warehouse-zone-chip={zone.id}
                      style={{ "--zone-color": identity.color, "--zone-tint": identity.tint } as CSSProperties}
                      title={label} aria-label={label} aria-pressed={selectedId === zone.id} aria-haspopup="dialog" onClick={() => selectZone(zone)}>
                      <span className={styles.zoneNumber}>{identity.number}</span><span className={styles.zoneArea}><ZoneIcon size={15} aria-hidden="true" />{zone.width * zone.height} m²</span>
                      <Check size={13} className={styles.zoneSelected} aria-hidden="true" />
                    </button>;
                  })}</div>
                </div>
                <KqWarehousePlan dimensions={dimensions} zones={draft.zones} serviceZones={draft.serviceZones ?? []} selectedId={selectedId} drawing={drawing} drawingKind={drawingKind} anchor={anchor} cursor={cursor} zoom={zoom} locked={locked} growing={snapshot.activeRun} managing={editing} activeZoneIds={zoneCultures ? occupiedZoneIds : undefined} lockedZoneIds={occupiedZoneIds} placingBuddie={!!pickedBuddie} buddieDrop={buddieDrop}
                  onZoom={setZoom} onCursor={setCursor} onSelectPoint={selectPoint} onDrawZone={drawZone} onConfigureZone={configureZone} onOpenZoneMenu={openZoneMenu} onKeyDown={mapKeyboard} onTransformZone={transformZone}
                  onDrawingKind={startDrawingKind}
                  onToggleDrawing={toggleDrawing} />
                <div className={styles.activity} data-warehouse-activity={snapshot.activeRun ? "growing" : "idle"}><span role="status" data-warehouse-draft={dirty || undefined}>{dirty ? draftStored ? "Brouillon conservé dans cet onglet. Enregistre pour appliquer tes modifications." : "Modifications non enregistrées. Enregistre avant de quitter pour les conserver." : snapshot.activeRun ? `${zoneCultures ? activeRuns.length : 1} culture${activeRuns.length > 1 ? "s" : ""} en cours.` : dryShort ? "Séchage à agrandir avant la récolte." : storeShort ? "Stockage à agrandir avant la récolte." : "Installation prête."}</span>{!zoneCultures && !dirty && !snapshot.legacyActiveRun && <Link className={styles.primary} href="/arene/placard?view=game">{snapshot.activeRun ? "Reprendre" : "Cultiver"}<ArrowRight size={15} /></Link>}</div>
                {error && !dirty && <p className={styles.error} role="alert"><CircleAlert size={17} />{error}</p>}
                {notice && <p className={styles.notice} role="status"><Check size={17} />{notice}</p>}
                {mainPlanReview}
                {editing && cultureAccess}
              </div>
              {!editing && zoneInspector}
              {showBuddieDock && <KqWarehouseBuddieDock buddies={buddies} runs={activeRuns} zones={draft.zones} disabled={locked} open={buddiesOpen} onOpenChange={setBuddiesOpen} selectedCode={pickedBuddie} onPick={pickBuddie} onDragPoint={dragBuddie} onDrop={dropBuddie} />}
            </div> : <>
              {dirty && <div data-postharvest-basket>{mainPlanReview}</div>}
              {room === "drying" && (issues.length ? <div role="alert"><p>{issues[0]}</p><button type="button" className={styles.secondary} onClick={() => setRoom("culture")}>Corriger les dimensions sur le plan</button></div> : <KqWarehousePostHarvest kind={room} state={draft} installedState={snapshot.state} billing={snapshot.storageClimateBilling} disabled={locked} onPlaceDevice={placeDevice} onEditZone={editServiceZone} onUpgradeZone={upgradeServiceZone} onSetStorageClimate={setStorageClimate} />)}
              {room === "processing" && <>
                <div className={styles.roomIntro}><div><h3>Mes machines</h3><p>Achète, améliore et entretiens tes machines. La transformation et la vente de tes lots se préparent dans Commerce.</p></div></div>
                {dirty ? <p className={styles.warning}>Enregistre ou annule ton aménagement avant de modifier les machines de l’atelier.</p> : <div className={styles.workshop} data-warehouse-workshop>
                  {workshopShop ? <>
                    <button className={styles.secondary} type="button" disabled={workshopBusy} onClick={() => setWorkshopShop(false)}>Retour à mes machines</button>
                    {workshopEquipmentCode === "COMPUTER" ? <KqCommerceComputer onBusyChange={setWorkshopBusy} /> : <KqEquipmentCatalogModal embedded workshopOnly initialEquipmentCode={workshopEquipmentCode} onBusyChange={setWorkshopBusy} onClose={() => setWorkshopShop(false)} />}
                  </> : <KqWarehouseEntry embedded workshopOnly initialEquipmentCode={workshopEquipmentCode} onBusyChange={setWorkshopBusy} onClose={() => setRoom("storage")} onOpenShop={openWorkshopShop} />}
                </div>}
                <div className={styles.destination} data-warehouse-commerce-access><p>{initialFlowerId ? "Retrouve le lot sélectionné pour préparer sa vente." : "Tes machines sont disponibles pour préparer tes ventes."}</p>{onOpenMarket ? <button className={styles.primary} type="button" disabled={workshopBusy || pending || dirty} onClick={() => onOpenMarket(initialFlowerId)}>Préparer la vente dans Commerce<ArrowRight size={16} aria-hidden="true" /></button> : <Link className={styles.primary} href={destinationHref("market", initialFlowerId)}>Préparer la vente dans Commerce<ArrowRight size={16} aria-hidden="true" /></Link>}</div>
              </>}
              {room === "storage" && <div>
                {dirty && <p className={styles.warning}>Enregistre ou annule ton aménagement avant de déplacer les récoltes.</p>}
                <KqHarvestStorage initialFlowerId={initialFlowerId} juryReturnView="workshop" showWarehouseLink={false} showOverviewLink={false}
                  disabled={pending || loading || workshopBusy || dirty} onBusyChange={setStorageBusy} onStorageChange={acceptStorage} onErrorChange={setStorageError}
                  onOpenMarket={(flowerId, section) => onOpenMarket ? onOpenMarket(flowerId, section) : router.push(destinationHref("market", flowerId, section))}
                  onOpenOverview={flowerId => onOpenHarvests ? onOpenHarvests(flowerId) : router.push(destinationHref("harvests", flowerId))}
                  onOpenWarehouse={flowerId => { focusedProtection.current = null; setProtectionFlowerId(flowerId ?? null); setStorageEquipmentOpen(true); }} />
                {issues.length ? <div role="alert"><p>{issues[0]}</p><button type="button" className={styles.secondary} onClick={() => setRoom("culture")}>Corriger les dimensions sur le plan</button></div> : <details className={styles.storageEquipment} data-storage-equipment open={storageEquipmentOpen} onToggle={event => setStorageEquipmentOpen(event.currentTarget.open)}>
                  <summary><strong>Aménager le stockage et le climat</strong><span>Climatisation : {formatKqCash(snapshot.storageClimateBilling?.monthlyCostCents ?? installedClimateCost)} / mois de jeu</span></summary>
                  <KqWarehousePostHarvest kind="storage" state={draft} installedState={snapshot.state} billing={snapshot.storageClimateBilling} disabled={locked} onPlaceDevice={placeDevice} onEditZone={editServiceZone} onUpgradeZone={upgradeServiceZone} onSetStorageClimate={setStorageClimate}
                    beforeConfiguration={protectionFlowerId ? <aside className={styles.protectionTarget} ref={storageProtectionTarget} tabIndex={-1} aria-label="Contenants pour le lot sélectionné" data-storage-protection-target={protectionFlowerId}>
                    <div><strong>{protectionLot?.varietyName ?? "Lot à retrouver"}</strong>
                      <p role="status">{protectionKnown ? protectionUnits > 0 ? <><b>{mass(protectionUnits / 10)}</b> sans contenant dans ce lot.</> : "Ce lot n’a plus de surplus sans contenant." : storageError || protectionLot ? "Le besoin de ce lot doit être actualisé." : !storage ? "Recherche du lot dans le stockage…" : "Ce lot n’apparaît plus dans les fleurs stockées."}</p>
                      {protectionKnown && protectionUnits > 0 ? <small>Choisis la capacité, puis enregistre le plan pour l’installer. Les contenants sont répartis entre les lots qui en ont besoin.</small> : null}
                    </div>
                    {onOpenHarvests ? <button type="button" className={styles.secondary} disabled={pending || dirty || storageBusy} data-return-protection-lot onClick={() => onOpenHarvests(protectionFlowerId)}>Revenir au lot<ArrowRight size={16} aria-hidden="true" /></button> : <Link className={styles.secondary} data-return-protection-lot aria-disabled={pending || dirty || storageBusy || undefined} onClick={event => { if (pending || dirty || storageBusy) event.preventDefault(); }} href={destinationHref("harvests", protectionFlowerId)}>Revenir au lot<ArrowRight size={16} aria-hidden="true" /></Link>}
                  </aside> : null} />
                </details>}
              </div>}
            </>}
          </div>
          <div ref={dashboard} id={`${id}-dashboard`}>
            <KqWarehouseDashboard summary={summary} installedSummary={installedSummary} condition={snapshot.cultureEquipment} projectedCondition={previewCondition} quote={quote} dirty={dirty} migrationCreditCents={snapshot.migrationCreditCents ?? 0} storageCapacity={storageCapacity} storageReserved={storageReserved} reservedHarvest={reservedHarvest} salesGramsPerDay={demand} open={dashboardOpen} onOpenChange={setDashboardOpen} tab={dashboardTab} onTabChange={setDashboardTab} />
          </div>
        </>}
      </div>
      <AppDialog open={!!menuZone && room === "culture"} onClose={closeZoneMenu} title={zoneMenuPage === "buddies" ? `Buddies · ${menuTitle}` : zoneMenuPage === "remove" ? `Supprimer · ${menuTitle}` : menuTitle} className={zoneMenuPage === "buddies" ? styles.zoneBuddiesDialog : styles.zoneActionsDialog} bodyClassName={styles.zoneMenuBody} dialogProps={{ "data-warehouse-zone-menu": true }}>
        {menuZone && snapshot && <>
          {zoneMenuPage !== "actions" && <button type="button" className={styles.secondary} data-warehouse-zone-back disabled={removalBusy} onClick={() => setZoneMenuPage("actions")}>Retour aux actions de la zone</button>}
          {zoneMenuPage === "actions" ? <>
            {removalAttempt.current && <p role="status">Une suppression reste à vérifier. Rouvre Supprimer dans la zone concernée avant de modifier le plan.</p>}
            {selectedRun ? <p role="status">Culture en cours : le matériel et le Buddie restent en place jusqu’à la récolte.</p> : null}
            {menuCondition && <dl className={styles.zoneCondition} data-warehouse-zone-condition><div><dt>Usure du matériel</dt><dd>{menuCondition.wearPercent === null ? menuSaved ? "Indisponible" : "Zone à installer" : `${decimal(menuCondition.wearPercent)} %`}</dd></div><div><dt>Rendement lié au matériel</dt><dd>{menuCondition.yieldPercent === null ? "À vérifier" : `${decimal(menuCondition.yieldPercent)} %`}</dd></div></dl>}
            <div className={styles.zoneActions}>
              {selectedRun && <ZoneDialogAction action="resume" leave className={styles.primary} disabled={dirty || locked} onClick={() => { setZoneMenuId(null); (onOpenCulture ?? router.push)(warehouseCultureHref(menuZone.id, selectedRun.leaderRunId ?? selectedRun.runId)); }}>Suivre la culture<ArrowRight size={18} aria-hidden="true" /></ZoneDialogAction>}
              <ZoneDialogAction action="furnish" className={styles.primary} disabled={selectedLocked} onClick={furnishZone}><ShoppingBag size={20} aria-hidden="true" /><span><strong>Aménager</strong><small>Choisir le matériel pour {menuZone.width * menuZone.height} m²</small></span></ZoneDialogAction>
              {!("kind" in menuZone) && <button type="button" className={styles.secondary} data-warehouse-zone-action="buddies" disabled={selectedLocked || !zoneCultures} onClick={showZoneBuddies}><Sprout size={20} aria-hidden="true" /><span><strong>Buddies</strong><small>Choisir la variété de cette zone</small></span></button>}
              <button type="button" className={styles.danger} data-warehouse-zone-action="remove" disabled={selectedLocked && removalAttempt.current?.zoneId !== menuZone.id} onClick={() => setZoneMenuPage("remove")}><Trash2 size={20} aria-hidden="true" /><span><strong>Supprimer</strong><small>{api.isTutorial || "kind" in menuZone ? "Remettre le matériel en réserve" : "Garder le matériel ou le revendre"}</small></span></button>
            </div>
            {menuCondition && menuCondition.wearPercent !== null && <details><summary>Usure et rendement</summary><p>Chaque culture terminée ajoute 5 points d’usure. Le matériel en réserve ne s’use pas.</p><p>À 50 % d’usure, le matériel conserve 75 % de son rendement potentiel. À 100 % d’usure, il en conserve 50 %.</p></details>}
            <details><summary>Dimensions et réglages de la zone</summary><ZoneDialogAction className={styles.secondary} action="dimensions" disabled={selectedLocked} onClick={() => { setZoneMenuId(null); setManaging(true); configureZone(menuZone.id); }}>Modifier les dimensions</ZoneDialogAction></details>
          </> : zoneMenuPage === "buddies" && !("kind" in menuZone) ? <div data-warehouse-zone-buddies>
            <p>Le Buddie choisi sera affecté à cette zone. Enregistre le plan pour valider.</p>
            <KqBuddieCarousel buddies={KQ_BUDDIES.filter(buddie => buddies?.ownedBuddieCodes.includes(buddie.code))} artwork={{}} selectedCode={menuZone.buddieCode ?? ""} rotation={buddies?.buddieRotation ?? null} compactRotation title="Choisir un Buddie" id={`${id}-zone-buddies`} disabled={selectedLocked} unavailableReasons={Object.fromEntries(activeRuns.map(run => [run.buddieCode, "Ce Buddie est déjà en culture."]))} onSelect={code => assignBuddie(code, menuZone, true)} />
            {notice && <p role="status" data-warehouse-buddie-save-status>{notice}</p>}
            {dirty && quoteReview(<button type="button" className={styles.primary} data-warehouse-zone-save-buddie disabled={selectedLocked || !quote || !affordable || adoptionBlocked} onClick={async () => {
              buddieSaveFocus.current = menuZone.id;
              if (!await save()) buddieSaveFocus.current = null;
            }}>{pending ? "Enregistrement…" : installLabel}</button>, true)}
            {!dirty && zoneDialogError && <p className={styles.error} role="alert">{zoneDialogError}</p>}
          </div> : zoneMenuPage === "remove" ? api.isTutorial || "kind" in menuZone ? <div className={styles.zoneRemoval} data-warehouse-removal>
            {api.isTutorial ? <p>Dans cet entraînement, le matériel reste en réserve. La zone est retirée du brouillon, sans revente. Enregistre le plan pour appliquer ce choix.</p> : "kind" in menuZone ? <>
              <p>Le matériel sera conservé en réserve. La capacité de {menuZone.kind === "storage" ? "stockage" : "séchage"} diminuera après enregistrement du plan.</p>
              <p>Le plan doit conserver assez de place pour tes lots avant de pouvoir être enregistré.</p>
            </> : null}
            <button type="button" className={styles.danger} data-warehouse-remove-confirm disabled={selectedLocked} onClick={removeSelectedZone}>Retirer cette zone du plan</button>
          </div> : <KqWarehouseZoneRemoval key={menuZone.id} zoneId={menuZone.id} revision={snapshot.revision} saved={menuSaved} dirty={dirty} locked={removalLocked || !!selectedRun} attempt={removalAttempt} onBusyChange={changeRemovalBusy} onRemoved={acceptZoneRemoval} onRemoveDraft={removeSelectedZone} /> : null}
        </>}
      </AppDialog>
      <AppDialog open={zoneDialogOpen} onClose={() => setZoneDialogId(null)} title="Équiper la zone" className={styles.zoneDialog} bodyClassName={styles.zoneDialogBody} dialogProps={{ "data-warehouse-zone-dialog": true }}>
        {zoneEditor}
        {dirty ? quoteReview(<button type="button" className={styles.primary} data-warehouse-action="save" disabled={selectedLocked || !quote || !affordable || adoptionBlocked} onClick={() => void confirmZone()}>{pending ? <LoaderCircle size={16} /> : <Check size={16} />}{pending ? "Enregistrement…" : installLabel}</button>, true)
          : <button type="button" className={styles.primary} onClick={() => setZoneDialogId(null)}>Terminer</button>}
      </AppDialog>
      {draft && <KqWarehouseShop key={shopVisit.id} open={shopOpen} initialDepartment={shopVisit.department} initialEquipmentCode={shopVisit.equipmentCode} onClose={() => { setShopOpen(false); if (room === "culture") restoreZoneFocus(); }} zone={selected && !("kind" in selected) ? selected : null} state={draft} installedState={snapshot?.state} condition={snapshot?.cultureEquipment} locked={locked} zoneLocked={!!selectedRun} onChangeZone={patch => { setManaging(true); updateZone(patch); }} onPlaceDevice={device => { placeDevice(device); setShopOpen(false); }} onOpenWorkshop={() => { setShopOpen(false); setRoom("processing"); openWorkshopShop(); }} planReview={dirty ? { payableCents: payable, onOpen: reviewPlan } : undefined} />}
    </section>
    <AppDialog open={!!pendingLeave} onClose={() => setPendingLeave(null)} title="Modifications en cours">
      <div className={styles.leaveDraft}>
        <p>{draftStored ? "Ton brouillon restera disponible dans cet onglet. Les modifications ne seront appliquées qu’après enregistrement." : "Ton brouillon ne peut pas être conservé dans ce navigateur. Enregistre pour ne pas perdre tes modifications."}</p>
        {pending && <p>Une demande est en cours. Quitter cet écran ne l’annule pas.</p>}
        {quoteReview(<button type="button" className={styles.primary} disabled={locked || !quote || !affordable || adoptionBlocked} onClick={async () => { if (await save()) continueLeaving(); }}>{pending ? "Enregistrement…" : `${installLabel} et quitter`}</button>, true)}
        <button type="button" className={styles.secondary} onClick={() => setPendingLeave(null)}>Continuer à modifier</button>
        <button type="button" className={styles.secondary} onClick={continueLeaving}>{draftStored ? "Quitter en gardant le brouillon" : "Quitter sans enregistrer"}</button>
      </div>
    </AppDialog>
  </div>;
}
