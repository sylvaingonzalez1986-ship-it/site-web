import { KQ_CANNABINOID_FAMILIES, type getKqCannabinoidReport } from "@/lib/kanab-quest-care";
import styles from "./KqCultureCare.module.css";

export function KqCannabinoidReport({ report, provisional = false }: {
  report: ReturnType<typeof getKqCannabinoidReport>; provisional?: boolean;
}) {
  const percent = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} %`;
  return <details className={styles.analysis} data-cannabinoid-report>
    <summary>Cannabinoïdes · indice et taux simulés{provisional ? " · en développement" : ""}</summary>
    <p><strong>Potentiel cannabinoïde : {report.score}/99</strong>. Cet indice de jeu, compris entre 35 et 99, suit le potentiel de ta variété développé puis conservé. {report.score}/99 ne signifie pas {report.score} % de CBD, de CBG ou de THC.</p>
    <p>Les opérations réussies en floraison et à la récolte le font progresser. Le séchage peut le préserver ou le réduire. Les intrants ne lui ajoutent aucun bonus direct.</p>
    <p><strong>{report.profile.name}</strong> · les taux en % ci-dessous sont calculés pour le jeu. Ils ne proviennent pas d’une analyse réelle de cette variété.</p>
    <div className={styles.labTable} role="region" aria-label="Tableau des cannabinoïdes simulés" tabIndex={0}>
      <table><caption>14 formes mesurables · 7 totaux calculés · teneurs simulées en masse sèche</caption><thead><tr><th scope="col">Famille</th><th scope="col">Forme neutre</th><th scope="col">Forme acide</th><th scope="col">Total potentiel</th></tr></thead><tbody>{KQ_CANNABINOID_FAMILIES.map(family => <tr key={family.code}><th scope="row">{family.name}</th><td><span>{family.neutralLabel}</span>{percent(report.rates[family.neutralCode])}</td><td><span>{family.acidLabel}</span>{percent(report.rates[family.acidCode])}</td><td>{percent(report.totals[family.code])}</td></tr>)}</tbody></table>
    </div>
    <p>Le total potentiel combine la forme neutre et sa forme acide avec une correction de masse. Il ne s’ajoute pas à ces deux valeurs. Une hausse de forme neutre ou de CBN ne signifie pas forcément une amélioration.</p>
    <p className={styles.hint}>Panel inspiré des <a href="https://www.labexan.com/produits-cbd/" target="_blank" rel="noreferrer">analyses publiées par LABEXAN</a>. La <a href="https://tools.cofrac.fr/annexes/sect1/1-5810.pdf" target="_blank" rel="noreferrer">portée Cofrac</a> concerne des dosages précis du laboratoire ; cette simulation n’est pas accréditée.</p>
  </details>;
}
