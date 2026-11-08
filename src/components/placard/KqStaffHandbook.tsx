import { KqHelpDashboard, KqHelpGrid, KqHelpNote, KqHelpSteps, KqHelpTopics } from "./KqHelpDashboard";
import styles from "./KqStaffDesk.module.css";

/** Discover the team's rules before making a hiring or spending decision. */
export function KqStaffHandbook() {
  return <div className={styles.form} aria-label="Comprendre le personnel">
    <details className={styles.reference} data-staff-guide="planning">
      <summary>Répartir le travail</summary>
      <KqHelpDashboard>
        <KqHelpSteps steps={[
          { label: "Choisis la personne", detail: "Toi ou un salarié.", art: "help-team" },
          { label: "Choisis le poste", detail: "Clique, touche ou glisse le portrait.", art: "help-plan" },
          { label: "Confirme la mission", detail: "Vérifie la cible, les heures et les frais.", art: "help-accounts" },
        ]} />
        <KqHelpTopics label="Choisir un poste à comprendre" topics={[
          { id: "hours", label: "Les heures", value: "Toi : 12 h / jour", art: "help-time", content: <KqHelpGrid items={[
            { label: "Toi", value: "12 h / jour du jeu", detail: "Réserve commune à tes activités, week-end compris. Sans salaire.", art: "help-time" },
            { label: "Chaque salarié", value: "Son propre planning", detail: "Missions à la suite. Repos le week-end et selon son contrat.", art: "help-rest" },
          ]} /> },
          { id: "culture", label: "Culture", value: "0,5 h / étape", art: "help-culture", content: <KqHelpGrid items={[
            { label: "Culture déléguée", value: "0 h pour toi", detail: "0,5 h par étape sur sa réserve, même avec Vif. Minutieux améliore seulement le bonus de terpènes. Les étapes restent à jouer.", art: "help-culture" },
            { label: "Réserve épuisée", value: "La culture attend", detail: "Ajoute des heures ou attends un jour travaillé avec réserve. Réservation possible avant la culture.", art: "help-time" },
          ]} /> },
          { id: "workshop", label: "Atelier", value: "Cadence selon le niveau", art: "help-workshop", content: <KqHelpGrid items={[
            { label: "Trim et transformation", value: "Entrepôt → Atelier", detail: "File commune : récoltes compatibles les plus anciennes d’abord. La compétence détermine la cadence.", art: "help-workshop" },
          ]} /> },
          { id: "sales", label: "Communication", value: "Prospection dès 2 h", art: "help-travel", content: <KqHelpGrid items={[
            { label: "Réseaux et prospection", value: "1 tentative / 2 h", detail: "Pour les nouvelles missions : 2 h, 4 h ou 6 h donnent 1, 2 ou 3 tentatives. Chaque réussite apporte un partenaire ; aucune recette garantie.", art: "help-social" },
            { label: "Sillonner les campagnes", value: "12 h de jeu · 40 €", detail: "Toi → Prospection. Journée complète : 2 h réelles, 0 à 2 contacts.", art: "help-travel" },
          ]} /> },
          { id: "administration", label: "Gestion", value: "Factures et remises", art: "help-accounts", content: <KqHelpGrid items={[
            { label: "Administration", value: "Remise pendant 7 jours", detail: "0,5 h suffit : le niveau et Organisé déterminent le taux sur les nouvelles fournitures Entrepôt. Plus d’heures donne plus d’XP et du temps pour les paiements autorisés.", art: "help-accounts" },
          ]} /> },
        ]} />
        <KqHelpNote>Une culture jamais déléguée prend tes heures. Les missions doivent finir avant le lendemain. Dans les fiches, « Organiser sa journée » permet d’ajouter des heures avec leurs limites et majorations.</KqHelpNote>
      </KqHelpDashboard>
    </details>
    <details className={styles.reference} data-staff-guide="development">
      <summary>Formations et congés</summary>
      <KqHelpDashboard>
        <KqHelpGrid items={[
          { label: "Progression", value: "Jusqu’au niveau 10", detail: "XP des missions terminées et des formations.", art: "help-training" },
          { label: "Métiers", value: "Tous accessibles", detail: "Compétences et trait influencent les résultats.", art: "help-team" },
          { label: "Ancienneté seule", value: "Aucune XP", detail: "Seul le travail effectué fait progresser.", art: "help-time" },
          { label: "Congés payés", value: "5 semaines / an du jeu", detail: "Mêmes droits à temps partiel ; salaire maintenu.", art: "help-rest" },
        ]} />
        <KqHelpSteps steps={[
          { label: "Former", detail: "Planning → compétence et durée. Mêmes heures que les missions.", art: "help-training" },
          { label: "Vérifier le coût", detail: "Frais affichés avant confirmation.", art: "help-accounts" },
          { label: "Prévoir les congés", detail: "Droits, dates et reprise dans Congés payés.", art: "help-rest" },
        ]} />
        <KqHelpNote>Aucune tâche pendant un congé payé.</KqHelpNote>
      </KqHelpDashboard>
    </details>
  </div>;
}
