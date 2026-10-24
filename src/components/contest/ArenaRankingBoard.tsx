"use client";

import { useRef } from "react";
import { BookOpen, Building2, ChevronDown, ChevronUp, CircleHelp, Crosshair, RefreshCw, Sprout, Swords, Trophy } from "lucide-react";
import Link from "@/components/navigation/NavigationLink";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { LeaderboardAvatar } from "./LeaderboardAvatar";
import { KqAllocationBar } from "../placard/KqVisuals";
import { KqPrintedArt } from "../placard/KqPrintedArt";
import styles from "./ArenaRankingBoard.module.css";

export type ArenaRankingMode = "general" | "tasting" | "duels" | "business";
export type ArenaRankingRow = {
  key: string;
  rank: number;
  pseudo: string;
  avatar?: ChanvrierAvatarProfile | null;
  detail: string;
  score: number;
  scoreLabel: string;
  rewardGrams: number | null;
  href: string;
  contributions?: { notebook: number; duels: number; business: number };
};

export type ArenaRankingBoardProps = {
  id: string;
  mode: ArenaRankingMode;
  scope: "season" | "global";
  rows: ArenaRankingRow[];
  loading: boolean;
  unavailable: boolean;
  compact?: boolean;
  viewerPseudo?: string;
  viewerRow?: ArenaRankingRow | null;
  totalPlayers?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreError?: string | null;
  onLoadMore?: () => void;
  onModeChange: (mode: ArenaRankingMode) => void;
  onScopeChange: (scope: "season" | "global") => void;
  onRetry: () => void;
};

const modes = [
  { id: "general", label: "Général", description: "La course aux récompenses", icon: Trophy },
  { id: "tasting", label: "Dégustation", description: "Les fins connaisseurs", icon: BookOpen },
  { id: "duels", label: "Duels", description: "Les meilleurs adversaires", icon: Swords },
  { id: "business", label: "Entreprise", description: "Les entreprises qui grandissent", icon: Building2 },
] as const;

const titles = { general: "Le classement général", tasting: "Les meilleurs testeurs", duels: "Les champions des duels", business: "Les meilleures entreprises" };
const intros = {
  general: "Découvre des fleurs, remporte des duels et développe ton entreprise. Chaque progrès compte.",
  tasting: "Une nouvelle fleur achetée et un avis validé : 100 points de plus pour tes découvertes.",
  duels: "Affronte les autres chanvriers. Chaque point gagné en duel fait progresser ton score.",
  business: "Cultive, développe tes ventes et construis ta réputation. Trois façons de grandir.",
};
const scoreHeadings = { general: "Score général", tasting: "Points dégustation", duels: "Points duels", business: "Points entreprise" };
const emptyMessages = {
  general: "Le tableau attend ses premiers joueurs. Une dégustation validée, un duel ou des points d’entreprise suffisent pour entrer.",
  tasting: "Aucun testeur classé pour le moment. Fais valider un avis sur une fleur achetée pour gagner tes premiers points.",
  duels: "Pas encore de duel au tableau. Termine un duel officiel pour entrer dans le classement.",
  business: "Pas encore d’entreprise classée. Développe ton entreprise pour marquer tes premiers points.",
};

const formatScore = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

function TastingRules() {
  return <><p><strong>100 points par fleur différente achetée et évaluée par un avis validé dans la saison.</strong> Un produit compte une seule fois par joueur et par saison, quels que soient son grammage, le nombre de commandes ou les corrections de l’avis. Un avis critique validé rapporte autant qu’un avis positif.</p><p>Les distinctions de qualité et les votes restent utiles dans le Carnet, sans ajouter de points à ce classement. Une fleur peut compter à nouveau la saison suivante avec un nouvel achat et un nouvel avis validé.</p></>;
}

function DuelRules() {
  return <><p>Seuls les points gagnés en duels contre d’autres joueurs pendant la saison comptent. Les défis contre les bots sont exclus. Les gains diminuent progressivement, sans plafond : 100 points de duels rapportent 158,5 points au classement ; 400 en rapportent 317.</p><p>Calcul : 100 × log₂(1 + points de duels humains / 50).</p></>;
}

function BusinessRules() {
  return <>
    <p>La surface réellement cultivée est moyennée sur les 30 derniers jours. Les espaces vides, le séchage et le stockage ne comptent pas. Le chiffre d’affaires correspond aux ventes du jeu encaissées pendant la saison, hors taxes et annulations. La réputation est ta réputation commerciale actuelle.</p>
    <p>Les trois critères progressent sans plafond, avec des gains dégressifs. Le profil de référence — 50 m² cultivés en moyenne, 10 000 € de ventes et 600 de réputation — rapporte 90 points : 27 pour les cultures, 36 pour les ventes et 27 pour la réputation.</p>
    <p>Calcul : 27 × log₂(1 + surface / 50) + 36 × log₂(1 + chiffre d’affaires / 10 000) + 27 × log₂(1 + réputation / 600). Les repères de calcul ne sont pas des limites.</p>
  </>;
}

export function ArenaRankingBoard({ id, mode, scope, rows, loading, unavailable, compact = false, viewerPseudo, viewerRow, totalPlayers, hasMore = false, loadingMore = false, loadMoreError, onLoadMore, onModeChange, onScopeChange, onRetry }: ArenaRankingBoardProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const viewer = viewerRow !== undefined ? viewerRow : rows.find(row => row.pseudo === viewerPseudo);
  const pinnedViewer = viewerRow && !rows.some(row => row.key === viewerRow.key) ? viewerRow : null;
  const playerCount = totalPlayers ?? rows.length;
  const titleId = `${id}-title`;
  const listId = `${id}-players`;
  const scrollBehavior = (): ScrollBehavior => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const findMyPosition = () => {
    const row = listRef.current?.querySelector<HTMLElement>('[data-viewer="true"]');
    row?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
    row?.focus({ preventScroll: true });
  };
  const changeMode = (nextMode: ArenaRankingMode) => {
    listRef.current?.scrollTo({ top: 0 });
    onModeChange(nextMode);
  };
  const renderRow = (row: ArenaRankingRow) => {
    const isViewer = viewerRow !== undefined ? row.key === viewerRow?.key : row.pseudo === viewerPseudo;
    const contributionTotal = row.contributions ? row.contributions.notebook + row.contributions.duels + row.contributions.business : 0;
    const content = <>
      <span className={styles.rank} data-podium={row.rank <= 3 ? row.rank : undefined} aria-label={`Place ${row.rank}`}>{row.rank === 1 ? <Trophy size={13} aria-hidden="true" /> : null}<b>{row.rank}</b></span>
      <span className={styles.avatar}><LeaderboardAvatar profile={row.avatar} pseudo={row.pseudo} /></span>
      <span className={styles.identity}><span className={styles.playerName}><strong>{row.pseudo}</strong>{isViewer ? <em>Toi</em> : null}</span>{!row.contributions && row.detail ? <small className={styles.detail}>{row.detail}</small> : null}</span>
      <span className={styles.score}><strong>{formatScore(row.score)}</strong><small>{row.scoreLabel}</small>{row.rewardGrams !== null ? <em>≈ {formatScore(row.rewardGrams)} g</em> : null}</span>
      {row.contributions ? <span className={styles.rowBreakdown}>
        {contributionTotal > 0 ? <span className={styles.contributionBar} aria-hidden="true">{(["notebook", "duels", "business"] as const).map(source => <span key={source} data-source={source} style={{ width: `${Math.max(0, row.contributions![source]) / contributionTotal * 100}%` }} />)}</span> : null}
        <span className={styles.contributions}><span data-source="notebook">Dégustation <b>{formatScore(row.contributions.notebook)}</b></span><span data-source="duels">Duels <b>{formatScore(row.contributions.duels)}</b></span><span data-source="business">Entreprise <b>{formatScore(row.contributions.business)}</b></span></span>
      </span> : null}
    </>;
    return <li key={row.key} value={row.rank}>{row.href ? <Link href={row.href} className={styles.row} data-viewer={isViewer || undefined} aria-label={`Voir le profil de ${row.pseudo}, place ${row.rank}`}>{content}</Link> : <div className={styles.row} tabIndex={-1} data-viewer={isViewer || undefined}>{content}</div>}</li>;
  };

  return <section id={id} className={styles.board} data-arena-ranking-board data-mode={mode} data-compact={compact || undefined} aria-labelledby={titleId}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}><Trophy size={15} aria-hidden="true" />Le tableau du village</p><h3 id={titleId}>{titles[mode]}</h3><p className={styles.intro}>{intros[mode]}</p></div>
      <span className={styles.seal}><KqPrintedArt kind="achievements" className={styles.illustration} sizes="(max-width: 560px) 82px, 150px" /><small>Sans plafond</small></span>
    </header>

    <div className={styles.modeSwitch} role="group" aria-label="Type de classement">
      {modes.map(({ id: nextMode, label, description, icon: Icon }) => <button key={nextMode} type="button" data-mode={nextMode} aria-pressed={mode === nextMode} aria-controls={listId} onClick={() => changeMode(nextMode)}><Icon size={22} aria-hidden="true" /><span><strong>{label}</strong><small>{description}</small></span></button>)}
    </div>

    <div className={styles.paper}>
      {viewer && !loading && !unavailable ? <div className={styles.viewerOverview}>
        <dl className={styles.viewerStanding}>
          <div><dt>Ta place</dt><dd><strong>#{viewer.rank}</strong>{totalPlayers !== undefined ? <small>sur {totalPlayers.toLocaleString("fr-FR")}</small> : null}</dd></div>
          <div><dt>Ton score</dt><dd><strong>{formatScore(viewer.score)}</strong><small>{viewer.scoreLabel}</small></dd></div>
        </dl>
        {mode === "general" && viewer.contributions ? <div className={styles.viewerBreakdown}><KqAllocationBar label="D’où viennent tes points" items={[
          { label: "Dégustation", value: viewer.contributions.notebook, displayValue: `${formatScore(viewer.contributions.notebook)} pts`, tone: "gold" },
          { label: "Duels", value: viewer.contributions.duels, displayValue: `${formatScore(viewer.contributions.duels)} pts`, tone: "ink" },
          { label: "Entreprise", value: viewer.contributions.business, displayValue: `${formatScore(viewer.contributions.business)} pts`, tone: "teal" },
        ]} emptyLabel="Aucun point enregistré." /></div> : viewer.detail ? <p className={styles.viewerDetail}>{viewer.detail}</p> : null}
      </div> : null}

      <div className={styles.toolbar}>
        <div className={styles.listLabel}><span className={styles.liveDot} aria-hidden="true" /><strong>{loading ? "Le tableau se prépare…" : unavailable ? "Tableau indisponible" : `${playerCount.toLocaleString("fr-FR")} joueur${playerCount > 1 ? "s" : ""} au tableau`}</strong>{!loading && !unavailable && rows.length > 0 ? <small>{mode === "tasting" && scope === "global" ? "Toutes les saisons" : "Classement de la saison"}</small> : null}</div>
        <div className={styles.toolbarActions}>
          {mode === "tasting" ? <div className={styles.scopeSwitch} role="group" aria-label="Période du classement dégustation">{(["season", "global"] as const).map(nextScope => <button key={nextScope} type="button" aria-pressed={scope === nextScope} onClick={() => onScopeChange(nextScope)}>{nextScope === "season" ? "Saison" : "Global"}</button>)}</div> : null}
          {viewer && !loading && !unavailable ? <button className={styles.myPosition} type="button" onClick={findMyPosition}><Crosshair size={16} aria-hidden="true" />Ma place <b>#{viewer.rank}</b></button> : null}
          {!loading && !unavailable && rows.length > 5 ? <div className={styles.scrollButtons}><button type="button" aria-label="Voir les joueurs précédents" aria-controls={listId} onClick={() => listRef.current?.scrollBy({ top: -300, behavior: scrollBehavior() })}><ChevronUp size={18} aria-hidden="true" /></button><button type="button" aria-label="Voir les joueurs suivants" aria-controls={listId} onClick={() => listRef.current?.scrollBy({ top: 300, behavior: scrollBehavior() })}><ChevronDown size={18} aria-hidden="true" /></button></div> : null}
        </div>
      </div>

      <div className={styles.listHeading} aria-hidden="true"><span>Place &amp; joueur</span><span>{scoreHeadings[mode]}</span></div>
      <div id={listId} ref={listRef} className={styles.listWindow} role="region" aria-label={titles[mode]} aria-busy={loading || loadingMore} tabIndex={0}>
        {loading ? <div className={styles.state} role="status"><RefreshCw className={styles.loadingIcon} size={28} aria-hidden="true" /><strong>On accroche les résultats…</strong><p>Chargement du classement.</p></div>
          : unavailable ? <div className={styles.state} role="status"><CircleHelp size={30} aria-hidden="true" /><strong>Le tableau prend une pause.</strong><p>Le classement est momentanément indisponible.</p><button type="button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" />Réessayer</button></div>
          : rows.length === 0 ? <div className={styles.state} role="status"><Sprout size={32} aria-hidden="true" /><strong>Une place à prendre !</strong><p>{emptyMessages[mode]}</p></div>
          : <><ol className={styles.rows}>{rows.map(renderRow)}</ol>{hasMore && onLoadMore ? <div className={styles.pagination}><button type="button" disabled={loadingMore} onClick={onLoadMore} aria-controls={listId}>{loadingMore ? <RefreshCw className={styles.loadingIcon} size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}{loadingMore ? "Chargement…" : "Voir les joueurs suivants"}</button><small>{rows.length.toLocaleString("fr-FR")} joueurs affichés{totalPlayers !== undefined ? ` sur ${totalPlayers.toLocaleString("fr-FR")}` : ""}</small></div> : null}{pinnedViewer ? <div className={styles.viewerPosition}><p>Ta place dans le classement</p><ol className={styles.rows}>{renderRow(pinnedViewer)}</ol></div> : null}</>}
      </div>
      {loadMoreError && !loading && !unavailable ? <p className={styles.paginationError} role="status">{loadMoreError}</p> : null}
      {!loading && !unavailable && rows.length > 5 ? <p className={styles.listFootnote}>Fais défiler pour voir la suite du classement.</p> : null}

      <details className={styles.scoreGuide}>
        <summary>Les leviers de ce classement</summary>
        {mode === "general" ? <div className={styles.scoreRecipe} aria-label="Les trois contributions au classement général, sans plafond">
          <div data-criterion="notebook"><BookOpen aria-hidden="true" /><span><strong>Dégustation</strong><small>Priorité aux découvertes</small></span><b>+100<small>par fleur</small></b></div>
          <div data-criterion="duels"><Swords aria-hidden="true" /><span><strong>Duels</strong><small>Contre des joueurs</small></span><b>↗<small>gains dégressifs</small></b></div>
          <div data-criterion="business"><Building2 aria-hidden="true" /><span><strong>Entreprise</strong><small>Cultures, ventes, réputation</small></span><b>↗<small>gains dégressifs</small></b></div>
        </div> : null}
        {mode === "general" || mode === "business" ? <div className={styles.businessRecipe} aria-label="Les trois critères du développement de l’entreprise">
          <span><Building2 size={18} aria-hidden="true" /><strong>Entreprise · 3 moteurs de progression</strong></span>
          <ul><li>Surface cultivée</li><li>Chiffre d’affaires</li><li>Réputation</li></ul>
        </div> : null}
        {mode === "tasting" ? <p>100 points par fleur différente achetée et évaluée par un avis validé dans la saison.</p> : mode === "duels" ? <p>Les duels contre les autres joueurs alimentent ce classement. Le détail du calcul est disponible ci-dessous.</p> : null}
      </details>

      <details className={styles.rules}>
        <summary><CircleHelp size={17} aria-hidden="true" /><span>{mode === "tasting" ? "Comment gagner des points ?" : "Comment les points sont calculés"}</span><ChevronDown size={17} aria-hidden="true" /></summary>
        <div>{mode === "general" ? <><p><strong>Le score général additionne dégustation, duels et entreprise, sans plafond.</strong> La dégustation est le premier moteur de progression, puis viennent les duels et l’entreprise. Tes premiers points suffisent pour être classé, sans duel obligatoire.</p><TastingRules /><DuelRules /><BusinessRules /><p>À score égal : score de dégustation, puis score de duels, puis score d’entreprise. Si tous ces critères sont identiques, les joueurs sont ex æquo.</p></> : mode === "duels" ? <><p><strong>Le classement Duels progresse sans plafond.</strong> Un duel officiel contre un joueur terminé est requis pour être classé.</p><DuelRules /></> : mode === "business" ? <><p><strong>Le classement Entreprise additionne cultures, ventes et réputation, sans plafond.</strong> Tes premiers points d’entreprise suffisent pour être classé, même sans duel.</p><BusinessRules /></> : <><TastingRules /><p>Le classement de saison suit les découvertes de la saison Kanab Quest en cours ; le classement global additionne toutes les saisons. Clique sur un testeur pour consulter son profil.</p></>}</div>
      </details>
    </div>
  </section>;
}
