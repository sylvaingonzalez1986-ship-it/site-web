"use client";

import { useCallback, useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { isKqCultureWorkQuote, type KqCultureWorkQuote } from "@/lib/kanab-quest-culture-work";
import { getKqPlayerWorkErrorMessage } from "@/lib/kanab-quest-player-work-errors";
import { KQ_STAFF_ROLES } from "@/lib/kanab-quest-staff";
import { ChanvrierAvatar } from "../contest/ChanvrierAvatar";
import { KqStaffPortrait } from "./KqStaffPortrait";
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
  const [result, setResult] = useState<{ key: string; quote: KqCultureWorkQuote | null; error: string } | null>(null);
  const key = `${runId}:${stageIndex}:${phase}:${revision}`;
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!enabled || !runId || phase === "complete") return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await request(`/api/arena/placard/runs/${encodeURIComponent(runId)}/work`, { cache: "no-store", signal: controller.signal });
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
        if (!controller.signal.aborted) setResult({ key, quote, error: "" });
      } catch {
        if (!controller.signal.aborted) setResult({ key, quote: null, error: unavailableHours });
      }
    })();
    return () => controller.abort();
  }, [enabled, runId, stageIndex, phase, request, key]);
  useEffect(() => {
    if (!enabled) return;
    const resume = () => { if (!document.hidden) refresh(); };
    const unsubscribe = api.subscribe(["kq:staff-updated", "kq:player-work-updated"], refresh);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { unsubscribe(); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [api, enabled, refresh]);
  return { quote: result?.key === key ? result.quote : null, error: result?.key === key ? result.error : "", refresh };
}

function PlayerPortrait() {
  const player = useKqSocialPlayer();
  return player.profile ? <ChanvrierAvatar profile={player.profile} view="portrait" /> : <UserRound size={34} aria-hidden="true" />;
}

export function KqCultureWorkStatus({ quote, error, onRefresh, compact = false, detailsOnly = false }: { quote: KqCultureWorkQuote | null; error: string; onRefresh: () => void; compact?: boolean; detailsOnly?: boolean }) {
  const employee = quote?.employee;
  const employeeWorking = quote?.source === "employee" && employee;
  const legacyStage = !!quote && !quote.paid && quote.phase !== "prepare";
  return <aside className={styles.status} aria-label="Travail de cette étape" data-culture-work-status={detailsOnly ? undefined : ""} data-culture-work-details={detailsOnly || undefined} data-compact={compact || undefined} data-work-source={quote?.source}>
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
      {quote.source === "blocked" ? <><p>{employee ? "Réserve davantage d’heures Culture dans Personnel, ou attends le prochain jour travaillé avec une réserve disponible. La culture reste confiée à ton équipe." : "Ta réserve personnelle doit couvrir 0,5 h pour jouer cette étape. Actualise après son renouvellement."}</p><button type="button" onClick={onRefresh}>Actualiser les heures</button></> : null}
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
