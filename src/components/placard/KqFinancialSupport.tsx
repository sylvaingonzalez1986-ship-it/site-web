import { ChevronDown, ExternalLink } from "lucide-react";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { getKqFinancialSupportUrl } from "@/lib/kanab-quest-financial-support";
import { KqPrintedArt } from "./KqPrintedArt";
import { KqHelpDashboard, KqHelpGrid, KqHelpNote } from "./KqHelpDashboard";
import styles from "./KqFinancialSupport.module.css";

export function KqFinancialSupport() {
  // Public Quick Pay link supplied by the operator; ship it with the interface so
  // a missing hosting variable cannot silently hide support after deployment.
  // An explicit empty or invalid override still disables the panel.
  const href = getKqFinancialSupportUrl(process.env.NEXT_PUBLIC_KQ_FINANCIAL_SUPPORT_URL ?? "https://pay.vivawallet.com/les-champs-bretons");
  if (!href) return null;

  return <aside className={styles.support} aria-labelledby="kq-financial-support-title" data-financial-support>
    <details className={styles.disclosure}>
      <summary className={styles.toggle}>
        <h2 id="kq-financial-support-title">Soutenir les producteurs</h2>
        <ChevronDown className={styles.chevron} size={24} aria-hidden="true" />
      </summary>
      <div className={styles.content}>
        <KqPrintedArt kind="producer-support" className={styles.art} sizes="(max-width: 600px) 200px, (max-width: 1000px) 160px, 240px" />
        <div className={styles.copy}>
          <p>Bon, on n’est pas là pour faire la manche… mais la tréso, ça ne pousse pas sous les lampes.</p>
          <p>Chez nous, dès qu’on parle de chanvre à actifs, les banques rangent le chéquier.
            Quand t’as les poches pleines, c’est plus facile de grandir.
            Nous, petits producteurs, on fait avec les moyens du bord.</p>
          <p>Tu peux nous aider en achetant notre CBD. Mais si c’est pas ton truc et que tu kiffes le game,
            tu peux aussi nous glisser un ou deux euros de temps en temps, seulement si l’envie te prend et si tu peux.
            Ça nous aide à faire grandir le projet. Dans tous les cas, un grand merci !</p>
          <details className={styles.details}>
            <summary>À qui va mon soutien ?</summary>
            <KqHelpDashboard>
              <KqHelpGrid art="help-accounts" items={[
                { label: "Fonds reçus par", value: `SASU ${BUSINESS_IDENTITY.legalName}`, detail: "Pour développer le projet.", art: "quarter" },
                { label: "Avantage en échange", value: "Aucun", detail: "Ni objet, bonus, accès privilégié ou avantage dans les concours.", art: "help-team" },
                { label: "Fiscalité", value: "Sans réduction d’impôt", detail: "Aucun reçu fiscal.", art: "help-accounts" },
              ]} />
              <KqHelpNote>Choisis ton montant sur la page Viva, puis vérifie-le avant de confirmer ce soutien ponctuel.</KqHelpNote>
            </KqHelpDashboard>
          </details>
        </div>
        <div className={styles.action}>
          <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
            Soutenir <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </details>
  </aside>;
}
