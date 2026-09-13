"use client";
import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Dices, Gift, Sprout, Trophy } from "lucide-react";
import { ARENA_CUSTOMER_REWARD_DICE_RATES, projectArenaCustomerRewardPool } from "@/lib/arena-customer-rewards";
import { formatArenaRewardGrams, getArenaRewardJarFill, isArenaRewardSeasonOpen } from "@/lib/arena-reward-presentation";
import styles from "./ArenaCustomerRewards.module.css";

export type ArenaCustomerRewardPool = {
  viewer?: { rank: number | null; battles: number; estimatedGrams: number | null; grant: { grams: number; kind: string } | null } | null;
  seasonCode: string;
  status: string;
  contributionRateBps: number;
  poolGrams: number;
  wholePoolGrams: number;
  carriedGrams: number;
  currentWeekGrams: number;
  weeklyDice: {
    startsOn: string | null;
    endsOn: string | null;
    rollCount: number;
    average: number | null;
    rateBps: number;
    eligibleFlowerGrams: number;
    contributionGrams: number;
  };
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
  minimumHumanBattles: number;
  eligiblePlayers: number;
  milestone: { previousGrams: number; nextGrams: number; progressPercent: number };
  topRewards: Array<{
    leaderboardRank: number;
    rewardRank: number;
    pseudo: string;
    shareBps: number;
    estimatedGrams: number;
  }>;
  surpriseReward: {
    shareBps: number;
    estimatedGrams: number;
    eligiblePlayers: number;
    oneChancePerCustomer: boolean;
  };
};

export function ArenaCustomerRewardPot({
  rankingId,
  rewardPool,
  onRewardPoolChange,
  loading,
  unavailable,
  viewerPseudo,
}: {
  rankingId: string;
  rewardPool: ArenaCustomerRewardPool | null;
  onRewardPoolChange: (pool: ArenaCustomerRewardPool) => void;
  loading: boolean;
  unavailable: boolean;
  viewerPseudo?: string;
}) {
  const [diceState, setDiceState] = useState<{
    eligible: boolean;
    viewerRoll: number | null;
  } | null>(null);
  const [diceLoading, setDiceLoading] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [diceError, setDiceError] = useState("");
  const viewer = rewardPool?.viewer;
  const viewerEntry = viewer?.rank ? { rank: viewer.rank, wins: viewer.battles, losses: 0 } : null;
  const viewerReward = viewer?.estimatedGrams !== null && viewer?.estimatedGrams !== undefined
    ? { rewardRank: viewer.rank, estimatedGrams: viewer.estimatedGrams } : null;
  const viewerBattles = viewer?.battles ?? 0;
  const viewerIsSurpriseEligible = Boolean(rewardPool && viewerEntry && viewerBattles >= rewardPool.minimumHumanBattles && viewerEntry.rank > 10);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRank, setSelectedRank] = useState(1);
  const detailId = useId();
  const titleId = useId();
  const previousPool = useRef(rewardPool?.poolGrams ?? null);
  const [increase, setIncrease] = useState(0);
  const open = rewardPool ? isArenaRewardSeasonOpen(rewardPool) : false;
  const settled = rewardPool?.status === "settled";
  const authenticated = Boolean(viewer || viewerPseudo);
  const toggleDetails = () => {
    setDetailsOpen(!detailsOpen);
    if (!detailsOpen) requestAnimationFrame(() => {
      const detail = document.getElementById(detailId);
      detail?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      detail?.focus({ preventScroll: true });
    });
  };
  const jarFillTopInset = 84 - getArenaRewardJarFill(rewardPool?.poolGrams ?? 0) * 0.61;
  const projection = projectArenaCustomerRewardPool(rewardPool?.poolGrams ?? 0);
  const selectedSlot = projection.slots.find((slot) => slot.rewardRank === selectedRank)!;
  const selectedPlayer = rewardPool?.topRewards.find((reward) => reward.rewardRank === selectedRank);
  useEffect(() => {
    const next = rewardPool?.poolGrams ?? null;
    if (next !== null && previousPool.current !== null && next > previousPool.current) setIncrease(next - previousPool.current);
    previousPool.current = next;
    const timer = window.setTimeout(() => setIncrease(0), 2000);
    return () => window.clearTimeout(timer);
  }, [rewardPool?.poolGrams]);
  const weeklyRatePercent = Math.max(1, Math.round((rewardPool?.weeklyDice.rateBps ?? 100) / 100));
  const statusCopy = viewerReward
    ? `Tu occupes la place récompensée #${viewerReward.rewardRank} · estimation ${viewerReward.estimatedGrams} g.`
    : viewerIsSurpriseEligible
      ? "Tu as une chance dans La Fleur Surprise, comme chaque participant éligible hors Top 10."
      : viewerEntry && rewardPool && viewerBattles < rewardPool.minimumHumanBattles
        ? `${rewardPool.minimumHumanBattles - viewerBattles} duel(s) officiel(s) à terminer pour devenir éligible.`
        : viewerPseudo
          ? "Entre au classement général pour rejoindre la récompense client."
          : "Connecte-toi pour suivre ta place et ton éligibilité.";

  useEffect(() => {
    if (!viewerPseudo || !open) {
      setDiceState(null);
      setDiceLoading(false);
      return;
    }
    const controller = new AbortController();
    setDiceLoading(true);
    setDiceError("");
    void fetch("/api/arena/rewards/dice", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as {
          eligible?: boolean;
          viewerRoll?: number | null;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "État du lancer indisponible.");
        setDiceState({ eligible: payload.eligible === true, viewerRoll: payload.viewerRoll ?? null });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDiceError(error instanceof Error ? error.message : "État du lancer indisponible.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDiceLoading(false);
      });
    return () => controller.abort();
  }, [viewerPseudo, rewardPool?.weeklyDice.startsOn, open]);

  const rollWeeklyDice = async () => {
    if (!open || diceRolling || diceState?.viewerRoll) return;
    setDiceRolling(true);
    setDiceError("");
    try {
      const response = await fetch("/api/arena/rewards/dice", { method: "POST" });
      const payload = await response.json() as {
        viewerRoll?: number;
        pool?: ArenaCustomerRewardPool;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Lancer impossible.");
      setDiceState({ eligible: true, viewerRoll: payload.viewerRoll ?? null });
      if (payload.pool) onRewardPoolChange(payload.pool);
    } catch (error) {
      setDiceError(error instanceof Error ? error.message : "Lancer impossible.");
    } finally {
      setDiceRolling(false);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.heading}>
        <span className={styles.eyebrow}><Gift size={16} aria-hidden="true" /> Des fleurs à gagner, pour de vrai</span>
        <h2 id={titleId}>Le Pot de la Canopée<span>.</span></h2>
        <p><strong>Les ventes remplissent le bocal. Ton classement détermine ta part.</strong> Une part des grammes de fleurs vendus devient une récompense en nature pour les joueurs éligibles.</p>
      </header>
      {unavailable && rewardPool ? <p className={styles.note} role="status">Dernière estimation disponible : la mise à jour a échoué. Une nouvelle tentative sera faite automatiquement.</p> : null}
      <div className={styles.overview}>
        <div className={styles.numbers}>
          <span className={styles.season}>{rewardPool ? `Saison ${rewardPool.seasonCode}` : "Récompenses de saison"} · {settled ? "Récompenses attribuées" : open ? "En cours" : rewardPool ? "Lancers fermés" : loading ? "Chargement" : "Compteur indisponible"}</span>
          <div className={styles.amount} aria-live="polite"><strong>{loading ? "…" : rewardPool ? formatArenaRewardGrams(rewardPool.poolGrams) : "—"}<small> g</small></strong><span>{settled ? "dans la dotation de saison" : "de fleurs à partager · estimation"}</span></div>
          {rewardPool ? <>
            <div className={styles.metrics}>
              <div><strong>{weeklyRatePercent} %</strong><span>des grammes de fleurs vendus cette semaine</span></div>
              <div><strong>{formatArenaRewardGrams(rewardPool.currentWeekGrams)} g</strong><span>contribution {open ? "provisoire" : "de la dernière semaine"}</span></div>
            </div>
            <p className={styles.note}>Prochain palier : {formatArenaRewardGrams(rewardPool.milestone.nextGrams)} g de fleurs dans le bocal.</p>
            <p className={styles.deadline}>{rewardPool.endsAt ? `Clôture : ${new Date(rewardPool.endsAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" })} (Paris)` : "La date de clôture sera annoncée ici."}</p>
          </> : <p role="status">{loading ? "Comptage du bocal…" : unavailable ? "Le compteur est momentanément indisponible. Réessaie en actualisant la page." : "Aucune dotation disponible pour le moment."}</p>}
          <div className={styles.actions}>
            <a href={`#${rankingId}`}>Voir le classement <ArrowUpRight size={17} aria-hidden="true" /></a>
            <button type="button" onClick={toggleDetails} aria-expanded={detailsOpen} aria-controls={detailId}>Comment ça marche <ChevronDown size={17} aria-hidden="true" /></button>
          </div>
        </div>
        <button type="button" className={styles.jar} onClick={toggleDetails} aria-expanded={detailsOpen} aria-controls={detailId} aria-label="Ouvrir le détail du bocal">
          <Image src="/contest/mascot/arena-customer-reward-jar-v4-empty.webp" alt="" width={1200} height={800} sizes="(max-width: 700px) 100vw, 40vw" />
          <Image className={styles.fill} src="/contest/mascot/arena-customer-reward-jar-v4-full.webp" alt="" width={1200} height={800} sizes="(max-width: 700px) 100vw, 40vw" style={{ clipPath: `inset(${jarFillTopInset}% 0 0 0)` }} />
          {increase > 0 ? <span key={rewardPool?.poolGrams} className={styles.growth} aria-hidden="true"><Sprout /> +{formatArenaRewardGrams(increase)} g</span> : null}
          <span className={styles.jarLabel}><Sprout size={17} aria-hidden="true" /> Explore le bocal <ArrowUpRight size={17} aria-hidden="true" /></span>
          <span className={styles.jarScale}>Illustration : jusqu’à 1 000 g · le compteur continue au-delà</span>
        </button>
      </div>
      <div className={styles.split}>
        <div><Trophy aria-hidden="true" /><span><strong>90 % pour le Top 10</strong><small>Selon le classement général et l’éligibilité.</small></span></div>
        <div><Gift aria-hidden="true" /><span><strong>10 % pour la Fleur Surprise</strong><small>Un joueur éligible hors Top 10, tiré au sort.</small></span></div>
      </div>
      {rewardPool ? <div className={styles.personal} aria-live="polite">
        <div><span className={styles.eyebrow}>Ta place dans la récolte</span><p>{settled ? viewer?.grant ? `Tu as remporté ${viewer.grant.grams} g de fleurs${viewer.grant.kind === "surprise" ? " avec la Fleur Surprise" : " au classement"}. Retrouve ton bon dans le panier.` : viewer ? "Aucune récompense attribuée à ton compte pour cette saison." : "Les récompenses sont attribuées. Connecte-toi pour consulter ton résultat." : !open ? "Les lancers sont fermés. Les gains restent estimatifs jusqu’à leur attribution." : statusCopy}</p>
          {open && viewerEntry ? <small>Rang #{viewerEntry.rank} · {Math.min(viewerBattles, rewardPool.minimumHumanBattles)}/{rewardPool.minimumHumanBattles} duels requis terminés</small> : null}
        </div>
        {settled && viewer?.grant ? <button type="button" onClick={() => window.dispatchEvent(new Event("shop:open-cart"))}>Ouvrir mon panier <Gift size={17} aria-hidden="true" /></button>
          : <Link href={authenticated ? "/arene/placard" : "/compte/connexion?next=%2Farene%3Fvue%3Dclassement"}>{authenticated ? "Jouer pour progresser" : "Me connecter"}<ArrowUpRight size={17} aria-hidden="true" /></Link>}
      </div> : null}
      {rewardPool && !settled ? <section className={styles.explorer} aria-label="Explorer les parts du classement">
        <div className={styles.sectionHeading}><h3>À chaque place, sa part.</h3><span>Choisis un rang</span></div>
        <div className={styles.ranks}>{projection.slots.filter(slot => slot.rewardRank !== null).map(slot => <button key={slot.code} type="button" aria-pressed={selectedRank === slot.rewardRank} onClick={() => setSelectedRank(slot.rewardRank!)}>#{slot.rewardRank}<small>{(slot.shareBps / 100).toLocaleString("fr-FR")} %</small></button>)}</div>
        <div className={styles.rankDetail} aria-live="polite"><Trophy aria-hidden="true" /><div><strong>#{selectedRank} · {selectedPlayer?.pseudo ?? "Part réservée à un joueur éligible"}</strong><p>{(selectedSlot.shareBps / 100).toLocaleString("fr-FR")} % du bocal · {selectedPlayer ? "selon la position actuelle" : `${rewardPool.minimumHumanBattles} duels minimum pour en bénéficier`}</p></div><b>≈ {selectedSlot.grams} g<small>estimation</small></b></div>
        <p className={styles.note}>Les parts sont arrondies en grammes entiers. Un rang non éligible ne donne pas automatiquement sa part au suivant. Fleur Surprise : ≈ {rewardPool.surpriseReward.estimatedGrams} g, pour un seul des {rewardPool.surpriseReward.eligiblePlayers} participants éligibles hors Top 10.</p>
      </section> : null}
      <div id={detailId} tabIndex={-1} className={styles.details} hidden={!detailsOpen}>
        <h3>Des ventes aux fleurs offertes</h3>
        <ol className={styles.steps}><li><b>1. Les ventes</b>Les grammes de fleurs des commandes payées alimentent le calcul, hors cadeaux et annulations.</li><li><b>2. Le bocal</b>Le taux collectif de chaque semaine transforme une part de ce volume en dotation.</li><li><b>3. Le classement</b>{rewardPool?.minimumHumanBattles ?? 3} duels officiels minimum. Le classement général détermine les parts du Top 10.</li><li><b>4. Ton cadeau</b>Après attribution, un bon en grammes de fleurs apparaît dans tes récompenses, à utiliser dans le panier.</li></ol>
        {rewardPool ? <p className={styles.formula}><strong>{formatArenaRewardGrams(rewardPool.weeklyDice.eligibleFlowerGrams)} g vendus × {weeklyRatePercent} % = {formatArenaRewardGrams(rewardPool.currentWeekGrams)} g</strong><span>Contribution de la semaine. Le taux peut monter ou descendre jusqu’à sa finalisation. Le bocal cumule les contributions des semaines et les ajustements éventuels.</span></p> : null}
        <p className={styles.note}>Le calcul porte sur le poids des fleurs vendues, pas sur le montant en euros ni sur les ventes virtuelles du Placard. Les récompenses ne sont pas convertibles en argent. Le bon cadeau s’utilise dans une commande ; il ne déclenche pas une expédition automatique.</p>
      </div>
      {rewardPool && open ? <details className={styles.dice}>
        <summary><Dices aria-hidden="true" /><span>Le dé collectif de la semaine<small>Un lancer par joueur · taux actuel {weeklyRatePercent} %</small></span><ChevronDown aria-hidden="true" /></summary>
        <div className={styles.diceBody}>
          <p>La moyenne arrondie des lancers fixe la part des grammes vendus ajoutée au bocal cette semaine.</p>
          <div className={styles.diceRates}>{ARENA_CUSTOMER_REWARD_DICE_RATES.map(rate => <span key={rate.rateBps} data-active={rate.rateBps === rewardPool.weeklyDice.rateBps || undefined}><small>Dé {rate.diceResult}</small><b>{rate.ratePercent} %</b></span>)}</div>
          <div className={styles.diceAction} aria-live="polite"><span>Moyenne : {rewardPool.weeklyDice.average?.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) ?? "—"}/6 · {rewardPool.weeklyDice.rollCount} lancers</span>
          {diceLoading ? <span>Vérification…</span> : diceState?.viewerRoll ? <strong>Ton dé : {diceState.viewerRoll}</strong> : diceState?.eligible ? <button type="button" onClick={() => void rollWeeklyDice()} disabled={diceRolling}><Dices aria-hidden="true" />{diceRolling ? "Le dé roule…" : "Lancer mon dé"}</button> : <Link href={authenticated ? "/arene/placard" : "/compte/connexion?next=%2Farene%3Fvue%3Dclassement"}>{authenticated ? "Créer mon profil Placard" : "Me connecter pour lancer"}</Link>}</div>
          {diceError ? <p role="alert">{diceError}</p> : null}
        </div>
      </details> : null}
    </section>
  );
}
