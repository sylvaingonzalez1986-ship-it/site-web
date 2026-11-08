"use client";

import { useEffect, useState } from "react";
import { getKqPlayerSkills, getKqPlayerWorkday, type KqPlayerWorkAvailability } from "@/lib/kanab-quest-player-work";
import type { KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqProgressMeter } from "./KqVisuals";
import { KqPlayerWorkDetails } from "./KqPlayerWorkDetails";
import styles from "./KqPlayerWorkStatus.module.css";

const events = ["kq:staff-updated", "kq:player-work-updated", "arena:progress-updated", "kq:equipment-updated", "kq:market-updated", "kq:commerce-updated", "kq:storage-updated", "kq:social-updated", "kq:treasury-updated", "kq:collection-updated"];
const hours = (value: number) => `${value.toLocaleString("fr-FR")} h`;

/** One server-owned allowance, displayed across destinations without client-side resets. */
export function KqPlayerWorkStatus({ view, onOpenPersonal, onAvailabilityChange }: { view: string; onOpenPersonal: () => void; onAvailabilityChange?: (value: KqPlayerWorkAvailability) => void }) {
  const api = useKqTutorialApi();
  const [snapshot, setSnapshot] = useState<KqStaffSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false, sequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let queued: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function load() {
      const current = ++sequence;
      controller?.abort(); controller = new AbortController();
      onAvailabilityChange?.({ status: "loading" });
      try {
        const response = await api.request("/api/arena/placard/staff", { cache: "no-store", signal: controller.signal });
        const data = await response.json() as KqStaffSnapshot;
        if (!response.ok || !data.state || !data.calendar || !Number.isFinite(Date.parse(data.serverNow))
          || !Number.isFinite(Date.parse(data.calendar.nextDayAt)) || Date.parse(data.calendar.nextDayAt) <= Date.parse(data.serverNow)) throw new Error("unavailable");
        const workday = getKqPlayerWorkday(data);
        if (!Number.isFinite(workday.usedHours) || workday.usedHours < 0 || workday.usedHours > 12) throw new Error("invalid");
        if (cancelled || current !== sequence) return;
        setSnapshot(data); setError(false);
        onAvailabilityChange?.({ status: "ready", workday, serverNow: data.serverNow, skills: getKqPlayerSkills(data.state) });
        clearTimeout(timer);
        // The clock received from the server controls renewal, even on a mis-set device.
        timer = setTimeout(() => { if (!document.hidden) void load(); }, Math.max(1000, Date.parse(data.calendar.nextDayAt) - Date.parse(data.serverNow) + 100));
      } catch {
        if (!cancelled && current === sequence) { setError(true); onAvailabilityChange?.({ status: "unavailable" }); }
      }
    }
    function schedule() {
      if (document.hidden) return;
      sequence += 1; controller?.abort();
      onAvailabilityChange?.({ status: "loading" });
      clearTimeout(queued);
      queued = setTimeout(() => { void load(); }, 180);
    }
    void load();
    const unsubscribe = api.subscribe(events, schedule);
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("focus", schedule);
    return () => { cancelled = true; controller?.abort(); clearTimeout(timer); clearTimeout(queued); unsubscribe(); document.removeEventListener("visibilitychange", schedule); window.removeEventListener("focus", schedule); };
  }, [api, refresh, onAvailabilityChange, view]);
  const workday = snapshot ? getKqPlayerWorkday(snapshot) : null;
  const skills = snapshot && !error ? getKqPlayerSkills(snapshot.state) : null;
  return <aside className={styles.status} aria-label="Ta réserve de travail" data-player-work-status>
    <div className={styles.top}>
      {workday && !error ? <KqProgressMeter label="Temps restant aujourd’hui" value={workday.remainingHours} max={workday.dailyHours}
        valueLabel={`${hours(workday.remainingHours)} / ${hours(workday.dailyHours)}`} tone={workday.remainingHours ? "teal" : "red"} />
        : <p role="status">{error ? "Temps de travail indisponible. Actualise avant de prévoir ta journée." : "Chargement de ton temps disponible…"}</p>}
      {error ? <button type="button" onClick={() => setRefresh(value => value + 1)}>Actualiser</button>
        : view !== "staff" ? <button type="button" aria-label="Organiser ma journée" onClick={onOpenPersonal}>Ma journée</button> : null}
    </div>
    <details><summary>Temps des activités et prochaine journée</summary>
      <KqPlayerWorkDetails key={view} view={view} workday={!error ? workday : null} skills={skills} />
    </details>
  </aside>;
}
