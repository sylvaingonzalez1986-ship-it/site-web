"use client";

import { KqBarChart } from "./KqVisuals";
import { KqHelpDashboard, KqHelpGrid } from "./KqHelpDashboard";
import type { KqHarvestMarketSection } from "@/lib/kanab-quest-harvests";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bell, Check, CircleAlert, Clock3, Fan, FlaskConical, Gauge, LoaderCircle, Package, RefreshCw, Ruler, Save, Scissors, ShoppingBag, Sprout, Trash2, Wrench, X, Zap } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { AppDialog, useDialogNavigation } from "@/components/ui/AppDialog";
import { navigateWithDraftGuard, registerNavigationGuard } from "@/lib/navigation-guard";
import { navigateAfterOverlays } from "@/lib/overlay-history";
import { readWarehouseDraft, writeWarehouseDraft, warehouseDraftStorage, type WarehouseDraft } from "@/lib/warehouse-draft";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqWarehouseDepartment, getKqWarehouseShopTarget, type KqWarehouseDepartment } from "@/lib/kanab-quest-warehouse-shop-target";
import { createClientRequestKey } from "@/lib/client-request-key";
import { KQ_WAREHOUSE_CATALOG, getKqWarehouseDevice, type KqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseAirCoverage, getKqWarehouseAirPlacements, type KqWarehouseAirMount, type KqWarehouseAirPlacement } from "@/lib/kanab-quest-warehouse-air";
import { adoptKqWarehouseStations, isKqWarehouseStationCode, getKqWarehouseStationCoverage, getKqWarehouseStationEntrance, KQ_WAREHOUSE_STATIONS, type KqWarehouseStationPlacement } from "@/lib/kanab-quest-warehouse-stations";
import { KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT } from "@/lib/kanab-quest-warehouse-preparations";
import { getKqWarehouseOption, getKqWarehouseZoneOptionQuantity, isKqWarehouseLegacyZoneOption, isKqWarehouseZoneDevice, type KqWarehouseHandlingCartConversion } from "@/lib/kanab-quest-warehouse-options";
import { getKqWarehouseHandling, isKqWarehouseHandlingCode, KQ_WAREHOUSE_HANDLING, placeKqWarehouseHandling } from "@/lib/kanab-quest-warehouse-handling";
import { validateKqWarehouseSpatialTransition } from "@/lib/kanab-quest-warehouse-spatial";
import { KQ_WAREHOUSE_UNLIT_CODE, isKqWarehouseZoneOperational, getKqWarehouseDimensions, getKqWarehouseQuote, getKqWarehouseStorageClimateQuote, getKqWarehouseSummary, getKqWarehouseZoneQuote, getKqWarehouseServiceZoneQuote, isKqWarehouseState, validateKqWarehouseState, type KqWarehouseState, type KqWarehouseZone, type KqWarehouseServiceZone, type KqWarehousePartition } from "@/lib/kanab-quest-warehouse";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { getKqStorageRefreshDelay } from "@/lib/kanab-quest-storage-refresh";
import type { KqStorageClimateBilling } from "@/lib/kanab-quest-business";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqCommerceComputer, KqCommerceDesk } from "./KqCommerceDesk";
import { KqWarehouseEntry } from "./KqWarehouseEntry";
import type { KqGrowRoomWarehouseEditor } from "./KqGrowRoom";
import { KqWarehouseCultureRoom } from "./KqWarehouseCultureRoom";
import type { KqGrowRoomEvent } from "./KqGrowRoomModel";
import { KqWarehouseCellMenu } from "./KqWarehouseCellMenu";
import { KqWorkshopTrimDesk } from "./KqWorkshopTrimDesk";
import { KqWarehousePostHarvest } from "./KqWarehousePostHarvest";
import { KqHarvestStorage } from "./KqHarvestStorage";
import { KqEquipmentCatalogModal } from "./KqEquipmentCatalogModal";
import { KqWarehouseCoverageDetails, type WarehouseCoverageSelection } from "./KqWarehouseCoverageDetails";
import { KqWarehouseCleaningPanel, KqWarehouseInputsPanel, KqWarehouseIrrigationPanel } from "./KqWarehouseSupplies";
import { useWarehousePreparations } from "./useWarehousePreparations";
import KqWarehouseSecurity from "./KqWarehouseSecurity";
import type { KqWarehouseSecuritySnapshot } from "@/lib/kanab-quest-warehouse-security";
import { getKqBusinessClock, KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";
import { KqChapterHeading } from "./KqChapterHeading";
import { KqProgressMeter } from "./KqVisuals";
import { WarehouseMetrics, WarehouseModules, WarehousePriorities, WarehouseProduction, WarehouseSurface, type KqWarehouseAlert, type KqWarehouseFloorModule, type KqWarehouseModule } from "./KqWarehousePilotage";
import { getKqWarehouseLightingCount } from "@/lib/kanab-quest-warehouse-fixtures";
import { KqWarehouseAirMountPicker } from "./KqWarehouseAirMountPicker";
import { KqWarehouseShop } from "./KqWarehouseShop";
import { proposeFirstWarehousePlan } from "@/lib/kanab-quest-warehouse-first-plan";
import { KqWarehousePlanQuote } from "./KqWarehousePlanQuote";
import { describeKqWarehouseAirMount, getKqWarehousePlanCultureBudget, getKqWarehousePlanPayment } from "@/lib/kanab-quest-warehouse-plan-review";
import { KqWarehouseCulture, warehouseCultureHref, warehouseCampaignHref, type KqWarehouseCultureSummary, type KqWarehouseBuddies } from "./KqWarehouseCulture";
import { KqWarehouseDashboard, type KqWarehouseDashboardTab } from "./KqWarehouseDashboard";
import { KqWarehouseBuddieDock } from "./KqWarehouseBuddieDock";
import { KqBuddieCarousel } from "./KqBuddieCarousel";
import { KqWarehouseZoneRemoval, type KqWarehouseRemovalAttempt, type KqWarehouseRemovalReceipt } from "./KqWarehouseZoneRemoval";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { getKqWarehouseZoneCondition, reconcileKqWarehouseCondition, type KqWarehouseCondition } from "@/lib/kanab-quest-warehouse-condition";
import { getKqBuddieRotationRemaining } from "@/lib/kanab-quest-buddie-rotation";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import { isKqProductionReservation, type KqProductionReservation } from "@/lib/kanab-quest-production-reservation";
import styles from "./KqWarehouse.module.css";
import board from "./KqWarehousePilotage.module.css";

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
  handlingCartConversion?: KqWarehouseHandlingCartConversion;
  productionReservation?: KqProductionReservation | null;
};
type Point = { x: number; y: number };
type FixtureTarget = { id: string; code: string; mount?: KqWarehouseAirMount; initialCell?: Point };
type ZoneKind = "culture" | "drying" | "storage";
type PlanZone = KqWarehouseZone | KqWarehouseServiceZone;
type CellBuild = { point: Point; id: string; before: KqWarehouseState; removing?: boolean };
const ZONE_LABELS: Record<ZoneKind, string> = { culture: "Culture", drying: "Séchage", storage: "Stockage" };
const mass = (grams: number) => grams >= 1_000 ? `${(grams / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg` : `${grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const decimal = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

function validateWarehouseDraft(next: KqWarehouseState, installed?: KqWarehouseState) {
  if (installed && (next.handlingPlacements?.length || installed.handlingPlacements?.length || next.stationPlacements?.some(item => item.code === "SIM-WATER-03") ||
    installed.stationPlacements?.some(item => item.code === "SIM-WATER-03"))) {
    return validateKqWarehouseSpatialTransition(installed, next);
  }
  return validateKqWarehouseState(next);
}

function ZoneDialogAction({ onClick, children, disabled, action, className, leave = false }: { onClick: () => void; children: ReactNode; disabled?: boolean; action: string; className: string; leave?: boolean }) {
  const navigate = useDialogNavigation();
  return <button type="button" className={className} disabled={disabled} data-warehouse-zone-action={action} onClick={() => leave ? navigate(onClick) : onClick()}>{children}</button>;
}

export function KqWarehouse({ embedded = false, draftOwnerId, initialSection = "equipment", initialWorkshopTab = "trim", initialFlowerId, initialEmployeeId, initialEquipmentCode, initialZoneId, initialShopOpen = false, initialShopDepartment, initialStorageEquipmentOpen = false, draftStore, onOpenCulture, onOpenMarket, onOpenHarvests, onOpenStaff, onClose, onReturnToVillage, contextNavigation }: {
  embedded?: boolean; draftOwnerId?: string; initialSection?: "equipment" | "storage" | "processing"; initialWorkshopTab?: "trim" | "machines"; initialFlowerId?: string; initialEmployeeId?: string; initialEquipmentCode?: string | null; initialZoneId?: string | null; initialShopOpen?: boolean; initialStorageEquipmentOpen?: boolean; onClose: () => void;
  draftStore?: { read: (revision: number) => KqWarehouseState | null; write: (state: KqWarehouseState) => void };
  initialShopDepartment?: KqWarehouseDepartment;
  onOpenCulture?: (href: string) => void;
  onOpenMarket?: (flowerId?: string, section?: KqHarvestMarketSection) => void;
  onOpenHarvests?: (flowerId?: string) => void;
  onOpenStaff?: () => void;
  onReturnToVillage?: () => void;
  contextNavigation?: ReactNode;
}) {
  const api = useKqTutorialApi();
  const router = useRouter();
  const id = useId().replaceAll(":", "");
  const initialTarget = getKqWarehouseShopTarget(initialEquipmentCode);
  const initialWorkshopCode = initialTarget?.kind === "workshop" ? initialTarget.code : undefined;
  const initialWorkshopShop = !!initialWorkshopCode;
  const initialDevice = initialEquipmentCode ? getKqWarehouseDevice(initialEquipmentCode) ?? KQ_WAREHOUSE_CATALOG.find(item => item.legacyCode === initialEquipmentCode) : undefined;
  const [room, setRoom] = useState<Room>(initialSection === "storage" ? "storage" : initialSection === "processing" || initialWorkshopShop ? "processing" : initialDevice?.kind === "drying" ? "drying" : initialDevice?.room ?? "culture");
  const [workshopTab, setWorkshopTab] = useState<"trim" | "extracts" | "machines">(initialWorkshopShop ? "machines" : initialWorkshopTab);
  const [floorModule, setFloorModule] = useState<KqWarehouseFloorModule>("production");
  const activeModule: KqWarehouseModule = room === "culture" ? floorModule : room;
  const [productionView, setProductionView] = useState<"priorities" | "surface" | "timeline" | "selection">(initialZoneId ? "selection" : "priorities");
  const [storageFlowerId, setStorageFlowerId] = useState(initialFlowerId);
  const [securitySnapshot, setSecuritySnapshot] = useState<KqWarehouseSecuritySnapshot | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [securityCoverage, setSecurityCoverage] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);
  const page = useRef<HTMLElement>(null);
  const workshopActions = useRef<HTMLDivElement>(null);
  const focusedInitialEquipment = useRef(false);
  const focusedInitialZone = useRef(false);
  const requestedStorageFlower = useRef(initialFlowerId);
  useEffect(() => {
    if (requestedStorageFlower.current === initialFlowerId) return;
    requestedStorageFlower.current = initialFlowerId;
    if (initialSection !== "storage" || !initialFlowerId) return;
    const frame = requestAnimationFrame(() => { setRoom("storage"); setStorageFlowerId(initialFlowerId); setProtectionFlowerId(initialFlowerId); });
    return () => cancelAnimationFrame(frame);
  }, [initialFlowerId, initialSection]);
  const [storageEquipmentOpen, setStorageEquipmentOpen] = useState(() => Boolean(
    (initialSection === "storage" && initialStorageEquipmentOpen) || (initialDevice?.room === "storage" && initialDevice.kind !== "drying"),
  ));
  const [protectionFlowerId, setProtectionFlowerId] = useState<string | null>(initialFlowerId ?? null);
  const storageProtectionTarget = useRef<HTMLElement>(null);
  const [snapshot, setSnapshot] = useState<KqWarehouseViewSnapshot | null>(null);
  const acceptWallet = useCallback((cashCents: number) => {
    if (Number.isSafeInteger(cashCents)) setSnapshot(current => current ? { ...current, cashCents } : current);
  }, []);
  const operationsAvailable = !!snapshot && (!api.isTutorial || ["cleaning", "irrigation", "inputs"].includes(activeModule));
  const preparations = useWarehousePreparations(acceptWallet, operationsAvailable);
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
  const [managing, setManaging] = useState<boolean | null>(null);
  const [roomEvent, setRoomEvent] = useState<KqGrowRoomEvent | null>(null);
  const [zoneDialogId, setZoneDialogId] = useState<string | null>(null);
  const [zoneMenuId, setZoneMenuId] = useState<string | null>(null);
  const [zoneMenuPage, setZoneMenuPage] = useState<"actions" | "buddies" | "remove">("actions");
  const [cellBuild, setCellBuild] = useState<CellBuild | null>(null);
  const [movingBuild, setMovingBuild] = useState<CellBuild | null>(null);
  const [fixtureTarget, setFixtureTarget] = useState<FixtureTarget | null>(null);
  const [coverageSelection, setCoverageSelection] = useState<WarehouseCoverageSelection | null>(null);
  const stationTarget = fixtureTarget && isKqWarehouseStationCode(fixtureTarget.code) ? { ...fixtureTarget, code: fixtureTarget.code } : null;
  const handlingTarget: KqGrowRoomWarehouseEditor["handlingTarget"] = fixtureTarget && isKqWarehouseHandlingCode(fixtureTarget.code)
    ? { ...fixtureTarget, code: fixtureTarget.code } : undefined;
  const airTarget = stationTarget || handlingTarget ? null : fixtureTarget;
  const [showAirCoverage, setShowAirCoverage] = useState(false);
  const [selectedPartitionId, setSelectedPartitionId] = useState<string | null>(null);
  const [saveOutcome, setSaveOutcome] = useState<"idle" | "unknown" | "conflict">("idle");
  const saveOutcomeRef = useRef(saveOutcome);
  const [reloadPlanOpen, setReloadPlanOpen] = useState(false);
  const zoneOrigin = useRef<HTMLElement | null>(null);
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
  const placementPanel = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const [planSaveError, setPlanSaveError] = useState<{ draft: KqWarehouseState; message: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [placementCode, setPlacementCode] = useState<string | null>(null);
  const placementOption = placementCode ? getKqWarehouseOption(placementCode) : undefined;
  const placementDevice = placementCode ? getKqWarehouseDevice(placementCode) : undefined;
  const placementZoneDevice = placementOption && isKqWarehouseZoneDevice(placementOption) ? placementOption : undefined;
  const placementName = placementZoneDevice?.name ?? placementOption?.description.split(". ")[0] ?? placementDevice?.name ?? "Paroi";
  const drawingKind: ZoneKind | null = placementOption || placementDevice?.kind === "lighting" ? "culture"
    : placementDevice?.kind === "drying" || placementDevice?.kind === "storage" ? placementDevice.kind : null;
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<KqWarehouseDashboardTab>("performance");
  const dashboard = useRef<HTMLDivElement>(null);
  const planReview = useRef<HTMLDivElement>(null);
  const firstInstallationAction = useRef<HTMLElement | null>(null);
  const focusedInstallationRevision = useRef<number | null>(null);
  const [firstInstallationRevision, setFirstInstallationRevision] = useState<number | null>(null);
  const [workshopShop, setWorkshopShop] = useState(initialShopOpen && initialWorkshopShop);
  const [resumeExtraction, setResumeExtraction] = useState(false);
  const [extractionLot, setExtractionLot] = useState({ flowerId: initialFlowerId, lotId: undefined as string | undefined });
  const [shopOpen, setShopOpen] = useState(initialShopOpen && !initialWorkshopShop && initialTarget?.kind !== "storage-climate");
  const [shopVisit, setShopVisit] = useState({ id: 0, department: initialShopDepartment ?? getKqWarehouseDepartment(room), equipmentCode: initialShopOpen ? initialEquipmentCode : undefined });
  const [workshopEquipmentCode, setWorkshopEquipmentCode] = useState<string | undefined>(initialWorkshopCode);
  const [workshopBusy, setWorkshopBusy] = useState(false);
  const mutation = useRef(false);
  const readVersion = useRef(0);
  const mounted = useRef(true);
  const request = useRef<{ fingerprint: string; key: string; body: string } | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  const inspector = useRef<HTMLDivElement>(null);
  const context = useRef<HTMLElement>(null);
  useBodyScrollLock(!embedded);

  const load = useCallback(async (signal?: AbortSignal, background = false, authoritative = false) => {
    if (mutation.current || saveOutcomeRef.current === "unknown" || saveOutcomeRef.current !== "idle" && !authoritative) return false;
    const version = ++readVersion.current;
    if (!background) setLoading(true);
    try {
      const response = await api.request("/api/arena/placard/warehouse", { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "L’entrepôt est momentanément indisponible.");
      if (!body || !isKqWarehouseState(body.state) || !Number.isSafeInteger(body.revision) || !Number.isSafeInteger(body.cashCents) || body.productionReservation !== undefined && !isKqProductionReservation(body.productionReservation)) throw new Error("Les informations de l’entrepôt sont incomplètes.");
      if (!signal?.aborted && version === readVersion.current && mounted.current) {
        let saved: WarehouseDraft | null = null;
        if (owner && !authoritative) saved = readWarehouseDraft(warehouseDraftStorage(), owner);
        const restored = authoritative ? body.state : draftStore?.read(body.revision) ?? (saved && saved.revision === body.revision ? saved.state : body.state);
        setStaleDraft(saved && saved.revision !== body.revision ? saved : null);
        if (saved?.revision === body.revision) setNotice("Ton brouillon a été restauré. Enregistre pour appliquer les modifications.");
        loadedOwner.current = owner;
        setSnapshot(body); setDraft(restored); setSelectedId(current => [...restored.zones, ...(restored.serviceZones ?? [])].some((zone: PlanZone) => zone.id === current) ? current : api.isTutorial ? restored.zones[0]?.id ?? restored.serviceZones?.[0]?.id ?? null : null); setError("");
        if (authoritative) {
          request.current = null; saveOutcomeRef.current = "idle"; setSaveOutcome("idle");
          setCellBuild(null); setMovingBuild(null); setSelectedPartitionId(null); setPlacementCode(null); setFixtureTarget(null); setNotice("Plan enregistré rechargé.");
          if (owner) writeWarehouseDraft(warehouseDraftStorage(), owner, null);
        }
        return true;
      }
    } catch (reason) {
      if (!signal?.aborted && version === readVersion.current && mounted.current) setError(reason instanceof Error ? reason.message : "Lecture impossible.");
    } finally { if (!signal?.aborted && version === readVersion.current && mounted.current) setLoading(false); }
    return false;
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

  const { quote, issues } = useMemo(() => {
    const issues = draft ? validateWarehouseDraft(draft, snapshot?.state) : [];
    if (!draft || !snapshot || issues.length) return { quote: null, issues };
    try {
      return { quote: getKqWarehouseQuote(draft, snapshot.state), issues };
    } catch (error) {
      return { quote: null, issues: [error instanceof Error ? error.message : "Le devis du plan est indisponible."] };
    }
  }, [draft, snapshot]);
  const airPlan = useMemo(() => draft && !issues.length ? { ...draft, airPlacements: getKqWarehouseAirPlacements(draft) } : null, [draft, issues]);
  const airCoverage = useMemo(() => airPlan ? getKqWarehouseAirCoverage(airPlan) : undefined, [airPlan]);
  const stationCoverage = useMemo(() => draft && !issues.length ? getKqWarehouseStationCoverage(draft) : undefined, [draft, issues]);
  const preparingStation = !!stationTarget;
  const stationPlan = useMemo(() => draft && preparingStation && !issues.length ? adoptKqWarehouseStations(draft) : null, [draft, preparingStation, issues]);
  const previewCondition = useMemo(() => quote && snapshot?.cultureEquipment
    ? reconcileKqWarehouseCondition(snapshot.state, quote.nextState, snapshot.cultureEquipment, { requestKey: "preview", fundedFraction: 1 })
    : snapshot?.cultureEquipment, [quote, snapshot]);
  const summary = useMemo(() => quote ? getKqWarehouseSummary(quote.nextState, 2, 2, previewCondition, undefined, 1) : snapshot ? getKqWarehouseSummary(snapshot.state, 2, 2, previewCondition, undefined, 1) : null, [quote, snapshot, previewCondition]);
  const cultureBudget = useMemo(() => snapshot ? getKqWarehousePlanCultureBudget(quote?.nextState ?? snapshot.state, snapshot.productionReservation?.zoneId) : undefined, [quote, snapshot]);
  const installedCultureBudget = useMemo(() => snapshot && quote ? getKqWarehousePlanCultureBudget(snapshot.state, snapshot.productionReservation?.zoneId) : undefined, [quote, snapshot]);
  const installedSummary = useMemo(() => snapshot ? getKqWarehouseSummary(snapshot.state, 2, 2, snapshot.cultureEquipment, undefined, 1) : undefined, [snapshot]);
  const savedPlan = snapshot?.state;
  const installedAir = useMemo(() => savedPlan ? getKqWarehouseAirCoverage({ ...savedPlan, airPlacements: getKqWarehouseAirPlacements(savedPlan) }) : undefined, [savedPlan]);
  function openDashboard(tab: KqWarehouseDashboardTab) {
    setDashboardTab(tab);
    setDashboardOpen(true);
    requestAnimationFrame(() => {
      const target = dashboard.current?.querySelector<HTMLButtonElement>(`[data-warehouse-summary-tab="${tab}"]`);
      target?.scrollIntoView({ block: "center", behavior: "instant" });
      target?.focus({ preventScroll: true });
    });
  }
  function reviewPlan() {
    setShopOpen(false);
    setManaging(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      planReview.current?.scrollIntoView({ block: "center", behavior: "instant" });
      planReview.current?.focus({ preventScroll: true });
    }));
  }
  const planZones = draft ? [...draft.zones, ...(draft.serviceZones ?? [])] : [];
  const placementTargets = drawingKind ? planZones.filter(zone => ("kind" in zone ? zone.kind : "culture") === drawingKind) : [];
  const dimensions = getKqWarehouseDimensions(draft ?? snapshot?.state);
  const selected = planZones.find(zone => zone.id === selectedId);
  const menuZone = planZones.find(zone => zone.id === zoneMenuId);
  useEffect(() => {
    if (!initialZoneId || initialShopOpen || initialSection === "storage" || room !== "culture" || !snapshot || selected?.id !== initialZoneId || focusedInitialZone.current) return;
    const frame = requestAnimationFrame(() => {
      const panel = inspector.current;
      if (!panel) return;
      focusedInitialZone.current = true;
      const action = panel.querySelector<HTMLElement>('[data-warehouse-zone-prepare]:not(:disabled), [data-warehouse-action="configure-selected"]:not(:disabled)') ?? panel;
      action.scrollIntoView({ block: "center", behavior: "instant" });
      action.focus({ preventScroll: true });
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
  const zoneQuote = selected && !issues.length ? "kind" in selected ? getKqWarehouseServiceZoneQuote(selected) : getKqWarehouseZoneQuote(selected, 2, previewCondition, draft?.airPlacements ? airCoverage?.zones[selected.id] : undefined, stationCoverage?.zones[selected.id], 1) : null;
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
  const editing = dirty || (managing ?? (!directPreparation && (!zoneCultures || Boolean(initialZoneId || initialEquipmentCode) || !draft?.zones.some(zone => zone.buddieCode) && !activeRuns.length)));
  const firstInstallationConfirmed = directPreparation && firstInstallationRevision !== null
    && snapshot?.revision === firstInstallationRevision && !dirty && activeRuns.length === 0;
  useEffect(() => {
    if (!firstInstallationConfirmed || pending || focusedInstallationRevision.current === firstInstallationRevision) return;
    const frame = requestAnimationFrame(() => {
      firstInstallationAction.current?.focus();
      focusedInstallationRevision.current = firstInstallationRevision;
    });
    return () => cancelAnimationFrame(frame);
  }, [firstInstallationConfirmed, firstInstallationRevision, pending]);
  const showBuddieDock = !directPreparation && zoneCultures && room === "culture" && !editing && !shopOpen;
  const activeCampaign = activeRuns.find(run => run.campaignId);
  const reservation = snapshot?.productionReservation;
  const selectedProduction = reservation?.zoneId === selectedId ? reservation : null;
  const campaignZones = draft?.zones.filter(zone => isKqWarehouseZoneOperational(zone) && zone.buddieCode && zone.id !== reservation?.zoneId) ?? [];
  const campaignReady = !!campaignZones.length && !!buddies && !activeRuns.length
    && new Set(campaignZones.map(zone => zone.buddieCode)).size === campaignZones.length
    && campaignZones.every(zone => buddies.ownedBuddieCodes.includes(zone.buddieCode!)
      && !getKqBuddieRotationRemaining(zone.buddieCode!, buddies.buddieRotation?.recentBuddieCodes ?? []));
  const occupiedZoneIds = activeRuns.flatMap(run => run.zoneId ? [run.zoneId] : []);
  const lockedZoneIds = reservation ? [...occupiedZoneIds, reservation.zoneId] : occupiedZoneIds;
  const selectedRun = activeRuns.find(run => run.zoneId === selectedId);
  const busyLocked = pending || removalBusy || loading || workshopBusy || storageBusy || securityBusy || !!preparations.irrigationPreparing || (!zoneCultures && !!snapshot?.activeRun) || !!snapshot?.legacyActiveRun;
  const saveLocked = busyLocked || !!removalAttempt.current || saveOutcome === "conflict";
  const removalLocked = busyLocked || saveOutcome !== "idle";
  const locked = removalLocked || !!removalAttempt.current;
  const selectedLocked = locked || !!selectedRun || !!selectedProduction;
  // Commercial occupancy locks the plan geometry; its equipment can still be quoted.
  const selectedEquipmentLocked = locked || !!selectedRun;
  const reservedBefore = snapshot?.state.zones.find(zone => zone.id === reservation?.zoneId);
  const reservedDraft = draft?.zones.find(zone => zone.id === reservation?.zoneId);
  function serviceChanged(zoneId: string) {
    if (!quote) return false;
    const before = snapshot?.state.airService?.[zoneId];
    const after = quote.nextState.airService?.[zoneId];
    const beforeStation = snapshot?.state.stationService?.[zoneId];
    const afterStation = quote.nextState.stationService?.[zoneId];
    return (beforeStation?.waterAreaM2 ?? 0) !== (afterStation?.waterAreaM2 ?? 0)
      || before?.qualityPoints !== after?.qualityPoints || before?.coveredAreaM2 !== after?.coveredAreaM2
      || before?.powerMilliWatts !== after?.powerMilliWatts;
  }
  const occupiedServiceChanged = occupiedZoneIds.some(zoneId => {
    if (serviceChanged(zoneId)) return true;
    const previous = snapshot?.state.zones.find(item => item.id === zoneId);
    const next = draft?.zones.find(item => item.id === zoneId);
    return !!previous?.optionCodes?.some(code => isKqWarehouseStationCode(code) && !next?.optionCodes?.includes(code));
  });
  const productionEquipmentChanged = !!reservedBefore && !!reservedDraft && (
    reservedBefore.lightingCode !== reservedDraft.lightingCode || reservedBefore.airCode !== reservedDraft.airCode || serviceChanged(reservedBefore.id)
    || [...(reservedBefore.optionCodes ?? [])].sort().join(",") !== [...(reservedDraft.optionCodes ?? [])].sort().join(","));
  const productionInstallationBlocked = productionEquipmentChanged && reservation?.equipmentEditable !== true;
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
    if (!snapshot || !draft || !quote || payable === null || !dirty || saveLocked || !affordable || adoptionBlocked || productionInstallationBlocked || occupiedServiceChanged || mutation.current) return false;
    const body = { expectedRevision: snapshot.revision, state: draft, expectedCostCents: quote.totalCostCents };
    const fingerprint = JSON.stringify(body);
    if (saveOutcome === "unknown" && request.current?.fingerprint !== fingerprint) return false;
    if (request.current?.fingerprint !== fingerprint) {
      const key = createClientRequestKey();
      request.current = { fingerprint, key, body: JSON.stringify({ ...body, requestKey: key }) };
    }
    const attempt = request.current;
    mutation.current = true; readVersion.current += 1; setPending(true); setError(""); setPlanSaveError(null); setNotice("");
    let rejected = false, conflict = false;
    try {
      const response = await api.request("/api/arena/placard/warehouse", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: attempt.body, signal: AbortSignal.timeout(20_000) });
      rejected = !response.ok && response.status >= 400 && response.status < 500 && response.status !== 408;
      conflict = response.status === 409;
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cet aménagement n’a pas pu être enregistré.");
      if (!isKqWarehouseState(result.state) || !Number.isSafeInteger(result.revision) || result.revision <= snapshot.revision || !Number.isSafeInteger(result.cashCents) || result.cashCents < 0 || result.productionReservation !== undefined && !isKqProductionReservation(result.productionReservation)) throw new Error("Le reçu est incomplet. Réessaie la même confirmation pour vérifier son résultat.");
      if (mounted.current) {
        setSnapshot(result); setDraft(result.state); setPlacementCode(null); setFixtureTarget(null);
        if (directPreparation && !snapshot.state.zones.some(zone => zone.id !== reservation?.zoneId && isKqWarehouseZoneOperational(zone))
          && result.state.zones.some((zone: KqWarehouseZone) => zone.id !== result.productionReservation?.zoneId && isKqWarehouseZoneOperational(zone))) {
          setFirstInstallationRevision(result.revision);
        }
        saveOutcomeRef.current = "idle"; setSaveOutcome("idle");
        setNotice(quote.totalCostCents > 0 ? `Aménagement installé. ${formatKqCash(payable)} prélevés${creditUsed ? ` et ${formatKqCash(creditUsed)} de crédit de reprise utilisés` : ""}.` : "Plan enregistré sans prélèvement.");
      }
      request.current = null;
      api.notify("kq:equipment-updated"); api.notify("kq:storage-updated");
      if (productionEquipmentChanged) api.notify("kq:staff-updated");
      if (owner && mounted.current) writeWarehouseDraft(warehouseDraftStorage(), owner, null);
      return true;
    } catch (reason) {
      if (mounted.current) {
        const outcome = conflict ? "conflict" : rejected ? "idle" : "unknown";
        saveOutcomeRef.current = outcome; setSaveOutcome(outcome);
        if (rejected && !conflict) request.current = null;
        setPlanSaveError({ draft, message: reason instanceof Error ? reason.message : "Enregistrement impossible." });
      }
      return false;
    }
    finally { mutation.current = false; if (mounted.current) setPending(false); }
  };

  function updateZone(patch: Partial<KqWarehouseZone & KqWarehouseServiceZone>) {
    if (!selected || selectedEquipmentLocked || selectedProduction && Object.keys(patch).some(key => !["lightingCode", "airCode", "optionCodes"].includes(key))) return;
    setDraft(current => current ? "kind" in selected
      ? { ...current, serviceZones: (current.serviceZones ?? []).map(zone => zone.id === selected.id ? { ...zone, ...patch } : zone) }
      : { ...current, zones: current.zones.map(zone => zone.id === selected.id ? { ...zone, ...patch } : zone) } : current);
    setNotice("");
  }
  function transformZone(zoneId: string, patch: { x: number; y: number; width: number; height: number }): boolean {
    if (!draft || !editing || locked || lockedZoneIds.includes(zoneId) || !planZones.some(zone => zone.id === zoneId)) return false;
    const next = {
      ...draft,
      zones: draft.zones.map(zone => zone.id === zoneId ? { ...zone, ...patch } : zone),
      ...(draft.serviceZones === undefined ? {} : { serviceZones: draft.serviceZones.map(zone => zone.id === zoneId ? { ...zone, ...patch } : zone) }),
    };
    const validation = validateWarehouseDraft(next, snapshot?.state);
    if (validation.length) { setError(validation[0]); return false; }
    setDraft(next); setSelectedId(zoneId); setError(""); setNotice("");
    return true;
  }
  function placePartition(point: Point) {
    if (!draft || locked || !editing || (!movingBuild && placementCode !== "PARTITION")) return;
    const wallId = movingBuild?.id ?? createClientRequestKey();
    const partitions = draft.partitions ?? [];
    const next = { ...draft, partitions: movingBuild
      ? partitions.map(wall => wall.id === wallId ? { ...wall, ...point } : wall)
      : [...partitions, { id: wallId, ...point, axis: "x" as const, length: 1 }] };
    const issue = validateWarehouseDraft(next, snapshot?.state)[0];
    if (issue) { setError(issue); return; }
    setDraft(next); setSelectedId(null); setSelectedPartitionId(wallId); setPlacementCode(null);
    setCellBuild({ point, id: wallId, before: movingBuild?.before ?? draft });
    setMovingBuild(null); setError(""); setNotice("");
  }
  function selectPartition(id: string) {
    if (!draft || locked || pickedBuddieRef.current || drawingKind) return;
    const wall = draft.partitions?.find(wall => wall.id === id);
    if (!wall) return;
    if (movingBuild) { placePartition({ x: wall.x, y: wall.y }); return; }
    rememberZoneFocus();
    setManaging(true); setSelectedId(null); setSelectedPartitionId(id); setMovingBuild(null);
    setCellBuild({ point: { x: wall.x, y: wall.y }, id, before: draft }); setError(""); setNotice("");
  }
  function updatePartition(patch: Partial<Pick<KqWarehousePartition, "x" | "y" | "axis" | "length">>) {
    if (!draft || !cellBuild?.id || locked) return;
    if (patch.length !== undefined && (!Number.isSafeInteger(patch.length) || patch.length < 1)) return;
    const next = { ...draft, partitions: draft.partitions?.map(wall => wall.id === cellBuild.id ? { ...wall, ...patch } : wall) };
    const issue = validateWarehouseDraft(next, snapshot?.state)[0];
    if (issue) { setError(issue); return; }
    setDraft(next); setError("");
  }
  function cancelCellBuild() {
    if (locked) return;
    const operation = cellBuild ?? movingBuild;
    if (operation?.before) setDraft(operation.before);
    setCellBuild(null); setMovingBuild(null); setSelectedId(null); setSelectedPartitionId(null); setError(""); restoreZoneFocus();
  }
  function inspectCoverage(kind: WarehouseCoverageSelection["kind"], itemId: string, scroll = false) {
    setSecurityCoverage(false);
    setCoverageSelection({ kind, id: itemId }); setShowAirCoverage(kind === "air");
    if (kind === "air" || kind === "station") {
      const station = draft?.stationPlacements?.find(item => item.id === itemId);
      setRoom("culture");
      setFloorModule(kind === "air" ? "ventilation" : station?.code === "SIM-HYGIENE-03" ? "cleaning" : "irrigation");
    }
    if (scroll) showDrawingPlan();
  }
  function inspectLighting(zoneId: string, index?: number) {
    setSelectedId(zoneId);
    setCoverageSelection({ kind: "lighting", id: zoneId, index });
    setShowAirCoverage(false); setSecurityCoverage(false); setRoom("culture"); setFloorModule("production"); setProductionView("selection");
  }
  function finishPlacement(next: KqWarehouseState, zoneId: string) {
    const issue = validateWarehouseDraft(next, snapshot?.state)[0];
    if (issue) { setError(issue); return false; }
    if (snapshot && placementOption && isKqWarehouseLegacyZoneOption(placementOption.code)) {
      try { getKqWarehouseQuote(next, snapshot.state); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "La réserve disponible ne couvre pas cette zone."); return false; }
    }
    setDraft(next); setSelectedId(zoneId); setPlacementCode(null); setError("");
    setNotice("Placement ajouté au devis.");
    if (placementZoneDevice) {
      setCoverageSelection({ kind: "zone", id: zoneId });
      reviewPlan();
    } else if (placementDevice?.kind === "lighting") {
      inspectLighting(zoneId);
      showDrawingPlan();
    }
    else inspectCoverage("zone", zoneId);
    return true;
  }
  function withSelectedProduct(zone: KqWarehouseZone): KqWarehouseZone {
    if (placementOption) return { ...zone, optionCodes: [
      ...(zone.optionCodes ?? []).filter(code => getKqWarehouseOption(code)?.family !== placementOption.family),
      placementOption.code,
    ] };
    if (placementDevice?.kind === "lighting") return { ...zone, lightingCode: placementDevice.code,
      active: zone.lightingCode === KQ_WAREHOUSE_UNLIT_CODE || zone.active };
    return zone;
  }
  function equipTarget(zone: PlanZone) {
    if (!draft || !drawingKind || locked || occupiedZoneIds.includes(zone.id)) return false;
    if ("kind" in zone) {
      if (reservation || zone.kind !== placementDevice?.kind) return false;
      return finishPlacement({ ...draft, serviceZones: draft.serviceZones?.map(item =>
        item.id === zone.id ? { ...item, deviceCode: placementDevice.code } : item) }, zone.id);
    }
    if (drawingKind !== "culture") return false;
    return finishPlacement({ ...draft, zones: draft.zones.map(item => item.id === zone.id ? withSelectedProduct(item) : item) }, zone.id);
  }
  function drawZone(start: Point, end: Point, kind: ZoneKind): boolean {
    if (!draft || locked || !editing || kind !== drawingKind || pickedBuddieRef.current) return false;
    const rectangle = { id: createClientRequestKey(), name: `${ZONE_LABELS[kind]} ${planZones.length + 1}`, x: Math.min(end.x, start.x), y: Math.min(end.y, start.y), width: Math.abs(end.x - start.x) + 1, height: Math.abs(end.y - start.y) + 1 };
    if (kind === "culture") {
      const zone = withSelectedProduct({ ...rectangle, active: false, lightingCode: KQ_WAREHOUSE_UNLIT_CODE, airCode: "SIM-AIR-01" });
      return finishPlacement({ ...draft, airPlacements: getKqWarehouseAirPlacements(draft), zones: [...draft.zones, zone] }, zone.id);
    }
    if (reservation || placementDevice?.kind !== kind) return false;
    return finishPlacement({ ...draft, serviceZones: [...(draft.serviceZones ?? []), { ...rectangle, kind, deviceCode: placementDevice.code }] }, rectangle.id);
  }
  function showDrawingPlan(includePlacementControls = false) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const useSidePanel = includePlacementControls && window.matchMedia("(min-width: 681px)").matches;
      const target = workspace.current?.querySelector(useSidePanel ? "[data-fixture-placement]" : "[data-warehouse-iso-viewport]");
      target?.scrollIntoView({ block: useSidePanel ? "start" : "center", behavior: "instant" });
      workspace.current?.querySelector<HTMLElement>("[data-warehouse-iso-map]")?.focus({ preventScroll: true });
    }));
  }
  function chooseProduct(code: string) {
    if (!draft || locked) return;
    const device = getKqWarehouseDevice(code);
    setShopOpen(false); setZoneMenuId(null); setZoneDialogId(null); setCoverageSelection(null); setMovingBuild(null); setCellBuild(null);
    setSelectedPartitionId(null); setFixtureTarget(null); setPlacementCode(null);
    setManaging(true); setBuddiesOpen(false); pickBuddie(null); setError(""); setNotice("");
    if (device?.kind === "climate" && device.room === "storage") {
      setRoom("storage"); setStorageEquipmentOpen(true);
      if (!draft.serviceZones?.some(zone => zone.kind === "storage")) {
        setError("Place d’abord un rangement pour climatiser le stockage."); return;
      }
      setStorageClimate(code); return;
    }
    setRoom("culture");
    if (isKqWarehouseHandlingCode(code)) {
      const existing = draft.handlingPlacements?.find(item => item.code === code);
      startFixture({ id: code, code, initialCell: existing }); return;
    }
    if (isKqWarehouseStationCode(code)) {
      startFixture({ id: createClientRequestKey(), code, initialCell: code === "SIM-HYGIENE-03" ? getKqWarehouseStationEntrance(dimensions) : { x: 0, y: 0 } });
      return;
    }
    if (device?.kind === "air") {
      if (!airPlan) { setError("Corrige le plan avant de placer un ventilateur."); return; }
      startFixture({ id: createClientRequestKey(), code }); return;
    }
    if (reservation && (device?.kind === "drying" || device?.kind === "storage")) {
      setError("Le séchage et le stockage sont réservés à la production commerciale."); return;
    }
    setPlacementCode(code); setCoverageSelection(null); setShowAirCoverage(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const panel = placementPanel.current;
      if (!panel || panel.dataset.warehousePlacement !== code) return;
      if (panel.querySelector("[data-warehouse-build-target]")) {
        panel.scrollIntoView({ block: "start", behavior: "instant" });
        panel.focus({ preventScroll: true });
      } else showDrawingPlan();
    }));
  }
  function placeDevice(device: KqWarehouseDevice) { chooseProduct(device.code); }
  function startFixture(target: FixtureTarget) {
    setFixtureTarget(target); setCoverageSelection(null);
    const destinationModule = target.code === "SIM-HYGIENE-03" ? "cleaning" : isKqWarehouseStationCode(target.code) ? "irrigation" : isKqWarehouseHandlingCode(target.code) ? "production" : "ventilation";
    setFloorModule(destinationModule); setShowAirCoverage(destinationModule === "ventilation"); setManaging(true); setPlacementCode(null);
    setMovingBuild(null); setSelectedPartitionId(null); setRoom("culture"); setSecurityCoverage(false); pickBuddie(null);
    setError(""); setNotice("");
    showDrawingPlan(!isKqWarehouseHandlingCode(target.code));
  }
  function previewAirPlacement(point: Point) {
    if (!airPlan || !airTarget) return null;
    const { id, code, mount } = airTarget;
    const placement: KqWarehouseAirPlacement = { id, code, ...point, ...(mount ? { mount } : {}) };
    const placements = airPlan.airPlacements.some(item => item.id === id)
      ? airPlan.airPlacements.map(item => item.id === id ? placement : item) : [...airPlan.airPlacements, placement];
    const state = { ...airPlan, airPlacements: placements };
    return { placement, state, error: validateWarehouseDraft(state, snapshot?.state)[0] };
  }
  function previewStationPlacement(point: Point) {
    if (!stationPlan || !stationTarget) return null;
    const placement: KqWarehouseStationPlacement = { id: stationTarget.id, code: stationTarget.code, ...point };
    const stations = stationPlan.stationPlacements ?? [];
    const stationPlacements = stations.some(item => item.id === placement.id)
      ? stations.map(item => item.id === placement.id ? placement : item) : [...stations, placement];
    const state = { ...stationPlan, stationPlacements };
    return { placement, state, error: validateWarehouseDraft(state, snapshot?.state)[0] };
  }
  function placeFixture(point: Point, focusMap = false) {
    if (locked || !fixtureTarget) return;
    if (draft && handlingTarget) {
      const state = placeKqWarehouseHandling(draft, { code: handlingTarget.code, ...point });
      const problem = validateWarehouseDraft(state, snapshot?.state)[0];
      if (problem) { setError(problem); return; }
      setDraft(state); setFixtureTarget(null); setCoverageSelection(null); setError("");
      setNotice(`${KQ_WAREHOUSE_HANDLING[handlingTarget.code].name} · colonne ${point.x + 1}, ligne ${point.y + 1}.`);
      reviewPlan(); return;
    }
    const preview = stationTarget ? previewStationPlacement(point) : previewAirPlacement(point);
    if (!preview) return;
    if (preview.error) { setError(preview.error); return; }
    setDraft(preview.state); setFixtureTarget(null); setError("");
    if (stationTarget?.code === "SIM-HYGIENE-03") {
      inspectCoverage("station", fixtureTarget.id); setFloorModule("cleaning");
      setNotice("Sas placé à la porte sud dans le brouillon. Confirme le devis pour l’installer.");
      reviewPlan(); return;
    }
    inspectCoverage(stationTarget ? "station" : "air", fixtureTarget.id, focusMap);
    setNotice("Emplacement ajouté au devis.");
  }
  function removeFixture(kind: "station" | "air", id: string) {
    if (!draft || locked) return;
    if (kind === "station") setDraft({ ...draft, stationPlacements: draft.stationPlacements?.filter(item => item.id !== id) });
    else if (airPlan) setDraft({ ...airPlan, airPlacements: airPlan.airPlacements.filter(item => item.id !== id) });
    setFixtureTarget(null); setCoverageSelection(null); setError("");
    setNotice("Retrait dans le brouillon. Le matériel reviendra en réserve à l’enregistrement.");
  }
  function configureZone(zoneId: string) {
    if (locked || pickedBuddieRef.current || lockedZoneIds.includes(zoneId) || !planZones.some(zone => zone.id === zoneId)) return;
    setManaging(true); setSelectedId(zoneId); setSelectedPartitionId(null); setPlacementCode(null); setError(""); setZoneDialogId(zoneId);
  }
  function openZoneMenu(zoneId: string) {
    if (drawingKind || pickedBuddieRef.current || !planZones.some(zone => zone.id === zoneId)) return;
    if (movingBuild) { const zone = planZones.find(zone => zone.id === zoneId)!; placePartition({ x: zone.x, y: zone.y }); return; }
    rememberZoneFocus();
    setFloorModule("production"); setProductionView("selection");
    setSelectedId(zoneId); setSelectedPartitionId(null); setZoneMenuId(zoneId); setZoneMenuPage("actions"); setError("");
  }
  function rememberZoneFocus() {
    const trigger = document.activeElement;
    zoneOrigin.current = trigger instanceof HTMLElement && workspace.current?.contains(trigger) ? trigger : null;
  }
  function restoreZoneFocus() {
    requestAnimationFrame(() => {
      const target = zoneOrigin.current?.isConnected ? zoneOrigin.current : workspace.current?.querySelector<HTMLElement>("[data-warehouse-iso-map]");
      target?.focus({ preventScroll: true });
    });
  }
  function closeZoneMenu() {
    if (removalBusy) { closeAfterRemoval.current = true; return; }
    setZoneMenuId(null); restoreZoneFocus();
  }
  function furnishZone() {
    if (menuZone) openZoneEquipment(menuZone);
  }
  function openZoneEquipment(zone: PlanZone) {
    if (selectedEquipmentLocked) return;
    setZoneMenuId(null); setManaging(true); setPlacementCode(null); setCoverageSelection(null);
    setShopVisit(current => ({ id: current.id + 1, department: "kind" in zone ? zone.kind : "lighting", equipmentCode: undefined }));
    setShopOpen(true);
  }
  function showZoneBuddies() {
    if (!menuZone || "kind" in menuZone || selectedLocked) return;
    setZoneMenuPage("buddies"); setNotice("");
    requestAnimationFrame(() => page.current?.querySelector<HTMLButtonElement>("[data-warehouse-zone-buddies] [data-buddie-select]:not(:disabled)")?.focus({ preventScroll: true }));
  }
  function editServiceZone(zoneId: string) {
    if (locked || !draft?.serviceZones?.some(zone => zone.id === zoneId)) return;
    setManaging(true); setRoom("culture"); setSelectedId(zoneId); setSelectedPartitionId(null); setPlacementCode(null); setError(""); setZoneDialogId(zoneId);
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
    if (!zoneId || saveLocked || !!selectedRun || !!selectedProduction) return;
    if (!dirty || await save()) setZoneDialogId(current => current === zoneId ? null : current);
  }
  function removeSelectedZone() {
    if (!draft || !selected || selectedLocked) return;
    const next = "kind" in selected ? { ...draft, serviceZones: (draft.serviceZones ?? []).filter(zone => zone.id !== selected.id) } : { ...draft, zones: draft.zones.filter(zone => zone.id !== selected.id) };
    if ("kind" in selected && !next.serviceZones?.some(zone => zone.kind === "storage")) delete next.storageClimateCode;
    setDraft(next);
    setPlacementCode(null); setError(""); setNotice("");
    setSelectedId(null); setZoneDialogId(null); setZoneMenuId(null);
    restoreZoneFocus();
  }
  function acceptZoneRemoval(value: KqWarehouseViewSnapshot, receipt: KqWarehouseRemovalReceipt) {
    setSnapshot(value); setDraft(value.state); setSelectedId(null); setZoneMenuId(null); setZoneDialogId(null);
    setPlacementCode(null); setError(""); setStaleDraft(null);
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
    setSelectedPartitionId(null);
    if (zone && (editing || api.isTutorial)) { openZoneMenu(zone.id); return; }
    setZoneMenuId(null);
    if (!editing) {
      clearCoverage(); setRoom(zone && "kind" in zone ? zone.kind : "culture"); setFloorModule("production");
      setProductionView(zone ? "selection" : "priorities");
    }
  }
  function pickBuddie(code: string | null) {
    if (code && (!showBuddieDock || !buddiesOpen)) return;
    pickedBuddieRef.current = code;
    setPickedBuddie(code);
    if (code) { setPlacementCode(null); setFixtureTarget(null); setCoverageSelection(null); }
    else setBuddieDrop(null);
  }
  function placementError(code: string, zone?: PlanZone, fromMenu = false): string {
    if ((fromMenu ? zoneMenuPage !== "buddies" || zoneMenuId !== zone?.id : !showBuddieDock || !buddiesOpen) || locked || mutation.current) return "Placement momentanément indisponible.";
    if (!buddies?.ownedBuddieCodes.includes(code)) return "Ce Buddie ne figure pas dans ta collection.";
    if (!buddies.buddieRotation) return "La disponibilité des Buddies doit être vérifiée.";
    if (activeRuns.some(run => run.buddieCode === code)) return "Ce Buddie est déjà en culture.";
    if (getKqBuddieRotationRemaining(code, buddies.buddieRotation?.recentBuddieCodes ?? [])) return "Ce Buddie est encore en rotation.";
    if (!zone || "kind" in zone) return "Dépose la carte dans une zone de culture.";
    if (zone.id === reservation?.zoneId) return "Cette zone est réservée à la production autonome.";
    if (draft?.zones.some(item => item.id === reservation?.zoneId && item.buddieCode === code)) return "Ce Buddie reste affecté à la zone réservée au personnel. Libère cette zone dans Personnel avant de le déplacer.";
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
    const viewport = workspace.current?.querySelector("[data-warehouse-iso-map]");
    const hit = document.elementFromPoint(point.x, point.y);
    if (!viewport || !hit || !viewport.contains(hit)) return;
    for (const polygon of viewport.querySelectorAll<SVGPolygonElement>("[data-grow-floor-zone]")) {
      const matrix = polygon.getScreenCTM();
      if (matrix && polygon.isPointInFill(new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse()))) {
        const zoneId = polygon.dataset.growFloorZone;
        return planZones.find(zone => zone.id === zoneId);
      }
    }
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
  function resetDraft() {
    if (pending || saveOutcome !== "idle" || !snapshot) return;
    setDraft(snapshot.state); setStaleDraft(null); setPlacementCode(null); setFixtureTarget(null); setCellBuild(null); setMovingBuild(null);
    setSelectedPartitionId(null); clearCoverage(); setError(""); setNotice("Modifications du plan annulées.");
    if (!snapshot.state.zones.some(zone => zone.id === selectedId) && !snapshot.state.serviceZones?.some(zone => zone.id === selectedId)) setSelectedId(null);
  }
  function continueLeaving() {
    if (mutation.current || saveOutcomeRef.current === "unknown") return;
    if (!pendingLeave) return;
    const action = pendingLeave;
    navigateAfterOverlays(() => { setPendingLeave(null); action(); });
  }
  function clearCoverage() {
    setCoverageSelection(null); setShowAirCoverage(false); setSecurityCoverage(false);
  }
  function openModule(next: KqWarehouseModule) {
    if (workshopBusy || storageBusy || securityBusy || preparations.irrigationPreparing) return;
    const nextRoom = next === "drying" || next === "storage" || next === "processing" ? next : "culture";
    setBuddiesOpen(false);
    pickBuddie(null);
    setPlacementCode(null);
    setFixtureTarget(null);
    setMovingBuild(null);
    setRoomEvent(null); clearCoverage();
    if (nextRoom === "culture") {
      setFloorModule(next as KqWarehouseFloorModule);
      if (next === "production") setProductionView("timeline");
    }
    if (nextRoom === "drying" || nextRoom === "storage") {
      const stations = draft?.serviceZones?.filter(zone => zone.kind === nextRoom);
      setSelectedId(stations?.find(zone => zone.id === selectedId)?.id ?? stations?.[0]?.id ?? null);
    }
    setRoom(nextRoom);
    if (nextRoom === "processing") requestAnimationFrame(() => {
      workshopActions.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
  }

  function focusContext() {
    requestAnimationFrame(() => {
      context.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 680px)").matches) context.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function selectProductionZone(zoneId: string) {
    openModule("production"); setProductionView("selection"); setSelectedId(zoneId);
    setRoomEvent({ id: `inspect:${zoneId}`, zoneId, gesture: "inspect" });
  }
  function selectCamera(id: string | null) {
    setCameraId(id); setCoverageSelection(null); setShowAirCoverage(false);
  }
  function openCamera(id?: string) {
    if (workshopBusy || storageBusy || securityBusy || preparations.irrigationPreparing || fixtureTarget || placementCode) return;
    setRoom("culture"); setFloorModule("security"); selectCamera(id ?? null); setSecurityCoverage(!!id); focusContext();
  }
  function setMode(amend: boolean) {
    if (workshopBusy || storageBusy || securityBusy || preparations.irrigationPreparing || pending || !amend && dirty) return;
    setManaging(amend); setBuddiesOpen(false); pickBuddie(null);
    if (amend) {
      setRoom("culture");
      if (floorModule === "production") setProductionView("selection");
      if (!selectedId) setSelectedId(draft?.zones[0]?.id ?? draft?.serviceZones?.[0]?.id ?? null);
    } else {
      setPlacementCode(null); setFixtureTarget(null); setMovingBuild(null); setSelectedPartitionId(null);
      setProductionView(selectedId ? "selection" : "priorities");
    }
  }

  function inspectRoomStation(id: string) {
    const station = snapshot?.state.serviceZones?.find(zone => zone.id === id);
    if (room === "culture" && (pickedBuddieRef.current || !station)) {
      selectZone(planZones.find(zone => zone.id === id));
      return;
    }
    const growingRun = !station && activeRuns.find(run => run.zoneId === id && run.stageIndex < 5);
    setRoomEvent(growingRun ? { id: `inspect:${growingRun.runId}`, zoneId: id, gesture: "inspect" } : null);
    setSelectedId(id);
    setRoom(station?.kind ?? "culture");
    if (!station) { setFloorModule("production"); setProductionView("selection"); }
    clearCoverage();
  }
  const currentService = room === "drying" || room === "storage"
    ? snapshot?.state.serviceZones?.find(zone => zone.id === selectedId && zone.kind === room)
      ?? snapshot?.state.serviceZones?.find(zone => zone.kind === room)
    : undefined;
  function openWorkshopShop(code?: string, fromExtraction = false) {
    setResumeExtraction(fromExtraction); setWorkshopTab("machines"); setWorkshopEquipmentCode(code); setWorkshopShop(true);
  }
  function closeWorkshopShop() {
    setWorkshopShop(false);
    if (resumeExtraction) { setResumeExtraction(false); setWorkshopTab("extracts"); }
  }
  function openTargetedShop(department: KqWarehouseDepartment, equipmentCode?: string) {
    setShopVisit(current => ({ id: current.id + 1, department, equipmentCode }));
    setShopOpen(true);
  }
  const openShop = () => {
    if (room === "processing") { openWorkshopShop(); return; }
    openTargetedShop(getKqWarehouseDepartment(room));
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
  const installLabel = saveOutcome === "unknown" ? "Vérifier / réessayer la confirmation" : payable === null ? "Devis à vérifier" : payable > 0 ? `Installer le plan · ${formatKqCash(payable)}` : "Enregistrer le plan · 0 €";
  const draftClimateCost = draft ? getKqWarehouseStorageClimateQuote(draft).monthlyCents : 0;
  const installedClimateCost = snapshot ? getKqWarehouseStorageClimateQuote(snapshot.state).monthlyCents : 0;
  const protectionLot = storage?.lots.find(lot => lot.flowerId === protectionFlowerId);
  const protectionUnits = protectionLot?.projection.capacity?.overflowUnits;
  const protectionKnown = !storageError && typeof protectionUnits === "number" && Number.isFinite(protectionUnits) && protectionUnits >= 0;

  const shouldReadLots = !api.isTutorial && activeModule === "production" && !editing && typeof stock === "number" && stock > 0;
  useEffect(() => {
    if (!shouldReadLots) return;
    const controller = new AbortController();
    let latest: { snapshot: KqStorageSnapshot; received: number } | null = null;
    const poll = startArenaVisiblePolling(async () => {
      try {
        const response = await api.request("/api/arena/placard/storage", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) });
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.lots) || !Number.isFinite(Date.parse(result.serverNow))) throw new Error("Échéances d’affinage indisponibles.");
        if (!controller.signal.aborted) { latest = { snapshot: result, received: performance.now() }; acceptStorage(result); }
      } catch {
        if (!controller.signal.aborted) setStorageError("Échéances d’affinage indisponibles.");
      }
    }, () => getKqStorageRefreshDelay(latest?.snapshot ?? null, latest ? performance.now() - latest.received : 0));
    const unsubscribe = api.subscribe(["kq:storage-updated", "arena:progress-updated"], () => void poll.refresh());
    return () => { controller.abort(); poll(); unsubscribe(); };
  }, [acceptStorage, api, shouldReadLots]);

  const workInProgress = pending || workshopBusy || storageBusy || securityBusy || !!preparations.irrigationPreparing;
  const guidePlanReady = !api.isTutorial && !!snapshot && !loading && !error && saveOutcome === "idle";
  const guideCleanPlan = guidePlanReady && !dirty;
  const calendarOrigin = preparations.state?.calendarOrigin;
  const sampledTime = preparations.state?.serverNow ?? storage?.serverNow;
  const [clockSample, setClockSample] = useState<{ sampledTime: string; now: number } | null>(null);
  useEffect(() => {
    if (!sampledTime) return;
    const start = Date.parse(sampledTime);
    if (!Number.isFinite(start)) return;
    const received = performance.now();
    const tick = () => { if (!document.hidden) setClockSample({ sampledTime, now: start + performance.now() - received }); };
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [sampledTime]);
  const serverTime = clockSample && clockSample.sampledTime === sampledTime ? clockSample.now : Date.parse(sampledTime ?? "");
  const calendar = calendarOrigin && Number.isFinite(Date.parse(calendarOrigin)) && Number.isFinite(serverTime) ? getKqBusinessClock(calendarOrigin, serverTime) : null;
  const cleaning = preparations.state?.cleaning;
  const cleaningStep = cleaning?.vacuum.pending ? "vacuum" : cleaning?.mop.pending ? "mop" : undefined;
  const cleaningPending = cleaningStep ? cleaning?.[cleaningStep].pending : null;
  const currentSecurity = securitySnapshot?.layoutRevision === snapshot?.revision ? securitySnapshot : null;
  const monitoring = currentSecurity?.monitoring;
  const paidUntil = Date.parse(monitoring?.paidUntil ?? "");
  const alerts: KqWarehouseAlert[] = [];
  const storedGrams = snapshot?.storageReservedGrams;
  const harvestReservation = snapshot?.reservedHarvestGrams;
  const availableStorage = typeof storedGrams === "number" && (!snapshot?.activeRun || typeof harvestReservation === "number")
    ? savedActualStorageCapacity - storedGrams - (harvestReservation ?? 0) : null;
  const outage = activeRuns.find(run => run.powerOutage);
  const scheduledCleaning = !cleaningPending && cleaning && Number.isFinite(serverTime) ? [cleaning.vacuum, cleaning.mop]
    .filter(step => step.completedAt).map(step => step.expiresAt ? Date.parse(step.expiresAt) : serverTime).filter(Number.isFinite) : [];
  const cleaningDeadline = Math.min(...scheduledCleaning);
  const airGap = activeRuns.find(run => run.zoneId && installedAir?.zones[run.zoneId] && installedAir.zones[run.zoneId].coveredAreaM2 < installedAir.zones[run.zoneId].areaM2)?.zoneId;
  const airGapCoverage = airGap ? installedAir?.zones[airGap] : undefined;
  if (outage) alerts.push({ id: "power", level: "urgent", title: "Coupure en culture", detail: "Cette culture subit une coupure de courant. Reprends le cycle pour traiter l’incident.", action: "Voir la culture", module: "production", zoneId: outage.zoneId ?? undefined });
  if (availableStorage !== null && availableStorage < 0) alerts.push({ id: "storage", level: "urgent", title: "Stockage saturé", detail: `${mass(-availableStorage)} dépassent la capacité des contenants et de la réserve prévue pour les cultures.`, action: "Gérer le stockage", module: "storage" });
  if (cleaningDeadline <= serverTime + KQ_GAME_DAY_MS) alerts.push({ id: "cleaning", level: "soon", title: cleaningDeadline <= serverTime ? "Préparation de nettoyage expirée" : "Nettoyage à renouveler", detail: "Au prochain semis, le bonus des passages arrivés à échéance ne s’appliquera plus.", action: "Ouvrir le nettoyage", module: "cleaning" });
  if (monitoring && (monitoring.status === "suspended" || monitoring.status === "active" && paidUntil <= serverTime + KQ_GAME_DAY_MS)) alerts.push({ id: "security", level: "soon", title: monitoring.status === "suspended" ? "Télésurveillance suspendue" : "Télésurveillance bientôt à échéance", detail: monitoring.status === "suspended" ? "Vérifie le tarif et l’échéance avant de réactiver le service." : "Vérifie le tarif et la trésorerie avant le renouvellement.", action: "Gérer le service", module: "security" });
  if (savedPlan && airGap && airGapCoverage) alerts.push({ id: "air", level: "soon", title: "Extraction d’air à vérifier", detail: `${getKqZoneIdentity(savedPlan, airGap)?.label ?? "Culture"} · ${airGapCoverage.coveredAreaM2} sur ${airGapCoverage.areaM2} m² desservis. Le bonus dépend de la surface couverte.`, action: "Localiser la zone", module: "ventilation", zoneId: airGap });
  if (installedSummary && installedSummary.estimatedHarvestGrams > installedSummary.dryingCapacityGrams) alerts.push({ id: "drying", level: "info", title: "Séchage à prévoir", detail: `Si la récolte atteint le potentiel matériel, il manquerait ${mass(installedSummary.estimatedHarvestGrams - installedSummary.dryingCapacityGrams)} de capacité pour tout sécher en une fois.`, action: "Voir le séchage", module: "drying" });

  function openPriority(alert: KqWarehouseAlert) {
    if (alert.zoneId && alert.module === "production") selectProductionZone(alert.zoneId);
    else {
      openModule(alert.module);
      if (alert.zoneId) { setSelectedId(alert.zoneId); setShowAirCoverage(true); }
    }
    focusContext();
  }

  function openPriorities() {
    openModule("production"); setProductionView("priorities"); focusContext();
  }
  function selectLot(flowerId: string) {
    setStorageFlowerId(flowerId); openModule("storage");
    requestAnimationFrame(() => page.current?.querySelector<HTMLElement>("[data-warehouse-wide-activity]")?.scrollIntoView({ block: "start", behavior: "instant" }));
  }

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
                  <details className={styles.zoneSettings} data-warehouse-zone-settings key={selected.id}><summary>Dimensions et position</summary><div>
                  <div className={styles.dimensions}><label className={styles.field}>Largeur (m)<input type="number" min="1" max={dimensions.columns - selected.x} step="1" value={selected.width} disabled={selectedLocked} onChange={event => updateZone({ width: Number(event.target.value) })} /></label><label className={styles.field}>Profondeur (m)<input type="number" min="1" max={dimensions.rows - selected.y} step="1" value={selected.height} disabled={selectedLocked} onChange={event => updateZone({ height: Number(event.target.value) })} /></label></div>
                  <div className={styles.dimensions}><label className={styles.field}>Position X (m)<input type="number" min="0" max={dimensions.columns - selected.width} step="1" value={selected.x} disabled={selectedLocked} onChange={event => updateZone({ x: Number(event.target.value) })} /></label><label className={styles.field}>Position Y (m)<input type="number" min="0" max={dimensions.rows - selected.height} step="1" value={selected.y} disabled={selectedLocked} onChange={event => updateZone({ y: Number(event.target.value) })} /></label></div>
                  </div></details>
                  <div className={styles.zoneModules} data-warehouse-zone-modules>
                    <p>{zoneQuote?.devices.map(line => `${line.quantity} × ${line.device.name}`).join(" · ") || ("kind" in selected
                      ? getKqWarehouseDevice(selected.deviceCode)?.name
                      : getKqWarehouseDevice(selected.lightingCode)?.name ?? "Éclairage à installer")}</p>
                    {!("kind" in selected) && <>
                      {!!selected.optionCodes?.length && <ul>{selected.optionCodes.map(code => <li key={code}>{getKqWarehouseOption(code)?.name ?? code} <button type="button" className={styles.secondary} disabled={selectedEquipmentLocked} aria-label={`Retirer ${getKqWarehouseOption(code)?.name ?? code}`} onClick={() => updateZone({ optionCodes: selected.optionCodes?.filter(item => item !== code) })}>Retirer</button></li>)}</ul>}
                      <label className={styles.check}><input type="checkbox" checked={selected.active} disabled={selectedLocked || selected.lightingCode === KQ_WAREHOUSE_UNLIT_CODE} onChange={event => updateZone({ active: event.target.checked })} />Active à la prochaine culture</label>
                    </>}
                    <button className={styles.secondary} type="button" disabled={selectedEquipmentLocked} onClick={() => { setZoneDialogId(null); openZoneEquipment(selected); }}>Choisir en boutique</button>
                  </div>
                  {zoneQuote && <div className={styles.quote} data-warehouse-zone-quote>
                      <div className={styles.quoteLine}><span>Coût neuf / m²</span><strong>{formatKqCash(zoneQuote.costPerM2Cents)}/m²</strong></div>
                      <div className={styles.quoteLine}><span>{selectedKind === "culture" ? "Potentiel matériel" : "Capacité totale"}</span><strong data-warehouse-capacity-grams={selectedCapacity}>{mass(selectedCapacity)}<small>
                        {decimal(selectedCapacityPerM2)} g/m²
                        {"volumeLitres" in zoneQuote && zoneQuote.volumeLitres > 0 && <> · {decimal(zoneQuote.volumeLitres)} L de contenants</>}
                        {"usableSurfaceM2" in zoneQuote && zoneQuote.usableSurfaceM2 > 0 && <> · {decimal(zoneQuote.usableSurfaceM2)} m² de filet utile</>}
                      </small></strong></div>
                      {"qualityBonus" in zoneQuote && <div className={styles.quoteLine}><span>Qualité au départ</span><strong data-warehouse-zone-quality={zoneQuote.qualityBonus}>+{zoneQuote.qualityBonus} pts<small>Récolte potentielle +{zoneQuote.yieldBonusPercent} %</small></strong></div>}
                      {"operatingCostCents" in zoneQuote && <div className={styles.quoteLine}><span>Charges par cycle</span><strong>{formatKqCash(zoneQuote.operatingCostCents)}<small>{formatKqCash(Math.round(zoneQuote.operatingCostCents / zoneQuote.areaM2))}/m²</small></strong></div>}
                  </div>}
                  <ZoneDialogAction className={styles.danger} action="remove" disabled={selectedLocked} onClick={() => { setZoneDialogId(null); setZoneMenuId(selected.id); setZoneMenuPage("remove"); }}><Trash2 size={13} />Supprimer cette zone</ZoneDialogAction>
                </div>
  </> : null;

  const cultureAccess = !firstInstallationConfirmed && zoneCultures && (activeRuns.length > 0 || snapshot?.state.zones.some(isKqWarehouseZoneOperational)) && !dirty && (directPreparation || !editing) && <div className={`${styles.campaignLaunch} ${directPreparation ? styles.preparationAccess : ""}`} data-warehouse-campaign>
                  <span>{directPreparation ? <><strong>{activeRuns.length ? "Tes cultures en cours" : "Prêt à cultiver ?"}</strong><small>{activeRuns.length ? `${activeRuns.length} culture${activeRuns.length > 1 ? "s" : ""} à suivre.` : "Choisis tes Buddies et tes cartes sur la page de préparation."}</small></> : activeCampaign ? "Une campagne · tous tes Buddies" : activeRuns.length ? "Termine tes cultures en cours" : `${campaignZones.length} Buddie${campaignZones.length > 1 ? "s" : ""} placé${campaignZones.length > 1 ? "s" : ""} pour la campagne`}</span>
                  {dirty ? <button type="button" className={styles.primary} data-warehouse-campaign-action="review" onClick={reviewPlan}>Voir le devis du plan</button>
                    : activeCampaign && !locked ? onOpenCulture
                      ? <button type="button" className={styles.primary} data-warehouse-campaign-action="resume" data-sylvain-target="next-open" onClick={() => onOpenCulture(warehouseCampaignHref(activeCampaign.leaderRunId ?? activeCampaign.runId))}>{directPreparation ? "Reprendre mes cultures" : "Reprendre la campagne"}<ArrowRight size={15} /></button>
                      : <Link className={styles.primary} data-warehouse-campaign-action="resume" data-sylvain-target="next-open" href={warehouseCampaignHref(activeCampaign.leaderRunId ?? activeCampaign.runId)}>{directPreparation ? "Reprendre mes cultures" : "Reprendre la campagne"}<ArrowRight size={15} /></Link>
                      : directPreparation && !locked ? onOpenCulture
                        ? <button type="button" className={styles.primary} data-sylvain-target={activeRuns.length ? "next-open" : "prepare-open"} data-warehouse-campaign-action={activeRuns.length ? "resume" : "start"} onClick={() => onOpenCulture(warehouseCampaignHref(undefined, !activeRuns.length))}>{activeRuns.length ? "Reprendre mes cultures" : "Préparer mes cultures"}<ArrowRight size={15} /></button>
                        : <Link className={styles.primary} data-sylvain-target={activeRuns.length ? "next-open" : "prepare-open"} data-warehouse-campaign-action={activeRuns.length ? "resume" : "start"} href={warehouseCampaignHref(undefined, !activeRuns.length)}>{activeRuns.length ? "Reprendre mes cultures" : "Préparer mes cultures"}<ArrowRight size={15} /></Link>
                      : campaignReady && !locked ? onOpenCulture
                        ? <button type="button" className={styles.primary} data-warehouse-campaign-action="start" onClick={() => onOpenCulture(warehouseCampaignHref())}>Lancer mes cultures<ArrowRight size={15} /></button>
                        : <Link className={styles.primary} data-warehouse-campaign-action="start" href={warehouseCampaignHref()}>Lancer mes cultures<ArrowRight size={15} /></Link>
                        : <button type="button" className={styles.primary} disabled>{directPreparation ? "Préparer mes cultures" : "Lancer mes cultures"}</button>}
                </div>;

  const firstPlan = editing && !dirty && !placementCode && !fixtureTarget && !staleDraft && draft ? proposeFirstWarehousePlan(draft) : null;
  const firstPreparationHref = warehouseCampaignHref(undefined, true);
  const firstPreparationAction = { ref: (node: HTMLElement | null) => { firstInstallationAction.current = node; },
    className: styles.primary, "data-warehouse-campaign-action": "start", "data-sylvain-target": "prepare-open" };
  const firstPreparationLabel = <>Préparer mes cultures<ArrowRight size={15} aria-hidden="true" /></>;
  const purchaseActions = <div className={styles.buttons}>
    <button className={styles.primary} type="button" disabled={!dirty || saveLocked || !quote || !affordable || adoptionBlocked || productionInstallationBlocked || occupiedServiceChanged} data-warehouse-action="save" data-sylvain-target="install-confirm" onClick={() => void save()}>{pending ? <LoaderCircle size={15} /> : <Save size={15} />} {pending ? "Enregistrement…" : installLabel}</button>
    {room === "culture" && <button className={styles.secondary} type="button" data-warehouse-continue-shop disabled={locked} onClick={openShop}><ShoppingBag size={15} /> Continuer en boutique</button>}
    <button className={styles.secondary} type="button" disabled={pending || saveOutcome !== "idle"} data-warehouse-action="reset" onClick={resetDraft}>Annuler les modifications du plan</button>
  </div>;
  const quoteReview = (actions: ReactNode, compact = false) => snapshot && draft ? <KqWarehousePlanQuote previousState={snapshot.state} draftState={draft} quote={quote} cashCents={snapshot.cashCents} migrationCreditCents={snapshot.migrationCreditCents ?? 0} cultureBudget={cultureBudget} installedCultureBudget={installedCultureBudget} potentialGrams={summary && installedSummary ? { installed: installedSummary.estimatedHarvestGrams, proposed: summary.estimatedHarvestGrams } : undefined} compact={compact} aside={<>
    {zoneDialogError && <p className={styles.error} role="alert">{zoneDialogError}</p>}
    {planSaveError && planSaveError.draft === draft && <p className={styles.error} role="alert" data-warehouse-plan-error>{planSaveError.message}</p>}
    {occupiedServiceChanged && <p role="status">Attends la fin des cultures dont la couverture change pour installer ce plan.</p>}
    {saveOutcome === "unknown" && <p role="status">La réponse est incertaine. Réessaie la même confirmation pour vérifier si le plan a été enregistré. L’aperçu reste verrouillé jusque-là.</p>}
    {saveOutcome === "conflict" && <div><p role="alert">Le plan enregistré a changé. Ton aperçu est conservé ; recharge le plan actuel avant de continuer.</p><button type="button" className={styles.secondary} data-warehouse-reconcile disabled={pending} onClick={() => setReloadPlanOpen(true)}>Recharger le plan enregistré</button></div>}
    {productionEquipmentChanged && <div data-production-equipment-review>
      <p>Le matériel choisi s’appliquera automatiquement aux prochains cycles autonomes.</p>
      {productionInstallationBlocked && <><p role="status">{reservation?.equipmentEditable === false ? "Des lots ou tâches utilisent encore le circuit. Suspends les nouveaux cycles dans Personnel, puis laisse terminer et vendre les lots avant d’installer le matériel." : "La disponibilité du circuit doit être vérifiée avant l’installation."} Ton choix reste dans le devis.</p>
        <button type="button" className={styles.secondary} disabled={locked} onClick={async () => {
          setLoading(true);
          try {
            const response = await api.request("/api/arena/placard/staff", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
            if (!response.ok) throw new Error("La disponibilité du personnel n’a pas pu être actualisée.");
            await load(undefined, true);
          } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Actualisation impossible."); }
          finally { if (mounted.current) setLoading(false); }
        }}>Actualiser la disponibilité</button></>}
    </div>}
    {quote && (draftClimateCost > 0 || installedClimateCost > 0) && <p className={styles.basketClimateCost}><Zap size={13} aria-hidden="true" />Climatisation après installation : {formatKqCash(draftClimateCost)} / mois de jeu{draftClimateCost !== installedClimateCost ? ` (actuellement ${formatKqCash(installedClimateCost)})` : ""}. Facturée séparément.</p>}
  </>}>{actions}</KqWarehousePlanQuote> : null;
  const mainPlanReview = dirty && <div className={styles.planActions} ref={planReview} tabIndex={-1} data-warehouse-plan-actions data-warehouse-plan-review aria-label="Devis de toutes les modifications du plan">{quoteReview(purchaseActions)}</div>;

  const warehouseEditor: KqGrowRoomWarehouseEditor = {
    selectedId: currentService?.id ?? selectedId,
    managing: room === "culture" && editing,
    locked: locked || room !== "culture",
    lockedZoneIds,
    selectedPartitionId,
    drawingKind,
    placingBuddie: !!pickedBuddie,
    buddieDrop,
    interactionHint: handlingTarget ? "Choisis une case libre. Au clavier, utilise les flèches puis Entrée." : airTarget ? "Choisis une case pour le ventilateur. Au clavier, utilise les flèches puis Entrée." : movingBuild || placementCode === "PARTITION" ? "Choisis une case pour la paroi. Au clavier, utilise les flèches puis Entrée." : undefined,
    handlingTarget: handlingTarget ?? undefined,
    onMoveHandling: editing && !locked ? chooseProduct : undefined,
    previewHandling: draft && handlingTarget ? point => validateWarehouseDraft(placeKqWarehouseHandling(draft, { code: handlingTarget.code, ...point }), snapshot?.state)[0] : undefined,
    stationTarget: stationTarget ?? undefined,
    selectedStationId: coverageSelection?.kind === "station" ? coverageSelection.id : undefined,
    selectedAirId: coverageSelection?.kind === "air" ? coverageSelection.id : undefined,
    lightingZoneId: coverageSelection?.kind === "lighting" ? coverageSelection.id : undefined,
    lightingIndex: coverageSelection?.kind === "lighting" ? coverageSelection.index : undefined,
    onInspectLighting: !workInProgress ? inspectLighting : undefined,
    effectZoneId: coverageSelection?.kind === "zone" ? coverageSelection.id : undefined,
    onInspectStation: !workInProgress ? id => { inspectCoverage("station", id); focusContext(); } : undefined,
    onInspectAir: !workInProgress ? id => { inspectCoverage("air", id); focusContext(); } : undefined,
    previewStation: stationTarget ? point => {
      const preview = previewStationPlacement(point);
      return preview ? { placement: preview.placement, coverage: preview.error ? undefined : getKqWarehouseStationCoverage(preview.state), error: preview.error } : {};
    } : undefined,
    placementCode: placementCode ?? undefined,
    targetZoneIds: placementTargets.filter(zone => !occupiedZoneIds.includes(zone.id)).map(zone => zone.id),
    onTargetZone: drawingKind ? zoneId => { const target = planZones.find(zone => zone.id === zoneId); return !!target && equipTarget(target); } : undefined,
    onDrawZone: drawZone,
    onTransformZone: transformZone,
    onOpenZoneMenu: zoneId => selectZone(planZones.find(zone => zone.id === zoneId)),
    onDeselect: room === "culture" ? () => selectZone() : undefined,
    onSelectPartition: selectPartition,
    onChooseCell: fixtureTarget ? placeFixture : movingBuild || placementCode === "PARTITION" ? placePartition : undefined,
    airPlacements: editing || draft?.airPlacements !== undefined ? airPlan?.airPlacements : undefined,
    airCoverage: room === "culture" && showAirCoverage ? airCoverage : undefined,
    airTarget: airTarget ?? undefined,
    security: currentSecurity ? {
      cameras: currentSecurity.cameras,
      alarmInstalled: currentSecurity.alarm === "installed",
      selectedCameraId: cameraId,
      showCoverage: securityCoverage && !dirty,
      onCameraPick: openCamera,
      onAlarmPick: () => openCamera(),
    } : undefined,
    cleaning: cleaningStep,
    cleaningPlayer: cleaningPending?.workChoice === "player",
    cleaningStartedAt: cleaningPending?.startsAt,
    irrigationPreparing: preparations.irrigationPreparing,
    previewAir: airTarget ? point => {
      const preview = previewAirPlacement(point);
      return preview ? { placement: preview.placement, coverage: preview.error ? undefined : getKqWarehouseAirCoverage(preview.state), error: preview.error } : {};
    } : undefined,
    onCancel: () => {
      setPlacementCode(null);
      if (movingBuild) cancelCellBuild();
      if (fixtureTarget) { setFixtureTarget(null); setError(""); }
      pickBuddie(null);
    },
  };
  const warehouseScene = snapshot && draft ? <KqWarehouseCultureRoom
    plan={editing ? draft : snapshot.state} runs={activeRuns}
    reservedZoneId={reservation?.zoneId} stockGrams={stock}
    event={roomEvent?.gesture !== "inspect" || roomEvent.zoneId === selectedId ? roomEvent : null}
    onSelect={inspectRoomStation} warehouseEditor={warehouseEditor}
  /> : null;

  const zonePreparationHref = directPreparation && !locked && !dirty && activeRuns.length === 0 && selected && !("kind" in selected)
    && selected.id !== reservation?.zoneId && snapshot?.state.zones.some(zone => zone.id === selected.id && isKqWarehouseZoneOperational(zone))
    ? warehouseCampaignHref(undefined, true, selected.id) : null;
  const zonePreparationProps = { className: styles.primary, "data-warehouse-zone-prepare": true, "data-sylvain-target": "prepare-zone" };
  const zonePreparationLabel = <><Sprout size={17} aria-hidden="true" />{selected && "buddieCode" in selected && selected.buddieCode ? "Changer mon Buddie" : "Choisir mon Buddie"}</>;
  const zonePreparation = zonePreparationHref && (onOpenCulture
    ? <button {...zonePreparationProps} type="button" onClick={() => onOpenCulture(zonePreparationHref)}>{zonePreparationLabel}</button>
    : <Link {...zonePreparationProps} href={zonePreparationHref}>{zonePreparationLabel}</Link>);
  const zoneInspector = snapshot && draft ? <div className={styles.inspector} ref={inspector} tabIndex={-1} data-warehouse-zone-inspector data-warehouse-zone-summary={editing && !!selected || undefined}>
                {selected && !("kind" in selected) && (!editing || selectedProduction) ? <KqWarehouseCulture key={selected.id} state={draft} zone={selected} productionReservation={selectedProduction} condition={previewCondition} zoneIdentity={selectedIdentity} run={selectedRun} previewBuddieCode={pickedBuddie} runs={activeRuns} buddies={buddies} disabled={selectedProduction ? locked : locked || !affordable || adoptionBlocked} dirty={dirty} legacy={!!snapshot.legacyActiveRun} onReviewPlan={reviewPlan} onManage={openShop} onEquipment={() => openZoneEquipment(selected)} completedRunId={snapshot.completedRuns?.find(run => run.zoneId === selected.id)?.runId} prepareAction={zonePreparation} showBuddieDock={showBuddieDock} /> : selected ? <><div className={styles.inspectorHeader} style={{ backgroundColor: selectedIdentity?.tint }}><div><h3><b className={styles.zoneNumber} style={{ backgroundColor: selectedIdentity?.color }} aria-label={selectedIdentity?.label}>{selectedIdentity?.number ?? "—"}</b> {ZONE_LABELS[selectedKind]} · {selected.width * selected.height} m²</h3><span>{![...snapshot.state.zones, ...(snapshot.state.serviceZones ?? [])].some(zone => zone.id === selected.id) ? "Au devis" : "lightingCode" in selected && selected.lightingCode === KQ_WAREHOUSE_UNLIT_CODE ? "Éclairage à installer" : selectedKind === "culture" ? (zoneCultures ? !!selectedRun : snapshot.activeRun) && "active" in selected && selected.active ? "Culture en cours" : "active" in selected && !selected.active ? "En pause" : "Zone active" : "Zone installée"}</span></div></div><div className={styles.inspectorBody}>
                  {zonePreparation}
                  <button type="button" className={styles.primary} disabled={!!placementCode || !!fixtureTarget} data-warehouse-action="configure-selected" aria-haspopup="dialog" onClick={() => openZoneMenu(selected.id)}>Actions de la zone</button>
                  <button type="button" className={styles.secondary} data-zone-effect disabled={!!fixtureTarget || !!placementCode} onClick={() => inspectCoverage("zone", selected.id, true)}>Voir la surface équipée</button>
                </div></> : !planZones.length && !!draft.handlingPlacements?.length ?
                  <div className={styles.inspectorEmpty}><h3>Matériel en place</h3>
                    {draft.handlingPlacements.map(item => <p key={item.code}><strong>{KQ_WAREHOUSE_HANDLING[item.code].name}</strong></p>)}
                  </div> : <div className={styles.inspectorEmpty}><Ruler size={30} /><h3>{planZones.length ? "Aucune zone sélectionnée" : "Aucune zone aménagée"}</h3><p>{planZones.length ? "Sélectionne une zone pour voir son équipement et ses dimensions." : "Dans Aménager, choisis un support de culture pour tracer ta première zone."}</p></div>}
                {selected && "lightingCode" in selected && <button type="button" className={`${styles.secondary} ${styles.lightingInspect}`}
                  data-lighting-inspect={selected.id} disabled={!!fixtureTarget || !!placementCode} onClick={() => { inspectLighting(selected.id); showDrawingPlan(); }}>Voir la portée des lampes</button>}
              </div> : null;

  const installedAirlock = savedPlan?.stationPlacements?.find(station => station.code === "SIM-HYGIENE-03");
  const selectedStation = coverageSelection?.kind === "station" ? stationCoverage?.placements.find(station => station.id === coverageSelection.id) : undefined;
  const airlock = stationCoverage?.placements.find(station => station.code === "SIM-HYGIENE-03");
  const irrigators = stationCoverage?.placements.filter(station => station.code === "SIM-WATER-03") ?? [];
  const coverageDetails = draft && coverageSelection && !fixtureTarget && !issues.length && <KqWarehouseCoverageDetails state={draft}
    selection={coverageSelection} air={airCoverage} stations={stationCoverage} condition={previewCondition} onInspectLamp={inspectLighting} onClose={clearCoverage} />;
  const labelZone = (id: string) => draft ? getKqZoneIdentity(draft, id)?.label ?? "Zone de culture" : "Zone de culture";
  const canPlace = !locked && !fixtureTarget && !placementCode;
  const placementReason = locked ? "L’aménagement est momentanément verrouillé." : fixtureTarget || placementCode ? "Termine ou annule d’abord le placement en cours." : undefined;

  const contextContent = snapshot && draft && summary && installedSummary ? <>
    {activeModule === "production" && <>
      {productionView === "priorities" && <WarehousePriorities alerts={alerts} ready={!!currentSecurity && !!preparations.state}
        disabled={workInProgress} onOpen={openPriority} nextAction={editing ? undefined : planZones.length === 0 ? <button type="button" className={board.control} data-primary data-sylvain-target="install-empty"
          disabled={!canPlace} onClick={() => { setMode(true); openTargetedShop("substrate"); }}><Wrench size={16} aria-hidden="true" />Installer une zone</button> : cultureAccess} />}
      {productionView === "surface" && <WarehouseSurface summary={summary} onOpen={module => {
        const nextZone = module === "production" ? draft.zones[0] : draft.serviceZones?.find(zone => zone.kind === module);
        if (module === "production" && nextZone) selectProductionZone(nextZone.id);
        else openModule(module);
        focusContext();
      }} />}
      {(productionView === "selection" || editing && productionView === "timeline") && <>
        {coverageDetails}{zoneInspector}
        {editing && !selected && <button type="button" className={board.control} data-primary disabled={!canPlace} onClick={openShop}><ShoppingBag size={16} aria-hidden="true" />Installer du matériel</button>}
      </>}
      {!editing && (productionView === "timeline" || productionView === "priorities" && (activeRuns.length > 0 || storage?.lots.some(lot => lot.projection.stage === "curing"))) &&
        <WarehouseProduction runs={activeRuns} lots={storageError ? undefined : storage?.lots} selectedZoneId={selectedId} labelZone={labelZone} official={guidePlanReady}
          onSelectZone={id => { selectProductionZone(id); showDrawingPlan(); }} onSelectLot={selectLot}>
          {storageError && <p>{storageError}</p>}{productionView === "timeline" ? cultureAccess : null}
        </WarehouseProduction>}
      {!editing && productionView === "selection" && <div className={board.sectionActions}><button type="button" className={board.control} onClick={() => setProductionView("timeline")}>
        Toutes les étapes <ArrowRight size={15} aria-hidden="true" /></button></div>}
    </>}

    {activeModule === "cleaning" && <section className={board.contextSection}>
      <h3>Nettoyage</h3>
      {coverageDetails}
      <KqWarehouseCleaningPanel register={preparations} airlockInstalled={!!installedAirlock}
        onOpenShop={code => openTargetedShop("hygiene", code)} onInspectAirlock={airlock ? () => inspectCoverage("station", airlock.id, true) : undefined} />
    </section>}

    {activeModule === "ventilation" && <section className={board.contextSection} data-warehouse-air-panel aria-label="Ventilation"
      data-sylvain-seen={guideCleanPlan && airCoverage ? "air" : undefined} data-sylvain-target="air" tabIndex={-1}>
      <h3>Extraction d’air</h3>
      {airCoverage ? <>
        <KqProgressMeter label="Surface de culture desservie" value={airCoverage.cells.filter(cell => cell.placementId !== null).length}
          max={airCoverage.cells.length} valueLabel={`${airCoverage.cells.filter(cell => cell.placementId !== null).length} / ${airCoverage.cells.length} m²`} />
        <div className={board.moduleActions}>
          <button type="button" className={board.control} aria-pressed={showAirCoverage} data-air-coverage-toggle disabled={!!fixtureTarget || !airCoverage.cells.length}
            onClick={() => { if (showAirCoverage) clearCoverage(); else { setCoverageSelection(null); setShowAirCoverage(true); showDrawingPlan(); } }}>{showAirCoverage ? "Masquer la couverture" : "Voir la couverture"}</button>
          <button type="button" className={board.control} data-air-shop disabled={!canPlace} onClick={() => openTargetedShop("air", "SIM-AIR-03")}><Fan size={16} aria-hidden="true" /> Choisir un appareil</button>
        </div>
        {!airCoverage.cells.length && <p>Délimite une zone de culture pour calculer la surface desservie.</p>}
        {coverageDetails}
        {airCoverage.placements.length > 0 ? <ul className={board.register}>{airCoverage.placements.map(placement => <li key={placement.id} data-air-placement={placement.id}>
          <div><strong>{getKqWarehouseDevice(placement.code)?.name}</strong><small>{placement.coveredAreaM2} / {placement.capacityM2} m² · {placement.powerWatts} W · portée {placement.rangeM} m</small>
            {editing && <small>{describeKqWarehouseAirMount(placement.mount, draft.partitions)}</small>}</div>
          <div className={board.moduleActions}>
            <button type="button" className={board.control} data-air-inspect disabled={!!fixtureTarget} onClick={() => inspectCoverage("air", placement.id, true)}>Voir le flux</button>
            <button type="button" className={board.control} data-air-move disabled={!canPlace} onClick={() => startFixture({ ...placement, initialCell: { x: placement.x, y: placement.y } })}>Déplacer</button>
            {editing && <button type="button" className={board.control} data-air-remove disabled={!canPlace} onClick={() => removeFixture("air", placement.id)}>Remettre en réserve</button>}
          </div>
        </li>)}</ul> : <p>Aucun ventilateur ni extracteur en place.</p>}
        {showAirCoverage && <details><summary>Surface desservie par zone</summary><ul className={board.register}>
          {draft.zones.map(zone => {
            const coverage = airCoverage.zones[zone.id];
            return coverage && <li key={zone.id}><button type="button" className={board.control} aria-pressed={selectedId === zone.id} onClick={() => { setSelectedId(zone.id); showDrawingPlan(); }}>{labelZone(zone.id)} · {coverage.coveredAreaM2} / {coverage.areaM2} m²</button></li>;
          })}
        </ul></details>}
      </> : <p>Corrige les dimensions du plan pour calculer la couverture.</p>}
      {placementReason && <p>{placementReason}</p>}
    </section>}

    {activeModule === "irrigation" && <section className={board.contextSection} aria-label="Irrigation" data-station-register>
      <h3>Irrigation</h3>
      {coverageDetails}
      {irrigators.length > 0 && <ul className={board.register}>{irrigators.map(station => <li key={station.id} data-station-placement={station.id}>
        <div><strong>{KQ_WAREHOUSE_STATIONS[station.code].name}</strong><small>{station.coveredAreaM2} / {station.capacityM2} m² desservis · portée {station.rangeM} m</small></div>
        <div className={board.moduleActions}>
          <button type="button" className={board.control} data-station-inspect disabled={!!fixtureTarget} onClick={() => inspectCoverage("station", station.id, true)}>Voir la portée</button>
          <button type="button" className={board.control} data-station-move disabled={!canPlace} onClick={() => startFixture({ ...station, initialCell: { x: station.x, y: station.y } })}>Déplacer</button>
          {editing && <button type="button" className={board.control} data-station-remove disabled={!canPlace} onClick={() => removeFixture("station", station.id)}>Remettre en réserve</button>}
        </div>
      </li>)}</ul>}
      {dirty ? <p>Enregistre le plan pour préparer les mélanges avec la couverture affichée.</p> : <KqWarehouseIrrigationPanel register={preparations} layout={snapshot.state}
        stationId={selectedStation?.id} onSelectZone={setSelectedId} onOpenShop={code => openTargetedShop(getKqWarehouseShopTarget(code)?.kind === "catalog" && code !== "SIM-WATER-03" ? "nutrition" : "water", code)} />}
      {irrigators.length > 0 && <button type="button" className={board.control} disabled={!canPlace} onClick={() => openTargetedShop("water", "SIM-WATER-03")}>Choisir une centrale</button>}
      {placementReason && <p>{placementReason}</p>}
    </section>}

    {activeModule === "inputs" && <section className={board.contextSection}><h3>Intrants</h3>
      <KqWarehouseInputsPanel register={preparations} runs={activeRuns.map(run => ({ ...run, name: run.zoneId ? labelZone(run.zoneId) : "Culture en cours" }))}
        selectedRunId={selectedRun?.runId} onSelectRun={runId => setSelectedId(activeRuns.find(run => run.runId === runId)?.zoneId ?? null)}
        onOpenShop={code => openTargetedShop("nutrition", code)} onOpenIrrigation={() => openModule("irrigation")}
        onOpenCulture={(runId, zoneId) => {
          const run = activeRuns.find(item => item.runId === runId);
          const href = zoneId ? warehouseCultureHref(zoneId, run?.leaderRunId ?? runId) : warehouseCampaignHref(run?.leaderRunId ?? runId);
          navigateWithDraftGuard(() => onOpenCulture ? onOpenCulture(href) : router.push(href));
        }} />
    </section>}

    {(room === "drying" || room === "storage") && <section className={board.contextSection}>
      <h3>{room === "drying" ? "Capacité de séchage" : "Place en stockage"}</h3>
      {room === "drying" && <KqProgressMeter label="Capacité par récolte" value={summary.dryingCapacityGrams} max={Math.max(summary.dryingCapacityGrams, summary.estimatedHarvestGrams)}
        valueLabel={mass(summary.dryingCapacityGrams)} hint={summary.activeAreaM2 ? `Potentiel matériel du plan · ${mass(summary.estimatedHarvestGrams)}` : "La récolte dépend des zones actives."} />}
      {room === "storage" && <p>{availableStorage === null ? "Occupation à établir." : `${mass(Math.max(0, availableStorage))} libres sur ${mass(savedActualStorageCapacity)}. Les réservations de récolte sont déduites.`}</p>}
      <p>{currentService ? `${labelZone(currentService.id)} · ${currentService.width * currentService.height} m²` : "Choisis un poste pour aménager la surface dans le plan."}</p>
      <a className={board.control} href={`#${id}-activity`}>{room === "drying" ? "Gérer le séchage" : "Gérer les lots"}<ArrowRight size={15} aria-hidden="true" /></a>
    </section>}
  </> : null;

  return <div className={embedded ? undefined : styles.overlay}>
    <section ref={page} className={`${styles.page} ${board.board}`} aria-labelledby={`${id}-title`} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} data-warehouse-v4 data-arena-tour-surface="warehouse"
      data-sylvain-warehouse-room={guidePlanReady ? room : undefined}
      data-sylvain-warehouse-mode={guidePlanReady ? editing ? "arrangement" : "pilotage" : undefined}
      data-sylvain-warehouse-draft={dirty || undefined}
      data-sylvain-draft-zone-count={draft?.zones.length}
      data-sylvain-active-run={guidePlanReady ? activeRuns[0]?.runId : undefined}
      data-sylvain-eligible-zone-count={guidePlanReady ? snapshot.state.zones.filter(zone => zone.id !== reservation?.zoneId && isKqWarehouseZoneOperational(zone)).length : undefined}
      data-warehouse-sylvain-loading={!api.isTutorial && loading || undefined}
      data-guide-saved-zone-count={snapshot?.state.zones.filter(isKqWarehouseZoneOperational).length}
      data-guide-assigned-zone-count={snapshot?.state.zones.filter(zone => isKqWarehouseZoneOperational(zone) && zone.buddieCode && zone.id !== reservation?.zoneId).length}
      onKeyDown={event => {
      if (event.key === "Escape" && pickedBuddieRef.current) { event.preventDefault(); event.stopPropagation(); pickBuddie(null); return; }
      if (embedded || shopOpen || event.target instanceof Element && event.target.closest("[data-app-dialog]")) return;
      if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); navigateWithDraftGuard(onClose); }
      if (event.key !== "Tab") return;
      const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')).filter(node => node.getClientRects().length);
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
    }}>
      <div className={board.masthead} data-arena-tour="warehouse">
        <KqChapterHeading title={room === "processing" ? "Atelier" : "Entrepôt"} titleId={`${id}-title`} compact actions={<div className={board.headingActions}>
          {calendar && <span className={board.clock}><Clock3 size={15} aria-hidden="true" />Jour {calendar.dayOfMonth} · Mois {calendar.month}</span>}
          <div className={board.wallet}><small>Trésorerie</small><strong>{snapshot ? formatKqCash(snapshot.cashCents) : "—"}</strong></div>
          <button className={board.control} type="button" data-warehouse-priorities data-alert-count={alerts.length ? "positive" : undefined} disabled={!snapshot || workInProgress} onClick={openPriorities}>
            <Bell size={16} aria-hidden="true" />{alerts.length ? `${alerts.length} priorité${alerts.length > 1 ? "s" : ""}` : "Priorités"}
          </button>
          {(onReturnToVillage || contextNavigation) && <span className={board.contextNavigation}>
            {onReturnToVillage && <button type="button" className={`${board.control} ${board.villageReturn}`} data-placard-back="hub" disabled={workInProgress || removalBusy} onClick={onReturnToVillage}>
              <ArrowLeft size={16} aria-hidden="true" />Retour au village
            </button>}
            {contextNavigation}
          </span>}
          {!embedded && <button ref={close} className={styles.iconButton} type="button" onClick={() => navigateWithDraftGuard(onClose)} aria-label="Fermer l’entrepôt"><X size={18} aria-hidden="true" /></button>}
        </div>} />
        <div className={board.modeBar} role={room === "processing" ? "group" : undefined}
          aria-label={room === "processing" ? "Navigation de l’atelier" : undefined}>
          {room === "processing" ? <button type="button" className={board.control} data-workshop-return disabled={workInProgress} onClick={() => {
            openModule("production"); setProductionView(editing ? "selection" : "priorities");
            requestAnimationFrame(() => page.current?.querySelector<HTMLButtonElement>('[data-warehouse-mode][aria-pressed="true"]')?.focus({ preventScroll: true }));
          }}><ArrowLeft size={16} aria-hidden="true" />Entrepôt</button> : <div className={board.modeChooser}>
            <span className={board.modeLabel} aria-hidden="true">Mode de l’entrepôt</span>
            <div className={board.modeSwitch} role="group" aria-label="Mode du plan" data-warehouse-mode-switch={editing ? "arrangement" : "pilotage"}>
              <button type="button" data-warehouse-mode="pilotage" aria-pressed={!editing} disabled={workInProgress || pending || dirty}
                aria-labelledby={`${id}-mode-pilotage`} aria-describedby={`${id}-mode-pilotage-detail`} onClick={() => setMode(false)}>
                <Gauge size={20} aria-hidden="true" />
                <span className={board.modeText}><strong id={`${id}-mode-pilotage`}>Pilotage</strong>
                  <small id={`${id}-mode-pilotage-detail`}>{dirty ? "Brouillon en cours" : "Suivre l’activité"}</small></span>
              </button>
              <button type="button" data-warehouse-mode="arrangement" data-warehouse-build-shop={!editing || undefined} data-sylvain-target={!editing ? "install-shop" : undefined} aria-pressed={editing} disabled={workInProgress || locked}
                aria-labelledby={`${id}-mode-arrangement`} aria-describedby={`${id}-mode-arrangement-detail`} onClick={() => setMode(true)}>
                <Wrench size={20} aria-hidden="true" />
                <span className={board.modeText}><strong id={`${id}-mode-arrangement`}>Aménager</strong>
                  <small id={`${id}-mode-arrangement-detail`}>Modifier le plan</small></span>
              </button>
            </div>
            {firstPlan && <button type="button" className={board.control} data-primary data-warehouse-first-plan data-sylvain-target="install-first" disabled={locked || workInProgress} onClick={() => {
              setDraft(firstPlan); setSelectedId(firstPlan.zones[0].id); setError("");
              setRoom("culture"); setFloorModule("production"); setProductionView("selection");
              setNotice("1 m² éclairé, un filet et des bocaux. Tu peux déplacer le matériel, vérifier le devis ou annuler.");
              showDrawingPlan();
            }}>Proposer un plan de départ</button>}
          </div>}
          <div className={board.modeActions}>
            <button type="button" className={board.control} data-warehouse-action="reserve" aria-controls={`${id}-dashboard`} disabled={!installedSummary || loading} onClick={() => openDashboard("reserve")}>
              <Package size={15} aria-hidden="true" />Réserve
            </button>
            <button className={styles.iconButton} type="button" data-warehouse-refresh aria-label="Actualiser l’entrepôt" disabled={pending || removalBusy || loading || dirty || workInProgress || !!removalAttempt.current}
              onClick={() => { void load(); if (operationsAvailable && !preparations.uncertain) preparations.refresh(); }}><RefreshCw size={16} aria-hidden="true" /></button>
          </div>
        </div>
      </div>
      {error && <p className={styles.error} role="alert"><CircleAlert size={17} aria-hidden="true" />{error}{!snapshot && <button type="button" onClick={() => void load()} disabled={pending}>Recharger</button>}</p>}
      {staleDraft && <div className={styles.warning} role="status"><p>Le plan enregistré a changé depuis ton brouillon. Reprends-le pour vérifier le nouveau devis avant d’enregistrer.</p>
        <div className={styles.buttons}><button type="button" className={board.control} disabled={locked} onClick={() => { setMode(true); setDraft(staleDraft.state); setStaleDraft(null); }}>Examiner le brouillon</button>
          <button type="button" className={board.control} disabled={locked} onClick={() => setStaleDraft(null)}>Garder le plan enregistré</button></div></div>}
      {snapshot?.activeRun && !zoneCultures && <p className={styles.warning}><CircleAlert size={17} aria-hidden="true" />L’aménagement est verrouillé jusqu’à la récolte de la culture en cours.</p>}
      {snapshot?.legacyActiveRun && <p className={styles.warning}>Termine ta culture en cours pour ouvrir les cultures par zone. <Link href="/arene/placard?view=game">Reprendre</Link></p>}
      {adoptingServicePlan && <p className={styles.warning} data-warehouse-adoption>Seul le matériel affecté aux zones comptera dans la capacité. Le reste sera conservé en réserve.{adoptionBlocked && " Agrandis le stockage pour accueillir tes lots."}</p>}
      {adoptionBlocked && !adoptingServicePlan && <p className={styles.warning} data-warehouse-capacity-blocked>Stockage insuffisant pour tes lots. Agrandis la zone ou change de gamme.</p>}
      {!snapshot || !draft || !summary || !installedSummary ? <div className={styles.loading} role="status">{loading
        ? <><LoaderCircle size={25} aria-hidden="true" />Chargement de ton installation…</>
        : "L’entrepôt n’est pas disponible. Tu peux réessayer avec le bouton Actualiser."}</div> : <>
          {firstInstallationConfirmed && <div className={`${styles.campaignLaunch} ${styles.preparationAccess}`} data-warehouse-first-installation>
            <span role="status"><strong>Plan installé</strong>{notice && <small>{notice}</small>}</span>
            <div className={styles.buttons}>
              {onOpenCulture ? <button type="button" {...firstPreparationAction} onClick={() => onOpenCulture(firstPreparationHref)}>{firstPreparationLabel}</button>
                : <Link {...firstPreparationAction} href={firstPreparationHref}>{firstPreparationLabel}</Link>}
              <button type="button" className={styles.secondary} data-warehouse-review-installed onClick={() => {
                const zone = snapshot.state.zones.find(zone => zone.id !== reservation?.zoneId && isKqWarehouseZoneOperational(zone));
                if (zone) selectProductionZone(zone.id);
                showDrawingPlan();
              }}>Revoir mon plan</button>
            </div>
          </div>}
          {room !== "processing" && <WarehouseMetrics summary={editing ? summary : installedSummary} count={zoneCultures ? activeRuns.length : Number(snapshot.activeRun)}
            stock={stock} stockFree={availableStorage === null ? null : Math.max(0, availableStorage)} disabled={workInProgress}
            onSurface={() => { openModule("production"); setProductionView("surface"); focusContext(); }}
            onProduction={() => { openModule("production"); focusContext(); }}
            onStorage={() => { openModule("storage"); focusContext(); }}
            onCosts={() => openDashboard("costs")} />}
          {room !== "processing" && <WarehouseModules id={id} active={activeModule} disabled={workInProgress || pending} onOpen={openModule} />}
          {editing && (dirty || room !== "processing") && <div className={board.planStatus} data-dirty={dirty || undefined}>
            <span role="status" data-warehouse-draft={dirty || undefined}><strong>{dirty ? "Brouillon à enregistrer" : "Plan enregistré"}</strong>
              {dirty ? draftStored ? "Brouillon conservé dans cet onglet." : "Enregistre pour installer tes modifications." : "Place, déplace ou redimensionne sur le plan."}
              {dirty && notice && <small>{notice}</small>}
            </span>
            {dirty && <button type="button" className={board.control} data-primary data-sylvain-target="install-review" onClick={reviewPlan}>{payable === null ? "Voir le devis" : `Voir le devis · ${formatKqCash(payable)}`}</button>}
          </div>}
          {notice && !dirty && !firstInstallationConfirmed && <p className={styles.notice} role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
          <div role={room === "processing" ? undefined : "tabpanel"} id={`${id}-module-panel`} aria-labelledby={room === "processing" ? undefined : `${id}-${activeModule}-tab`}>
            {room !== "processing" && <div className={board.floor} ref={workspace} data-warehouse-cultures={zoneCultures || undefined} data-warehouse-managing={editing || undefined}>
              <div className={board.sceneColumn}>
                {editing && <div className={board.planToolbar}>
                  {fixtureTarget && <button type="button" className={board.control} onClick={focusContext}>Options du placement<ArrowRight size={15} aria-hidden="true" /></button>}
                  <button type="button" className={board.control} data-primary data-warehouse-build-shop data-warehouse-action="shop" aria-haspopup="dialog" disabled={!canPlace}
                    onClick={() => openTargetedShop(getKqWarehouseDepartment(room))}>
                    <ShoppingBag size={17} aria-hidden="true" />Ajouter du matériel</button>
                  {placementReason && !fixtureTarget && <small>{placementReason}</small>}
                </div>}
                <div className={board.sceneFrame} data-sylvain-target={drawingKind === "culture" ? "install-placement" : undefined} tabIndex={drawingKind === "culture" ? -1 : undefined}>{warehouseScene}</div>
                {movingBuild && <button type="button" className={board.control} disabled={locked} onClick={cancelCellBuild}>Annuler ce déplacement</button>}
                {!zoneCultures && !dirty && !snapshot.legacyActiveRun && <Link className={board.control} href="/arene/placard?view=game">{snapshot.activeRun ? "Reprendre" : "Cultiver"}<ArrowRight size={15} aria-hidden="true" /></Link>}
              </div>
              <aside ref={context} tabIndex={-1} className={board.context} aria-label="Détails de l’entrepôt" data-warehouse-context>
                {fixtureTarget && <section className={styles.airPanel} data-fixture-placement={fixtureTarget.code} aria-label="Placement sur le plan">
                  <h3>{handlingTarget ? KQ_WAREHOUSE_HANDLING[handlingTarget.code].name : stationTarget ? KQ_WAREHOUSE_STATIONS[stationTarget.code].name : getKqWarehouseDevice(fixtureTarget.code)?.name}</h3>
                  {airTarget && <KqWarehouseAirMountPicker dimensions={dimensions} partitions={draft.partitions} mount={airTarget.mount} disabled={locked}
                    onChange={(mount, initialCell) => { setFixtureTarget({ ...airTarget, mount, initialCell }); setError(""); showDrawingPlan(); }} />}
                  {stationTarget?.code === "SIM-HYGIENE-03" && <p><strong>{snapshot.state.optionInventory?.some(item => item.code === stationTarget.code && item.quantity > 0)
                    ? "Sas déjà acquis · pose gratuite"
                    : `${formatKqCash(KQ_WAREHOUSE_STATIONS[stationTarget.code].priceCents)} · pose comprise`}</strong></p>}
                  <p>{handlingTarget ? "Choisis une case libre, puis confirme l’emplacement et le prix." : airTarget?.mount ? "Choisis un point d’accroche sur le mur ou la paroi indiquée." : stationTarget?.code === "SIM-HYGIENE-03" ? `Place le sas à la porte sud, puis confirme le devis. Dès le prochain semis, le risque d’infections, de ravageurs et de virus diminue de ${KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT} % dans tout l’entrepôt.` : "Choisis une case sur le plan pour voir la portée de l’appareil."}</p>
                  {stationTarget?.code === "SIM-HYGIENE-03" && <button type="button" data-station-install-entrance className={styles.primary} disabled={locked} onClick={() => placeFixture(getKqWarehouseStationEntrance(dimensions), true)}>Placer à l’entrée</button>}
                  {stationTarget && draft.stationPlacements === undefined && draft.zones.some(zone => zone.optionCodes?.some(isKqWarehouseStationCode)) &&
                    <p>Au passage aux postes physiques, les anciens modules Centrale de distribution et Sas d’entretien retourneront en réserve. Le devis détaille les zones modifiées.</p>}
                  {error && <p role="alert" className={styles.error}>{error}</p>}
                  <button type="button" className={styles.secondary} data-air-cancel={airTarget ? true : undefined} data-fixture-cancel onClick={() => { setFixtureTarget(null); setError(""); }}>Annuler le placement</button>
                </section>}
                {placementCode && <section className={styles.airPanel} data-warehouse-placement={placementCode} ref={placementPanel} tabIndex={-1} aria-labelledby={`${id}-placement-title`}>
                  <h3 id={`${id}-placement-title`}>{placementName}</h3>
                  <p>{placementZoneDevice ? `Choisis la zone à équiper ou trace une nouvelle zone sur le plan. Un appareil équipe jusqu’à ${placementZoneDevice.capacityM2} m² dans cette zone.` : drawingKind ? "Touche une case libre pour poser 1 m², glisse pour tracer une surface ou choisis une zone existante." : "Choisis son emplacement sur le plan."}</p>
                  {placementTargets.length > 0 && <div className={styles.airActions} role="group" aria-label="Équiper une zone existante">
                    {placementTargets.map(zone => {
                      const count = placementDevice?.kind === "lighting" ? getKqWarehouseLightingCount(zone.width, zone.height, placementDevice.code) : 0;
                      const area = zone.width * zone.height;
                      const devices = placementZoneDevice ? getKqWarehouseZoneOptionQuantity(placementZoneDevice.code, area) : 0;
                      return <button key={zone.id} type="button" className={styles.secondary} data-warehouse-build-target={zone.id} data-sylvain-target={placementDevice?.kind === "lighting" ? "install-placement" : undefined} disabled={locked || occupiedZoneIds.includes(zone.id)} onClick={() => equipTarget(zone)}>{getKqZoneIdentity(draft, zone.id)?.label ?? zone.name} · {area} m²{count > 0 && ` · ${count} lampe${count > 1 ? "s" : ""}`}{devices > 0 && ` · ${devices} appareil${devices > 1 ? "s" : ""}`}</button>;
                    })}
                    <button type="button" className={styles.secondary} data-warehouse-build-floor onClick={() => showDrawingPlan()}>Placer sur le sol libre</button>
                  </div>}
                  <button type="button" className={styles.secondary} data-warehouse-placement-cancel onClick={() => { setPlacementCode(null); setError(""); }}>Annuler le placement</button>
                  {error && <p role="alert" className={styles.error}>{error}</p>}
                </section>}
                {contextContent}
                {(!api.isTutorial || activeModule === "security") && <div hidden={activeModule !== "security"}>
                  {dirty && <p className={board.contextIntro}>La sécurité affiche les emplacements enregistrés. Enregistre le plan pour voir sa couverture sur la scène.</p>}
                  <KqWarehouseSecurity variant="inline" active={activeModule === "security"} layoutRevision={snapshot.revision} onSnapshotChange={setSecuritySnapshot}
                    selectedCameraId={cameraId} onSelectCamera={selectCamera} coverageVisible={securityCoverage && !dirty}
                    onToggleCoverage={dirty ? undefined : () => {
                      setSecurityCoverage(value => !value); setCoverageSelection(null); setShowAirCoverage(false);
                      if (!securityCoverage) showDrawingPlan();
                    }}
                    onChanged={acceptWallet} onBusyChange={setSecurityBusy} onSelectZone={id => { setSelectedId(id); showDrawingPlan(); }} calendarOrigin={calendarOrigin} />
                </div>}
              </aside>
              {showBuddieDock && <KqWarehouseBuddieDock buddies={buddies} runs={activeRuns} zones={draft.zones} disabled={locked} open={buddiesOpen} onOpenChange={setBuddiesOpen} selectedCode={pickedBuddie} onPick={pickBuddie} onDragPoint={dragBuddie} onDrop={dropBuddie} />}
              {mainPlanReview}
            </div>}
            {room !== "culture" && <div className={board.wideActivity} id={`${id}-activity`} data-warehouse-wide-activity>
              {room === "drying" && (issues.length ? <div role="alert"><p>{issues[0]}</p><button type="button" className={styles.secondary} onClick={() => setMode(true)}>Corriger les dimensions sur le plan</button></div> : <KqWarehousePostHarvest kind={room} state={draft} installedState={snapshot.state} billing={snapshot.storageClimateBilling} disabled={locked} onPlaceDevice={placeDevice} onEditZone={editServiceZone} onUpgradeZone={upgradeServiceZone} onSetStorageClimate={setStorageClimate} />)}
              {room === "processing" && <>
                <div ref={workshopActions} className={`${board.moduleActions} ${board.workshopActions}`} role="group" aria-label="Activités de l’atelier" data-workshop-tabs>
                  <button type="button" className={board.control} aria-pressed={workshopTab === "trim"} disabled={workshopBusy} onClick={() => setWorkshopTab("trim")}><Scissors size={16} aria-hidden="true" />Trim</button>
                  <button type="button" className={board.control} aria-pressed={workshopTab === "extracts"} disabled={workshopBusy} onClick={() => setWorkshopTab("extracts")}><FlaskConical size={16} aria-hidden="true" />Extractions</button>
                  <button type="button" className={board.control} aria-pressed={workshopTab === "machines"} disabled={workshopBusy} onClick={() => setWorkshopTab("machines")}><Wrench size={16} aria-hidden="true" />Machines</button>
                </div>
                {dirty ? <><p className={styles.warning}>Enregistre ou annule ton aménagement avant de travailler dans l’atelier.</p>{mainPlanReview}</>
                : <div className={styles.workshop} data-warehouse-workshop data-workshop-section={workshopTab}>
                  {workshopTab === "trim" ? <KqWorkshopTrimDesk initialFlowerId={initialFlowerId} initialEmployeeId={initialEmployeeId}
                    onBusyChange={setWorkshopBusy} disabled={pending || loading} onOpenHarvests={onOpenHarvests} />
                    : workshopTab === "extracts" ? <KqCommerceDesk workshop initialFlowerId={extractionLot.flowerId} initialLotId={extractionLot.lotId}
                      onLotSelectionChange={(lotId, flowerId) => setExtractionLot({ lotId, flowerId })} onBusyChange={setWorkshopBusy}
                      onOpenShop={code => openWorkshopShop(code, true)} onOpenStorage={flowerId => flowerId ? selectLot(flowerId) : openModule("storage")} />
                    : workshopShop ? <>
                      <button className={board.control} type="button" disabled={workshopBusy} onClick={closeWorkshopShop}>{resumeExtraction ? "Retour à l’extraction" : "Retour à mes machines"}</button>
                      {workshopEquipmentCode === "COMPUTER" ? <KqCommerceComputer onBusyChange={setWorkshopBusy} />
                        : <KqEquipmentCatalogModal embedded workshopOnly initialEquipmentCode={workshopEquipmentCode} onBusyChange={setWorkshopBusy} onClose={closeWorkshopShop} />}
                    </> : <KqWarehouseEntry embedded workshopOnly showWorkshopHeading={false} initialEquipmentCode={workshopEquipmentCode} onBusyChange={setWorkshopBusy} onClose={() => openModule("storage")} onOpenShop={openWorkshopShop} />}
                </div>}
              </>}
              {room === "storage" && <div>
                {dirty && <p className={styles.warning}>Enregistre ou annule ton aménagement avant de déplacer les récoltes.</p>}
                <KqHarvestStorage initialFlowerId={storageFlowerId} juryReturnView="workshop" showWarehouseLink={false} showOverviewLink={false}
                  disabled={pending || loading || workshopBusy || dirty} onBusyChange={setStorageBusy} onStorageChange={acceptStorage} onErrorChange={setStorageError}
                  onStored={id => { if (currentService) setRoomEvent({ id, zoneId: currentService.id, gesture: "store" }); }}
                  onOpenMarket={(flowerId, section) => onOpenMarket ? onOpenMarket(flowerId, section) : router.push(destinationHref("market", flowerId, section))}
                  onOpenOverview={flowerId => onOpenHarvests ? onOpenHarvests(flowerId) : router.push(destinationHref("harvests", flowerId))}
                  onOpenWarehouse={flowerId => { focusedProtection.current = null; setProtectionFlowerId(flowerId ?? null); setStorageEquipmentOpen(true); }} />
                {issues.length ? <div role="alert"><p>{issues[0]}</p><button type="button" className={styles.secondary} onClick={() => setMode(true)}>Corriger les dimensions sur le plan</button></div> : <details className={styles.storageEquipment} data-storage-equipment open={storageEquipmentOpen} onToggle={event => setStorageEquipmentOpen(event.currentTarget.open)}>
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
            </div>}
          </div>
          <div ref={dashboard} id={`${id}-dashboard`}>
            <KqWarehouseDashboard summary={summary} installedSummary={installedSummary} condition={snapshot.cultureEquipment} projectedCondition={previewCondition} quote={quote} dirty={dirty} migrationCreditCents={snapshot.migrationCreditCents ?? 0} cultureBudget={cultureBudget} storageCapacity={storageCapacity} storageReserved={storageReserved} reservedHarvest={reservedHarvest} salesGramsPerDay={demand} open={dashboardOpen} onOpenChange={setDashboardOpen} tab={dashboardTab} onTabChange={setDashboardTab} />
          </div>
        </>}
      <AppDialog open={!!menuZone && room === "culture"} onClose={closeZoneMenu} title={zoneMenuPage === "buddies" ? `Buddies · ${menuTitle}` : zoneMenuPage === "remove" ? `Supprimer · ${menuTitle}` : menuTitle} className={zoneMenuPage === "buddies" ? styles.zoneBuddiesDialog : styles.zoneActionsDialog} bodyClassName={styles.zoneMenuBody} dialogProps={{ "data-warehouse-zone-menu": true }}>
        {menuZone && snapshot && <>
          {zoneMenuPage !== "actions" && <button type="button" className={styles.secondary} data-warehouse-zone-back disabled={removalBusy} onClick={() => setZoneMenuPage("actions")}>Retour aux actions de la zone</button>}
          {zoneMenuPage === "actions" ? <>
            {removalAttempt.current && <p role="status">Une suppression reste à vérifier. Rouvre Supprimer dans la zone concernée avant de modifier le plan.</p>}
            {selectedRun ? <p role="status">Culture en cours : le matériel et le Buddie restent en place jusqu’à la récolte.</p> : null}
            {selectedProduction && <p role="status" data-warehouse-production-status><strong>Production autonome</strong> · {selectedProduction.enabled ? "Zone gérée par le personnel." : "Circuit en pause, lots ou tâches à terminer."} Choisis le matériel et consulte son devis. L’installation est possible une fois le circuit vide ; la zone reste dédiée au personnel.</p>}
            {menuCondition && <dl className={styles.zoneCondition} data-warehouse-zone-condition><div><dt>Usure du matériel</dt><dd>{menuCondition.wearPercent === null ? menuSaved ? "Indisponible" : "Zone à installer" : `${decimal(menuCondition.wearPercent)} %`}</dd></div><div><dt>Rendement lié au matériel</dt><dd>{menuCondition.yieldPercent === null ? "À vérifier" : `${decimal(menuCondition.yieldPercent)} %`}</dd></div></dl>}
            <div className={styles.zoneActions}>
              {selectedRun && <ZoneDialogAction action="resume" leave className={styles.primary} disabled={dirty || locked} onClick={() => { setZoneMenuId(null); (onOpenCulture ?? router.push)(warehouseCultureHref(menuZone.id, selectedRun.leaderRunId ?? selectedRun.runId)); }}>Suivre la culture<ArrowRight size={18} aria-hidden="true" /></ZoneDialogAction>}
              <ZoneDialogAction action="furnish" className={styles.primary} disabled={selectedEquipmentLocked} onClick={furnishZone}><ShoppingBag size={20} aria-hidden="true" /><strong>{selectedProduction ? "Choisir le matériel" : "Aménager"}</strong></ZoneDialogAction>
              {selectedProduction ? <ZoneDialogAction action="staff" leave className={styles.secondary} disabled={locked || dirty} onClick={() => { setZoneMenuId(null); if (onOpenStaff) onOpenStaff(); else router.push("/arene/placard?view=staff"); }}>Voir le personnel<ArrowRight size={18} aria-hidden="true" /></ZoneDialogAction> : !("kind" in menuZone) && <button type="button" className={styles.secondary} data-warehouse-zone-action="buddies" data-warehouse-zone-prepare={!!zonePreparationHref || undefined} data-sylvain-target={zonePreparationHref ? "prepare-zone" : undefined} disabled={selectedLocked || !zoneCultures} onClick={() => {
                if (zonePreparationHref && !buddies?.ownedBuddieCodes.length) {
                  setZoneMenuId(null);
                  (onOpenCulture ?? router.push)(zonePreparationHref);
                } else showZoneBuddies();
              }}><Sprout size={20} aria-hidden="true" /><span><strong>{zonePreparationHref ? "Choisir mon Buddie" : "Buddies"}</strong><small>Choisir la variété de cette zone</small></span></button>}
              <ZoneDialogAction className={styles.secondary} action="dimensions" disabled={selectedLocked} onClick={() => { setZoneMenuId(null); setManaging(true); configureZone(menuZone.id); }}><Ruler size={20} aria-hidden="true" /><strong>Modifier les dimensions</strong></ZoneDialogAction>
              <button type="button" className={styles.danger} data-warehouse-zone-action="remove" disabled={selectedLocked && removalAttempt.current?.zoneId !== menuZone.id} onClick={() => setZoneMenuPage("remove")}><Trash2 size={20} aria-hidden="true" /><span><strong>Supprimer</strong><small>{api.isTutorial || "kind" in menuZone ? "Remettre le matériel en réserve" : "Garder le matériel ou le revendre"}</small></span></button>
            </div>
            {menuCondition && menuCondition.wearPercent !== null && <details><summary>Usure et rendement</summary><KqHelpDashboard>
              <KqHelpGrid art="warehouse" items={[
                { label: "Chaque culture terminée", value: "+5 points d’usure", art: "help-culture" },
                { label: "Matériel en réserve", value: "Aucune usure", art: "help-workshop" },
              ]} />
              <KqBarChart title="Rendement potentiel conservé" items={[
                { label: "Usure à 0 %", value: 100, displayValue: "100 % du potentiel" },
                { label: "Usure à 50 %", value: 75, displayValue: "75 % du potentiel", tone: "gold" },
                { label: "Usure à 100 %", value: 50, displayValue: "50 % du potentiel", tone: "red" },
              ]} />
            </KqHelpDashboard></details>}
          </> : zoneMenuPage === "buddies" && !("kind" in menuZone) ? <div data-warehouse-zone-buddies>
            <p>Le Buddie choisi sera affecté à cette zone. Enregistre le plan pour valider.</p>
            <KqBuddieCarousel buddies={KQ_BUDDIES.filter(buddie => buddies?.ownedBuddieCodes.includes(buddie.code))} artwork={{}} selectedCode={menuZone.buddieCode ?? ""} rotation={buddies?.buddieRotation ?? null} compactRotation title="Choisir un Buddie" id={`${id}-zone-buddies`} disabled={selectedLocked} unavailableReasons={Object.fromEntries(activeRuns.map(run => [run.buddieCode, "Ce Buddie est déjà en culture."]))} onSelect={code => assignBuddie(code, menuZone, true)} />
            {notice && <p role="status" data-warehouse-buddie-save-status>{notice}</p>}
            {dirty && quoteReview(<button type="button" className={styles.primary} data-warehouse-zone-save-buddie disabled={saveLocked || !!selectedRun || !!selectedProduction || !quote || !affordable || adoptionBlocked || occupiedServiceChanged || productionInstallationBlocked} onClick={async () => {
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
      <AppDialog open={zoneDialogOpen} onClose={() => setZoneDialogId(null)} title="Régler la zone" className={styles.zoneDialog} bodyClassName={styles.zoneDialogBody} dialogProps={{ "data-warehouse-zone-dialog": true }}>
        {zoneEditor}
        {dirty ? quoteReview(<button type="button" className={styles.primary} data-warehouse-action="save" disabled={saveLocked || !!selectedRun || !!selectedProduction || !quote || !affordable || adoptionBlocked || occupiedServiceChanged || productionInstallationBlocked} onClick={() => void confirmZone()}>{pending ? <LoaderCircle size={16} /> : <Check size={16} />}{pending ? "Enregistrement…" : installLabel}</button>, true)
          : <button type="button" className={styles.primary} onClick={() => setZoneDialogId(null)}>Terminer</button>}
      </AppDialog>
      <KqWarehouseCellMenu cell={cellBuild?.point ?? null} partition={draft?.partitions?.find(wall => wall.id === cellBuild?.id)} removing={cellBuild?.removing}
        dimensions={dimensions} disabled={locked} error={error}
        onClose={() => { setCellBuild(null); restoreZoneFocus(); }} onUpdatePartition={updatePartition}
        onMove={() => { if (!locked) { setMovingBuild(cellBuild); setCellBuild(null); showDrawingPlan(); } }}
        onRemove={() => {
          if (locked || !draft || !cellBuild) return;
          if (draft.airPlacements?.some(fan => fan.mount?.partitionId === cellBuild.id)) { setError("Déplace ou retire les extracteurs fixés à cette paroi avant de la retirer."); return; }
          setDraft({ ...draft, partitions: draft.partitions?.filter(wall => wall.id !== cellBuild.id) }); setError(""); setCellBuild({ ...cellBuild, removing: true });
        }}
        review={cellBuild?.id && <>{dirty && quoteReview(<button type="button" className={styles.primary} data-warehouse-cell-save disabled={saveLocked || !quote || !affordable || adoptionBlocked || productionInstallationBlocked || occupiedServiceChanged} onClick={async () => { if (await save()) { setCellBuild(null); setMovingBuild(null); restoreZoneFocus(); } }}>{pending ? "Enregistrement…" : installLabel}</button>, true)}
          <button type="button" className={styles.secondary} data-warehouse-cell-cancel disabled={locked} onClick={cancelCellBuild}>Annuler cet aménagement</button></>} />
      {snapshot && draft && <KqWarehouseShop key={shopVisit.id} open={shopOpen} onPaid={acceptWallet} initialDepartment={shopVisit.department} initialEquipmentCode={shopVisit.equipmentCode} onClose={() => { setShopOpen(false); }}
        state={draft} installedState={snapshot.state} handlingCartConversion={snapshot.handlingCartConversion} handling={getKqWarehouseHandling(snapshot.state, snapshot.cultureEquipment)} locked={locked}
        cashCents={snapshot.cashCents} migrationCreditCents={snapshot.migrationCreditCents ?? 0} onChooseProduct={chooseProduct}
        onOpenWorkshop={() => { setShopOpen(false); setRoom("processing"); openWorkshopShop(); }} planReview={dirty ? { payableCents: payable, onOpen: reviewPlan } : undefined} />}
    </section>
    <AppDialog open={!!pendingLeave} onClose={() => setPendingLeave(null)} title="Modifications en cours">
      <div className={styles.leaveDraft}>
        <p>{draftStored ? "Ton brouillon restera disponible dans cet onglet. Les modifications ne seront appliquées qu’après enregistrement." : "Ton brouillon ne peut pas être conservé dans ce navigateur. Enregistre pour ne pas perdre tes modifications."}</p>
        {(pending || saveOutcome === "unknown") && <p>Vérifie le résultat de la confirmation avant de quitter cet écran.</p>}
        {quoteReview(<button type="button" className={styles.primary} disabled={saveLocked || !quote || !affordable || adoptionBlocked || productionInstallationBlocked || occupiedServiceChanged} onClick={async () => { if (await save()) continueLeaving(); }}>{pending ? "Enregistrement…" : `${installLabel} et quitter`}</button>, true)}
        <button type="button" className={styles.secondary} onClick={() => setPendingLeave(null)}>Continuer à modifier</button>
        <button type="button" className={styles.secondary} disabled={pending || saveOutcome === "unknown"} onClick={continueLeaving}>{draftStored ? "Quitter en gardant le brouillon" : "Quitter sans enregistrer"}</button>
      </div>
    </AppDialog>
    <AppDialog open={reloadPlanOpen} onClose={() => setReloadPlanOpen(false)} title="Recharger le plan enregistré" className={styles.zoneDialog}>
      <p>L’aperçu local sera remplacé par le plan enregistré. Les modifications non confirmées seront abandonnées.</p>
      <button type="button" className={styles.secondary} onClick={() => setReloadPlanOpen(false)}>Garder l’aperçu</button>
      <button type="button" className={styles.primary} data-warehouse-reconcile-confirm disabled={pending || loading || saveOutcome === "unknown"} onClick={async () => { if (await load(undefined, false, true)) setReloadPlanOpen(false); }}>Recharger</button>
    </AppDialog>
  </div>;
}
