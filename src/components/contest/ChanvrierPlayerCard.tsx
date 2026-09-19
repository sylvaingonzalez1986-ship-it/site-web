"use client";
import { ChanvrierSavingsPanel } from "./ChanvrierSavingsPanel";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Award, BookOpen, Check, ChevronUp, Dices, Gift, Leaf, LockKeyhole, Medal, Pencil, Pin, ShieldCheck, Sparkles, Store, Swords, Target, Trophy, X } from "lucide-react";
import { CHANVRIER_STRENGTHS, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, BADGE_TIERS, achievementProgress, type AchievementCategory, type ChanvrierBadge, type ChanvrierProgress, type ChanvrierShowcase } from "@/lib/chanvrier-progress";
import { getKqReputationProgress } from "@/lib/kanab-quest-reputation";
import { KQ_MISSION_COPY } from "@/lib/kanab-quest-missions";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import styles from "./ChanvrierPlayerCard.module.css";

const ICONS = { "triple-spark": Dices, "spark-collector": Sparkles, "perfect-culture": Leaf, "cool-head": ShieldCheck, "natural-defense": ShieldCheck, "jury-favorite": Trophy, "versatile-artisan": Store, "perfect-victory": Swords };
const ORIGINS = { game: "Placard", notebook: "Carnet", season: "Saison" };
const UPDATES = ["arena:progress-updated", "kq:market-updated", "kq:boosters-updated", "kq:missions-updated", "contest:badges-updated"];
function BadgeMedal({ badge }: { badge: Pick<ChanvrierBadge, "code" | "awardedAt"> }) {
  const code = ACHIEVEMENTS.find(a => badge.code.startsWith(`kq-ach-${a.code}-`))?.code;
  const Icon = code ? ICONS[code as keyof typeof ICONS] : Award;
  const tier = code ? badge.code.slice(-1) : "2";
  return <span className={styles.medal} data-tier={tier} data-locked={!badge.awardedAt} aria-hidden="true"><Icon size={27} /></span>;
}
function Meter({ value, target, label }: { value: number; target: number; label: string }) {
  return <progress className={styles.meter} value={Math.min(value, target)} max={target} aria-label={label} />;
}

export function ChanvrierPlayerCard({ profile, onEdit }: { profile: ChanvrierProfile; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"journey" | "achievements" | "badges">("journey");
  const [filter, setFilter] = useState<AchievementCategory | "all">("all");
  const [origin, setOrigin] = useState<"all" | ChanvrierBadge["origin"]>("all");
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [data, setData] = useState<ChanvrierProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const fetchedAt = useRef(0);
  const requestVersion = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const badgeDetail = useRef<HTMLDivElement>(null);
  const id = useId();
  const strength = CHANVRIER_STRENGTHS.find(item => item.code === profile.strength)!;
  const close = () => { dialog.current?.close(); setOpen(false); setData(current => current ? { ...current, newBadgeCount: 0 } : null); trigger.current?.focus({ preventScroll: true }); };

  useBodyScrollLock(open);
  useEffect(() => { if (tab === "badges" && selectedBadge) badgeDetail.current?.scrollIntoView({ block: "nearest" }); }, [selectedBadge, tab]);
  useEffect(() => {
    const invalidate = () => { fetchedAt.current = 0; setDirty(true); if (open) setRefresh(v => v + 1); };
    UPDATES.forEach(event => window.addEventListener(event, invalidate));
    return () => UPDATES.forEach(event => window.removeEventListener(event, invalidate));
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, [open]);
  useEffect(() => {
    if (!open || Date.now() - fetchedAt.current < 60_000) return;
    const controller = new AbortController();
    const version = ++requestVersion.current;
    setLoading(true); setError("");
    void (async () => {
      try {
        const response = await fetch("/api/arena/chanvrier/progress", { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Impossible de charger ton parcours.");
        if (controller.signal.aborted || version !== requestVersion.current) return;
        setData(payload); fetchedAt.current = Date.now(); setDirty(false);
        if (payload.newBadgeCount > 0) {
          // Only acknowledge badges actually shown, not a newer concurrent unlock.
          void fetch("/api/arena/chanvrier/progress", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seenBadgeCount: payload.badgeCount }) }).catch(() => {});
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Parcours indisponible.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [open, refresh]);

  async function save(showcase: ChanvrierShowcase) {
    if (saving) return;
    setSaving(true); setSaveError("");
    ++requestVersion.current;
    try {
      const response = await fetch("/api/arena/chanvrier/progress", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showcase }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Vitrine indisponible.");
      setData(current => current ? { ...current, showcase } : current);
      fetchedAt.current = 0;
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : "Impossible d’enregistrer ce choix."); }
    finally { setSaving(false); }
  }
  const reputation = getKqReputationProgress(data?.reputation ?? 0);
  const chosenTitle = ACHIEVEMENTS.find(a => a.code === data?.showcase.title)?.title;
  const pinned = data?.badges.filter(b => data.showcase.badges.includes(b.id)) ?? [];
  const goldFrame = data?.badges.some(b => b.code === "kq-ach-jury-favorite-3" && b.awardedAt);
  const inspected = data?.badges.find(b => b.id === selectedBadge);
  const achievements = ACHIEVEMENTS.map(a => achievementProgress(a.code, data?.metrics ?? {}));
  const objectives = data ? [
    ...data.missions.filter(m => m.unlocked && !m.claimed).map(m => ({ key: m.code, title: KQ_MISSION_COPY[m.code].title, value: m.progress, target: m.target, hint: m.claimable ? "Pack à récupérer" : "Mission", href: m.claimable ? "/arene/placard?view=missions" : `/arene/placard?view=${KQ_MISSION_COPY[m.code].destination}`, priority: m.claimable ? 2 : m.progress / m.target })),
    ...achievements.filter(a => !a.completed).map(a => ({ key: a.code, title: a.name, value: a.value, target: a.target, hint: a.code === data.showcase.tracked ? "Objectif épinglé" : "Succès", href: `/arene/placard?view=${a.category === "commerce" ? "market" : a.category === "arena" ? "arena" : "game"}`, priority: a.code === data.showcase.tracked ? 3 : a.value / a.target })),
  ].sort((a, b) => b.priority - a.priority).slice(0, 3) : [];

  return <div className={styles.dock} data-chanvrier-card>
    <button ref={trigger} type="button" className={styles.trigger} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog" onClick={() => setOpen(v => !v)}>
      <span className={styles.thumbnail} aria-hidden="true"><ChanvrierAvatar profile={profile} /></span>
      <span className={styles.label}><small>MA CARTE {dirty ? <span className={styles.dot} aria-label="Parcours actualisé" /> : null}</small><strong>{profile.nickname}</strong></span><ChevronUp size={18} />
    </button>
    {open ? createPortal(<dialog ref={dialog} id={id} aria-labelledby={`${id}-name`} className={styles.card} data-chanvrier-palmares onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.sheet}>
        <header className={styles.header}><span>LA GUILDE DES CHANVRIERS</span><button type="button" aria-label="Replier ma carte" onClick={close}><X size={20} /></button></header>
        <div className={styles.hero}>
          <div className={styles.portrait} data-gold={goldFrame}><ChanvrierAvatar profile={profile} className={styles.avatar} /><span>{strength.name}</span></div>
          <div className={styles.identity}><small>MON PERSONNAGE · MON HISTOIRE</small><h2 id={`${id}-name`}>{profile.nickname}</h2><p className={styles.chosenTitle}>{chosenTitle || (profile.gender === "female" ? "Chanvrière de la guilde" : "Chanvrier de la guilde")}</p>
            <div className={styles.pinned} aria-label="Mes trois distinctions"><span className={styles.pinnedLabel}>Ma vitrine</span>{[0, 1, 2].map(index => <button key={index} type="button" title={pinned[index]?.label || "Choisir un badge"} aria-label={pinned[index]?.label || `Choisir le badge ${index + 1}`} onClick={() => { setTab("badges"); setSelectedBadge(pinned[index]?.id ?? null); }}>{pinned[index] ? <BadgeMedal badge={pinned[index]} /> : <Medal size={22} />}</button>)}</div>
            <details className={styles.specialty}><summary>Ma spécialité · {strength.badge}</summary><p>{strength.description}</p></details>
            <button type="button" className={styles.edit} onClick={() => { close(); onEdit(); }}><Pencil size={13} />Personnaliser mon personnage</button>
          </div>
        </div>
        {profile.strength === "treasurer" ? <ChanvrierSavingsPanel /> : null}
        <nav className={styles.tabs} aria-label="Rubriques de ma carte">{([
          ["journey", "Mon parcours", Target], ["achievements", "Succès", Trophy], ["badges", "Badges", Medal],
        ] as const).map(([key, label, Icon]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}><Icon size={17} />{label}</button>)}</nav>
        <div className={styles.content} aria-busy={loading}>
          {loading ? <p className={styles.notice} role="status">Ouverture de ton palmarès…</p> : null}
          {error ? <div className={styles.notice} role="alert"><p>{error}</p><button type="button" disabled={loading} onClick={() => { fetchedAt.current = 0; setRefresh(v => v + 1); }}>Réessayer le palmarès</button></div> : null}
          {saveError ? <p className={styles.notice} role="alert">{saveError}</p> : null}
          {data && !loading ? <>
            {data.newBadgeCount > 0 ? <div className={styles.unlock} role="status"><Sparkles size={21} /><span><strong>{data.newBadgeCount} nouvelle{data.newBadgeCount > 1 ? "s distinctions" : " distinction"} !</strong> Ta vitrine s’agrandit.</span><button type="button" onClick={() => setTab("badges")}>Voir</button></div> : null}
            {tab === "journey" ? <>
              <div className={styles.reputation}><div><small>RÉPUTATION</small><h3>{reputation.tier.name}</h3><p>{reputation.nextTier ? `${reputation.pointsToNext} points avant ${reputation.nextTier.name}` : "Le plus haut palier est atteint."}</p></div><strong>{data.reputation}<small>points</small></strong><Meter value={reputation.progressPercent} target={100} label="Prochain palier de réputation" /></div>
              <div className={styles.stats}>
                <div><Leaf /><strong>{data.metrics.cultures ?? 0}</strong><span>Cultures terminées</span></div>
                <div><Trophy /><strong>{data.metrics.bestJury ? `${data.metrics.bestJury.toLocaleString("fr-FR")}/10` : "—"}</strong><span>Meilleure note du jury</span></div>
                <div><Swords /><strong>{data.metrics.wins ?? 0} <small>V ·</small> {data.metrics.losses ?? 0} <small>D</small></strong><span>Duels entre joueurs</span></div>
              </div>
              <div className={styles.ranking}><Award size={29} /><div><strong>Classement commun</strong><p>{data.rank ? `N° ${data.rank} au Placard` : "Pas encore classé"} · Tous les chanvriers réunis</p>{data.rank && data.rankAsOf ? <small>Classement du {new Date(data.rankAsOf).toLocaleDateString("fr-FR")}</small> : null}</div><Link prefetch={false} onClick={close} href="/arene">L’arène ↗</Link></div>
              <div className={styles.sectionTitle}><h3>Mon prochain cap</h3><Link prefetch={false} onClick={close} href="/arene/placard?view=missions">Toutes les missions ↗</Link></div>
              <div className={styles.objectives}>{objectives.map(o => <Link prefetch={false} onClick={close} key={o.key} href={o.href}><small>{o.hint}</small><strong>{o.title}</strong><Meter value={o.value} target={o.target} label={o.title} /><span>{Math.min(o.value, o.target)} / {o.target}<b>Continuer →</b></span></Link>)}</div>
              {!objectives.length ? <p>Tous tes objectifs sont atteints. Quelle sera ta prochaine fleur d’exception ?</p> : null}
            </> : null}
            {tab === "achievements" ? <>
              <div className={styles.reward}><Gift size={27} /><div><h3>{data.unlockedFamilies} / 8 familles débloquées</h3><p>Un pack La Botte à 5 familles, puis un à 8. Chaque pack contient 10 cartes.</p><Meter value={data.unlockedFamilies} target={8} label="Familles de succès" /><small>{data.packsGranted} / 2 packs gagnés · chaque récompense une seule fois</small></div><Link prefetch={false} onClick={close} href="/arene/placard?view=shop">Mes packs ↗</Link></div>
              <div className={styles.filters} aria-label="Filtrer les succès">{(["all", "culture", "dice", "commerce", "arena"] as const).map(key => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{key === "all" ? "Tous" : ACHIEVEMENT_CATEGORIES[key]}</button>)}</div>
              <div className={styles.achievements}>{achievements.filter(a => filter === "all" || a.category === filter).map(a => <article key={a.code} className={styles.achievement} data-earned={a.tier > 0}>
                <BadgeMedal badge={{ code: `kq-ach-${a.code}-${Math.max(1, a.tier)}`, awardedAt: a.tier ? "earned" : null }} /><div className={styles.achievementBody}><small>{ACHIEVEMENT_CATEGORIES[a.category]} · {a.tier ? BADGE_TIERS[a.tier - 1] : "À débloquer"}</small><h3>{a.name}</h3><p>{a.description}</p><Meter value={a.value} target={a.target} label={a.name} /><span className={styles.progressText}>{a.value} / {a.target} {a.unit}{a.completed ? <Check size={15} aria-label="Terminé" /> : null}</span><div className={styles.tiers}>{a.thresholds.map((n, i) => <span key={n} data-earned={a.value >= n}>{BADGE_TIERS[i]} · {n}</span>)}</div><small className={styles.rewardHint}>{a.title ? `Au dernier palier : titre « ${a.title} »` : a.code === "jury-favorite" ? "Au dernier palier : cadre de portrait doré" : "Distinction permanente pour ta vitrine"}</small>
                <button className={styles.pin} type="button" disabled={saving || (a.completed && data.showcase.tracked !== a.code)} aria-pressed={data.showcase.tracked === a.code} onClick={() => void save({ ...data.showcase, tracked: data.showcase.tracked === a.code ? null : a.code })}><Pin size={13} />{data.showcase.tracked === a.code ? "Objectif épinglé" : "Suivre cet objectif"}</button></div>
              </article>)}</div><p className={styles.footnote}>Les dés finaux et les cultures terminées comptent. Tes succès restent acquis d’une saison à l’autre.</p>
            </> : null}
            {tab === "badges" ? <>
              <div className={styles.sectionTitle}><div><h3>Ma collection de distinctions</h3><p>{data.badgeCount} obtenues · {data.showcase.badges.length} / 3 épinglées</p></div></div>
              <label className={styles.titleSelect}>Le titre sur ma carte<select value={data.showcase.title ?? ""} disabled={saving} onChange={e => void save({ ...data.showcase, title: e.target.value || null })}><option value="">Membre de la guilde</option>{ACHIEVEMENTS.filter(a => a.title && data.badges.some(b => b.code === `kq-ach-${a.code}-${a.thresholds.length}` && b.awardedAt)).map(a => <option key={a.code} value={a.code}>{a.title}</option>)}</select></label>
              <div className={styles.filters} aria-label="Origine des badges">{(["all", "game", "notebook", "season"] as const).map(key => <button type="button" key={key} aria-pressed={origin === key} onClick={() => setOrigin(key)}>{key === "all" ? "Tous" : ORIGINS[key]}</button>)}</div>
              {inspected ? <div ref={badgeDetail} className={styles.badgeDetail}><BadgeMedal badge={inspected} /><div><small>{ORIGINS[inspected.origin]}</small><h3>{inspected.label}</h3><p>{inspected.description}</p><small>{inspected.awardedAt ? `Obtenu le ${new Date(inspected.awardedAt).toLocaleDateString("fr-FR")}` : "Cette distinction reste à gagner."}</small>{inspected.awardedAt ? <button type="button" disabled={saving || (!data.showcase.badges.includes(inspected.id) && data.showcase.badges.length >= 3)} onClick={() => void save({ ...data.showcase, badges: data.showcase.badges.includes(inspected.id) ? data.showcase.badges.filter(b => b !== inspected.id) : [...data.showcase.badges, inspected.id] })}><Pin size={14} />{data.showcase.badges.includes(inspected.id) ? "Retirer de ma carte" : data.showcase.badges.length >= 3 ? "Retire un badge pour faire de la place" : "Afficher sur ma carte"}</button> : null}</div></div> : <p className={styles.footnote}>Ouvre un badge pour lire sa condition et choisir ceux que tu affiches sur ta carte.</p>}
              <div className={styles.badges}>{data.badges.filter(b => origin === "all" || b.origin === origin).map(b => <button type="button" key={b.id} aria-pressed={b.id === selectedBadge} className={styles.badge} data-earned={Boolean(b.awardedAt)} onClick={() => setSelectedBadge(b.id)}><BadgeMedal badge={b} /><strong>{b.label}</strong><small>{data.showcase.badges.includes(b.id) ? <><Pin size={11} /> Épinglé</> : b.awardedAt ? <><Check size={11} /> Obtenu</> : <><LockKeyhole size={11} /> À gagner</>}</small></button>)}</div>
              {data.badges.filter(b => origin === "all" || b.origin === origin).length === 0 ? <p>Aucune distinction dans cette catégorie pour le moment.</p> : null}
              <p className={styles.footnote}>Les badges du Carnet et les missions conservent leurs récompenses habituelles.</p>
            </> : null}
          </> : null}
        </div>
        <footer className={styles.footer}><Link prefetch={false} onClick={close} href="/arene/carnet/regular"><BookOpen size={15} />Mon Carnet</Link><Link prefetch={false} onClick={close} href="/arene/placard?view=missions"><Target size={15} />Mes missions</Link><Link prefetch={false} onClick={close} href="/arene/placard"><Dices size={15} />Mes cartes La Botte</Link></footer>
      </div>
    </dialog>, document.body) : null}
  </div>;
}
