"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClientRequestKey } from "@/lib/client-request-key";
import { KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";
import type { KqWarehouseInputCode, KqWarehousePreparationCommand, KqWarehousePreparations } from "@/lib/kanab-quest-warehouse-preparations";
import { useKqTutorialApi } from "./KqTutorialApiContext";

type WithoutKey<T> = T extends unknown ? Omit<T, "requestKey"> : never;
const url = "/api/arena/placard/warehouse/preparations";

export function useWarehousePreparations(onPaid?: (cashCents: number) => void, enabled = true) {
  const api = useKqTutorialApi();
  const [state, setState] = useState<KqWarehousePreparations | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [irrigationPreparing, setIrrigationPreparing] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [lastPackPurchase, setLastPackPurchase] = useState<{ code: KqWarehouseInputCode; charges: number } | null>(null);
  const sequence = useRef(0);
  const writing = useRef(false);
  const pending = useRef<KqWarehousePreparationCommand | null>(null);
  const fetchState = useCallback(async (command?: KqWarehousePreparationCommand) => {
    if (writing.current) return;
    const version = ++sequence.current;
    writing.current = !!command;
    setBusy(true);
    setError("");
    if (command?.action === "program" && Object.keys(command.quantities).length) setIrrigationPreparing(command.stationId);
    try {
      const response = await api.request(url, command ? {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command),
        signal: AbortSignal.timeout(20_000),
      } : { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const data = await response.json();
      if (!response.ok) {
        if (command && response.status < 500) pending.current = null;
        throw new Error(data.error || "Le registre est indisponible.");
      }
      if (!Array.isArray(data.items) || !Array.isArray(data.runs) || !Array.isArray(data.coverage) || !Array.isArray(data.programs) || !data.cleaning
        || (data.entranceAirlock !== undefined && typeof data.entranceAirlock !== "boolean")) throw new Error("Le registre reçu est incomplet.");
      if (version === sequence.current) {
        setState(data);
        if (command) {
          pending.current = null;
          if (command.action === "purchasePack") {
            const item = (data as KqWarehousePreparations).items.find(i => i.code === command.code);
            if (item?.kind === "consumable" && item.chargesPerPack) setLastPackPurchase({ code: command.code, charges: item.chargesPerPack * command.quantity });
          }
          onPaid?.(data.cashCents);
          api.notify("kq:preparations-updated", { cashCents: data.cashCents });
          if (command.action === "use") api.notify("kq:provision-used");
          if (command.action === "clean") api.notify("kq:staff-updated");
        }
      }
    } catch (reason) {
      if (version === sequence.current) setError(reason instanceof Error ? reason.message : "Lecture du registre impossible.");
    } finally {
      if (command) writing.current = false;
      if (command?.action === "program") setIrrigationPreparing(undefined);
      if (version === sequence.current) {
        setUncertain(!!pending.current);
        setBusy(false);
      }
    }
  }, [api, onPaid]);
  useEffect(() => {
    if (!enabled) return;
    const counter = sequence;
    void fetchState();
    const unsubscribe = api.subscribe(["kq:preparations-updated", "kq:equipment-updated", "kq:treasury-updated"], () => {
      if (!pending.current) void fetchState();
    });
    return () => {
      unsubscribe();
      if (!writing.current) counter.current++;
    };
  }, [api, enabled, fetchState]);
  useEffect(() => {
    if (!enabled || !state || uncertain || busy) return;
    const serverNow = state.serverNow ? Date.parse(state.serverNow) : Date.now();
    const dates = [...state.programs.map(p => p.expiresAt), ...Object.values(state.cleaning).flatMap(step => [step.expiresAt, step.pending?.endsAt])];
    const times = dates.flatMap(date => date ? [Date.parse(date)] : []);
    if (state.cleaning.vacuum.expiresAt) times.push(Date.parse(state.cleaning.vacuum.expiresAt) - KQ_GAME_DAY_MS / 24);
    const next = Math.min(...times.filter(time => time > serverNow));
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(() => void fetchState(), Math.max(300, next - serverNow + 100));
    return () => clearTimeout(timer);
  }, [enabled, state, fetchState, uncertain, busy]);
  const act = (command: WithoutKey<KqWarehousePreparationCommand>) => {
    if (!enabled || writing.current || pending.current) return;
    if (command.action === "purchasePack") setLastPackPurchase(null);
    pending.current = { ...command, requestKey: createClientRequestKey() };
    void fetchState(pending.current);
  };
  const refresh = () => void fetchState(pending.current ?? undefined);
  return { state, busy, error, uncertain, act, refresh, lastPackPurchase, irrigationPreparing };
}
