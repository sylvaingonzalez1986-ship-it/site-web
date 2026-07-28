"use client";

import Image from "next/image";
import { Activity, BookOpen, Droplets, Eye, Fan, Flower2, Gauge, HeartPulse, Lightbulb, RotateCcw, Sparkles, Sprout, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  advancePlacardCulture,
  assessPlacardAction,
  getPlacardBiologicalReport,
  getPlacardQuickStatus,
  getPlacardDailyEvent,
  getPlacardActionHand,
  getPlacardPhase,
  PLACARD_SETUPS,
  PLACARD_TOTAL_DAYS,
  PLACARD_VARIETIES,
  scorePlacardHarvest,
  startPlacardCulture,
type PlacardAction,
  type PlacardCultureState,
  type PlacardHarvest,
  type PlacardSetup,
} from "@/lib/placard-game";
import styles from "./PlacardPrototype.module.css";

const STORAGE_KEY = "placard-local-prototype-v4";

type LocalContestResult = {
  opponentName: string;
  opponentScore: number;
  playerRounds: number;
  opponentRounds: number;
  rounds: Array<{ label: string; player: number; opponent: number }>;
};

type MobileGameView = "culture" | "journal";

const PRIMARY_ACTIONS = new Set<PlacardAction>([
  "inspect-canopy", "measured-irrigation", "renew-air", "adjust-light", "sanitary-scouting",
  "space-flowers", "control-drying-air", "inspect-drying",
]);

type ActionDefinition = {
  id: PlacardAction;
  label: string;
  hint: string;
  icon: typeof Eye;
};

const ACTIONS: ActionDefinition[] = [
  { id: "inspect-canopy", label: "Inspecter la canopée", hint: "Observer feuilles et apex avant d’intervenir", icon: Eye },
  { id: "measured-irrigation", label: "Irrigation mesurée", hint: "Ramener l’eau à la cible sans saturer", icon: Droplets },
  { id: "renew-air", label: "Renouveler l’air", hint: "Améliorer les échanges dans la canopée", icon: Fan },
  { id: "adjust-light", label: "Ajuster la lampe", hint: "Viser la lumière adaptée au stade", icon: Lightbulb },
  { id: "check-drainage", label: "Contrôler le drainage", hint: "Repérer et corriger un substrat trop humide", icon: Sprout },
  { id: "climate-control", label: "Régler le climat", hint: "Adapter extraction et humidité au stade", icon: Gauge },
  { id: "canopy-training", label: "Palisser la canopée", hint: "Répartir la lumière ; utile surtout en croissance", icon: Flower2 },
  { id: "sanitary-scouting", label: "Inspection sanitaire", hint: "Contrôler feuilles et zones humides", icon: HeartPulse },
  { id: "check-runoff", label: "Mesurer le drainage", hint: "Vérifier l’équilibre avant de fertiliser", icon: Activity },
  { id: "space-flowers", label: "Espacer le lot", hint: "Uniformiser la circulation d’air", icon: Flower2 },
  { id: "control-drying-air", label: "Régler le séchage", hint: "Modérer l’air et limiter la lumière", icon: Fan },
  { id: "inspect-drying", label: "Contrôler le séchage", hint: "Comparer plusieurs zones du lot", icon: Eye },
  { id: "stabilize-storage", label: "Stabiliser le stockage", hint: "Protéger le lot dans l’obscurité", icon: Gauge },
  { id: "vent-containers", label: "Renouveler les contenants", hint: "Évacuer un excès d’humidité", icon: Activity },
  { id: "sensory-check", label: "Contrôle sensoriel", hint: "Consigner toucher et évolution aromatique", icon: Sparkles },
];

function Metric({ label, value, tone = "green" }: { label: string; value: number; tone?: "green" | "blue" | "gold" | "red" }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <div className={styles.metricTrack}>
        <i className={styles[tone]} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
      <strong>{Math.round(value)}</strong>
    </div>
  );
}

function BiologicalIndicator({ label, status, detail, value, tone }: ReturnType<typeof getPlacardBiologicalReport>[number]) {
  return (
    <article className={styles.bioIndicator} data-tone={tone}>
      <div className={styles.bioIndicatorHeader}>
        <span>{label}</span>
        <strong>{status}</strong>
      </div>
      <div className={styles.bioTrack} aria-hidden="true"><i style={{ width: `${Math.max(3, Math.min(100, value))}%` }} /></div>
      <p>{detail}</p>
    </article>
  );
}

export function PlacardPrototype() {
  const [culture, setCulture] = useState<PlacardCultureState | null>(null);
  const [selectedCode, setSelectedCode] = useState(PLACARD_VARIETIES[0].code);
  const [selectedSetup, setSelectedSetup] = useState<PlacardSetup["code"]>("balanced");
  const [hydrated, setHydrated] = useState(false);
  const [pressedAction, setPressedAction] = useState<PlacardAction | null>(null);
  const [contestResult, setContestResult] = useState<LocalContestResult | null>(null);
  const [mobileView, setMobileView] = useState<MobileGameView>("culture");
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setCulture(JSON.parse(saved) as PlacardCultureState);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (culture) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(culture));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [culture, hydrated]);

  useEffect(() => () => {
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
  }, []);

  const variety = useMemo(
    () => PLACARD_VARIETIES.find((item) => item.code === (culture?.varietyCode ?? selectedCode)) ?? PLACARD_VARIETIES[0],
    [culture?.varietyCode, selectedCode],
  );
  const harvest = culture?.harvested ? scorePlacardHarvest(culture) : null;
  const latest = culture?.history.at(-1);
  const activeSetup = PLACARD_SETUPS.find((item) => item.code === (culture?.setupCode ?? selectedSetup)) ?? PLACARD_SETUPS[1];
  const dailyEvent = culture && culture.day < 7 ? getPlacardDailyEvent(culture.seed, culture.day) : null;
  const actionHand = culture ? getPlacardActionHand(culture) : [];
  const biologicalReport = culture ? getPlacardBiologicalReport(culture) : [];
  const quickStatus = culture ? getPlacardQuickStatus(culture) : [];
  const buddyReaction = quickStatus.find((item) => item.tone === "alert")
    ?? quickStatus.find((item) => item.tone === "watch")
    ?? quickStatus[2];

  const play = (action: PlacardAction) => {
    if (pressedAction) return;
    setPressedAction(action);
    setCulture((current) => (current ? advancePlacardCulture(current, action) : current));
    actionTimerRef.current = setTimeout(() => setPressedAction(null), 520);
  };

  const renderTechnique = ({ id, label, hint, icon: Icon }: ActionDefinition, index: number) => {
    if (!culture) return null;
    const assessment = assessPlacardAction(culture, id);
    return (
      <button
        key={id}
        type="button"
        onClick={() => play(id)}
        disabled={pressedAction !== null}
        aria-pressed={pressedAction === id}
        className={pressedAction === id ? styles.actionPressed : ""}
      >
        <span className={styles.techniqueNumber}>T{index + 1}</span>
        <Icon aria-hidden="true" />
        <span className={styles.actionCopy}>
          <span className={styles.actionTitle}><strong>{pressedAction === id ? `${label} ✓` : label}</strong></span>
          <small>{pressedAction === id ? "Action enregistrée" : hint}</small>
          {pressedAction !== id ? (
            <span className={styles.tradeoffs}>
              <small className={styles.advantage}><b>+</b>{assessment.advantage}</small>
              <small className={styles.drawback}><b>−</b>{assessment.drawback}</small>
            </span>
          ) : null}
        </span>
      </button>
    );
  };

  const enterContest = (scores: PlacardHarvest) => {
    const opponentName = variety.code === "HH2026-014" ? "Cannatonic du Jury" : "Sour Tsunami du Jury";
    const offset = ((culture?.seed ?? 1) % 9) - 4;
    const rounds = [
      { label: "Présentation", player: (scores.aspect + scores.cleanliness) / 2, opponent: 72 + offset },
      { label: "Analyse aromatique", player: (scores.nose + scores.complexity) / 2, opponent: 76 - offset / 2 },
      { label: "Verdict final", player: (scores.complexity + scores.sobriety) / 2, opponent: 74 + offset / 3 },
    ].map((round) => ({ ...round, player: Math.round(round.player), opponent: Math.round(round.opponent) }));
    const playerRounds = rounds.filter((round) => round.player >= round.opponent).length;
    setContestResult({
      opponentName,
      opponentScore: Math.round(rounds.reduce((sum, round) => sum + round.opponent, 0) / rounds.length),
      playerRounds,
      opponentRounds: rounds.length - playerRounds,
      rounds,
    });
  };

  if (!hydrated) return <main className={styles.page}><div className={styles.loading}>Ouverture du carnet…</div></main>;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Prototype local · aucune donnée Supabase</p>
          <h1>Le Placard</h1>
          <p>Choisis un Buddie, conduis sa culture et révèle ta première carte Récolte.</p>
        </div>
        <Image src="/dev/placard/arena-duo.webp" alt="Le duo de l’Arène" width={270} height={190} priority />
      </section>

      {!culture ? (
        <section className={styles.notebook}>
          <header className={styles.sectionHeader}>
            <div><span>Album de test</span><h2>Choisis ta variété</h2></div>
            <p>Ces trois cartes sont débloquées localement pour tester la boucle.</p>
          </header>
          <div className={styles.cardGrid}>
            {PLACARD_VARIETIES.map((item) => {
              const active = item.code === selectedCode;
              return (
                <button key={item.code} type="button" onClick={() => setSelectedCode(item.code)} className={`${styles.varietyCard} ${active ? styles.selected : ""}`}>
                  <div className={styles.cardArt} data-rarity={item.rarity}>
                    <span className={styles.cardNumber}>#{item.cardNumber}</span>
                    <Image src="/dev/placard/card-back.webp" alt="" fill sizes="240px" />
                    <span className={styles.cultivable}>Cultivable</span>
                  </div>
                  <div className={styles.cardCopy}>
                    <strong>{item.name}</strong>
                    <span>{item.aroma}</span>
                    <small>Difficulté {"●".repeat(item.difficulty)}{"○".repeat(3 - item.difficulty)}</small>
                  </div>
                </button>
              );
            })}
          </div>
          <div className={styles.setupPicker}>
            <div><span className={styles.kicker}>Configuration du placard</span><h3>Choisis ton installation</h3></div>
            <div className={styles.setupOptions}>
              {PLACARD_SETUPS.map((setup) => (
                <button key={setup.code} type="button" onClick={() => setSelectedSetup(setup.code)} aria-pressed={selectedSetup === setup.code} className={selectedSetup === setup.code ? styles.setupSelected : ""}>
                  <strong>{setup.name}</strong><small>{setup.description}</small>
                  <span>Lumière {setup.light} · Air {setup.airflow}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.selectionFooter}>
            <div><strong>{variety.name} · Installation {activeSetup.name}</strong><p>{variety.description}</p></div>
            <button type="button" className={styles.primaryButton} onClick={() => setCulture(startPlacardCulture(selectedCode, 2026, selectedSetup))}>Envoyer au Placard</button>
          </div>
        </section>
      ) : (
        <section className={styles.gameLayout} data-mobile-view={mobileView}>
          <div className={styles.gameBoard}>
            <header className={styles.boardHeader}>
              <div><span>Jour {culture.day}/{PLACARD_TOTAL_DAYS}</span><h2>{getPlacardPhase(culture.day)}</h2></div>
              <button type="button" className={styles.resetButton} onClick={() => setCulture(null)}><RotateCcw size={16} /> Recommencer</button>
            </header>

            <div className={styles.boardCenter}>
              <div className={styles.equipment}><Lightbulb /><span>{activeSetup.name}</span><strong>{Math.round(culture.light)}</strong></div>
              <div className={styles.heroCard}>
                <Image src="/dev/placard/card-back.webp" alt="" fill sizes="280px" />
                <div><small>Hemp Heroes #{variety.cardNumber}</small><strong>{variety.name}</strong><span>{getPlacardPhase(culture.day)}</span></div>
              </div>
              <div className={styles.equipment}><Fan /><span>Air</span><strong>{Math.round(culture.airflow)}</strong></div>
            </div>

            {harvest ? (
              <div className={styles.harvestPanel}>
                <Image src="/dev/placard/charles.webp" alt="Charles présente la récolte" width={180} height={210} />
                <div><span className={styles.kicker}>Carte Récolte révélée</span><h2>{variety.name} · #{String(culture.seed).padStart(5, "0")}</h2><p>Première récolte locale prête pour un concours de démonstration.</p></div>
                <div className={styles.score}><Trophy /><strong>{Math.round(harvest.total)}</strong><span>/100</span></div>
              </div>
            ) : (
              <div className={styles.diagnostic}>
                <Image src="/dev/placard/flower-inspector.webp" alt="L’inspecteur de l’Arène" width={122} height={122} />
                <div>
                  <span>Diagnostic de l’Inspecteur</span>
                  {dailyEvent ? <small className={styles.eventChip}>{dailyEvent.label}</small> : null}
                  <strong>{buddyReaction ? `${buddyReaction.emoji} ${buddyReaction.value}` : "😊 Tout va bien"}</strong>
                  <p>{latest?.summary ?? dailyEvent?.description ?? "Tout est prêt. Choisis ta première intervention."}</p>
                </div>
              </div>
            )}
          </div>

          <aside className={styles.sidebar}>
            <div className={`${styles.metricsPanel} ${styles.statusPanel}`}>
              <span className={styles.kicker}>En un coup d’œil</span>
              <h3>Comment va ton Buddie ?</h3>
              <div className={styles.quickStatusGrid}>
                {quickStatus.map((item) => (
                  <article key={item.code} data-tone={item.tone}>
                    <b aria-hidden="true">{item.emoji}</b><span>{item.label}</span><strong>{item.value}</strong>
                  </article>
                ))}
              </div>
              <details className={styles.bioDetails}>
                <summary>Voir le diagnostic expert</summary>
                <p className={styles.bioIntro}>Les détails expliquent le calcul sans être nécessaires pour jouer.</p>
                <div className={styles.bioList}>
                  {biologicalReport.map((indicator) => <BiologicalIndicator key={indicator.code} {...indicator} />)}
                </div>
              </details>
            </div>

            {!harvest ? (
              <div className={styles.actionsPanel}>
                <span className={styles.kicker}>{actionHand.length} interventions disponibles</span>
                <h3>Que veux-tu faire ?</h3>
                <div className={styles.actionList}>
                  {ACTIONS.filter(({ id }) => actionHand.includes(id) && PRIMARY_ACTIONS.has(id)).map(renderTechnique)}
                </div>
                <details className={styles.advancedActions}>
                  <summary>Techniques avancées ({actionHand.filter((id) => !PRIMARY_ACTIONS.has(id)).length})</summary>
                  <div className={styles.actionList}>
                    {ACTIONS.filter(({ id }) => actionHand.includes(id) && !PRIMARY_ACTIONS.has(id)).map(renderTechnique)}
                  </div>
                </details>
                <p className={styles.handHint}>Une seule action par tour. Les techniques avancées restent toujours accessibles.</p>
              </div>
            ) : (
              <div className={styles.metricsPanel}>
                <span className={styles.kicker}>Verdict du jury</span>
                <Metric label="Aspect" value={harvest.aspect} />
                <Metric label="Nez" value={harvest.nose} tone="gold" />
                <Metric label="Complexité" value={harvest.complexity} />
                <Metric label="Propreté" value={harvest.cleanliness} tone="blue" />
                <Metric label="Sobriété" value={harvest.sobriety} />
                {harvest.combos.length > 0 ? (
                  <div className={styles.comboBox}>
                    <header><span>Combos débloqués</span><strong>+{harvest.comboBonus}</strong></header>
                    {harvest.combos.map((combo) => <div key={combo.code}><Sparkles aria-hidden="true" /><span><strong>{combo.label}</strong><small>{combo.description}</small></span></div>)}
                  </div>
                ) : null}
                <button type="button" className={styles.primaryButton} onClick={() => enterContest(harvest)}><Trophy size={17} /> Inscrire au concours</button>
                <button type="button" className={styles.secondaryButton} onClick={() => { setContestResult(null); setCulture(null); }}><Sparkles size={17} /> Nouvelle culture</button>
              </div>
            )}

            {culture.history.length > 0 ? (
              <details className={styles.historyPanel} open={mobileView === "journal" ? true : undefined}>
                <summary>
                  <span>Journal de culture</span>
                  <strong>{culture.history.length} entrée{culture.history.length > 1 ? "s" : ""}</strong>
                </summary>
                <ol>
                  {[...culture.history].reverse().slice(0, 6).map((entry) => {
                    const action = ACTIONS.find((item) => item.id === entry.action);
                    const Icon = action?.icon ?? Eye;
                    return (
                      <li key={`${entry.day}-${entry.action}`}>
                        <Icon aria-hidden="true" />
                        <span><strong>Jour {entry.day} · {action?.label ?? entry.action}</strong>{entry.eventLabel ? <em>{entry.eventLabel}</em> : null}<small>{entry.summary}</small></span>
                      </li>
                    );
                  })}
                </ol>
              </details>
            ) : null}
          </aside>

          <nav className={styles.mobileGameNav} aria-label="Navigation du Placard">
            <button type="button" className={mobileView === "culture" ? styles.mobileTabActive : ""} onClick={() => setMobileView("culture")} aria-pressed={mobileView === "culture"}>
              <Sprout aria-hidden="true" /><span>Culture & état</span>
            </button>
            <button type="button" className={mobileView === "journal" ? styles.mobileTabActive : ""} onClick={() => setMobileView("journal")} aria-pressed={mobileView === "journal"} disabled={culture.history.length === 0}>
              <BookOpen aria-hidden="true" /><span>Journal</span>
            </button>
          </nav>
        </section>
      )}

      {harvest && contestResult ? (
        <section className={styles.contestPanel} aria-live="polite">
          <div className={styles.judgeColumn}>
            <Image src="/dev/placard/leaderboard-judge.webp" alt="Le juge de l’Arène" width={210} height={210} />
            <span className={styles.kicker}>Verdict officiel local</span>
            <h2>{contestResult.playerRounds >= 2 ? "Victoire !" : "Défaite honorable"}</h2>
            <p>Le Juge a comparé les deux récoltes sur trois manches.</p>
          </div>
          <div className={styles.duelBoard}>
            <header>
              <div><small>Ta récolte</small><strong>{variety.name}</strong><span>{Math.round(harvest.total)} pts</span></div>
              <b>{contestResult.playerRounds} — {contestResult.opponentRounds}</b>
              <div><small>Adversaire</small><strong>{contestResult.opponentName}</strong><span>{contestResult.opponentScore} pts</span></div>
            </header>
            <div className={styles.roundList}>
              {contestResult.rounds.map((round) => (
                <div key={round.label} className={round.player >= round.opponent ? styles.roundWon : ""}>
                  <strong>{round.player}</strong><span>{round.label}</span><strong>{round.opponent}</strong>
                </div>
              ))}
            </div>
            <button type="button" className={styles.primaryButton} onClick={() => setContestResult(null)}>Fermer le verdict</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
