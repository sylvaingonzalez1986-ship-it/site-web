"use client";

import { useRef } from "react";
import { BookOpen, Building2, ChevronDown, ChevronUp, CircleHelp, Crosshair, RefreshCw, Sprout, Swords, Trophy } from "lucide-react";
import Link from "@/components/navigation/NavigationLink";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { LeaderboardAvatar } from "./LeaderboardAvatar";
import styles from "./ArenaRankingBoard.module.css";

export type ArenaRankingMode = "general" | "tasting" | "placard";
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
  businessScore?: number;
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
  onModeChange: (mode: ArenaRankingMode) => void;
  onScopeChange: (scope: "season" | "global") => void;
  onRetry: () => void;
};

const modes = [
  { id: "general", label: "Général", description: "La course aux récompenses", icon: Trophy },
  { id: "tasting", label: "Dégustation", description: "Les fins connaisseurs", icon: BookOpen },
  { id: "placard", label: "Kanab Quest", description: "Les talents du village", icon: Sprout },
] as const;

const titles = { general: "Le classement général", tasting: "Les meilleurs testeurs", placard: "Les champions de Kanab Quest" };
const emptyMessages = {
  general: "Le tableau attend ses premiers joueurs. Termine un duel officiel pour entrer dans le classement.",
  tasting: "Aucun testeur classé pour le moment. Les avis validés dans le Carnet font gagner les premiers points.",
  placard: "Pas encore de cultivateur classé. Une première Fleur au jury, et l’aventure commence !",
};

function BusinessRules() {
  return <>
    <p>Le chiffre d’affaires encaissé dans le jeu, TTC et cumulé, apporte jusqu’à 80 points à 10 000 €. La valeur nette estimée apporte jusqu’à 60 points à 10 000 €. Ces deux bonus augmentent de moins en moins vite.</p>
    <p>La production rapporte 1,2 point par m² de culture équipé, jusqu’à 60 points pour 50 m². Une surface équipée compte même en pause ; les espaces vides, de séchage et de stockage sont exclus.</p>
    <p>La valeur nette estimée correspond à ce que possède encore ton entreprise, placements compris, moins ses dettes. Les placements sont évalués au dernier cours disponible ou, à défaut, à leur prix d’achat.</p>
  </>;
}

export function ArenaRankingBoard({ id, mode, scope, rows, loading, unavailable, compact = false, viewerPseudo, onModeChange, onScopeChange, onRetry }: ArenaRankingBoardProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const viewer = rows.find(row => row.pseudo === viewerPseudo);
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

  return <section id={id} className={styles.board} data-arena-ranking-board data-compact={compact || undefined} aria-labelledby={titleId}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}><Trophy size={15} aria-hidden="true" />Le tableau du village</p><h3 id={titleId}>{titles[mode]}</h3><p className={styles.intro}>{mode === "general" ? "Un bon carnet, de belles Fleurs et une entreprise qui grandit. À toi de faire ta place !" : mode === "tasting" ? "Les avis validés font la différence. Chaque dégustation enrichit le Carnet." : "Cultive, affronte le jury et développe ton entreprise pour monter au tableau."}</p></div>
      <span className={styles.seal}><Trophy size={24} aria-hidden="true" /><strong>{mode === "general" ? "1 000" : mode === "tasting" ? "Carnet" : "Kanab Quest"}</strong><small>{mode === "general" ? "points à viser" : "le palmarès"}</small></span>
    </header>

    <div className={styles.modeSwitch} role="group" aria-label="Type de classement">
      {modes.map(({ id: nextMode, label, description, icon: Icon }) => <button key={nextMode} type="button" aria-pressed={mode === nextMode} aria-controls={listId} onClick={() => changeMode(nextMode)}><Icon size={22} aria-hidden="true" /><span><strong>{label}</strong><small>{description}</small></span></button>)}
    </div>

    <div className={styles.paper}>
      {mode === "general" ? <div className={styles.scoreRecipe} aria-label="Répartition des 1 000 points du classement général">
        <div data-criterion="notebook"><BookOpen aria-hidden="true" /><span><strong>Carnet</strong><small>Avis validés</small></span><b>300<small>pts max.</small></b></div>
        <div data-criterion="duels"><Swords aria-hidden="true" /><span><strong>Duels</strong><small>Activité + cote</small></span><b>500<small>pts max.</small></b></div>
        <div data-criterion="business"><Building2 aria-hidden="true" /><span><strong>Entreprise</strong><small>Ton développement</small></span><b>200<small>pts max.</small></b></div>
      </div> : null}

      {mode !== "tasting" ? <div className={styles.businessRecipe} aria-label="Les trois critères du développement de l’entreprise">
        <span><Building2 size={18} aria-hidden="true" /><strong>Entreprise · 200 points max.</strong></span>
        <ul><li>Chiffre d’affaires <b>80</b></li><li>Production <b>60</b></li><li>Valeur nette <b>60</b></li></ul>
      </div> : null}

      <div className={styles.toolbar}>
        <div className={styles.listLabel}><span className={styles.liveDot} aria-hidden="true" /><strong>{loading ? "Le tableau se prépare…" : unavailable ? "Tableau indisponible" : `${rows.length} joueur${rows.length > 1 ? "s" : ""} au tableau`}</strong>{!loading && !unavailable && rows.length > 0 ? <small>{mode === "tasting" ? scope === "season" ? "Cette saison" : "Toutes les saisons" : "Classement de la saison"}</small> : null}</div>
        <div className={styles.toolbarActions}>
          {mode === "tasting" ? <div className={styles.scopeSwitch} role="group" aria-label="Période du classement dégustation">{(["season", "global"] as const).map(nextScope => <button key={nextScope} type="button" aria-pressed={scope === nextScope} onClick={() => onScopeChange(nextScope)}>{nextScope === "season" ? "Saison" : "Global"}</button>)}</div> : null}
          {viewer && !loading && !unavailable ? <button className={styles.myPosition} type="button" onClick={findMyPosition}><Crosshair size={16} aria-hidden="true" />Ma place <b>#{viewer.rank}</b></button> : null}
          {!loading && !unavailable && rows.length > 5 ? <div className={styles.scrollButtons}><button type="button" aria-label="Voir les joueurs précédents" aria-controls={listId} onClick={() => listRef.current?.scrollBy({ top: -300, behavior: scrollBehavior() })}><ChevronUp size={18} aria-hidden="true" /></button><button type="button" aria-label="Voir les joueurs suivants" aria-controls={listId} onClick={() => listRef.current?.scrollBy({ top: 300, behavior: scrollBehavior() })}><ChevronDown size={18} aria-hidden="true" /></button></div> : null}
        </div>
      </div>

      <div className={styles.listHeading} aria-hidden="true"><span>Place &amp; joueur</span><span>{mode === "general" ? "Score / 1 000" : mode === "placard" ? "Score Kanab Quest" : "Points Carnet"}</span></div>
      <div id={listId} ref={listRef} className={styles.listWindow} role="region" aria-label={titles[mode]} aria-busy={loading} tabIndex={0}>
        {loading ? <div className={styles.state} role="status"><RefreshCw className={styles.loadingIcon} size={28} aria-hidden="true" /><strong>On accroche les résultats…</strong><p>Chargement du classement.</p></div>
          : unavailable ? <div className={styles.state} role="status"><CircleHelp size={30} aria-hidden="true" /><strong>Le tableau prend une pause.</strong><p>Le classement est momentanément indisponible.</p><button type="button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" />Réessayer</button></div>
          : rows.length === 0 ? <div className={styles.state} role="status"><Sprout size={32} aria-hidden="true" /><strong>Une place à prendre !</strong><p>{emptyMessages[mode]}</p></div>
          : <ol className={styles.rows}>{rows.map(row => {
            const isViewer = row.pseudo === viewerPseudo;
            const content = <>
              <span className={styles.rank} data-podium={row.rank <= 3 || undefined} aria-label={`Place ${row.rank}`}>{row.rank === 1 ? <Trophy size={13} aria-hidden="true" /> : null}<b>{row.rank}</b></span>
              <span className={styles.avatar}><LeaderboardAvatar profile={row.avatar} pseudo={row.pseudo} /></span>
              <span className={styles.identity}><span className={styles.playerName}><strong>{row.pseudo}</strong>{isViewer ? <em>Toi</em> : null}</span>{row.contributions ? <span className={styles.contributions}><span>Carnet <b>{row.contributions.notebook}</b></span><span>Duels <b>{row.contributions.duels}</b></span><span>Entreprise <b>{row.contributions.business}</b></span></span> : <small className={styles.detail}>{row.detail}</small>}{row.businessScore !== undefined && !row.contributions ? <span className={styles.businessScore}>Entreprise <b>{row.businessScore} / 200</b></span> : null}</span>
              <span className={styles.score}><strong>{row.score.toLocaleString("fr-FR")}</strong><small>{row.scoreLabel}</small>{row.rewardGrams !== null ? <em>≈ {row.rewardGrams} g</em> : null}</span>
            </>;
            return <li key={row.key} value={row.rank}>{row.href ? <Link href={row.href} className={styles.row} data-viewer={isViewer || undefined} aria-label={`Voir le profil de ${row.pseudo}, place ${row.rank}`}>{content}</Link> : <div className={styles.row} tabIndex={-1} data-viewer={isViewer || undefined}>{content}</div>}</li>;
          })}</ol>}
      </div>
      {!loading && !unavailable && rows.length > 5 ? <p className={styles.listFootnote}>Fais défiler pour voir la suite du classement.</p> : null}

      <details className={styles.rules}>
        <summary><CircleHelp size={17} aria-hidden="true" /><span>{mode === "tasting" ? "Comment gagner des points ?" : "Comment les points sont calculés"}</span><ChevronDown size={17} aria-hidden="true" /></summary>
        <div>{mode === "general" ? <><p><strong>Le classement général est sur 1 000 points.</strong> Carnet : 300 maximum. Duels : 500 maximum, dont 400 pour l’activité et 100 pour la cote. Entreprise : 200 maximum. Un duel officiel terminé est requis pour être classé.</p><BusinessRules /></> : mode === "placard" ? <><p>Le <strong>Score Kanab Quest</strong> additionne la cote de duel, le bonus de saison (150 maximum), le bonus de réputation (100 maximum) et le développement de l’entreprise (200 maximum).</p><BusinessRules /><p>À Score Kanab Quest égal : meilleure réputation, puis meilleure cote, plus de victoires, moins de défaites et enfin plus de points de saison.</p></> : <p>Les avis validés dans le Carnet font progresser ton profil testeur et tes points. Le classement de saison suit la récolte en cours ; le classement global réunit toutes les saisons. Clique sur un testeur pour consulter son profil.</p>}</div>
      </details>
    </div>
  </section>;
}
