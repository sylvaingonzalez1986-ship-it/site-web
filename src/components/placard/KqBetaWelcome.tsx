"use client";

import { useCallback, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Gift } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { dismissBetaNotice, hasDismissedBetaNotice } from "@/lib/arena-beta-notice";
import { KqChapterHeading } from "./KqChapterHeading";
import styles from "./KqBetaWelcome.module.css";

const changed = "kq:beta-notice-dismissed";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback); window.addEventListener(changed, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changed, callback); };
}
const serverSnapshot = () => true;
const unavailableStorage = { getItem: () => null, setItem: () => {} };
function storage() { try { return window.localStorage; } catch { return unavailableStorage; } }

export function KqBetaWelcome({ ownerId, connectionKey, enabled = true }: { ownerId: string; connectionKey?: string | null; enabled?: boolean }) {
  const titleId = useId();
  const snapshot = useCallback(() => !connectionKey || hasDismissedBetaNotice(ownerId, connectionKey, storage()), [ownerId, connectionKey]);
  const dismissed = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const close = () => {
    if (connectionKey) dismissBetaNotice(ownerId, connectionKey, storage());
    window.dispatchEvent(new Event(changed));
  };
  if (!enabled || dismissed) return null;
  return createPortal(<AppDialog open onClose={close} labelledBy={titleId} closeLabel="Fermer l’accueil bêta" className={styles.dialog} bodyClassName={styles.body} dialogProps={{ "data-beta-welcome": true }}>
    <KqChapterHeading art="mailbox" title="Le jeu est en bêta" titleId={titleId} compact />
    <p>Le quartier se construit avec toi. Un bug, une difficulté ou une idée ? <strong>Tes retours sont importants pour améliorer le jeu.</strong></p>
    <p>Sur la carte du quartier, ouvre la <strong>boîte aux lettres</strong> pour écrire à l’équipe.</p>
    <p className={styles.reward}><Gift size={24} aria-hidden="true" /><span>Les contributions utiles peuvent être récompensées par des <strong>packs Botte du Chanvrier</strong>, après validation de l’équipe.</span></p>
    <button type="button" className={styles.play} onClick={close}>C’est compris, je joue !</button>
  </AppDialog>, document.body);
}
