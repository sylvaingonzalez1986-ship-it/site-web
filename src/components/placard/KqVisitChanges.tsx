"use client";

import { useEffect, useState } from "react";
import { readKqEarlierVisit, type KqVisit } from "@/lib/kanab-quest-last-visit";
import { formatKqCash } from "@/lib/kanab-quest-equipment";

export function KqVisitChanges({ storageKey, at, cashCents, readyLotCount }: KqVisit & { storageKey: string }) {
  const [previous] = useState(() => {
    try { return readKqEarlierVisit(localStorage.getItem(storageKey), { at, cashCents, readyLotCount }); }
    catch { return null; }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ at, cashCents, readyLotCount })); }
    catch { /* The current server summary still works when persistence is unavailable. */ }
  }, [storageKey, at, cashCents, readyLotCount]);
  if (!previous) return null;
  const change = cashCents - previous.cashCents;
  return <details><summary>Depuis ton passage du {new Date(previous.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })}</summary>
    <p>Caisse de {formatKqCash(previous.cashCents)} à {formatKqCash(cashCents)} ({change > 0 ? "+" : ""}{formatKqCash(change)}).</p>
    <p>Lots à valoriser au dernier passage · {previous.readyLotCount}. Actuellement · {readyLotCount}.</p>
  </details>;
}
