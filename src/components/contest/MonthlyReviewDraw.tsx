"use client";

import { useEffect, useId, useState } from "react";
import Link from "@/components/navigation/NavigationLink";
import { ArrowRight, CalendarDays, Check, Gift, RefreshCw } from "lucide-react";
import { KqProgressMeter } from "@/components/placard/KqVisuals";
import type { MonthlyReviewDraw as DrawStatus } from "@/lib/monthly-review-draw";
import styles from "./MonthlyReviewDraw.module.css";

function drawDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function MonthlyReviewDraw({ loginHref = "/compte/connexion?next=%2Farene%2Fcarnet%2Fregular", onChooseFlower }: { loginHref?: string; onChooseFlower?: () => void }) {
  const titleId = useId();
  const [draw, setDraw] = useState<DrawStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch("/api/contest/monthly-draw", { cache: "no-store", credentials: "include", signal: controller.signal });
        const payload = await response.json() as { draw?: DrawStatus };
        if (!response.ok || !payload.draw) throw new Error("unavailable");
        if (!controller.signal.aborted) setDraw(payload.draw);
      } catch {
        if (!controller.signal.aborted) {
          setDraw(null);
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void refresh();
    return () => controller.abort();
  }, [refreshKey]);

  const availableRewards = draw?.rewards.filter((reward) => reward.status === "available") ?? [];
  const reservedRewards = draw?.rewards.filter((reward) => reward.status === "reserved") ?? [];

  return <section className={styles.panel} aria-labelledby={titleId} data-monthly-review-draw>
    <header className={styles.header}>
      <Gift size={25} aria-hidden="true" />
      <div><p className={styles.eyebrow}>Le tirage du Carnet</p><h3 id={titleId}>{draw ? `${draw.prizeGrams} g` : "10 g"} de fleurs à gagner</h3></div>
    </header>
    <p>Chaque 1er du mois : un gagnant parmi les joueurs ayant déjà fait valider un avis sur une fleur achetée.</p>
    {loading ? <p role="status">Vérification du prochain tirage…</p> : null}
    {error ? <p className={styles.error} role="alert">Le tirage est momentanément indisponible. Ta participation n’a pas pu être vérifiée.</p> : null}
    {draw && !loading ? <>
      <p className={styles.date}><CalendarDays size={18} aria-hidden="true" /><span>Prochain tirage : <strong><time dateTime={draw.nextDrawDate}>{drawDate(draw.nextDrawDate)}</time></strong><small>Chaque 1er du mois · heure de Paris</small></span></p>
      {draw.approvedReviewCount !== null ? <KqProgressMeter label="Participation au tirage" value={Math.min(draw.approvedReviewCount, 1)} max={1} valueLabel={`${Math.min(draw.approvedReviewCount, 1)} / 1 avis validé requis`} /> : null}
      <p className={styles.participation}>{draw.eligible === true
        ? <><Check size={17} aria-hidden="true" /> Tu remplis les conditions : une chance au prochain tirage.</>
        : draw.eligible === false
          ? "Note une fleur achetée : ton avis devra être validé avant le tirage."
          : "Connecte-toi pour vérifier ta participation et tes gains."}</p>
      {draw.eligible !== null ? <p className={styles.detail}>Tes anciens avis comptent. Un seul avis validé suffit pour participer chaque mois.</p> : null}
      {draw.eligible !== null && onChooseFlower ? <button type="button" className={styles.action} onClick={onChooseFlower}>{draw.eligible ? "Continuer mes dégustations" : "Choisir une fleur à noter"} <ArrowRight size={17} aria-hidden="true" /></button> : null}
      {availableRewards.length > 0 ? <div className={styles.win}>
        <strong><Gift size={18} aria-hidden="true" /> Tu as gagné !</strong>
        <ul>{availableRewards.map((reward) => <li key={reward.claimId}>{draw.prizeGrams} g de fleurs · tirage du <time dateTime={reward.drawDate}>{drawDate(reward.drawDate)}</time></li>)}</ul>
        <p>Dans ton panier, choisis ton gain dans « Bon / cadeau », puis clique sur « Utiliser ». Les fleurs seront jointes à ta commande payée.</p>
        <Link href="/boutique" className={styles.action}>Préparer ma commande <ArrowRight size={17} aria-hidden="true" /></Link>
      </div> : null}
      {reservedRewards.length > 0 ? <p className={styles.detail}>Ton gain est réservé sur une commande en cours de paiement. Il reste lié à cette commande tant que sa réservation est active.</p> : null}
      {draw.latestDraw ? <p className={styles.detail}>Tirage du {drawDate(draw.latestDraw.drawDate)} : {draw.latestDraw.participantCount === 0
        ? "aucun participant éligible, aucun lot attribué."
        : draw.latestDraw.viewerWon ? "ton compte a été tiré au sort." : `${draw.latestDraw.participantCount} participant${draw.latestDraw.participantCount > 1 ? "s" : ""}, un gagnant.`}</p> : null}
      {draw.eligible === null ? <Link href={loginHref} className={styles.action}>Vérifier ma participation <ArrowRight size={17} aria-hidden="true" /></Link> : null}
    </> : null}
    <button type="button" className={styles.refresh} disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={15} aria-hidden="true" />{error ? "Réessayer" : "Actualiser ma participation"}</button>
    <details className={styles.rules}>
      <summary>Comment participer et récupérer le lot ?</summary>
      <p>Il suffit d’avoir au moins un avis validé sur une fleur achetée, Regular ou Concours, avant 00 h le 1er du mois (heure de Paris). Tous les anciens avis comptent. L’achat doit être payé et non annulé. Les avis en attente ou refusés ne comptent pas.</p>
      <p>La participation est automatique chaque mois, sans nouvel avis obligatoire. Une seule chance par compte, quel que soit le nombre d’avis ou la note attribuée. Un avis critique a les mêmes chances qu’un avis enthousiaste.</p>
      <p>Un gagnant reçoit un bon pour 10 g de fleurs CBD, à réclamer avec une commande payée. Aucune expédition automatique. Le bon est à sélectionner dans le panier et n’est pas cumulable avec un code promo.</p>
    </details>
  </section>;
}
