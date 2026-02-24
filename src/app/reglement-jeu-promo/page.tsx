﻿import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();
const rulesUrl = `${siteUrl}/reglement-jeu-promo`;

export const metadata: Metadata = {
  title: "Règlement jeu promotionnel",
  description:
    "Règlement officiel du jeu promotionnel Ticket de grattage des Chanvriers Bretons.",
  alternates: {
    canonical: rulesUrl,
  },
};

export default function ReglementJeuPromoPage() {
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <article className="cartoon-border bg-white p-6 md:p-10">
          <h1 className="section-title">REGLEMENT DU JEU PROMOTIONNEL</h1>
          <p className="mt-4 text-sm leading-relaxed text-charcoal">
            Jeu promotionnel &quot;Ticket de grattage&quot; organise par Les Champs Bretons.
          </p>

          <div className="mt-6 grid gap-6 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-display text-2xl">Article 1 - Organisateur</h2>
              <p className="mt-2">
                SASU Les Champs Bretons - SIRET 94236899400011 - TVA intracommunautaire
                FR9094238994
                <br />
                60 rue Francois 1er, 75008 Paris, France
                <br />
                Contact : leschanvriersbretons@gmail.com
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 2 - Duree</h2>
              <p className="mt-2">
                Le jeu debute le 1er mars 2026 a 00h00 (heure de Paris) pour une duree
                indéterminée, jusqu&apos;a modification, suspension ou arret par l&apos;Organisateur.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 3 - Conditions de participation</h2>
              <p className="mt-2">
                Le jeu est reserve aux personnes majeures (18+) disposant d&apos;un compte client valide
                sur le site et d&apos;une commande payée.
              </p>
              <p className="mt-2">
                Une verification de majorite est requise. L&apos;Organisateur peut annuler toute
                participation frauduleuse (multi-comptes, usurpation, automatisation, abus).
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 4 - Mécanique</h2>
              <p className="mt-2">
                Attribution automatique : 1 ticket par tranche de 20 EUR TTC de commande payée
                (seuil affiche dans l&apos;espace client).
              </p>
              <p className="mt-2">
                Chaque ticket est grattable une seule fois. Le résultat est déterminé cété serveur
                au moment du grattage.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 5 - Probabilites</h2>
              <p className="mt-2">
                Repartition globale des issues :
                <br />- Perdu : 50,00 %
                <br />- Commun : 45,00 %
                <br />- Rare : 4,00 %
                <br />- Epique : 0,99 %
                <br />- Legendaire : 0,01 %
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 6 - Lots</h2>
              <p className="mt-2">
                Les lots disponibles sont :
                <br />- Commun : 10 % de reduction sur la prochaine commande OU 1 g offert
                <br />- Rare : 20 % de reduction sur la prochaine commande OU 10 g offerts
                <br />- Epique : 50 % de reduction sur la prochaine commande OU 50 g offerts
                <br />- Legendaire : 1 an de consommation offerte
              </p>
              <p className="mt-2">
                La sous-attribution des lots &quot;OU&quot; est déterminée aléatoirement cété serveur.
              </p>
              <p className="mt-2">
                Les lots ne sont ni echangeables contre especes, ni cessibles. Delai de remise :
                30 jours maximum sauf force majeure.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 7 - Limites et anti-fraude</h2>
              <p className="mt-2">
                Les tickets sont personnels. L&apos;Organisateur peut suspendre ou annuler tout gain en
                cas de comportement frauduleux ou contraire au present règlement.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 8 - Données personnelles</h2>
              <p className="mt-2">
                Les données du jeu sont traitees pour la gestion des tickets, l&apos;attribution des
                gains, la prevention de la fraude et la preuve des operations.
              </p>
              <p className="mt-2">
                Pour en savoir plus : consultez la politique de confidentialite du site.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 9 - Responsabilite</h2>
              <p className="mt-2">
                L&apos;Organisateur ne peut être tenu responsable en cas d&apos;incident technique,
                indisponibilite temporaire du service ou force majeure.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 10 - Litiges et mediation</h2>
              <p className="mt-2">
                Le present règlement est soumis au droit français. Toute réclamation doit être
                adressee en priorite a leschanvriersbretons@gmail.com.
              </p>
              <p className="mt-2">
                A defaut d&apos;accord amiable, le consommateur peut recourir a un mediateur de la
                consommation conformement aux dispositions du Code de la consommation.
              </p>
              <p className="mt-2">
                Pour les professionnels, tribunal de commerce de Paris compétent.
              </p>
            </section>
          </div>

          <p className="mt-8 text-xs text-charcoal">Version en vigueur : 22 fevrier 2026</p>
        </article>
      </div>
    </section>
  );
}


