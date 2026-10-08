"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { Camera, Check, Send, X } from "lucide-react";
import { MISSION_PROOF_ACCEPT_ATTRIBUTE, MISSION_PROOF_UPLOAD_MAX_BYTES, isSupportedMissionProofMimeType } from "@/lib/mission-proof-policy";
import { formatMissionReward } from "@/lib/community-missions";
import type { MissionSubmission, MissionWithUserStatus } from "@/types/missions";
import styles from "./CommunityMissions.module.css";
import { useKqTutorialApi } from "../placard/KqTutorialApiContext";

export function MissionDialog({ title, children, busy = false, onClose }: { title: string; children: ReactNode; busy?: boolean; onClose: () => void }) {
  const api = useKqTutorialApi();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useBodyScrollLock(true);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const content = <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.getClientRects().length > 0);
    if (!controls.length) { event.preventDefault(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <header className={styles.dialogHeader}><h2 id={titleId}>{title}</h2><button type="button" aria-label="Fermer la mission" disabled={busy} onClick={onClose}><X size={22} aria-hidden="true" /></button></header>
    {children}
  </dialog>;
  return api.isTutorial ? content : createPortal(content, document.body);
}

export function CommunityMissionDialog({ mission, correction, onClose, onSubmitted }: { mission: MissionWithUserStatus; correction?: MissionSubmission; onClose: () => void; onSubmitted: () => void }) {
  const api = useKqTutorialApi();
  const [proofUrl, setProofUrl] = useState(correction?.proofUrl ?? "");
  const [proofText, setProofText] = useState(correction?.proofText ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  const requestKey = useRef(crypto.randomUUID());
  const revision = useRef(correction?.revision);
  const baseId = useId();
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    if (mission.requiresProof && !file && !correction?.proofStoragePath) { setError("Ajoute une capture d’écran avant d’envoyer ta preuve."); return; }
    if (file && (!isSupportedMissionProofMimeType(file.type) || file.size > MISSION_PROOF_UPLOAD_MAX_BYTES || file.size === 0)) { setError("Choisis une image JPG, PNG ou WEBP, de 8 Mo maximum."); return; }
    if (proofUrl.trim()) {
      try { const url = new URL(proofUrl.trim()); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); }
      catch { setError("Ajoute le lien public complet de ta publication, commençant par https://."); return; }
    }
    sending.current = true; setBusy(true); setError("");
    try {
      const body = new FormData();
      body.set("missionId", mission.id); body.set("requestKey", requestKey.current);
      body.set("proofUrl", proofUrl.trim()); body.set("proofText", proofText.trim());
      if (file) body.set("file", file);
      if (correction) { body.set("submissionId", correction.id); body.set("expectedRevision", String(revision.current)); }
      const response = await api.request("/api/account/missions", { method: "POST", body });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Impossible d’envoyer ta preuve. Tes informations sont conservées.");
      api.notify("community:missions-updated");
      onSubmitted();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Connexion interrompue. Tes informations sont conservées, réessaie."); }
    finally { sending.current = false; setBusy(false); }
  }

  return <MissionDialog title={correction ? "Compléter ma preuve" : mission.title} busy={busy} onClose={onClose}>
    <form onSubmit={(event) => void submit(event)} className={styles.form}>
      <p>{mission.description}</p>
      <div className={styles.prize}><Check size={17} aria-hidden="true" /><span>{formatMissionReward(correction ?? mission)} <small>après validation par notre équipe</small></span></div>
      {correction?.adminNote ? <div className={styles.feedback}><strong>À corriger</strong><p>{correction.adminNote}</p></div> : null}
      {mission.proofInstructions ? <div className={styles.instructions}><strong>Pour réussir cette mission</strong><p>{mission.proofInstructions}</p></div> : null}
      <label htmlFor={`${baseId}-file`}>Ta capture d’écran {mission.requiresProof ? "(requise)" : "(facultative)"}</label>
      <div className={styles.upload}><Camera size={25} aria-hidden="true" /><input id={`${baseId}-file`} type="file" accept={MISSION_PROOF_ACCEPT_ATTRIBUTE} disabled={busy} onChange={(event) => { setPreview(null); setFile(event.target.files?.[0] ?? null); setError(""); }} aria-describedby={`${baseId}-file-help`} /><small id={`${baseId}-file-help`}>JPG, PNG ou WEBP · 8 Mo maximum. Masque les informations personnelles inutiles.</small>
        {!file && correction?.proofStoragePath ? <p>Ta capture précédente est conservée. Tu peux la remplacer ici.</p> : null}
        {file ? <p className={styles.fileName}>{file.name}</p> : null}
        {preview ? <>
          {/* Local object URL, revoked when the file changes or the dialog closes. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.preview} src={preview} alt="Aperçu de ta capture" />
        </> : null}
      </div>
      <label htmlFor={`${baseId}-url`}>Lien de la publication ou du profil (si disponible)</label>
      <input id={`${baseId}-url`} type="url" inputMode="url" placeholder="https://…" maxLength={2048} value={proofUrl} disabled={busy} onChange={(event) => setProofUrl(event.target.value)} autoComplete="off" />
      <label htmlFor={`${baseId}-message`}>Un mot pour l’équipe (facultatif)</label>
      <textarea id={`${baseId}-message`} rows={3} maxLength={2000} value={proofText} disabled={busy} onChange={(event) => setProofText(event.target.value)} placeholder="Ton pseudo sur le réseau, une précision…" />
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <p className={styles.help}>Ta preuve est privée : seuls toi et l’équipe de vérification avez accès à ta demande. Le gain est ajouté automatiquement après validation.</p>
      <div className={styles.formActions}><button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>Annuler</button><button type="submit" className={styles.primary} disabled={busy}><Send size={17} aria-hidden="true" />{busy ? "Envoi en cours…" : correction ? "Renvoyer ma preuve" : "Envoyer ma preuve"}</button></div>
    </form>
  </MissionDialog>;
}
