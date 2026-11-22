"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClientRequestKey } from "@/lib/client-request-key";
import { KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";
import { KQ_WAREHOUSE_PREPARATION_ACCOUNT_HEADER, type KqWarehouseInputCode, type KqWarehousePreparationCommand, type KqWarehousePreparations } from "@/lib/kanab-quest-warehouse-preparations";
import { useKqTutorialApi } from "./KqTutorialApiContext";

type WithoutKey<T> = T extends unknown ? Omit<T, "requestKey"> : never;
const url = "/api/arena/placard/warehouse/preparations";
const storageKey = (account: string) => `kq:preparation:pending:${account}`;

function readPending(account: string | null): KqWarehousePreparationCommand | null {
  if (!account) return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(storageKey(account)) ?? "null");
    return typeof value?.requestKey === "string" && typeof value.action === "string" ? value : null;
  } catch { return null; }
}

function savePending(account: string | null, command: KqWarehousePreparationCommand) {
  if (!account) return;
  try { window.sessionStorage.setItem(storageKey(account), JSON.stringify(command)); } catch { /* The in-screen retry remains available. */ }
}

function clearPending(account: string | null, command: KqWarehousePreparationCommand) {
  if (!account || readPending(account)?.requestKey !== command.requestKey) return;
  try { window.sessionStorage.removeItem(storageKey(account)); } catch { /* The receipt can be read again safely. */ }
}

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
  const account = useRef<string | null>(null);
  const pending = useRef<KqWarehousePreparationCommand | null>(null);
  const fetchState = useCallback(async (command?: KqWarehousePreparationCommand) => {
    if (writing.current) return;
    const version = ++sequence.current;
    const commandAccount = account.current;
    writing.current = !!command;
    setBusy(true);
    setError("");
    if (command?.action === "program" && Object.keys(command.quantities).length) setIrrigationPreparing(command.stationId);
    try {
      const response = await api.request(url, command ? {
        method: "POST", headers: { "Content-Type": "application/json", ...(commandAccount ? { [KQ_WAREHOUSE_PREPARATION_ACCOUNT_HEADER]: commandAccount } : {}) }, body: JSON.stringify(command),
        signal: AbortSignal.timeout(20_000),
      } : { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const data = await response.json();
      const responseAccount = api.isTutorial ? null : response.headers.get(KQ_WAREHOUSE_PREPARATION_ACCOUNT_HEADER);
      if (!response.ok) {
        if (command && commandAccount && responseAccount && commandAccount !== responseAccount) {
          if (version === sequence.current) {
            account.current = null;
            pending.current = null;
            setState(null);
            setLastPackPurchase(null);
          }
        } else if (command && [400, 409, 413].includes(response.status)) {
          clearPending(commandAccount, command);
          if (version === sequence.current) pending.current = null;
        }
        throw new Error(data.error || "Le registre est indisponible.");
      }
      if (!Array.isArray(data.items) || !Array.isArray(data.runs) || !Array.isArray(data.coverage) || !Array.isArray(data.programs) || !data.cleaning
        || (data.entranceAirlock !== undefined && typeof data.entranceAirlock !== "boolean")) throw new Error("Le registre reçu est incomplet.");
      if (command) clearPending(commandAccount, command);
      if (version === sequence.current) {
        setState(data);
        if (!command && responseAccount) {
          if (account.current !== responseAccount) {
            account.current = responseAccount;
            pending.current = readPending(responseAccount);
            setLastPackPurchase(null);
          } else {
            pending.current ??= readPending(responseAccount);
          }
          if (pending.current) setError("Une opération reste à vérifier.");
        }
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
      if (version === sequence.current) {
        if (command?.action === "program") setIrrigationPreparing(undefined);
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
    const stored = readPending(account.current);
    if (stored) {
      pending.current = stored;
      setUncertain(true);
      setError("Une opération reste à vérifier.");
      return;
    }
    if (command.action === "purchasePack") setLastPackPurchase(null);
    pending.current = { ...command, requestKey: createClientRequestKey() };
    savePending(account.current, pending.current);
    void fetchState(pending.current);
  };
  const refresh = () => void fetchState(pending.current ?? undefined);
  return { state, busy, error, uncertain, act, refresh, lastPackPurchase, irrigationPreparing };
}
