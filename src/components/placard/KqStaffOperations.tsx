"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock3, LoaderCircle, RefreshCw } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { createClientRequestKey } from "@/lib/client-request-key";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_STAFF_SKILLS } from "@/lib/kanab-quest-staff";
import { KQ_PROSPECTING_DEPARTMENTS } from "@/lib/kanab-quest-prospecting";
import type { KqStaffCommand, KqStaffSnapshot, KqStaffTask } from "@/lib/kanab-quest-staff-types";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqStaffDesk.module.css";

const money = formatKqCash;
const dateTime = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export type KqStaffConfirmation = { title: string; description: string; rows: Array<[string, string]>; command: KqStaffCommand; requestKey: string; debitCents: number; confirmLabel: string };
export type KqStaffConfirmationDraft = Omit<KqStaffConfirmation, "requestKey">;
export type KqStaffConfirmedReceipt = { snapshot: KqStaffSnapshot; previousSnapshot: KqStaffSnapshot | null; requestKey: string };

export function isKqStaffSnapshot(value: unknown): value is KqStaffSnapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<KqStaffSnapshot>;
  return !!data.state && Array.isArray(data.state.employees) && Array.isArray(data.state.tasks) && Array.isArray(data.state.payroll)
    && Array.isArray(data.candidates) && !!data.calendar && !!data.context && typeof data.cashCents === "number"
    && typeof data.outstandingCents === "number" && typeof data.monthlyEmployerCostCents === "number" && typeof data.serverNow === "string"
    && Number.isFinite(Date.parse(data.serverNow)) && Number.isSafeInteger(data.revision) && Number(data.revision) >= 0;
}

/** Personnel and workshop use the same authoritative snapshot and receipt lifecycle. */
export function useKqStaffOperations(label: string, onConfirmed?: (command: KqStaffCommand, receipt: KqStaffConfirmedReceipt) => void, { refreshRecruitment = false }: { refreshRecruitment?: boolean } = {}) {
  const api = useKqTutorialApi();
  const [snapshot, setSnapshot] = useState<KqStaffSnapshot | null>(null);
  const [snapshotReceivedAt, setSnapshotReceivedAt] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<KqStaffConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const busyRef = useRef(false);
  const generation = useRef(0);
  const receivedAt = useRef(0);
  const deferredRefresh = useRef(false);
  const confirmationOrigin = useRef<HTMLElement | null>(null);
  const latestSnapshot = useRef<{ api: typeof api; value: KqStaffSnapshot } | null>(null);
  const pendingRef = useRef(false);
  const acceptSnapshot = useCallback((next: KqStaffSnapshot) => {
    const current = latestSnapshot.current;
    if (!isKqStaffSnapshot(next) || !current || current.api !== api || busyRef.current || pendingRef.current
      || next.revision < current.value.revision
      || next.revision === current.value.revision && Date.parse(next.serverNow) < Date.parse(current.value.serverNow)) return false;
    generation.current += 1;
    latestSnapshot.current = { api, value: next };
    receivedAt.current = performance.now();
    setSnapshotReceivedAt(receivedAt.current); setSnapshot(next); setError(""); setLoading(false);
    return true;
  }, [api]);
  const load = useCallback(async (signal?: AbortSignal) => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const response = await api.request("/api/arena/placard/staff", { cache: "no-store", signal });
      const payload: unknown = await response.json();
      if (!response.ok || !isKqStaffSnapshot(payload)) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : api.isTutorial ? `${label} n’est pas encore disponible dans ce mode d’essai.` : `${label} est momentanément indisponible.`;
        throw new Error(message);
      }
      if (!signal?.aborted && current === generation.current) { receivedAt.current = performance.now(); latestSnapshot.current = { api, value: payload }; setSnapshotReceivedAt(receivedAt.current); setSnapshot(payload); setError(""); }
    } catch (cause) { if (!signal?.aborted && current === generation.current) setError(cause instanceof Error ? cause.message : `Impossible de charger ${label.toLocaleLowerCase("fr")}.`); }
    finally { if (!signal?.aborted && current === generation.current) setLoading(false); }
  }, [api, label]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => { controller.abort(); generation.current += 1; }; }, [load]);
  useEffect(() => {
    const refresh = () => {
      if (document.hidden || busyRef.current) return;
      if (pending) { if (refreshRecruitment) deferredRefresh.current = true; return; }
      deferredRefresh.current = false;
      void load();
    };
    if (deferredRefresh.current && !pending) refresh();
    const timer = window.setInterval(refresh, 60000);
    const unsubscribe = api.subscribe(["kq:staff-updated"], refresh);
    document.addEventListener("visibilitychange", refresh);
    if (refreshRecruitment) window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); unsubscribe(); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [api, load, pending, refreshRecruitment]);
  useEffect(() => {
    if (!refreshRecruitment || !snapshot?.recruitment || pending || busy) return;
    // Only schedule a GET: the server alone decides which offers can be signed.
    const serverDelay = Date.parse(snapshot.recruitment.refreshAt) - Date.parse(snapshot.serverNow);
    if (!Number.isFinite(serverDelay)) return;
    const remaining = serverDelay - (performance.now() - receivedAt.current);
    const timer = window.setTimeout(() => { if (!document.hidden && !busyRef.current) void load(); }, Math.min(2147483647, Math.max(250, remaining)));
    return () => window.clearTimeout(timer);
  }, [refreshRecruitment, snapshot, pending, busy, load]);
  function prepare(confirmation: KqStaffConfirmationDraft) { confirmationOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; pendingRef.current = true; setMutationError(""); setNotice(""); setPending({ ...confirmation, requestKey: createClientRequestKey() }); }
  async function confirm() {
    if (!pending || busyRef.current) return;
    busyRef.current = true; setBusy(true); setMutationError(""); generation.current += 1;
    try {
      const response = await api.request("/api/arena/placard/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...pending.command, requestKey: pending.requestKey }) });
      const payload: unknown = await response.json();
      if (!response.ok || !isKqStaffSnapshot(payload)) throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "La confirmation n’a pas été reçue. Réessaie avec ce même dossier.");
      receivedAt.current = performance.now(); deferredRefresh.current = false;
      setSnapshotReceivedAt(receivedAt.current);
      latestSnapshot.current = { api, value: payload }; pendingRef.current = false;
      setSnapshot(payload); setError(""); setPending(null);
      setNotice(pending.command.action === "set-administration-rules" ? pending.command.enabled ? "Règles enregistrées. Les prochaines missions Administration pourront régler les documents autorisés, dans tes limites. Aucun débit immédiat." : "Paiements délégués désactivés. Les missions continuent à négocier les remises." : pending.command.action === "renew-contract" ? "Contrat prolongé. La date d’embauche, les congés et les compétences sont conservés. Aucun débit immédiat." : pending.command.action === "convert-cdi" ? "Passage en CDI confirmé, sans date de fin. Ancienneté, congés et compétences conservés, sans prime de fin de CDD ni débit immédiat." : pending.command.action === "rehire" ? "Réembauche confirmée. Compétences conservées ; nouvelle paie et nouveaux congés. La semaine type est à reprogrammer. Aucun débit immédiat." : pending.command.action === "set-weekly-plan" ? pending.command.enabled ? "Semaine type enregistrée et active dès le prochain jour du jeu. Aucun frais débité maintenant." : "Semaine type enregistrée en pause. Les tâches déjà réservées continuent." : pending.command.action === "hire" ? "Contrat signé. Retrouve ton nouvel employé dans l’équipe." : pending.command.action === "payroll" ? "Les salaires ont été réglés." : pending.command.action === "extra-hours" ? "Les heures sont disponibles et ajoutées à la paie." : pending.command.action === "pay-invoice" ? "La facture fournisseur a été réglée." : pending.command.action === "leave" ? "Les congés payés sont enregistrés dans le planning." : pending.command.action === "cancel-leave" ? "Les congés sont annulés et les droits sont disponibles." : pending.command.action === "buy-trimmer" ? "La trimeuse est disponible pour toute la ferme." : pending.command.action === "trim" ? "Créneau réservé dans l’Atelier. La progression sera confirmée au fil du travail." : "Travail enregistré. Le résultat apparaîtra à la fin de la tâche.");
      onConfirmed?.(pending.command, { snapshot: payload, previousSnapshot: snapshot, requestKey: pending.requestKey });
      api.notify("kq:treasury-updated"); api.notify("kq:equipment-updated"); api.notify("kq:staff-updated");
    } catch (cause) { setMutationError(cause instanceof Error ? cause.message : "Impossible de confirmer. Tu peux réessayer."); }
    finally { busyRef.current = false; setBusy(false); setLoading(false); }
  }
  return { snapshot, snapshotReceivedAt, loading, error, notice, pending, busy, mutationError, confirmationOrigin, load, acceptSnapshot, prepare, confirm, dismissNotice: () => setNotice(""), cancel: () => { if (!busyRef.current) { pendingRef.current = false; setPending(null); } } };
}
export type KqStaffOperationsController = ReturnType<typeof useKqStaffOperations>;

export function KqStaffOperationsStatus({ controller, label, disabled = false, suppressNotice = false }: { controller: KqStaffOperationsController; label: string; disabled?: boolean; suppressNotice?: boolean }) {
  const { snapshot, loading, busy, error, notice, load } = controller;
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (notice && !suppressNotice) noticeRef.current?.focus(); }, [notice, suppressNotice]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  return <>
    <div className={styles.barHeader}><div><strong>{snapshot ? `${snapshot.calendar.label} · semaine ${snapshot.calendar.week + 1}` : label}</strong>{snapshot ? <small className={styles.muted}>Prochaine journée : {dateTime(snapshot.calendar.nextDayAt)} · heure réelle</small> : null}</div><button type="button" onClick={() => void load()} disabled={disabled || loading || busy}><RefreshCw size={17} className={loading ? styles.spin : undefined} aria-hidden="true" />{loading ? "Actualisation…" : "Actualiser"}</button></div>
    {error ? <div ref={errorRef} role="alert" tabIndex={-1} className={styles.error}><strong>{label} indisponible</strong><p>{error}</p>{snapshot ? <p>Les dernières données reçues restent affichées. Actualise avant de confirmer une action.</p> : null}<button type="button" disabled={disabled || loading} onClick={() => void load()}>Réessayer</button></div> : null}
    {notice && !suppressNotice ? <p ref={noticeRef} role="status" tabIndex={-1} className={styles.notice}>{notice}</p> : null}
    {!snapshot && loading ? <p className={styles.empty} role="status"><LoaderCircle size={20} className={styles.spin} aria-hidden="true" /> Chargement…</p> : null}
  </>;
}

function ConfirmationDialog({ pending, cashCents, busy, error, origin, close, confirm }: { pending: KqStaffConfirmation; cashCents: number; busy: boolean; error: string; origin: HTMLElement | null; close: () => void; confirm: () => void }) {
  useBodyScrollLock(true);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const cancelled = useRef(false);
  function cancel() { cancelled.current = true; close(); }
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = origin ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    dialog?.showModal(); titleRef.current?.focus();
    return () => { dialog?.close(); if (cancelled.current) requestAnimationFrame(() => { if (previous?.isConnected) previous.focus(); }); };
  }, [origin]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const insufficient = pending.debitCents > cashCents;
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="staff-confirm-title" aria-describedby="staff-confirm-description" onCancel={event => { event.preventDefault(); if (!busy) cancel(); }}><div className={styles.dialogContent}>
    <h2 id="staff-confirm-title" ref={titleRef} tabIndex={-1}>{pending.title}</h2><p id="staff-confirm-description">{pending.description}</p><dl className={styles.review}>{pending.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}{pending.debitCents > 0 ? <div><dt>Disponible après paiement</dt><dd>{money(cashCents - pending.debitCents)}</dd></div> : null}</dl>
    {insufficient ? <p className={styles.error}>La trésorerie disponible ({money(cashCents)}) ne couvre pas ce paiement.</p> : null}
    {error ? <p ref={errorRef} className={styles.error} role="alert" tabIndex={-1}>{error}</p> : null}
    <div className={styles.actions}><button type="button" onClick={cancel} disabled={busy}>Annuler</button><button type="button" className={styles.primary} onClick={confirm} disabled={busy || insufficient}>{busy ? <LoaderCircle size={18} className={styles.spin} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}{busy ? "Enregistrement…" : error ? "Réessayer la confirmation" : pending.confirmLabel}</button></div>
  </div></dialog>;
}

export function KqStaffOperationsConfirmation({ controller }: { controller: KqStaffOperationsController }) {
  const { pending, snapshot, busy, mutationError, confirm, cancel } = controller;
  return pending && snapshot ? <ConfirmationDialog pending={pending} cashCents={snapshot.cashCents} busy={busy} error={mutationError} origin={controller.confirmationOrigin.current} close={cancel} confirm={() => void confirm()} /> : null;
}

export function KqStaffTaskList({ snapshot, tasks, title = "Travaux & résultats" }: { snapshot: KqStaffSnapshot; tasks: KqStaffTask[]; title?: string }) {
  if (!tasks.length) return null;
  const sorted = tasks.slice().sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const row = (task: KqStaffTask) => {
    const queued = task.status === "running" && Date.parse(task.startedAt) > Date.parse(snapshot.serverNow);
    const label = task.kind === "production" ? "Production autonome" : task.kind === "training" ? `Formation ${KQ_STAFF_SKILLS[task.skill].toLocaleLowerCase("fr")}` : task.kind === "trim" ? "Trim" : task.kind === "countryside" ? "Sillonner les campagnes" : KQ_STAFF_SKILLS[task.kind];
    if (task.cultureShift || task.processingShift) {
      const used = task.processingShift ? task.processingUsedHours : task.cultureUsedHours;
      const remaining = used === undefined ? null : Math.max(0, task.hours - used);
      const expired = Date.parse(task.completesAt) <= Date.parse(snapshot.serverNow);
      const target = task.processingShift ? task.targetId ? snapshot.context.processingBatches.find(batch => batch.flowerId === task.targetId)?.name ?? "Lot affecté" : "Toutes les transformations" : task.targetId ? snapshot.context.activeRuns.find(run => run.id === task.targetId)?.name ?? "Culture affectée" : "Toutes les cultures";
      return <li key={task.id} data-culture-reservation={task.cultureShift || undefined} data-processing-reservation={task.processingShift || undefined}><div><strong>{snapshot.state.employees.find(employee => employee.id === task.employeeId)?.name ?? "Ancien employé"} · {label}</strong><small>{target}</small><small>{task.hours.toLocaleString("fr-FR")} h réservées · {task.processingShift ? "selon le volume transformé" : "0,5 h par étape"}</small><small>{remaining === null ? "Consommation à vérifier" : `${used!.toLocaleString("fr-FR")} h consommées · ${remaining.toLocaleString("fr-FR")} h ${expired ? "non consommées" : "restantes"}`}</small><small>Réserve {expired ? "close" : "valable"} jusqu’au {dateTime(task.completesAt)}</small>{queued ? <small>Disponible le {dateTime(task.startedAt)}</small> : null}</div><span className={styles.status}>{task.status === "completed" || expired ? "Clôturée" : queued ? "À venir" : remaining === 0 ? "Épuisée" : "Disponible"}</span>{task.outcome ? <p>{task.outcome}</p> : null}</li>;
    }
    return <li key={task.id}><div><strong>{task.employeeId === "player" ? "Toi" : snapshot.state.employees.find(employee => employee.id === task.employeeId)?.name ?? "Ancien employé"} · {label}</strong>{task.department ? <small>{KQ_PROSPECTING_DEPARTMENTS.find(item => item.code === task.department)?.name ?? task.department}</small> : null}<small>{task.hours.toLocaleString("fr-FR")} h réservées · {task.status === "completed" ? "Terminée" : "Fin prévue"} le {dateTime(task.completesAt)}</small>{queued ? <small>Début prévu le {dateTime(task.startedAt)}</small> : null}{task.successChance !== undefined && task.status === "running" ? <small>Chance estimée{task.kind === "countryside" ? " par contact" : ""} : {Math.round(task.successChance)} %</small> : null}</div><span className={styles.status}>{task.status === "completed" ? "Terminé" : queued ? "À venir" : "En cours"}</span>{task.outcome ? <p>{task.outcome}</p> : null}</li>;
  };
  return <section className={styles.panel}><header className={styles.sectionHeader}><h2>{title}</h2><Clock3 size={20} aria-hidden="true" /></header><ul className={styles.taskList}>{sorted.slice(0, 12).map(row)}</ul>{sorted.length > 12 ? <details><summary>{sorted.length - 12} autres travaux</summary><ul className={styles.taskList}>{sorted.slice(12).map(row)}</ul></details> : null}</section>;
}
