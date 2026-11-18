"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearFinanceRecovery, financeRecoveryKey, getKqFinanceReconnectHref, readFinanceRecovery, readFinanceResponse, saveFinanceRecovery, sameFinanceCommand, type KqFinanceRecovery, type KqFinanceScope } from "@/lib/kanab-quest-finance-recovery";
import styles from "./KqBankLoans.module.css";
import { kqStaffRecoveryStorage, useKqStaffRecoveryOwner } from "./KqStaffRecoveryContext";
import { useKqTutorialApi } from "./KqTutorialApiContext";

export function useKqFinanceRecovery(scope: KqFinanceScope) {
  const api = useKqTutorialApi(), account = useKqStaffRecoveryOwner();
  const owner = api.isTutorial ? "lesson" : account;
  const [saved, setSaved] = useState<KqFinanceRecovery | null>(null);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const flight = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const sync = useCallback(() => {
    try {
      if (!owner) throw new Error("Le compte doit être identifié avant une opération. Recharge la page.");
      setSaved(readFinanceRecovery(kqStaffRecoveryStorage(api), owner, scope)); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dossier indisponible."); }
  }, [api, owner, scope]);
  useEffect(() => {
    mounted.current = true; setSaved(null); setAuth(false); setBusy(false); sync();
    const changed = (event: StorageEvent) => { if (!flight.current && (event.key === null || event.key === financeRecoveryKey(owner ?? "", scope))) sync(); };
    window.addEventListener("storage", changed);
    return () => { mounted.current = false; flight.current?.abort(); flight.current = null; window.removeEventListener("storage", changed); };
  }, [owner, scope, sync]);
  async function send(command: Record<string, unknown>, summary: string, valid: (body: unknown) => boolean): Promise<unknown> {
    if (flight.current || !owner || auth) return null;
    const controller = new AbortController(); flight.current = controller;
    const current = () => mounted.current && flight.current === controller && !controller.signal.aborted;
    setBusy(true); setError("");
    try {
      const submit = async () => {
        if (!current()) return null;
        const store = kqStaffRecoveryStorage(api);
        const previous = readFinanceRecovery(store, owner, scope);
        if (saved && !previous) throw new Error("Cette confirmation a été traitée dans une autre fenêtre. Actualise le dossier.");
        const dossier = saveFinanceRecovery(store, { version: 1, ownerId: owner, scope, command, summary, sentAt: new Date().toISOString() });
        setSaved(dossier);
        if (!sameFinanceCommand(dossier.command, command)) throw new Error("Une autre confirmation reste à vérifier. Reprends le dossier conservé.");
        const { response, body } = await readFinanceResponse(api.request, scope, { ...dossier.command, ...(!api.isTutorial ? { expectedOwnerId: owner } : {}) }, controller.signal);
        if (!current()) return null;
        if (response.status === 401 || (body && typeof body === "object" && "code" in body && body.code === "finance_owner_changed")) {
          setAuth(true); return null;
        }
        if (!response.ok) {
          // A business rejection is definitive; transport/rate-limit errors remain uncertain.
          if (response.status === 400 || response.status === 409) { clearFinanceRecovery(store, dossier); setSaved(null); }
          throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Résultat incertain. Vérifie cette même confirmation.");
        }
        if (!valid(body)) throw new Error("Réponse incomplète. Vérifie cette même confirmation.");
        clearFinanceRecovery(store, dossier); setSaved(null);
        return body;
      };
      if (api.isTutorial) return await submit();
      if (!navigator.locks) throw new Error("Utilise un navigateur à jour et une connexion HTTPS pour protéger la confirmation entre onglets. Aucune demande envoyée.");
      return await navigator.locks.request(financeRecoveryKey(owner, scope), { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Une confirmation est en cours dans une autre fenêtre. Attends sa réponse.");
        return submit();
      });
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : "Réponse perdue. Vérifie la confirmation conservée.");
      return null;
    } finally { if (current()) { setBusy(false); flight.current = null; } }
  }
  const requireLogin = useCallback(() => setAuth(true), []);
  return { saved, error, auth, busy, send, sync, requireLogin, blocked: busy || auth || !!saved || !!error };
}
export function KqFinanceRecoveryNotice({ recovery, resume }: { recovery: ReturnType<typeof useKqFinanceRecovery>; resume: () => void }) {
  return <div data-finance-recovery aria-live="polite">
    {recovery.error ? <p role="alert">{recovery.error}</p> : null}
    {recovery.auth ? <p role="alert">Ta session a expiré ou le compte connecté a changé. <a href={getKqFinanceReconnectHref(window.location)}>Se reconnecter au même écran</a>. Aucune opération ne sera relancée automatiquement.</p> : null}
    {recovery.saved ? <div><p><strong>Confirmation à vérifier</strong> · {recovery.saved.summary}</p><p>La demande peut avoir été enregistrée. Fermer cet écran ne l’annule pas.</p><button className={styles.primary} type="button" disabled={recovery.busy || recovery.auth} onClick={resume}>{recovery.busy ? "Vérification…" : "Vérifier cette confirmation"}</button></div> : null}
    {recovery.error && !recovery.saved && !recovery.auth ? <button className={styles.primary} type="button" disabled={recovery.busy} onClick={recovery.sync}>Relire le dossier local</button> : null}
  </div>;
}
