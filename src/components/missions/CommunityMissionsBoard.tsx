"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Check, Clock3, Gift, RefreshCw, Users } from "lucide-react";
import { formatMissionReward, getMissionRewardDestination } from "@/lib/community-missions";
import type { MissionSubmission, MissionWithUserStatus, ReferralPendingReward } from "@/types/missions";
import { CommunityMissionDialog, MissionDialog } from "./CommunityMissionDialog";
import styles from "./CommunityMissions.module.css";
import { useKqTutorialApi } from "../placard/KqTutorialApiContext";

export function CommunityMissionWelcome({ title = "Centre de missions", children }: { title?: string; children?: React.ReactNode }) {
  return <header className={styles.welcome}>
    <div><span className={styles.eyebrow}>Le rendez-vous des chanvriers</span><h1 data-arena-tour="missions">{title}</h1><p>Montre tes plus belles Fleurs, relève les défis et fais grandir la communauté.</p>{children ?? <span className={styles.welcomeNote}><Gift size={18} aria-hidden="true" />Packs, Buddies et argent du jeu à gagner</span>}</div>
    <Image src="/contest/mascot/arena-lobby-sylvain-v1.png" alt="Sylvain t’accueille au centre de missions" width={280} height={280} sizes="(max-width: 600px) 120px, 240px" priority />
  </header>;
}

const STATUS_LABELS = { pending: "En vérification", approved: "Validée", rejected: "Refusée", changes_requested: "À compléter" } as const;
const PAGE_SIZE = 4;

function SubmissionHistory({ submission, mission }: { submission: MissionSubmission; mission: MissionWithUserStatus }) {
  const reward = submission.rewardType ? submission : mission;
  const destination = getMissionRewardDestination(reward.rewardType);
  return <li className={styles.historyEntry} data-submission-status={submission.status}>
    <div className={styles.historyHeading}><strong>{submission.missionTitle || mission.title}</strong><span>{STATUS_LABELS[submission.status]}</span></div>
    <small>Envoyée le {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(submission.createdAt))}</small>
    {submission.adminNote ? <p className={styles.reviewNote}><strong>Message de l’équipe : </strong>{submission.adminNote}</p> : null}
    {submission.status === "pending" ? <p>Ta preuve est dans la file de vérification. Tu peux suivre la réponse ici.</p> : null}
    {submission.status === "approved" && submission.rewardGranted ? <p className={styles.earned}><Check size={16} aria-hidden="true" />{formatMissionReward(reward)} ajouté{reward.rewardType === "points" ? "s" : ""}. <Link href={destination.href}>{destination.label}<ArrowRight size={14} aria-hidden="true" /></Link></p> : null}
    {submission.proofUrl?.startsWith("https://") ? <a href={submission.proofUrl} target="_blank" rel="noopener noreferrer" className={styles.proofLink}>Ma publication <ArrowRight size={14} aria-hidden="true" /></a> : null}
  </li>;
}

function ReferralChoice({ reward, onClose, onChosen }: { reward: ReferralPendingReward; onClose: () => void; onChosen: () => void }) {
  const api = useKqTutorialApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  async function choose(choice: "points" | "packs") {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try {
      const response = await api.request("/api/account/referral-choice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pendingRewardId: reward.id, choice }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Impossible de choisir ta récompense.");
      onChosen();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Connexion interrompue. Réessaie."); }
    finally { sending.current = false; setBusy(false); }
  }
  return <MissionDialog title="Ton cadeau de parrainage" busy={busy} onClose={onClose}><div className={styles.form}><p>Ton filleul a passé sa première commande. Choisis ton cadeau :</p><button type="button" className={styles.rewardChoice} disabled={busy} onClick={() => void choose("points")}><strong>{reward.pointsAmount} points fidélité</strong><small>Ajoutés à ton solde du compte</small></button><button type="button" className={styles.rewardChoice} disabled={busy} onClick={() => void choose("packs")}><strong>{reward.packsAmount} pack{reward.packsAmount > 1 ? "s" : ""} Buddies</strong><small>À retrouver dans tes packs Kanab Quest</small></button>{busy ? <p role="status">Attribution en cours…</p> : null}{error ? <p role="alert" className={styles.error}>{error}</p> : null}</div></MissionDialog>;
}

export function CommunityMissionsBoard() {
  const api = useKqTutorialApi();
  const [missions, setMissions] = useState<MissionWithUserStatus[]>([]);
  const [referrals, setReferrals] = useState<ReferralPendingReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"available" | "history">("available");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ mission: MissionWithUserStatus; correction?: MissionSubmission } | null>(null);
  const [choice, setChoice] = useState<ReferralPendingReward | null>(null);
  const version = useRef(0);
  const invalidateRequests = useCallback(() => { version.current++; }, []);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    setLoading(true);
    try {
      const response = await api.request("/api/account/missions", { cache: "no-store" });
      const payload = await response.json() as { error?: string; missions?: MissionWithUserStatus[]; pendingRewards?: ReferralPendingReward[] };
      if (version.current !== request) return;
      setSignedOut(response.status === 401);
      if (!response.ok) throw new Error(payload.error || "Impossible de retrouver tes missions.");
      if (!Array.isArray(payload.missions) || !Array.isArray(payload.pendingRewards)) throw new Error("Impossible de retrouver tes missions. Réessaie dans un instant.");
      setMissions(payload.missions); setReferrals(payload.pendingRewards); setLoaded(true); setError("");
    } catch (failure) { if (version.current === request) setError(failure instanceof Error ? failure.message : "Connexion interrompue. Réessaie."); }
    finally { if (version.current === request) setLoading(false); }
  }, [api]);
  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    const unsubscribe = api.subscribe(["focus", "community:missions-updated"], update);
    return () => { invalidateRequests(); unsubscribe(); };
  }, [refresh, invalidateRequests, api]);

  const active = missions.filter((mission) => mission.isActive || mission.userSubmissions.some((submission) => submission.status === "changes_requested"));
  const history = missions.flatMap((mission) => mission.userSubmissions.map((submission) => ({ mission, submission }))).sort((a, b) => b.submission.createdAt.localeCompare(a.submission.createdAt));
  const pending = history.filter(({ submission }) => submission.status === "pending").length;
  const corrections = history.filter(({ submission }) => submission.status === "changes_requested").length;
  const total = tab === "available" ? active.length : history.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * PAGE_SIZE;
  const pendingReferrals = referrals.filter((reward) => reward.status === "pending");
  const hasChanges = corrections > 0;
  return <section className={styles.board} aria-label="Missions communautaires">
    <div className={styles.sectionHeading}><div><h2>Le tableau des missions</h2><p>Une mission, une preuve, un cadeau après validation.</p></div><button type="button" className={styles.refresh} aria-label="Actualiser les missions communautaires" disabled={loading} onClick={() => void refresh()}><RefreshCw size={19} aria-hidden="true" /></button></div>
    <div className={styles.filters} aria-label="Afficher les missions"><button type="button" aria-pressed={tab === "available"} onClick={() => { setTab("available"); setPage(0); }}>Participer{hasChanges ? <span>{corrections} à compléter</span> : null}</button><button type="button" aria-pressed={tab === "history"} onClick={() => { setTab("history"); setPage(0); }}>Mes envois{pending > 0 ? <span>{pending} en attente</span> : null}</button></div>
    {notice ? <p className={styles.success} role="status"><Check size={18} aria-hidden="true" />{notice}</p> : null}
    {error ? <div className={styles.error} role="alert"><p>{error}</p>{signedOut ? <Link href="/compte/connexion?next=%2Farene%2Fplacard%3Fview%3Dmissions">Me connecter</Link> : <button type="button" className={styles.secondary} disabled={loading} onClick={() => void refresh()}>Réessayer</button>}</div> : null}
    {loading && !loaded ? <p className={styles.empty} role="status">Sylvain prépare ton tableau…</p> : null}
    {loaded && tab === "available" ? <div className={styles.cards}>{active.slice(start, start + PAGE_SIZE).map((mission) => {
      const correction = mission.userSubmissions.find((submission) => submission.status === "changes_requested");
      const pendingSubmission = mission.userSubmissions.find((submission) => submission.status === "pending");
      const waiting = Boolean(pendingSubmission);
      const complete = mission.completedCount >= mission.maxCompletionsPerUser;
      const rejected = mission.userSubmissions.find((submission) => submission.status === "rejected");
      const promisedReward = correction ?? pendingSubmission ?? (complete ? mission.userSubmissions.find((submission) => submission.status === "approved") : null) ?? mission;
      const destination = getMissionRewardDestination(promisedReward.rewardType);
      return <article key={mission.id} className={styles.card} data-mission-id={mission.id} data-state={correction ? "changes_requested" : waiting ? "pending" : complete ? "approved" : "available"}>
        <div className={styles.cardTop}><span className={styles.cardIcon}>{complete ? <Check size={23} aria-hidden="true" /> : mission.icon === "camera" ? <Camera size={23} aria-hidden="true" /> : <Users size={23} aria-hidden="true" />}</span><span className={styles.badge}>{correction ? "À compléter" : waiting ? "En vérification" : complete ? "Mission accomplie" : "Mission de la communauté"}</span></div>
        <h3>{mission.title}</h3><p className={styles.description}>{mission.description}</p>
        <div className={styles.prize}><Gift size={21} aria-hidden="true" /><div><strong>{formatMissionReward(promisedReward)}</strong><small>{destination.label}</small></div></div>
        {correction?.adminNote ? <p className={styles.reviewNote}><strong>L’équipe te demande : </strong>{correction.adminNote}</p> : null}
        {rejected && !correction && !waiting && !complete ? <p className={styles.reviewNote}><strong>Dernier envoi refusé. </strong>{rejected.adminNote || "Retrouve les détails dans Mes envois."}</p> : null}
        {waiting ? <p className={styles.waiting}><Clock3 size={17} aria-hidden="true" />Ta preuve est bien reçue.</p> : complete ? <Link className={styles.secondary} href={destination.href}>Retrouver mon gain<ArrowRight size={16} aria-hidden="true" /></Link> : mission.canSubmit ? <button type="button" className={styles.primary} onClick={() => setSelected({ mission, correction })}>{correction ? "Compléter ma preuve" : "Participer"}<ArrowRight size={17} aria-hidden="true" /></button> : <p className={styles.waiting}>Mission indisponible pour le moment.</p>}
      </article>;
    })}</div> : null}
    {loaded && tab === "history" ? <ul className={styles.history}>{history.slice(start, start + PAGE_SIZE).map(({ mission, submission }) => <SubmissionHistory key={submission.id} mission={mission} submission={submission} />)}</ul> : null}
    {loaded && total === 0 ? <div className={styles.empty}><Gift size={30} aria-hidden="true" /><h3>{tab === "history" ? "Ton aventure commence ici" : "De nouvelles missions se préparent"}</h3><p>{tab === "history" ? "Tes preuves et les réponses de l’équipe apparaîtront ici." : "Reviens découvrir les prochains défis de Sylvain. Tes envois précédents restent dans Mes envois."}</p></div> : null}
    {pages > 1 ? <nav className={styles.pagination} aria-label="Pages des missions"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Précédent</button><span>{currentPage + 1} / {pages}</span><button type="button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Suivant</button></nav> : null}
    {pendingReferrals.length > 0 ? <aside className={styles.referrals} aria-label="Cadeaux de parrainage">{pendingReferrals.map((reward) => <div key={reward.id}><Gift size={23} aria-hidden="true" /><p><strong>Ton parrainage a porté ses fruits !</strong><span>{reward.pointsAmount} points fidélité ou {reward.packsAmount} pack{reward.packsAmount > 1 ? "s" : ""} Buddies</span></p><button type="button" className={styles.primary} onClick={() => setChoice(reward)}>Choisir mon cadeau</button></div>)}</aside> : null}
    <details className={styles.how}><summary>Comment ça marche ?</summary><ol><li>Choisis une mission et suis ses consignes.</li><li>Envoie ta capture et, si disponible, le lien de ta publication directement ici.</li><li>L’équipe vérifie ta preuve. Après validation, ton gain arrive automatiquement, une seule fois.</li></ol><p>Besoin de compléter ta preuve ? Le message de l’équipe t’explique quoi corriger. Aucune connexion à un réseau social n’est nécessaire.</p></details>
    {referrals.some((reward) => reward.status !== "pending") ? <details className={styles.how}><summary>Mes cadeaux de parrainage précédents</summary><ul>{referrals.filter((reward) => reward.status !== "pending").map((reward) => <li key={reward.id}>{reward.status === "chosen_points" ? `${reward.pointsAmount} points fidélité reçus` : `${reward.packsAmount} packs Buddies reçus`}</li>)}</ul></details> : null}
    {selected ? <CommunityMissionDialog key={`${selected.mission.id}:${selected.correction?.id ?? "new"}`} {...selected} onClose={() => setSelected(null)} onSubmitted={() => { setSelected(null); setNotice("Preuve envoyée ! Retrouve la réponse de l’équipe dans Mes envois."); setTab("history"); setPage(0); }} /> : null}
    {choice ? <ReferralChoice reward={choice} onClose={() => setChoice(null)} onChosen={() => { setChoice(null); setNotice("Ton cadeau de parrainage a été ajouté à ton compte."); void refresh(); }} /> : null}
  </section>;
}
