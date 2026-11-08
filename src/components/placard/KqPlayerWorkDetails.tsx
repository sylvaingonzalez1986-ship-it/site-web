"use client";

import { useState } from "react";
import { Clock3, Megaphone, PackageCheck, Sprout, Store, Wallet } from "lucide-react";
import type { getKqPlayerWorkday } from "@/lib/kanab-quest-player-work";
import { getKqPlayerActionHours, getKqPlayerActionLevel, getKqPlayerActionSkill, KQ_PLAYER_ACTION_COST_GROUPS } from "@/lib/kanab-quest-player-action-costs";
import type { KqStaffSkill, KqStaffSkills } from "@/lib/kanab-quest-staff-types";
import { KQ_STAFF_SKILLS } from "@/lib/kanab-quest-staff";
import { KqAllocationBar, KqBarChart } from "./KqVisuals";
import { KqHelpDashboard, KqHelpGrid, KqHelpNote } from "./KqHelpDashboard";
import { KqPrintedArt } from "./KqPrintedArt";
import styles from "./KqPlayerWorkStatus.module.css";

const hours = (value: number) => `${value.toLocaleString("fr-FR")} h`;
const minutes = (value: number) => `${(Math.round(value * 6000) / 100).toLocaleString("fr-FR")} min`;
const groups = [
  { key: "communication", title: "Communication", icon: Megaphone, art: "help-social" },
  { key: "sales", title: "Commerce", icon: Store, art: "help-travel" },
  { key: "processing", title: "Transformation", icon: PackageCheck, art: "help-workshop" },
  { key: "administration", title: "Gestion", icon: Wallet, art: "help-accounts" },
  { key: "culture", title: "Culture", icon: Sprout, art: "help-culture" },
] as const;
const labels: Record<string, string> = {
  "culture/roll": "Une étape de culture",
  "commerce/prepare": "Conditionner les fleurs",
  "online/create-listing": "Créer une annonce",
  "commerce/advertise": "Pub, marketing, post sponsorisé",
  "social/choose": "Publication, partenariat",
  "commerce/sell": "Vendre, modifier une annonce",
  "storage/place": "Ranger, entretenir, installer",
  "administration/pay-energy": "Achats, factures, organisation",
  "culture/buy-care": "Acheter des soins",
};
const contextNotes: Record<string, string> = {
  game: "Culture déléguée : les heures viennent de l’équipe. Planning épuisé : étape bloquée. Cartes et soins joués : aucun temps en plus.",
  workshop: "Les délais des machines continuent séparément du travail actif.",
  harvests: "Rangement : Transformation. Vente : Prospection.",
  market: "Le temps de diffusion d’une campagne est distinct de ton travail.",
  social: "La fréquence autorisée des publications reste indépendante du temps de travail.",
  staff: "Toi : 12 h par jour, week-end compris. Chaque salarié suit son propre planning.",
  treasury: "La banque et la consultation des comptes ne prennent aucune heure.",
};

export function KqPlayerWorkDetails({ view, workday, skills }: {
  view: string; workday: ReturnType<typeof getKqPlayerWorkday> | null; skills: KqStaffSkills | null;
}) {
  const [selectedGroup, setSelectedGroup] = useState<string>(({ game: "culture", workshop: "processing", harvests: "processing", market: "sales", treasury: "administration" } as Record<string, string>)[view] ?? "communication");
  return <KqHelpDashboard>
    <div className={styles.daySummary}>
      <section className={styles.paper} aria-label="Répartition de ta journée">
        <KqPrintedArt kind="help-time" className={styles.dayArt} sizes="112px" />
        {workday ? <KqAllocationBar label={`Ta journée · jour ${workday.day}`} items={[
          { label: "Disponibles", value: workday.remainingHours, displayValue: hours(workday.remainingHours), tone: "teal" },
          { label: "Utilisées ou réservées", value: workday.usedHours, displayValue: hours(workday.usedHours), tone: "gold" },
        ]} /> : <p>Ta journée est indisponible. Actualise pour retrouver tes heures.</p>}
      </section>
      <section className={styles.paper} aria-label="Renouvellement du temps">
        <KqPrintedArt kind="help-rest" className={styles.dayArt} sizes="112px" /><h3>Prochaine journée</h3>
        {workday ? <time className={styles.renewal} dateTime={workday.nextDayAt}>{new Date(workday.nextDayAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time> : <strong>À confirmer</strong>}
        <span className={styles.caption}>Heure réelle · retour à 12 h, sans report</span>
      </section>
      <section className={styles.paper} aria-label="Effet des compétences sur le temps">
        <KqPrintedArt kind="help-training" className={styles.dayArt} sizes="112px" /><h3>Jusqu’à 10 × plus rapide</h3>
        <KqBarChart title="Pour un geste de base de 1 h" scaleMax={60} items={[
          { label: "Niveau 1", value: 60, displayValue: "60 min", tone: "ink" },
          { label: "Niveau 10", value: 6, displayValue: "6 min", tone: "teal" },
        ]} />
        <span className={styles.caption}>−10 % du temps de base par niveau gagné. Un geste de 30 min descend à 3 min.</span>
      </section>
    </div>
    <section aria-label="Durée de tes gestes" className={styles.costSection}>
      <div className={styles.costHeading}><h3><Clock3 size={18} aria-hidden="true" />Temps par geste</h3><span>{skills ? "Tes niveaux actuels · même échelle de 0 à 60 min" : "Niveaux indisponibles · fourchettes du jeu"}</span></div>
      <div className={styles.categories} role="group" aria-label="Choisir une activité">{groups.map(group => {
        return <button key={group.key} type="button" data-player-cost-selector={group.key} aria-pressed={selectedGroup === group.key} onClick={() => setSelectedGroup(group.key)}><KqPrintedArt kind={group.art} className={styles.categoryArt} sizes="88px" />{group.title}</button>;
      })}</div>
      <div className={styles.costGrid}>{groups.map(group => {
        const actions = KQ_PLAYER_ACTION_COST_GROUPS.filter(item => (getKqPlayerActionSkill(item.domain, item.action) ?? "culture") === group.key);
        const first = actions[0];
        const level = first && skills ? getKqPlayerActionLevel(first.domain, first.action, skills) : null;
        const Icon = group.icon;
        return <section className={styles.costCard} hidden={selectedGroup !== group.key} data-player-cost-group={group.key} data-skill-level={level ?? undefined} key={group.key}>
          <h4><Icon size={19} aria-hidden="true" />{group.title}{level !== null ? <span>Niv. {level}</span> : null}</h4>
          {skills || group.key === "culture" ? <KqBarChart title={group.key === "culture" ? "Durées fixes" : KQ_STAFF_SKILLS[group.key as KqStaffSkill]} scaleMax={60} items={actions.map(item => {
            const duration = getKqPlayerActionHours(item.domain, item.action, skills ?? undefined);
            return { label: labels[`${item.domain}/${item.action}`], value: duration * 60, displayValue: minutes(duration) };
          })} /> : <dl className={styles.ranges}>{actions.map(item => <div key={item.action}><dt>{labels[`${item.domain}/${item.action}`]}</dt><dd>{minutes(getKqPlayerActionHours(item.domain, item.action) / 10)} à {minutes(getKqPlayerActionHours(item.domain, item.action))}</dd></div>)}</dl>}
          {group.key === "culture" ? <span className={styles.caption}>6 étapes = 3 h. Une fois par étape.</span> : null}
        </section>;
      })}</div>
    </section>
    <KqHelpGrid items={[
      { label: "Machines de transformation", value: "Selon le volume", detail: "Devis adapté à la cadence et à la compétence.", art: "help-workshop" },
      { label: "Missions et trim", value: "Durée choisie", detail: "La même réserve de travail.", art: "help-plan" },
      { label: "Sillonner les campagnes", value: "12 h", detail: "Toute ta journée de travail.", art: "help-travel" },
      { label: "Consulter ou déléguer", value: "0 min", detail: "Pause et récupération d’un résultat aussi.", art: "help-team" },
    ]} />
    <KqHelpNote>Heures réservées à la confirmation. Une action refusée ne consomme rien. {contextNotes[view] ?? "Tes salariés utilisent leur propre planning."}</KqHelpNote>
  </KqHelpDashboard>;
}
