"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Pin, PinOff, RefreshCw } from "lucide-react";
import { KQ_MISSION_COPY, type KqMission, type KqMissionCode } from "@/lib/kanab-quest-missions";
import { kqPinnedMissionKey, readKqPinnedMission, readKqPinnedMissionProgress, writeKqPinnedMission } from "@/lib/kanab-quest-pinned-mission";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqPinnedMission.module.css";

type FocusPreference = { code: KqMissionCode | null; loaded: boolean; unavailable: boolean; choose: (code: KqMissionCode | null) => void };
const FocusContext = createContext<FocusPreference | null>(null);

/** Scope the preference to the signed-in game. Tutorial portals never offer pin controls. */
export function KqMissionFocusProvider({ ownerId, children }: { ownerId?: string; children: ReactNode }) {
  const [state, setState] = useState({ code: null as KqMissionCode | null, loaded: false, unavailable: false });
  useEffect(() => {
    const read = () => {
      if (!ownerId) return { code: null, unavailable: true };
      try { return readKqPinnedMission(window.localStorage, ownerId); }
      catch { return { code: null, unavailable: true }; }
    };
    const frame = requestAnimationFrame(() => setState({ ...read(), loaded: true }));
    const synchronize = (event: StorageEvent) => {
      if (ownerId && (event.key === kqPinnedMissionKey(ownerId) || event.key === null)) setState({ ...read(), loaded: true });
    };
    window.addEventListener("storage", synchronize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("storage", synchronize); };
  }, [ownerId]);
  const choose = useCallback((code: KqMissionCode | null) => {
    let persisted = false;
    try { persisted = !!ownerId && writeKqPinnedMission(window.localStorage, ownerId, code); } catch { /* Keep the choice for this mounted game. */ }
    setState({ code, loaded: true, unavailable: !persisted });
  }, [ownerId]);
  return <FocusContext value={{ ...state, choose }}>{children}</FocusContext>;
}

export function KqMissionPinButton({ mission, disabled = false }: { mission: KqMission; disabled?: boolean }) {
  const focus = useContext(FocusContext), api = useKqTutorialApi();
  if (!focus || api.isTutorial || mission.claimed || !mission.unlocked) return null;
  const selected = focus.code === mission.code;
  return <button type="button" className={styles.pin} data-pin-mission={mission.code} aria-pressed={selected}
    aria-label={`${selected ? "Ne plus suivre" : "Épingler"} : ${KQ_MISSION_COPY[mission.code].title}`}
    disabled={disabled || !focus.loaded} onClick={() => focus.choose(selected ? null : mission.code)}>
    {selected ? <PinOff size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}{selected ? "Épinglé au Quartier" : "Épingler au Quartier"}
  </button>;
}

export function KqMissionFocusNotice() {
  const focus = useContext(FocusContext), api = useKqTutorialApi();
  if (!focus || api.isTutorial) return null;
  return <p className={styles.notice} role="status">{focus.code ? <>Objectif épinglé : <strong>{KQ_MISSION_COPY[focus.code].title}</strong>. Les autres missions continuent à progresser.</> : "Épingle un défi pour le retrouver dans le Quartier. Les autres missions continuent à progresser."}
    {focus.unavailable && focus.code ? " Ce choix reste valable ici, mais ce navigateur ne peut pas le sauvegarder." : null}</p>;
}

export function KqPinnedMission({ onChoose, onContinue }: { onChoose: () => void; onContinue: (code: KqMissionCode) => void }) {
  const focus = useContext(FocusContext), api = useKqTutorialApi();
  const code = focus?.code ?? null;
  const [result, setResult] = useState<{ code: KqMissionCode; mission: KqMission | null; error: boolean } | null>(null);
  const [revision, setRevision] = useState(0);
  const chooseButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!code || api.isTutorial) return;
    const controller = new AbortController();
    let version = 0;
    const load = async () => {
      const current = ++version;
      try {
        const response = await api.request("/api/arena/placard/missions", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        const body: unknown = await response.json();
        const mission = response.ok ? readKqPinnedMissionProgress(body, code) : null;
        if (!controller.signal.aborted && current === version) setResult({ code, mission, error: !mission });
      } catch {
        if (!controller.signal.aborted && current === version) setResult({ code, mission: null, error: true });
      }
    };
    const polling = startArenaVisiblePolling(load, 60_000);
    const refresh = () => { void polling.refresh(); };
    const unsubscribe = api.subscribe(["kq:missions-updated", "kq:storage-updated", "kq:commerce-updated", "arena:progress-updated"], refresh);
    return () => { controller.abort(); polling(); unsubscribe(); };
  }, [api, code, revision]);
  if (!focus || !focus.loaded || api.isTutorial) return null;
  if (!code) return <div className={styles.empty}><button ref={chooseButton} type="button" className={styles.pin} onClick={onChoose}><Pin size={16} aria-hidden="true" />Choisir un objectif<ArrowRight size={16} aria-hidden="true" /></button></div>;
  const copy = KQ_MISSION_COPY[code], current = result?.code === code ? result : null, mission = current?.mission;
  return <section className={styles.focus} aria-label="Mon objectif épinglé" data-pinned-mission={code}>
    <header><div><span><Pin size={15} aria-hidden="true" />Mon objectif</span><h2>{copy.title}</h2></div>
      <button type="button" className={styles.pin} onClick={() => { focus.choose(null); requestAnimationFrame(() => chooseButton.current?.focus()); }} aria-label="Retirer l’objectif épinglé"><PinOff size={16} aria-hidden="true" />Retirer</button></header>
    {mission ? <>
      <KqProgressMeter label={copy.progressLabel} value={mission.progress} max={mission.target} valueLabel={`${mission.progress.toLocaleString("fr-FR")} / ${mission.target.toLocaleString("fr-FR")}`} />
      {mission.claimed ? <p>Objectif accompli, récompense récupérée.</p> : mission.claimable ? <p>Objectif atteint · récompense à récupérer dans Missions.</p> : !mission.unlocked ? <p>Récupère la récompense précédente pour débloquer cette étape.</p> : null}
      <button type="button" className={styles.pin} onClick={() => mission.claimed || mission.claimable || !mission.unlocked ? onChoose() : onContinue(code)}>{mission.claimed ? "Choisir un autre objectif" : mission.claimable ? "Voir ma récompense" : !mission.unlocked ? "Voir les étapes" : copy.action}<ArrowRight size={16} aria-hidden="true" /></button>
    </> : <p role="status">{current?.error ? <>Progression indisponible. Ton objectif reste épinglé. <button type="button" className={styles.pin} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} aria-hidden="true" />Réessayer</button></> : "Lecture de ta progression…"}</p>}
    {focus.unavailable ? <p className={styles.warning}>Ce navigateur ne peut pas sauvegarder ton choix. Il reste épinglé tant que cette partie est ouverte.</p> : null}
  </section>;
}
