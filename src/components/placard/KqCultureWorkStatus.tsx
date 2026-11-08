"use client";

import { useCallback, useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { isKqCultureWorkChoice, isKqCultureWorkQuote, type KqCultureWorkChoice, type KqCultureWorkOption, type KqCultureWorkQuote } from "@/lib/kanab-quest-culture-work";
import { getKqPlayerWorkErrorMessage } from "@/lib/kanab-quest-player-work-errors";
import { KQ_STAFF_ROLES } from "@/lib/kanab-quest-staff";
import { ChanvrierAvatar } from "../contest/ChanvrierAvatar";
import { KqStaffPortrait } from "./KqStaffPortrait";
import { KqWorkActorSelector } from "./KqWorkActorSelector";
import { KqProgressMeter } from "./KqVisuals";
import { KqHelpDashboard, KqHelpGrid, KqHelpNote } from "./KqHelpDashboard";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { useKqSocialPlayer } from "./useKqSocialPlayer";
import styles from "./KqCultureWorkStatus.module.css";

const hours = (value: number) => `${value.toLocaleString("fr-FR")} h`;
const unavailableHours = "Les heures de cette étape sont indisponibles. Actualise pour les vérifier.";
// Only recognized public explanations may be displayed; transport and database
// errors must not leak through a failed quote read.
const publicWorkErrors = new Set([
  "Culture invalide.", "Culture introuvable.",
  "Prise en charge momentanément indisponible. Actualise avant de lancer l’étape.",
  ...["culture_work_exhausted", "culture_work_changed", "player_work_exhausted", "player_work_changed"]
    .map(getKqPlayerWorkErrorMessage),
]);

/** A stale or missing quote cannot authorize a player-hour debit. */
export function useKqCultureWorkQuote({ enabled, runId, stageIndex, phase, request }: {
  enabled: boolean; runId: string | null; stageIndex: number; phase: string; request: typeof fetch;
}) {
  const api = useKqTutorialApi();
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<{ runId: string | null; choice: KqCultureWorkChoice } | null>(null);
  const choice = selection?.runId === runId ? selection.choice : "auto";
  const scope = `${runId}:${stageIndex}`;
  const [optionsSnapshot, setOptionsSnapshot] = useState<{ scope: string; quote: KqCultureWorkQuote } | null>(null);
  const [result, setResult] = useState<{ key: string; quote: KqCultureWorkQuote | null; error: string } | null>(null);
  const key = `${scope}:${phase}:${choice}:${revision}`;
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const selectChoice = useCallback((next: string) => {
    if (phase === "prepare" && isKqCultureWorkChoice(next)) setSelection({ runId, choice: next });
  }, [runId, phase]);
  useEffect(() => {
    if (!enabled || !runId || phase === "complete") return;
    const controller = new AbortController();
    void (async () => {
      try {
        const query = choice === "auto" ? "" : `?workChoice=${encodeURIComponent(choice)}`;
        const response = await request(`/api/arena/placard/runs/${encodeURIComponent(runId)}/work${query}`, { cache: "no-store", signal: controller.signal });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
          const error = response.status === 401 ? "Ta session a expiré. Reconnecte-toi pour vérifier les heures de cette étape."
            : typeof message === "string" && publicWorkErrors.has(message) ? message : unavailableHours;
          if (!controller.signal.aborted) setResult({ key, quote: null, error });
          return;
        }
        const quote = payload && typeof payload === "object" && "quote" in payload ? payload.quote : payload;
        if (!isKqCultureWorkQuote(quote) || quote.runId !== runId || quote.stageIndex !== stageIndex || quote.phase !== phase) throw new Error(unavailableHours);
        if ((quote.choices !== undefined || choice !== "auto") && quote.workChoice !== choice) throw new Error(unavailableHours);
        if (!controller.signal.aborted) {
          setResult({ key, quote, error: "" });
          setOptionsSnapshot({ scope, quote });
        }
      } catch {
        if (!controller.signal.aborted) setResult({ key, quote: null, error: unavailableHours });
      }
    })();
    return () => controller.abort();
  }, [enabled, runId, stageIndex, phase, request, key, choice, scope]);
  useEffect(() => {
    if (!enabled) return;
    const resume = () => { if (!document.hidden) refresh(); };
    const unsubscribe = api.subscribe(["kq:staff-updated", "kq:player-work-updated"], refresh);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { unsubscribe(); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [api, enabled, refresh]);
  const snapshot = optionsSnapshot?.scope === scope ? optionsSnapshot.quote : null;
  const selectedChoice = choice !== "auto" ? choice : snapshot?.employee ? `employee:${snapshot.employee.id}` : "player";
  return { quote: result?.key === key ? result.quote : null, error: result?.key === key ? result.error : "", refresh, choice, selectedChoice,
    choices: snapshot?.choices ?? [], playerRemainingHours: snapshot?.playerRemainingHours, selectChoice };
}

function PlayerPortrait() {
  const player = useKqSocialPlayer();
  return player.profile ? <ChanvrierAvatar profile={player.profile} view="portrait" /> : <UserRound size={34} aria-hidden="true" />;
}

export function KqCultureWorkStatus({ quote, error, onRefresh, compact = false, detailsOnly = false, choices = [], selectedChoice = "player", onSelectChoice, selectionDisabled = false, playerRemainingHours }: {
  quote: KqCultureWorkQuote | null; error: string; onRefresh: () => void; compact?: boolean; detailsOnly?: boolean;
  choices?: KqCultureWorkOption[]; selectedChoice?: string; onSelectChoice?: (choice: string) => void; selectionDisabled?: boolean; playerRemainingHours?: number;
}) {
  const employee = quote?.employee;
  const employeeWorking = quote?.source === "employee" && employee;
  const legacyStage = !!quote && !quote.paid && quote.phase !== "prepare";
  return <aside className={styles.status} aria-label="Travail de cette étape" data-culture-work-status={detailsOnly ? undefined : ""} data-culture-work-details={detailsOnly || undefined} data-compact={compact || undefined} data-work-source={quote?.source}>
    {!detailsOnly && onSelectChoice ? <KqWorkActorSelector label="Qui réalise l’étape ?" value={selectedChoice} onChange={onSelectChoice} disabled={selectionDisabled || !!quote?.paid} options={choices.map(option => ({
      id: option.choice, name: option.employee?.name ?? "Toi",
      portrait: option.employee ? <KqStaffPortrait person={option.employee} /> : <PlayerPortrait />,
      detail: option.employee ? `Niv. ${option.employee.level} · ${hours(option.employee.remainingHours)} disponibles` : playerRemainingHours !== undefined ? `${hours(playerRemainingHours)} disponibles` : undefined,
      disabledReason: option.available ? undefined : option.reason || "Heures indisponibles",
    }))} /> : null}
    {!quote ? <div className={styles.unavailable}><p role="status">{error || "Vérification des heures de cette étape…"}</p>{error ? <button type="button" onClick={onRefresh}>Actualiser les heures</button> : null}</div> : <>
      <div className={styles.top}>
        {!legacyStage ? <span className={styles.portrait} aria-hidden="true">{employee ? <KqStaffPortrait person={employee} /> : <PlayerPortrait />}</span> : null}
        <div className={styles.identity}><strong>{legacyStage ? "Étape déjà engagée" : employeeWorking ? `${employee.name} ${quote.paid ? "a assuré" : "assure"} cette étape` : quote.source === "blocked" ? "Culture en attente" : `Tu ${quote.paid ? "as assuré" : "assures"} cette étape`}</strong>
          <span>{legacyStage ? "Pas de temps supplémentaire pour cette étape." : employeeWorking ? `${hours(quote.stepHours)} sur sa réservation · 0 h pour toi` : quote.source === "blocked" ? quote.reason ?? "La réservation ne couvre plus cette étape." : `${hours(quote.stepHours)} ${quote.paid ? "déjà comptée" : "au lancer"} sur ta journée`}</span>
          {legacyStage && quote.reason ? <small>{quote.reason}</small> : null}
          {quote.paid ? <small>Étape déjà comptabilisée.</small> : null}
        </div>
      </div>
      {employee ? <KqProgressMeter label={`${employee.name} · Culture restante`} value={employee.remainingHours} max={employee.allocatedHours} valueLabel={`${hours(employee.remainingHours)} / ${hours(employee.allocatedHours)}`} tone={employee.remainingHours >= quote.stepHours ? "teal" : "red"} /> : <p className={styles.remaining}>Ta réserve restante : <strong>{hours(quote.playerRemainingHours)}</strong></p>}
      {quote.source === "blocked" ? <><p>{choices.some(option => option.available) ? "Choisis un autre portrait pour prendre le relais." : employee ? "Ajoute des heures Culture dans Personnel, ou attends le prochain jour travaillé." : "Ta réserve personnelle doit couvrir 0,5 h pour jouer cette étape."}</p><button type="button" onClick={onRefresh}>Actualiser les heures</button></> : null}
      {!compact ? <details open={detailsOnly || undefined}><summary>Heures et bonus de cette étape</summary>
        <KqHelpDashboard>
        <KqHelpGrid art="help-time" items={[
          { label: "Une étape", value: "0,5 h" },
          { label: "Six étapes", value: "3 h" },
          { label: "Cartes, soins et validation", value: "0 h en plus", detail: "Étape suivante incluse.", art: "help-care" },
        ]} />
        {employee ? <KqHelpGrid art="help-team" items={[
          { label: employee.name, value: `Culture niv. ${employee.level}`, detail: KQ_STAFF_ROLES[employee.role] },
          { label: "Réservation utilisée", value: `${hours(employee.usedHours)} / ${hours(employee.allocatedHours)}`, art: "help-plan" },
          { label: "Ta réserve", value: hours(quote.playerRemainingHours), art: "help-time" },
        ]} /> : null}
        {!legacyStage ? <><dl><div><dt>Vitalité</dt><dd>+{quote.bonus.vitality.toLocaleString("fr-FR")}</dd></div><div><dt>Terpènes</dt><dd>+{quote.bonus.terpenes.toLocaleString("fr-FR")}</dd></div><div><dt>Rendement</dt><dd>+{quote.bonus.yieldPercent.toLocaleString("fr-FR")} %</dd></div><div><dt>Cannabinoïdes</dt><dd>+{quote.bonus.cannabinoids.toLocaleString("fr-FR")}</dd></div></dl>
          <KqHelpNote>{quote.paid ? "Bonus confirmés pour cette étape." : quote.source === "employee" ? "Bonus appliqués une seule fois, au lancer." : quote.source === "blocked" ? "Étape bloquée : aucune heure ni aucun bonus appliqué." : "Étape personnelle : aucun bonus salarié."}</KqHelpNote></> : null}
        </KqHelpDashboard>
      </details> : null}
    </>}
  </aside>;
}
