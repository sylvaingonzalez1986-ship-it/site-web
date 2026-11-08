import { KQ_CANNABINOID_FAMILIES, type getKqCannabinoidReport } from "@/lib/kanab-quest-care";
import styles from "./KqCultureCare.module.css";
import { KqHelpDashboard, KqHelpGrid, KqHelpNote, KqHelpSteps } from "./KqHelpDashboard";

export function KqCannabinoidReport({ report, provisional = false }: {
  report: ReturnType<typeof getKqCannabinoidReport>; provisional?: boolean;
}) {
  const percent = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} %`;
  return <details className={styles.analysis} data-cannabinoid-report>
    <summary>Cannabinoïdes · indice et taux simulés{provisional ? " · en développement" : ""}</summary>
    <KqHelpDashboard>
      <KqHelpGrid art="help-quality" items={[
        { label: "Potentiel cannabinoïde", value: `${report.score}/99`, detail: "Indice de jeu de 35 à 99.", art: "help-culture" },
        { label: "Profil simulé", value: report.profile.name, detail: "Aucune analyse réelle de cette variété." },
      ]} />
      <KqHelpSteps art="help-quality" steps={[
        { label: "Floraison et récolte", detail: "Réussites → potentiel développé.", art: "help-culture" },
        { label: "Séchage", detail: "Potentiel conservé ou réduit.", art: "help-workshop" },
      ]} />
      <KqHelpNote>{report.score}/99 ne signifie pas {report.score} % de CBD, CBG ou THC. Les intrants ne donnent aucun bonus direct.</KqHelpNote>
    </KqHelpDashboard>
    <div className={styles.labTable} role="region" aria-label="Tableau des cannabinoïdes simulés" tabIndex={0}>
      <table><caption>14 formes mesurables · 7 totaux calculés · teneurs simulées en masse sèche</caption><thead><tr><th scope="col">Famille</th><th scope="col">Forme neutre</th><th scope="col">Forme acide</th><th scope="col">Total potentiel</th></tr></thead><tbody>{KQ_CANNABINOID_FAMILIES.map(family => <tr key={family.code}><th scope="row">{family.name}</th><td><span>{family.neutralLabel}</span>{percent(report.rates[family.neutralCode])}</td><td><span>{family.acidLabel}</span>{percent(report.rates[family.acidCode])}</td><td>{percent(report.totals[family.code])}</td></tr>)}</tbody></table>
    </div>
    <KqHelpNote>Total potentiel = forme neutre + forme acide corrigée en masse. Ne pas additionner ce total aux deux formes. Plus de forme neutre ou de CBN ne signifie pas forcément mieux.</KqHelpNote>
  </details>;
}
