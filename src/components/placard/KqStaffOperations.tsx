"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock3, LoaderCircle, RefreshCw } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { createClientRequestKey } from "@/lib/client-request-key";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_STAFF_SKILLS, parseKqStaffCommand } from "@/lib/kanab-quest-staff";
import { clearKqStaffRecovery, kqStaffRecoveryKey, readKqStaffConfirmation, readKqStaffRecovery, saveKqStaffRecovery, type KqStaffConfirmation, type KqStaffRecovery } from "@/lib/kanab-quest-staff-recovery";
import { getKqStaffAuthProblem, getKqStaffReconnectHref, type KqStaffAuthProblem } from "@/lib/kanab-quest-staff-reauth";
import { KQ_PROSPECTING_DEPARTMENTS } from "@/lib/kanab-quest-prospecting";
import type { KqStaffCommand, KqStaffSnapshot, KqStaffTask } from "@/lib/kanab-quest-staff-types";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { kqStaffRecoveryStorage, useKqStaffRecoveryOwner } from "./KqStaffRecoveryContext";
import styles from "./KqStaffDesk.module.css";

const money = formatKqCash;
const dateTime = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export type { KqStaffConfirmation } from "@/lib/kanab-quest-staff-recovery";
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
  const accountOwner = useKqStaffRecoveryOwner();
  const ownerId = api.isTutorial ? "lesson" : accountOwner;
  const scope = useRef({ api, ownerId });
  if (scope.current.api !== api || scope.current.ownerId !== ownerId) scope.current = { api, ownerId };
  const [stateScope, setStateScope] = useState(scope.current);
  const active = stateScope === scope.current;
  const mounted = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const [recovery, setRecovery] = useState<KqStaffRecovery | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  const [authProblem, setAuthProblem] = useState<KqStaffAuthProblem | null>(null);
  const authProblemRef = useRef<KqStaffAuthProblem | null>(null);
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
  const requireLogin = useCallback((problem: KqStaffAuthProblem) => {
    authProblemRef.current = problem; setAuthProblem(problem);
    generation.current += 1; setLoading(false); setError(""); setMutationError("");
  }, []);
  const syncRecovery = useCallback(() => {
    if (busyRef.current) return;
    try {
      if (!ownerId) { setRecoveryError("Le compte doit être identifié avant de confirmer une action. Recharge la page."); return; }
      const saved = readKqStaffRecovery(kqStaffRecoveryStorage(api), ownerId);
      setRecovery(saved); setRecoveryError("");
      if (pendingRef.current) {
        if (saved) { setPending(saved.confirmation); setMutationError("Cette confirmation est aussi ouverte dans une autre fenêtre. Reprends le dossier conservé."); }
        else {
          pendingRef.current = false; setPending(null);
          setError("Ce dossier a été fermé dans une autre fenêtre. Actualise Personnel avant de préparer une nouvelle action.");
        }
      }
    } catch (cause) { setRecoveryError(cause instanceof Error ? cause.message : "Le dossier conservé sur cet appareil est indisponible. Aucune nouvelle demande ne sera envoyée."); }
  }, [api, ownerId]);
  useEffect(() => {
    mounted.current = true;
    setStateScope(scope.current); setSnapshot(null); setSnapshotReceivedAt(undefined); setPending(null); setRecovery(null);
    setError(""); setNotice(""); setMutationError(""); setLoading(true); setBusy(false);
    authProblemRef.current = null; setAuthProblem(null);
    latestSnapshot.current = null; pendingRef.current = false; busyRef.current = false; confirmationOrigin.current = null;
    syncRecovery();
    const changed = (event: StorageEvent) => { if (ownerId && (event.key === kqStaffRecoveryKey(ownerId) || event.key === null)) syncRecovery(); };
    window.addEventListener("storage", changed);
    const unsubscribe = api.subscribe(["kq:staff-confirmation-updated"], syncRecovery);
    return () => { mounted.current = false; requestController.current?.abort(); window.removeEventListener("storage", changed); unsubscribe(); };
  }, [api, ownerId, syncRecovery]);
  const acceptSnapshot = useCallback((next: KqStaffSnapshot) => {
    const current = latestSnapshot.current;
    if (!isKqStaffSnapshot(next) || !current || current.api !== api || busyRef.current || pendingRef.current || authProblemRef.current
      || next.revision < current.value.revision
      || next.revision === current.value.revision && Date.parse(next.serverNow) < Date.parse(current.value.serverNow)) return false;
    generation.current += 1;
    latestSnapshot.current = { api, value: next };
    receivedAt.current = performance.now();
    setSnapshotReceivedAt(receivedAt.current); setSnapshot(next); setError(""); setLoading(false);
    return true;
  }, [api]);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (authProblemRef.current) return;
    const current = ++generation.current;
    const startedScope = scope.current;
    setLoading(true);
    try {
      const response = await api.request("/api/arena/placard/staff", { cache: "no-store", signal });
      const auth = getKqStaffAuthProblem(response.status, null, api.isTutorial);
      if (auth) {
        if (!signal?.aborted && mounted.current && startedScope === scope.current && current === generation.current) requireLogin(auth);
        return;
      }
      const payload: unknown = await response.json();
      if (!response.ok || !isKqStaffSnapshot(payload)) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : api.isTutorial ? `${label} n’est pas encore disponible dans ce mode d’essai.` : `${label} est momentanément indisponible.`;
        throw new Error(message);
      }
      if (!signal?.aborted && mounted.current && startedScope === scope.current && current === generation.current) { receivedAt.current = performance.now(); latestSnapshot.current = { api, value: payload }; setSnapshotReceivedAt(receivedAt.current); setSnapshot(payload); setError(""); }
    } catch (cause) { if (!signal?.aborted && mounted.current && startedScope === scope.current && current === generation.current) setError(cause instanceof Error ? cause.message : `Impossible de charger ${label.toLocaleLowerCase("fr")}.`); }
    finally { if (!signal?.aborted && mounted.current && startedScope === scope.current && current === generation.current) setLoading(false); }
  }, [api, label, requireLogin]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => { controller.abort(); generation.current += 1; }; }, [load, ownerId]);
  useEffect(() => {
    const refresh = () => {
      if (document.hidden || busyRef.current || authProblemRef.current) return;
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
  function openRecovery(saved = recovery) {
    if (!saved || busyRef.current || !active) return;
    confirmationOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pendingRef.current = true; setPending(saved.confirmation); setMutationError("");
  }
  function prepare(confirmation: KqStaffConfirmationDraft) {
    if (!active || busyRef.current || authProblemRef.current) return;
    try {
      if (!ownerId) throw new Error("Le compte doit être identifié avant de confirmer une action. Recharge la page.");
      const saved = readKqStaffRecovery(kqStaffRecoveryStorage(api), ownerId);
      if (saved) { setRecovery(saved); openRecovery(saved); return; }
      setRecoveryError("");
      confirmationOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      pendingRef.current = true; setMutationError(""); setNotice(""); setPending({ ...confirmation, command: parseKqStaffCommand(confirmation.command), requestKey: createClientRequestKey() });
    } catch { setRecoveryError("Impossible de conserver une confirmation sur cet appareil. Autorise le stockage du site, puis réessaie. Aucune nouvelle demande n’a été envoyée."); }
  }
  async function confirm() {
    if (!pending || busyRef.current || !active || !ownerId || authProblemRef.current) return;
    const startedScope = scope.current;
    const abort = new AbortController(); requestController.current = abort;
    const current = () => mounted.current && scope.current === startedScope && !abort.signal.aborted;
    busyRef.current = true; setBusy(true); setMutationError(""); generation.current += 1;
    try {
      const submit = async () => {
        let saved: KqStaffRecovery;
        let wasUncertain = !!recovery;
        try {
          if (!current() || authProblemRef.current) return;
          const storage = kqStaffRecoveryStorage(api);
          const previous = readKqStaffRecovery(storage, ownerId);
          if (recovery && !previous) {
            // Another tab already resolved this dossier while its presentation was open.
            setRecovery(null); setPending(null); pendingRef.current = false;
            setError("Ce dossier a été fermé dans une autre fenêtre. Actualise Personnel avant de préparer une nouvelle action.");
            return;
          }
          wasUncertain ||= !!previous;
          saved = saveKqStaffRecovery(storage, { version: 1, ownerId, sentAt: new Date().toISOString(), confirmation: pending });
        } catch { throw new Error("Impossible de conserver cette confirmation sur cet appareil. Autorise le stockage du site, puis réessaie. La demande n’a pas été envoyée."); }
        if (!current()) return;
        setRecovery(saved); setRecoveryError("");
        if (saved.confirmation.requestKey !== pending.requestKey || JSON.stringify(saved.confirmation.command) !== JSON.stringify(pending.command)) {
          setPending(saved.confirmation); throw new Error("Une autre confirmation attend déjà son résultat. Reprends ce dossier avant de lancer une nouvelle action.");
        }
        api.notify("kq:staff-confirmation-updated");
        const { response, payload } = await readKqStaffConfirmation(api.request, { ...pending.command, requestKey: pending.requestKey, ...(!api.isTutorial ? { expectedOwnerId: ownerId } : {}) }, abort.signal);
        if (!current()) return;
        const auth = getKqStaffAuthProblem(response.status, payload, api.isTutorial);
        if (auth) { requireLogin(auth); return; }
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : null;
        if (!response.ok || !isKqStaffSnapshot(payload)) {
          // A first explicit rejection has no unresolved earlier invocation. A later
          // rejection cannot prove that a previously lost request will not commit.
          if (response.status === 400 && message && !wasUncertain) {
            clearKqStaffRecovery(kqStaffRecoveryStorage(api), ownerId, pending.requestKey);
            setRecovery(null); api.notify("kq:staff-confirmation-updated");
          }
          throw new Error(message ?? "La confirmation reçue est incomplète. Réessaie avec ce même dossier.");
        }
        try { clearKqStaffRecovery(kqStaffRecoveryStorage(api), ownerId, pending.requestKey); setRecovery(null); setRecoveryError(""); }
        catch { setRecoveryError("Le résultat est confirmé, mais sa copie locale n’a pas pu être effacée. Elle pourra être vérifiée à nouveau sans répéter l’action."); }
        receivedAt.current = performance.now(); deferredRefresh.current = false;
        setSnapshotReceivedAt(receivedAt.current);
        latestSnapshot.current = { api, value: payload }; pendingRef.current = false;
        setSnapshot(payload); setError(""); setPending(null);
        setNotice(pending.command.action === "set-administration-rules" ? pending.command.enabled ? "Règles enregistrées. Les prochaines missions Administration pourront régler les documents autorisés, dans tes limites. Aucun débit immédiat." : "Paiements délégués désactivés. Les missions continuent à négocier les remises." : pending.command.action === "renew-contract" ? "Contrat prolongé. La date d’embauche, les congés et les compétences sont conservés. Aucun débit immédiat." : pending.command.action === "convert-cdi" ? "Passage en CDI confirmé, sans date de fin. Ancienneté, congés et compétences conservés, sans prime de fin de CDD ni débit immédiat." : pending.command.action === "rehire" ? "Réembauche confirmée. Compétences conservées ; nouvelle paie et nouveaux congés. La semaine type est à reprogrammer. Aucun débit immédiat." : pending.command.action === "set-weekly-plan" ? pending.command.enabled ? "Semaine type enregistrée et active dès le prochain jour du jeu. Aucun frais débité maintenant." : "Semaine type enregistrée en pause. Les tâches déjà réservées continuent." : pending.command.action === "hire" ? "Contrat signé. Retrouve ton nouvel employé dans l’équipe." : pending.command.action === "payroll" ? "Les salaires ont été réglés." : pending.command.action === "extra-hours" ? "Les heures sont disponibles et ajoutées à la paie." : pending.command.action === "pay-invoice" ? "La facture fournisseur a été réglée." : pending.command.action === "leave" ? "Les congés payés sont enregistrés dans le planning." : pending.command.action === "cancel-leave" ? "Les congés sont annulés et les droits sont disponibles." : pending.command.action === "buy-trimmer" ? "La trimeuse est disponible pour toute la ferme." : pending.command.action === "trim" ? "Créneau réservé dans l’Atelier. La progression sera confirmée au fil du travail." : "Travail enregistré. Le résultat apparaîtra à la fin de la tâche.");
        onConfirmed?.(pending.command, { snapshot: payload, previousSnapshot: snapshot, requestKey: pending.requestKey });
        api.notify("kq:treasury-updated"); api.notify("kq:equipment-updated"); api.notify("kq:staff-updated"); api.notify("kq:staff-confirmation-updated");
      };
      if (api.isTutorial) await submit();
      else {
        if (!navigator.locks) throw new Error("Ce navigateur ne permet pas de protéger la confirmation entre plusieurs onglets. Utilise un navigateur à jour et une connexion HTTPS. Aucune demande n’a été envoyée.");
        // Serialize the whole bounded attempt, including definitive rejection cleanup.
        // A competing tab must explicitly retry after this one has finished.
        await navigator.locks.request(kqStaffRecoveryKey(ownerId), { ifAvailable: true }, async lock => {
          if (!current()) return;
          if (!lock) {
            const saved = readKqStaffRecovery(kqStaffRecoveryStorage(api), ownerId);
            if (saved) { setRecovery(saved); setPending(saved.confirmation); }
            else { setPending(null); pendingRef.current = false; setError("Une confirmation est en cours dans une autre fenêtre. Actualise Personnel avant de préparer une nouvelle action."); }
            throw new Error("Cette confirmation est en cours dans une autre fenêtre. Attends sa réponse avant de réessayer.");
          }
          await submit();
        });
      }
    } catch (cause) { if (current()) setMutationError(cause instanceof Error ? cause.message : "La réponse n’a pas été reçue. Réessaie cette même confirmation."); }
    finally { if (current()) { busyRef.current = false; setBusy(false); setLoading(false); } }
  }
  return { snapshot: active ? snapshot : null, snapshotReceivedAt, loading: !active || loading, error: active ? error : "", notice: active ? notice : "", pending: active ? pending : null, recovery: active ? recovery : null, recoveryError: active ? recoveryError : "", authProblem: active ? authProblem : null, busy: active && busy, mutationError, confirmationOrigin, load, acceptSnapshot, prepare, confirm, openRecovery: () => openRecovery(), syncRecovery, dismissNotice: () => setNotice(""), cancel: () => { if (!busyRef.current) { pendingRef.current = false; setPending(null); } } };
}
export type KqStaffOperationsController = ReturnType<typeof useKqStaffOperations>;

function StaffReauthNotice({ problem, saved }: { problem: KqStaffAuthProblem; saved: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, [problem]);
  const href = getKqStaffReconnectHref(window.location);
  return <div ref={ref} data-staff-reauth role="alert" tabIndex={-1} className={styles.error}>
    <strong>{problem === "expired" ? "Ta session a expiré" : "Le compte connecté a changé"}</strong>
    <p>{problem === "expired" ? "Reconnecte-toi pour continuer." : "Reconnecte-toi au compte de cette confirmation pour la reprendre."} Tu reviendras sur cet écran.</p>
    {saved ? <p>La demande envoyée reste conservée sur cet appareil pour son compte d’origine. Tu pourras reprendre sa confirmation après connexion.</p> : null}
    <p>Aucune action ne sera relancée automatiquement.</p>
    {/* Full navigation leaves the expired server account context behind. */}
    <a data-staff-reconnect className={`${styles.reconnect} ${styles.primary}`} href={href}>Se reconnecter</a>
  </div>;
}

export function KqStaffOperationsStatus({ controller, label, disabled = false, suppressNotice = false }: { controller: KqStaffOperationsController; label: string; disabled?: boolean; suppressNotice?: boolean }) {
  const { snapshot, loading, busy, error, notice, load } = controller;
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (notice && !suppressNotice) noticeRef.current?.focus(); }, [notice, suppressNotice]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  return <>
    <div className={styles.barHeader}><div><strong>{snapshot ? `${snapshot.calendar.label} · semaine ${snapshot.calendar.week + 1}` : label}</strong>{snapshot ? <small className={styles.muted}>Prochaine journée : {dateTime(snapshot.calendar.nextDayAt)} · heure réelle</small> : null}</div><button type="button" onClick={() => void load()} disabled={disabled || loading || busy || !!controller.authProblem}><RefreshCw size={17} className={loading ? styles.spin : undefined} aria-hidden="true" />{loading ? "Actualisation…" : "Actualiser"}</button></div>
    {controller.authProblem && !controller.pending ? <StaffReauthNotice problem={controller.authProblem} saved={!!controller.recovery} /> : null}
    {error && !controller.authProblem ? <div ref={errorRef} role="alert" tabIndex={-1} className={styles.error}><strong>{label} indisponible</strong><p>{error}</p>{snapshot ? <p>Les dernières données reçues restent affichées. Actualise avant de confirmer une action.</p> : null}<button type="button" disabled={disabled || loading} onClick={() => void load()}>Réessayer</button></div> : null}
    {notice && !suppressNotice ? <p ref={noticeRef} role="status" tabIndex={-1} className={styles.notice}>{notice}</p> : null}
    {!snapshot && loading ? <p className={styles.empty} role="status"><LoaderCircle size={20} className={styles.spin} aria-hidden="true" /> Chargement…</p> : null}
    {controller.recovery ? <div className={styles.notice} data-staff-recovery role="status"><strong>Une confirmation reste à vérifier</strong><p>{controller.recovery.confirmation.title} · envoyée le {dateTime(controller.recovery.sentAt)}.</p><p>Retrouve la demande déjà envoyée avant d’en créer une autre. Fermer sa présentation conserve ce dossier.</p><button type="button" data-staff-recover disabled={busy || !!controller.pending} onClick={controller.openRecovery}>Reprendre cette confirmation</button></div> : null}
    {controller.recoveryError ? <div className={styles.error} role="alert"><p>{controller.recoveryError}</p><button type="button" disabled={busy} onClick={controller.syncRecovery}>Réessayer la lecture du dossier</button></div> : null}
  </>;
}

function ConfirmationDialog({ pending, cashCents, recovering, authProblem, busy, error, origin, close, confirm }: { pending: KqStaffConfirmation; cashCents: number | undefined; recovering: boolean; authProblem: KqStaffAuthProblem | null; busy: boolean; error: string; origin: HTMLElement | null; close: () => void; confirm: () => void }) {
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
    return () => { dialog?.close(); if (cancelled.current) requestAnimationFrame(() => {
      const reconnect = document.querySelector<HTMLAnchorElement>("[data-staff-reconnect]");
      if (reconnect) reconnect.focus();
      else if (previous?.isConnected && !previous.matches(":disabled")) previous.focus();
      else document.querySelector<HTMLButtonElement>("[data-staff-recover]")?.focus();
    }); };
  }, [origin]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const insufficient = !recovering && (cashCents === undefined || pending.debitCents > cashCents);
  return <dialog ref={dialogRef} data-staff-confirmation className={styles.dialog} aria-labelledby="staff-confirm-title" aria-describedby="staff-confirm-description" onCancel={event => { event.preventDefault(); if (!busy) cancel(); }}><div className={styles.dialogContent}>
    <h2 id="staff-confirm-title" ref={titleRef} tabIndex={-1}>{pending.title}</h2><p id="staff-confirm-description">{pending.description}</p>
    {recovering ? <p>{authProblem ? "Les montants ci-dessous sont ceux de la demande initiale." : "Cette demande a déjà été envoyée. Réessaie pour récupérer son résultat ou la faire aboutir si elle n’a pas été enregistrée. La même confirmation ne peut pas déclencher deux fois l’action. Les montants ci-dessous sont ceux de la demande initiale."}</p> : null}
    <dl className={styles.review}>{pending.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}{!recovering && pending.debitCents > 0 && cashCents !== undefined ? <div><dt>Disponible après paiement</dt><dd>{money(cashCents - pending.debitCents)}</dd></div> : null}</dl>
    {insufficient ? <p className={styles.error}>{cashCents === undefined ? "Actualise la trésorerie avant de confirmer." : `La trésorerie disponible (${money(cashCents)}) ne couvre pas ce paiement.`}</p> : null}
    {error ? <p ref={errorRef} className={styles.error} role="alert" tabIndex={-1}>{error}</p> : null}
    {authProblem ? <StaffReauthNotice problem={authProblem} saved={recovering} /> : null}
    <div className={styles.actions}><button type="button" data-staff-confirm-close onClick={cancel} disabled={busy}>{recovering ? "Fermer et conserver" : "Annuler"}</button>{!authProblem ? <button type="button" data-staff-confirm-submit className={styles.primary} onClick={confirm} disabled={busy || insufficient}>{busy ? <LoaderCircle size={18} className={styles.spin} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}{busy ? "Enregistrement…" : error || recovering ? "Réessayer la confirmation" : pending.confirmLabel}</button> : null}</div>
  </div></dialog>;
}

export function KqStaffOperationsConfirmation({ controller }: { controller: KqStaffOperationsController }) {
  const { pending, snapshot, busy, mutationError, confirm, cancel } = controller;
  return pending ? <ConfirmationDialog pending={pending} cashCents={snapshot?.cashCents} recovering={!!controller.recovery} authProblem={controller.authProblem} busy={busy} error={mutationError} origin={controller.confirmationOrigin.current} close={cancel} confirm={() => void confirm()} /> : null;
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
