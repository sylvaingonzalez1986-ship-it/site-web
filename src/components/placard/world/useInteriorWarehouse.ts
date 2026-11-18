"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKqTutorialApi } from "../KqTutorialApiContext";
import type { KqWarehouseViewSnapshot } from "../KqWarehouse";
import { createClientRequestKey } from "@/lib/client-request-key";
import { getKqWarehouseDimensions, getKqWarehouseQuote, isKqWarehouseState, type KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { getKqWarehousePlanPayment } from "@/lib/kanab-quest-warehouse-plan-review";
import { getKqWarehouseSpatialLayout, validateKqWarehouseSpatialTransition } from "@/lib/kanab-quest-warehouse-spatial";
import { KQ_WAREHOUSE_CATALOG } from "@/lib/kanab-quest-warehouse-catalog";
import { isKqProductionReservation } from "@/lib/kanab-quest-production-reservation";
import type { InteriorRotation } from "./interior-types";

function validSnapshot(value: unknown): value is KqWarehouseViewSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as KqWarehouseViewSnapshot;
  const money = (amount: unknown) => typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0;
  const quantity = (amount: unknown) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0;
  return isKqWarehouseState(s.state) && money(s.revision) && s.revision >= 1 && money(s.cashCents) && money(s.migrationCreditCents)
    && typeof s.activeRun === "boolean" && typeof s.legacyActiveRun === "boolean"
    && (s.stockGrams === null || quantity(s.stockGrams)) && (s.salesGramsPerDay === null || quantity(s.salesGramsPerDay))
    && (s.storageCapacityGrams === undefined || s.storageCapacityGrams === null || quantity(s.storageCapacityGrams))
    && (s.storageReservedGrams === undefined || s.storageReservedGrams === null || quantity(s.storageReservedGrams))
    && (s.reservedHarvestGrams === undefined || quantity(s.reservedHarvestGrams))
    && (s.activeRuns === undefined || Array.isArray(s.activeRuns) && s.activeRuns.every(run => run && typeof run === "object"
      && typeof run.runId === "string" && !!run.runId && (run.zoneId === null || typeof run.zoneId === "string" && s.state.zones.some(zone => zone.id === run.zoneId)))
      && (s.activeRun || s.activeRuns.length === 0))
    && (s.productionReservation === undefined || isKqProductionReservation(s.productionReservation)
      && (s.productionReservation === null || s.state.zones.some(zone => zone.id === s.productionReservation?.zoneId)));
}

export function useInteriorWarehouse(enabled: boolean, suspended: boolean) {
  const api = useKqTutorialApi();
  const [snapshot, setSnapshot] = useState<KqWarehouseViewSnapshot | null>(null);
  const [draft, setDraft] = useState<KqWarehouseState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled && !suspended);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const alive = useRef(true);
  const mutation = useRef(false);
  const reading = useRef(0);
  const request = useRef<{ fingerprint: string; key: string; body: string } | null>(null);
  const readInFlight = useRef<Promise<boolean> | null>(null);
  const activation = useRef<{ active: boolean; api: typeof api } | null>(null);
  const dirty = !!draft;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async () => {
    if (!enabled || suspended || mutation.current) return false;
    if (readInFlight.current) return readInFlight.current;
    const operation = (async () => {
      const version = ++reading.current;
      setLoading(true); setError("");
      try {
        const response = await api.request("/api/arena/placard/warehouse?layout=spatial", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || "Impossible de charger ton entrepôt.");
        if (!validSnapshot(result)) throw new Error("Le plan reçu est incomplet. Réessaie le chargement.");
        if (!alive.current || reading.current !== version) return false;
        setSnapshot(result);
        return true;
      } catch (reason) {
        if (alive.current && reading.current === version) setError(reason instanceof Error ? reason.message : "Chargement impossible.");
        return false;
      } finally { if (alive.current && reading.current === version) setLoading(false); }
    })();
    readInFlight.current = operation;
    try { return await operation; } finally { if (readInFlight.current === operation) readInFlight.current = null; }
  }, [api, enabled, suspended]);

  // One read on activation, including a return from a real activity panel. The ref
  // also prevents React's development effect replay from starting a second GET.
  useEffect(() => {
    const active = enabled && !suspended;
    const entering = active && (!activation.current?.active || activation.current.api !== api);
    if (!active || activation.current && activation.current.api !== api) {
      // A result from the hidden 3D scene must not replace state loaded by a
      // later visit. Ignore it and read afresh when this scene becomes active.
      ++reading.current;
      readInFlight.current = null;
      setLoading(false);
    }
    activation.current = { active, api };
    if (entering && !dirty) void load();
  }, [api, enabled, suspended, dirty, load]);
  useEffect(() => {
    if (!enabled || suspended) return;
    return api.subscribe(["kq:equipment-updated", "kq:storage-updated", "kq:staff-updated"], () => { if (!dirty && !mutation.current) void load(); });
  }, [api, dirty, enabled, suspended, load]);

  const validation = useMemo(() => snapshot && draft ? validateKqWarehouseSpatialTransition(snapshot.state, draft) : [], [snapshot, draft]);
  const quote = useMemo(() => {
    if (!snapshot || !draft || validation.length) return null;
    try { return getKqWarehouseQuote(draft, snapshot.state); } catch { return null; }
  }, [snapshot, draft, validation]);
  const payment = getKqWarehousePlanPayment(quote, snapshot?.cashCents ?? 0, snapshot?.migrationCreditCents ?? 0);
  const selectedItem = draft && selectedId ? getKqWarehouseSpatialLayout(draft).items.find(item => item.id === selectedId) ?? null : null;
  const item = selectedItem ? { ...selectedItem, deviceCode: selectedItem.deviceCode ?? draft?.zones.find(zone => zone.id === selectedId)?.lightingCode } : null;
  const lockReason = useCallback((id?: string | null) => {
    if (!snapshot) return "Plan indisponible.";
    if (snapshot.legacyActiveRun || snapshot.activeRun && !snapshot.activeRuns?.length || snapshot.activeRuns?.some(run => !run.zoneId)) return "Une culture utilise ce plan. Termine-la avant de modifier son aménagement.";
    if (!id) return "";
    if (snapshot.activeRuns?.some(run => run.zoneId === id)) return "Cette zone accueille une culture. Termine-la avant de modifier son aménagement.";
    if (snapshot.productionReservation && snapshot.productionReservation.zoneId === id) return "Cette zone est réservée à la production commerciale.";
    if (snapshot.productionReservation && snapshot.state.serviceZones?.some(zone => zone.id === id)) return "Le plan de séchage et de stockage est réservé à la production commerciale.";
    return "";
  }, [snapshot]);

  const begin = (id: string) => {
    if (!enabled || suspended || !snapshot || loading || mutation.current || pending || dirty || uncertain || conflict) return false;
    const reason = lockReason(id);
    if (reason) { setError(reason); return false; }
    if (!getKqWarehouseSpatialLayout(snapshot.state).items.some(item => item.id === id)) return false;
    setSelectedId(id); setDraft(structuredClone(snapshot.state)); setError(""); setNotice("");
    return true;
  };
  const place = (x: number, z: number, rotation?: InteriorRotation) => {
    if (!enabled || suspended || !draft || !selectedId || loading || mutation.current || pending || uncertain || conflict) return;
    // Invalid previews stay adjustable; validation gates confirmation, not the preview.
    const baseItem = getKqWarehouseSpatialLayout(draft).items.find(item => item.id === selectedId);
    if (!baseItem) return;
    const { columns, rows } = getKqWarehouseDimensions(draft);
    const partition = draft.partitions?.find(partition => partition.id === selectedId);
    if (partition) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const patch = { x: Math.floor(x + columns / 2), y: Math.floor(z + rows / 2), axis: rotation === undefined ? partition.axis : rotation % 180 === 0 ? "x" as const : "y" as const };
      setDraft({ ...draft, partitions: draft.partitions!.map(item => item.id === selectedId ? { ...item, ...patch } : item) });
      setError(""); return;
    }
    const turn = rotation ?? baseItem.rotation;
    const swap = (turn - baseItem.rotation) % 180 !== 0;
    const width = swap ? baseItem.depth : baseItem.width, height = swap ? baseItem.width : baseItem.depth;
    const patch = { x: Math.round(x + columns / 2 - width / 2), y: Math.round(z + rows / 2 - height / 2), width, height, rotation: turn };
    if (![0, 90, 180, 270].includes(turn) || ![patch.x, patch.y].every(Number.isSafeInteger)) return;
    setDraft({ ...draft, spatial: { version: 1 }, zones: draft.zones.map(zone => zone.id === selectedId ? { ...zone, ...patch } : zone), ...(draft.serviceZones === undefined ? {} : { serviceZones: draft.serviceZones.map(zone => zone.id === selectedId ? { ...zone, ...patch } : zone) }) });
    setError("");
  };
  const add = (kind: "culture" | "drying" | "storage", width: number, depth: number, deviceCode: string, cell?: { x: number; y: number }) => {
    if (!enabled || suspended || !snapshot || loading || dirty || mutation.current || pending || uncertain || conflict) return;
    const device = KQ_WAREHOUSE_CATALOG.find(entry => entry.code === deviceCode && entry.kind === (kind === "culture" ? "lighting" : kind) && entry.purchasable !== false);
    const air = KQ_WAREHOUSE_CATALOG.find(entry => entry.kind === "air" && entry.purchasable !== false);
    const { columns: floorColumns, rows: floorRows } = getKqWarehouseDimensions(snapshot.state);
    if (!device || kind === "culture" && !air || !Number.isSafeInteger(width) || !Number.isSafeInteger(depth) || width < 1 || depth < 1 || width > floorColumns || depth > floorRows) {
      setError("Choisis un matériel compatible et des dimensions entières dans les limites du plan."); return;
    }
    if (kind !== "culture" && snapshot.productionReservation) { setError("Le plan de séchage et de stockage est réservé à la production commerciale."); return; }
    const reason = lockReason();
    if (reason) { setError(reason); return; }
    const id = createClientRequestKey();
    const rect = { id, name: `${kind === "culture" ? "Culture" : kind === "drying" ? "Séchage" : "Stockage"} ${snapshot.state.zones.length + (snapshot.state.serviceZones?.length ?? 0) + 1}`, x: 0, y: 0, width, height: depth, rotation: 0 as const };
    const next: KqWarehouseState = { ...snapshot.state, spatial: { version: 1 }, ...(kind === "culture" ? { zones: [...snapshot.state.zones, { ...rect, active: true, lightingCode: deviceCode, airCode: air!.code }] }
      : { serviceZones: [...(snapshot.state.serviceZones ?? []), { ...rect, kind, deviceCode }] }) };
    if (cell) {
      const atCell = { ...next, zones: next.zones.map(zone => zone.id === id ? { ...zone, ...cell } : zone), ...(next.serviceZones === undefined ? {} : { serviceZones: next.serviceZones.map(zone => zone.id === id ? { ...zone, ...cell } : zone) }) };
      setDraft(atCell); setSelectedId(id); setNotice(""); setError(""); return;
    }
    // Prefer the first accessible free location, then let the player adjust the preview.
    const { columns, rows } = getKqWarehouseDimensions(next);
    let found = false;
    for (let y = 0; y <= rows - depth && !found; y++) for (let x = 0; x <= columns - width && !found; x++) {
      const candidate = { ...next, zones: next.zones.map(zone => zone.id === id ? { ...zone, x, y } : zone), ...(next.serviceZones === undefined ? {} : { serviceZones: next.serviceZones.map(zone => zone.id === id ? { ...zone, x, y } : zone) }) };
      if (!validateKqWarehouseSpatialTransition(snapshot.state, candidate).length) { setDraft(candidate); found = true; }
    }
    if (!found) { setError("Aucun emplacement libre de cette taille avec un passage accessible."); return; }
    setSelectedId(id); setNotice(""); setError("");
  };
  const addPartition = (cell: { x: number; y: number }) => {
    if (!enabled || suspended || !snapshot || loading || dirty || mutation.current || pending || uncertain || conflict) return;
    const reason = lockReason();
    if (reason) { setError(reason); return; }
    const id = createClientRequestKey();
    setDraft({ ...snapshot.state, spatial: { version: 1 }, partitions: [...(snapshot.state.partitions ?? []), { id, ...cell, axis: "x", length: 1 }] });
    setSelectedId(id); setError(""); setNotice("");
  };
  const updatePartition = (patch: { axis?: "x" | "y"; length?: number }) => {
    if (!enabled || suspended || !draft || !selectedId || mutation.current || pending || uncertain || conflict) return;
    if (patch.length !== undefined && (!Number.isSafeInteger(patch.length) || patch.length < 1)) return;
    setDraft({ ...draft, partitions: draft.partitions?.map(item => item.id === selectedId ? { ...item, ...patch } : item) });
    setError("");
  };
  const removePartition = (id: string) => {
    if (!enabled || suspended || !snapshot || loading || dirty || mutation.current || pending || uncertain || conflict) return;
    const reason = lockReason();
    if (reason) { setError(reason); return; }
    if (!snapshot.state.partitions?.some(item => item.id === id)) return;
    setDraft({ ...snapshot.state, partitions: snapshot.state.partitions.filter(item => item.id !== id) });
    setSelectedId(id); setError(""); setNotice("");
  };
  const changeDevice = (code: string) => {
    if (!enabled || suspended || !draft || !selectedId || mutation.current || pending || uncertain || conflict) return;
    const item = getKqWarehouseSpatialLayout(draft).items.find(item => item.id === selectedId);
    if (!item || item.kind === "partition") return;
    const device = KQ_WAREHOUSE_CATALOG.find(entry => entry.code === code && entry.kind === (item.kind === "culture" ? "lighting" : item.kind) && entry.purchasable !== false);
    if (!device) return;
    setDraft({ ...draft, zones: draft.zones.map(zone => zone.id === selectedId ? { ...zone, lightingCode: code } : zone), ...(draft.serviceZones === undefined ? {} : { serviceZones: draft.serviceZones.map(zone => zone.id === selectedId ? { ...zone, deviceCode: code } : zone) }) });
    setError("");
  };
  const cancel = () => { if (enabled && !suspended && !mutation.current && !pending && !uncertain) { setDraft(null); setSelectedId(null); setError(""); setConflict(false); request.current = null; } };
  const reload = async () => {
    if (!enabled || suspended || mutation.current || pending) return;
    if (await load()) { setDraft(null); setSelectedId(null); setConflict(false); setUncertain(false); request.current = null; }
  };
  const save = async () => {
    if (!enabled || suspended || loading || !snapshot || !draft || !quote || !payment.affordable || conflict || mutation.current) return false;
    const body = { expectedRevision: snapshot.revision, state: draft, expectedCostCents: quote.totalCostCents };
    const fingerprint = JSON.stringify(body);
    if (uncertain && (!request.current || request.current.fingerprint !== fingerprint)) return false;
    if (request.current?.fingerprint !== fingerprint) {
      const key = createClientRequestKey();
      request.current = { fingerprint, key, body: JSON.stringify({ ...body, requestKey: key }) };
    }
    const confirmedRequest = request.current;
    let definiteRejection = false;
    mutation.current = true; ++reading.current; setPending(true); setError("");
    try {
      const response = await api.request("/api/arena/placard/warehouse", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: confirmedRequest.body, signal: AbortSignal.timeout(20_000) });
      const result = await response.json();
      if (!response.ok) {
        definiteRejection = response.status >= 400 && response.status < 500 && response.status !== 408;
        if (alive.current) { setConflict(response.status === 409); setUncertain(!definiteRejection); }
        throw new Error(typeof result?.error === "string" ? result.error : "Aménagement refusé.");
      }
      if (!validSnapshot(result) || result.revision <= body.expectedRevision) throw new Error("Reçu incomplet. Vérifie le plan enregistré avant une autre modification.");
      if (alive.current) { setSnapshot(result); setDraft(null); setSelectedId(null); setConflict(false); setUncertain(false); setNotice("Aménagement enregistré."); }
      request.current = null;
      api.notify("kq:equipment-updated"); api.notify("kq:storage-updated");
      return true;
    } catch (reason) {
      if (alive.current) { setUncertain(!definiteRejection); setError(reason instanceof Error ? reason.message : "Enregistrement impossible."); }
      return false;
    } finally { mutation.current = false; if (alive.current) setPending(false); }
  };
  return { snapshot, draft, selectedId, setSelectedId, loading, pending, dirty, error, notice, conflict, uncertain, validation, quote, payment, item, lockReason, begin, place, add, addPartition, updatePartition, removePartition, changeDevice, cancel, reload, save };
}
