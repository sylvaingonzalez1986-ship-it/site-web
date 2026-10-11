"use client";

import { ChevronDown, Sprout, UserRound } from "lucide-react";
import { CHANVRIER_STRENGTHS, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import {
  CHANVRIER_CAREER_LEVEL_XP, CHANVRIER_CULTURE_XP, CHANVRIER_FAILED_STAGE_XP,
  CHANVRIER_PRACTICE_LABELS, CHANVRIER_PROCESSING_FAMILIES,
  getChanvrierEquipmentAccess, getChanvrierEquipmentPracticeRequirement,
  getChanvrierEquipmentRequiredLevel, getChanvrierEquipmentUpgradeRequiredLevel,
  getChanvrierExpansionRequiredLevel, type ChanvrierCareerSnapshot,
} from "@/lib/chanvrier-career";
import { KQ_EQUIPMENT_CATALOG } from "@/lib/kanab-quest-equipment";
import { ChanvrierAvatar } from "../contest/ChanvrierAvatar";
import styles from "./KqCareerProgress.module.css";
import { useKqTutorialApi } from "./KqTutorialApiContext";

const equipment = KQ_EQUIPMENT_CATALOG.filter(item => item.purchasable);
const milestones = CHANVRIER_CAREER_LEVEL_XP.map((xp, index) => {
  const level = index + 1;
  const unlocks = equipment.filter(item => getChanvrierEquipmentRequiredLevel(item.code) === level).map(item => item.name);
  for (const tents of [2, 3, 4, 5]) if (getChanvrierExpansionRequiredLevel(tents) === level) {
    unlocks.push(tents === 5 ? "Second entrepôt · de 5 à 8 tentes" : `${tents}e tente`);
  }
  if (getChanvrierEquipmentUpgradeRequiredLevel("LED-300", 4) === level) unlocks.push("Améliorations du matériel aux niveaux 4 à 6");
  if (getChanvrierEquipmentUpgradeRequiredLevel("LED-300", 7) === level) unlocks.push("Améliorations du matériel aux niveaux 7 à 10");
  return { level, xp, unlocks };
});
const format = (value: number) => value.toLocaleString("fr-FR");

export function KqCareerProgress({ career, profile, compact = false }: {
  career?: ChanvrierCareerSnapshot | null;
  profile?: ChanvrierProfile | null;
  compact?: boolean;
}) {
  const { isTutorial } = useKqTutorialApi();
  const strength = CHANVRIER_STRENGTHS.find(item => item.code === profile?.strength);
  const nextMilestone = career ? milestones.find(item => item.level > career.level && item.unlocks.length) : undefined;
  const pendingPractice = career ? equipment.map(item => ({ item, access: getChanvrierEquipmentAccess(career, item.code) }))
    .filter(({ access }) => access.requiredLevel !== null && access.requiredLevel <= career.level && access.practiceLotsRemaining > 0) : [];
  const levelXp = career ? CHANVRIER_CAREER_LEVEL_XP[career.level - 1] : 0;
  const earnedInLevel = career ? career.xp - levelXp : 0;
  const neededInLevel = career?.nextLevelXp === null ? 0 : (career?.nextLevelXp ?? 0) - levelXp;

  return <section className={styles.career} data-compact={compact || undefined} aria-label="Progression du Chanvrier" data-career-progress>
    <div className={styles.overview}>
      <div className={styles.identity}>
        <div className={styles.portrait} data-career-portrait>
          {profile ? <ChanvrierAvatar profile={profile} view="portrait" className={styles.avatar} /> : <UserRound aria-label={isTutorial ? "Personnage de démonstration" : "Portrait indisponible"} />}
        </div>
        <div className={styles.identityText}>
          <small>{isTutorial ? "Parcours de démonstration" : profile?.gender === "female" ? "Ton métier de Chanvrière" : "Ton métier de Chanvrier"}</small>
          <strong className={styles.nickname}>{profile?.nickname ?? (isTutorial ? "Chanvrier d’essai" : "Ton chanvrier")}</strong>
          <div className={styles.identityMeta}>
            {career ? <span className={styles.level}>Niveau {career.level}<span> / {CHANVRIER_CAREER_LEVEL_XP.length}</span></span> : null}
            {strength ? <span className={styles.strength}>{strength.name}</span> : null}
          </div>
        </div>
      </div>
      {career ? <div className={styles.progression}>
        <div className={styles.progressHeading}>
          <strong>{career.nextLevel === null ? "Niveau métier maximal" : `Vers le niveau ${career.nextLevel}`}</strong>
          <span>{career.nextLevel === null ? `${format(career.xp)} XP cumulés` : `${format(earnedInLevel)} / ${format(neededInLevel)} XP`}</span>
        </div>
        <progress aria-label="Avancement vers le prochain niveau Chanvrier" aria-valuetext={career.nextLevel === null ? "Niveau métier maximal atteint" : `${format(earnedInLevel)} XP sur ${format(neededInLevel)} dans ce niveau, encore ${format(career.xpToNextLevel)} XP avant le niveau ${career.nextLevel}`} max={100} value={career.progressPercent} />
        <div className={styles.progressCaption}>
          <span>{career.nextLevel === null ? "Les conditions de pratique restent nécessaires." : `encore ${format(career.xpToNextLevel)} XP`}</span>
          <small>{format(career.xp)} {isTutorial ? "XP de démonstration" : "XP permanents"}</small>
        </div>
        {nextMilestone ? <p className={styles.next}><Sprout size={15} aria-hidden="true" /><span>Au niveau {nextMilestone.level} : <strong>{nextMilestone.unlocks[0]}</strong>{nextMilestone.unlocks.length > 1 ? ` et ${nextMilestone.unlocks.length - 1} autres déblocages` : ""}.</span></p>
          : pendingPractice.length ? <p className={styles.next}><Sprout size={15} aria-hidden="true" /><span>{pendingPractice.length} machine{pendingPractice.length > 1 ? "s" : ""} demande{pendingPractice.length > 1 ? "nt" : ""} encore de la pratique.</span></p>
          : <p className={styles.next}><Sprout size={15} aria-hidden="true" /><span>Tous les prérequis de métier et de pratique sont atteints.</span></p>}
      </div> : <p className={styles.loading} role="status">Chargement de la progression du Chanvrier…</p>}
    </div>
    {isTutorial ? <p className={styles.tutorial}>Niveau prêté pour cet exercice. La progression de ton compte reste inchangée.</p> : null}
    {career ? <details className={styles.details} data-career-details>
      <summary><span>Déblocages et règles d’XP</span><ChevronDown size={17} aria-hidden="true" /></summary>
      <div className={styles.detailContent}>
        <div className={styles.learning}>
          <section>
            <h3>Comment gagner de l’expérience ?</h3>
            <p><strong>+{CHANVRIER_CULTURE_XP} XP métier par culture terminée.</strong> Le nombre de tentes ne multiplie pas ce gain.</p>
            <p>Si la culture meurt : +{CHANVRIER_FAILED_STAGE_XP} XP par étape validée. Un abandon volontaire ne donne aucun XP.</p>
            <p>Ces XP restent acquis et ne servent pas à payer les cartes.</p>
            <span className={styles.cultureCount}>{format(career.completedCultures)} culture{career.completedCultures > 1 ? "s" : ""} terminée{career.completedCultures > 1 ? "s" : ""}</span>
          </section>
          <section>
            <h3>Ta pratique d’atelier</h3>
            <p>Les transformations ne donnent pas d’XP métier. Elles valident la pratique requise pour certaines machines.</p>
            <dl className={styles.practice}>{CHANVRIER_PROCESSING_FAMILIES.map(family => <div key={family}><dt>{CHANVRIER_PRACTICE_LABELS[family]}</dt><dd>{format(career.processingPractice[family])} lot{career.processingPractice[family] > 1 ? "s" : ""}</dd></div>)}</dl>
            <ul className={styles.practiceRequirements}>{equipment.filter(item => getChanvrierEquipmentPracticeRequirement(item.code)).map(item => {
              const requirement = getChanvrierEquipmentPracticeRequirement(item.code)!;
              const lots = career.processingPractice[requirement.family];
              return <li key={item.code}><strong>{item.name}</strong><span>{format(lots)} / {requirement.minimumLots} lots de {CHANVRIER_PRACTICE_LABELS[requirement.family]} · {lots >= requirement.minimumLots ? "pratique acquise" : "à pratiquer"}</span></li>;
            })}</ul>
          </section>
        </div>
        <section className={styles.roadmap}>
          <h3>Prochain palier matériel et parcours complet</h3>
          <p>Le niveau autorise l’achat : le budget et, pour certaines machines, la pratique restent nécessaires. Les améliorations demandent aussi le niveau métier d’achat de la machine.</p>
          <ol>{milestones.map(milestone => <li key={milestone.level} data-current={milestone.level === career.level || undefined} data-reached={milestone.level < career.level || undefined}>
            <div className={styles.milestoneHeading}><strong>Niveau {milestone.level}</strong><span>{format(milestone.xp)} XP cumulés{milestone.level === career.level ? " · Ton niveau" : milestone.level < career.level ? " · Atteint" : ""}</span></div>
            <p>{milestone.unlocks.length ? milestone.unlocks.join(" · ") : "Une étape de maîtrise avant le prochain équipement."}</p>
          </li>)}</ol>
        </section>
      </div>
    </details> : null}
  </section>;
}
