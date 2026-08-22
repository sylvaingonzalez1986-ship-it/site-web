import type { Metadata } from "next";
import Link from "next/link";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/JsonLd";
import { getSiteUrl } from "@/lib/site-url";

const PAGE_SLUG = "analyse-laboratoire-cbd";
const LAST_REVIEWED = "2026-08-22";

const FAQ_ITEMS = [
  {
    question: "Qu'est-ce qu'un certificat d'analyse CBD ou COA ?",
    answer:
      "Un COA, pour Certificate of Analysis, est un rapport émis après l'analyse d'un échantillon. Il décrit les mesures réalisées, leurs résultats et leurs limites. Il ne vaut que pour l'échantillon et le lot auxquels il est rattaché et ne constitue pas, à lui seul, une garantie générale de qualité ou de légalité.",
  },
  {
    question: "Comment vérifier qu'une analyse correspond au produit CBD vendu ?",
    answer:
      "Comparez le nom ou la référence du produit, le numéro de lot, la matrice analysée et, si elle apparaît, la date de prélèvement avec l'étiquette du produit. Un rapport sans identifiant permettant ce rapprochement apporte peu de traçabilité.",
  },
  {
    question: "Que signifient ND, LOD et LOQ sur une analyse CBD ?",
    answer:
      "ND signifie généralement non détecté. LOD désigne la limite de détection et LOQ la limite de quantification. ND ne signifie donc pas forcément zéro absolu : la substance peut être présente sous la capacité de détection ou de quantification de la méthode.",
  },
  {
    question: "Une analyse des cannabinoïdes prouve-t-elle l'absence de pesticides ?",
    answer:
      "Non. Un profil de cannabinoïdes mesure les molécules listées dans cette partie du rapport. L'absence de pesticides, métaux lourds, solvants, contaminants microbiologiques ou mycotoxines ne peut être déduite que si ces familles ont effectivement été recherchées et figurent dans les résultats.",
  },
  {
    question: "Faut-il choisir un laboratoire accrédité ?",
    answer:
      "L'accréditation selon la norme ISO/IEC 17025 apporte un signal de compétence pour une portée définie. Vérifiez le nom du laboratoire, la validité de son accréditation et surtout si la matrice et la méthode concernées figurent dans sa portée. L'accréditation du laboratoire ne signifie pas automatiquement que chaque essai du rapport est couvert.",
  },
  {
    question: "Un taux de THC sous 0,3 % suffit-il à prouver qu'un produit est légal ?",
    answer:
      "Non. La réglementation dépend aussi de la catégorie du produit, de son origine, de sa composition et de son usage. Une analyse renseigne sur l'échantillon testé ; elle ne remplace ni l'étiquetage, ni les autres obligations applicables, ni la vérification du lot vendu.",
  },
];

const CHECKLIST_ITEMS = [
  "Le laboratoire, le numéro de rapport et la date sont identifiables.",
  "Le nom du produit, la matrice et le numéro de lot correspondent à l'étiquette.",
  "Chaque résultat possède une unité et la méthode indique ses limites de mesure.",
  "Les cannabinoïdes acides et neutres ne sont pas confondus.",
  "Les contaminants ne sont considérés comme vérifiés que s'ils figurent dans le périmètre testé.",
  "La portée d'accréditation est consultée lorsqu'une accréditation est revendiquée.",
] as const;

export const metadata: Metadata = {
  title: "Analyse laboratoire CBD : lire un certificat (COA)",
  description:
    "Méthode pratique pour lire une analyse CBD : lot, cannabinoïdes, unités, LOD, LOQ, contaminants et portée d'accréditation du laboratoire.",
  alternates: {
    canonical: "https://www.leschanvriersbretons.com/analyse-laboratoire-cbd",
  },
  keywords: [
    "analyse laboratoire cbd",
    "certificat analyse cbd",
    "coa cbd",
    "lire analyse cbd",
    "analyse thc cbd",
    "laboratoire cbd france",
  ],
  openGraph: {
    title: "Comment lire une analyse laboratoire CBD ?",
    description:
      "Les contrôles utiles pour relier un rapport au bon lot et comprendre cannabinoïdes, unités et limites d'analyse.",
    url: "https://www.leschanvriersbretons.com/analyse-laboratoire-cbd",
    type: "article",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Guide de lecture d'une analyse laboratoire CBD",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Analyse laboratoire CBD : comment lire un COA ?",
    description: "Lot, unités, LOD, LOQ, cannabinoïdes et contaminants : la checklist utile.",
    images: ["/og-default.png"],
  },
};

export default function CbdAnalysisGuidePage() {
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/${PAGE_SLUG}`;

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: baseUrl },
          { name: "CBD naturel", url: `${baseUrl}/cbd-naturel` },
          { name: "Lire une analyse CBD", url: pageUrl },
        ]}
      />
      <ArticleJsonLd
        title="Analyse laboratoire CBD : comment lire un certificat (COA) ?"
        description="Méthode pratique pour vérifier le lot, les cannabinoïdes, les unités, les limites de mesure et le périmètre d'une analyse CBD."
        url={pageUrl}
        image={`${baseUrl}/og-default.png`}
        datePublished={LAST_REVIEWED}
        dateModified={LAST_REVIEWED}
        category="Guide CBD et traçabilité"
      />
      <FaqJsonLd questions={FAQ_ITEMS} />

      <div className="retro-container">
        <article className="cartoon-border bg-cream p-6 md:p-10">
          <nav className="mb-4 text-sm text-charcoal" aria-label="Fil d'Ariane">
            <Link href="/" className="underline hover:text-ink">Accueil</Link>
            {" > "}
            <Link href="/cbd-naturel" className="underline hover:text-ink">CBD naturel</Link>
            {" > "}
            <span className="font-bold text-ink">Analyse laboratoire</span>
          </nav>

          <h1 className="section-title text-ink">Comment lire une analyse laboratoire CBD ?</h1>
          <p className="mt-4 max-w-4xl text-lg leading-relaxed text-charcoal">
            Une analyse CBD, souvent appelée certificat d&apos;analyse ou COA, devient utile uniquement
            si elle peut être reliée au produit vendu et si son périmètre est compris. Commencez par le
            numéro de lot, puis vérifiez le laboratoire, la date, les unités, les limites de mesure et les
            familles réellement recherchées.
          </p>
          <p className="mt-4 text-sm text-charcoal">
            Publié par <Link href="/a-propos" className="underline hover:text-ink">Les Chanvriers Bretons</Link>
            {" · "}<time dateTime={LAST_REVIEWED}>Vérifié le 22 août 2026</time>
          </p>
        </article>

        <article className="cartoon-border mt-8 bg-white p-6 md:p-10" aria-labelledby="reponse-courte">
          <h2 id="reponse-courte" className="font-display text-3xl text-ink">La réponse courte</h2>
          <p className="mt-4 max-w-4xl leading-relaxed text-charcoal">
            Pour lire un COA CBD, contrôlez cinq éléments : l&apos;identité du produit et son lot,
            l&apos;identité du laboratoire, la date et la méthode, les unités et limites de mesure, puis
            la liste exacte des substances recherchées. Une ligne absente du rapport n&apos;est pas un
            résultat négatif : elle signifie simplement que ce document ne permet pas de conclure.
          </p>

          <ol className="mt-6 grid gap-4 md:grid-cols-5">
            {["Lot", "Laboratoire", "Date et méthode", "Unités", "Périmètre"].map((label, index) => (
              <li key={label} className="cartoon-border-sm bg-cream p-4 text-center">
                <span className="block font-display text-2xl text-ink">{index + 1}</span>
                <span className="text-sm font-bold text-charcoal">{label}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="cartoon-border mt-8 bg-cream p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">Pourquoi rapprocher l&apos;étiquette et l&apos;analyse ?</h2>
          <div className="mt-4 grid gap-4 leading-relaxed text-charcoal">
            <p>
              Une étude soutenue par la MILDECA a comparé l&apos;étiquetage et la composition de 223
              produits CBD achetés en France en 2022 et 2023. Parmi les produits dont la composition
              était étiquetée, 81 % présentaient une teneur en CBD différente de celle annoncée selon
              la marge retenue par l&apos;étude.
            </p>
            <p>
              Ce panel n&apos;est pas présenté comme représentatif de tout le marché. Il montre néanmoins
              pourquoi une promesse commerciale, une ancienne analyse générique ou un rapport sans lot
              identifiable ne suffisent pas à documenter le produit reçu.
            </p>
            <p>
              Source :{" "}
              <a
                href="https://www.drogues.gouv.fr/etude-cbd"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                étude CBD publiée par la MILDECA
              </a>.
            </p>
          </div>
        </article>

        <article className="cartoon-border mt-8 bg-white p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">1. Identifier le produit, le lot et le rapport</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div className="cartoon-border-sm bg-cream p-5">
              <h3 className="font-display text-xl text-ink">Sur le produit</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-charcoal">
                <li>nom ou référence exacte ;</li>
                <li>numéro de lot ;</li>
                <li>format et matrice : fleur, résine, huile ou autre ;</li>
                <li>date ou période de fabrication lorsqu&apos;elle est indiquée.</li>
              </ul>
            </div>
            <div className="cartoon-border-sm bg-cream p-5">
              <h3 className="font-display text-xl text-ink">Sur le rapport</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-charcoal">
                <li>nom et coordonnées du laboratoire ;</li>
                <li>numéro unique du rapport ;</li>
                <li>date de réception et date d&apos;analyse ;</li>
                <li>identité de l&apos;échantillon et méthode utilisée.</li>
              </ul>
            </div>
          </div>
          <p className="mt-5 leading-relaxed text-charcoal">
            Les deux ensembles doivent pouvoir être rapprochés sans supposition. Si le produit reçu porte
            un autre lot, demandez le rapport correspondant.
          </p>
        </article>

        <article className="cartoon-border mt-8 bg-cream p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">2. Comprendre le profil des cannabinoïdes</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-ink text-white">
                  <th className="border-2 border-ink p-3">Ligne fréquente</th>
                  <th className="border-2 border-ink p-3">Ce qu&apos;elle décrit</th>
                  <th className="border-2 border-ink p-3">Point de vigilance</th>
                </tr>
              </thead>
              <tbody className="bg-white text-charcoal">
                <tr>
                  <td className="border-2 border-ink p-3 font-bold text-ink">CBD / CBDA</td>
                  <td className="border-2 border-ink p-3">Forme neutre et forme acide du cannabidiol.</td>
                  <td className="border-2 border-ink p-3">Ne pas additionner sans connaître la formule du laboratoire.</td>
                </tr>
                <tr>
                  <td className="border-2 border-ink p-3 font-bold text-ink">Δ9-THC / THCA</td>
                  <td className="border-2 border-ink p-3">THC mesuré et précurseur acide éventuel.</td>
                  <td className="border-2 border-ink p-3">Vérifier si une valeur « totale » est fournie et comment elle est calculée.</td>
                </tr>
                <tr>
                  <td className="border-2 border-ink p-3 font-bold text-ink">CBG, CBN, CBC</td>
                  <td className="border-2 border-ink p-3">Autres cannabinoïdes recherchés par certaines méthodes.</td>
                  <td className="border-2 border-ink p-3">Une molécule absente du tableau n&apos;a pas forcément été recherchée.</td>
                </tr>
                <tr>
                  <td className="border-2 border-ink p-3 font-bold text-ink">Total</td>
                  <td className="border-2 border-ink p-3">Valeur calculée selon la convention du rapport.</td>
                  <td className="border-2 border-ink p-3">Lire la note de calcul avant de comparer deux laboratoires.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="cartoon-border mt-8 bg-white p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">3. Lire les unités, LOD, LOQ et ND</h2>
          <div className="mt-4 grid gap-5 leading-relaxed text-charcoal md:grid-cols-2">
            <div>
              <h3 className="font-display text-xl text-ink">Les unités</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li><strong>% m/m</strong> : pourcentage massique ; 1 % correspond à 10 mg/g.</li>
                <li><strong>mg/g</strong> : milligrammes mesurés par gramme de produit.</li>
                <li><strong>mg/mL</strong> : milligrammes mesurés par millilitre de liquide.</li>
              </ul>
              <p className="mt-3 text-sm">
                Ne convertissez pas automatiquement mg/mL en pourcentage massique : la densité et la
                convention du laboratoire sont nécessaires.
              </p>
            </div>
            <div>
              <h3 className="font-display text-xl text-ink">Les limites</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li><strong>LOD</strong> : plus petite quantité que la méthode peut détecter.</li>
                <li><strong>LOQ</strong> : plus petite quantité que la méthode peut quantifier de manière définie.</li>
                <li><strong>ND</strong> : non détecté selon la méthode et sa limite, pas zéro absolu.</li>
              </ul>
            </div>
          </div>
        </article>

        <article className="cartoon-border mt-8 bg-cream p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">4. Vérifier ce qui a réellement été recherché</h2>
          <p className="mt-4 max-w-4xl leading-relaxed text-charcoal">
            Un rapport peut se limiter au profil cannabinoïde. Pour chaque famille ci-dessous, recherchez
            une section, une méthode, des résultats et leurs seuils. Sans ces éléments, le document ne
            permet pas de conclure à l&apos;absence du contaminant.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Pesticides", "Liste des molécules recherchées et seuils associés."],
              ["Métaux lourds", "Par exemple plomb, cadmium, arsenic ou mercure selon le périmètre."],
              ["Solvants résiduels", "Pertinent selon le procédé d'extraction et le type de produit."],
              ["Microbiologie", "Bactéries, levures ou moisissures selon la matrice."],
              ["Mycotoxines", "Recherche distincte, qui ne se déduit pas d'un test microbiologique."],
              ["Autres cannabinoïdes", "Molécules naturelles, synthétiques ou hémisynthétiques listées par la méthode."],
            ].map(([title, description]) => (
              <div key={title} className="cartoon-border-sm bg-white p-5">
                <h3 className="font-display text-xl text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal">{description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="cartoon-border mt-8 bg-white p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">5. Vérifier le laboratoire et sa portée</h2>
          <div className="mt-4 grid gap-4 leading-relaxed text-charcoal">
            <p>
              Une accréditation ISO/IEC 17025 concerne un domaine d&apos;activité défini. Le COFRAC précise
              que la compétence technique est reconnue pour une portée déterminée : il faut donc vérifier
              la validité de l&apos;attestation, son annexe technique, la matrice et la méthode concernées.
            </p>
            <p>
              Un logo seul ne suffit pas. Recherchez le numéro d&apos;accréditation dans l&apos;annuaire officiel
              et contrôlez si l&apos;essai du rapport est annoncé comme couvert par l&apos;accréditation.
            </p>
            <p>
              Vérification :{" "}
              <a
                href="https://tools.cofrac.fr/fr/easysearch?list-68262116="
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                annuaire des organismes accrédités du COFRAC
              </a>.
            </p>
          </div>
        </article>

        <article className="cartoon-border mt-8 bg-cream p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">Checklist avant de retenir une analyse CBD</h2>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => (
              <li key={item} className="cartoon-border-sm flex gap-3 bg-white p-4 text-sm leading-relaxed text-charcoal">
                <span aria-hidden="true" className="font-black text-ink">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 leading-relaxed text-charcoal">
            Une analyse solide documente un échantillon précis. Elle complète la fiche produit et
            l&apos;étiquette ; elle ne transforme pas une affirmation générale en preuve pour tous les lots.
          </p>
        </article>

        <article className="cartoon-border mt-8 bg-white p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">Questions fréquentes</h2>
          <div className="mt-6 space-y-5">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question} className="border-b-2 border-ink/15 pb-5 last:border-b-0">
                <h3 className="font-display text-xl text-ink">{item.question}</h3>
                <p className="mt-2 leading-relaxed text-charcoal">{item.answer}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="cartoon-border mt-8 bg-cream p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">Sources et suite de lecture</h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 leading-relaxed text-charcoal">
            <li>
              <a href="https://www.drogues.gouv.fr/etude-cbd" target="_blank" rel="noopener noreferrer" className="underline">
                MILDECA — étude de la composition de produits CBD disponibles en France
              </a>
            </li>
            <li>
              <a href="https://www.drogues.gouv.fr/le-cbd" target="_blank" rel="noopener noreferrer" className="underline">
                MILDECA — cadre général et réglementations applicables au CBD
              </a>
            </li>
            <li>
              <a href="https://www.cofrac.fr/a-propos-du-cofrac/organisation/section-laboratoires" target="_blank" rel="noopener noreferrer" className="underline">
                COFRAC — compétence des laboratoires et norme ISO/IEC 17025
              </a>
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/cbd-naturel" className="btn-cartoon btn-secondary inline-flex min-h-11 items-center px-5 text-xs">
              Comprendre le CBD naturel
            </Link>
            <Link href="/boutique" className="btn-cartoon btn-primary inline-flex min-h-11 items-center px-5 text-xs">
              Voir les fiches produits
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
