import type { Metadata } from "next";
import Link from "next/link";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
  ProductListJsonLd,
  WebPageJsonLd,
} from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { bretonCities } from "@/lib/local-seo-data";
import { getOwnProducer, isOwnProduct } from "@/lib/own-producer";
import { dedupeProducts } from "@/lib/product-dedup";
import { getSiteUrl } from "@/lib/site-url";

const PAGE_SLUG = "cbd-breton";
const FIRST_PUBLISHED = "2026-08-23";
const LAST_REVIEWED = "2026-08-23";

const PUBLIC_SOURCES = [
  {
    name: "MILDECA — cadre applicable au CBD et à la culture du chanvre",
    url: "https://www.drogues.gouv.fr/le-cbd",
  },
  {
    name: "Drogues Info Service — statut légal et précautions liées au CBD",
    url: "https://www.drogues-info-service.fr/Tout-savoir-sur-les-drogues/Le-dico-des-drogues/CBD-cannabidiol",
  },
  {
    name: "Ministère de l’Agriculture — denrées alimentaires contenant du CBD",
    url: "https://agriculture.gouv.fr/node/110883",
  },
  {
    name: "Annuaire des entreprises — identité de l’éditeur Les Champs Bretons",
    url: "https://annuaire-entreprises.data.gouv.fr/entreprise/942368994",
  },
] as const;

const GEOGRAPHY_ROWS = [
  {
    label: "Cultivé en Bretagne",
    meaning: "Le chanvre à l’origine du produit a été cultivé sur une exploitation située en Bretagne.",
    evidence: "Producteur, commune ou département, campagne de récolte et lot correspondant.",
  },
  {
    label: "Transformé en Bretagne",
    meaning: "Une étape de transformation, de préparation ou de conditionnement a été réalisée en Bretagne.",
    evidence: "Entreprise responsable, adresse du site concerné et nature exacte de l’opération.",
  },
  {
    label: "Expédié depuis la Bretagne",
    meaning: "La commande part d’un site logistique breton, sans que cela prouve l’origine du chanvre.",
    evidence: "Lieu d’expédition et origine du produit indiqués séparément.",
  },
  {
    label: "Marque bretonne",
    meaning: "La marque revendique un ancrage breton, mais son catalogue peut réunir plusieurs origines.",
    evidence: "Identité de l’éditeur et producteur attribué à chaque référence.",
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "Qu'est-ce qu'un CBD breton ?",
    answer:
      "L'expression « CBD breton » devrait désigner un produit dont le lien avec la Bretagne est précisé et vérifiable : culture du chanvre, transformation, conditionnement ou simple expédition. Ces étapes ne sont pas équivalentes. Pour parler d'un chanvre cultivé en Bretagne, la fiche doit identifier le producteur et l'origine de la matière première.",
  },
  {
    question: "Tous les produits des Chanvriers Bretons sont-ils cultivés en Bretagne ?",
    answer:
      "Non. Le catalogue distingue la production rattachée aux Chanvriers Bretons des références sélectionnées auprès de producteurs partenaires. Le nom et la localisation du producteur affichés sur chaque fiche permettent de connaître l'origine déclarée de la référence concernée.",
  },
  {
    question: "Comment vérifier l'origine bretonne d'un produit CBD ?",
    answer:
      "Vérifiez le nom du producteur, sa localisation, le numéro de lot, la composition et l'analyse disponible. Une adresse d'expédition ou le siège d'une marque ne prouvent pas, à eux seuls, que le chanvre a été cultivé en Bretagne.",
  },
  {
    question: "CBD breton signifie-t-il CBD naturel ou biologique ?",
    answer:
      "Non. « Breton » décrit une relation géographique, « naturel » désigne généralement une origine végétale et « biologique » renvoie à une certification encadrée. Il faut vérifier séparément l'origine, la composition, le mode de culture déclaré et les éventuelles certifications.",
  },
  {
    question: "Le CBD breton est-il légal en France ?",
    answer:
      "L'origine bretonne ne détermine pas la légalité. La conformité dépend notamment de la variété cultivée, de la teneur en THC, de la composition, de la présentation et des règles propres à la catégorie du produit. Les informations publiques à jour restent prioritaires.",
  },
  {
    question: "Quel est le taux de THC autorisé pour le chanvre en France ?",
    answer:
      "La MILDECA indique que les variétés autorisées et les produits concernés doivent respecter un taux de THC inférieur ou égal à 0,3 %, avec d'autres conditions applicables. Ce seuil ne suffit pas à lui seul à établir la conformité d'un produit fini.",
  },
  {
    question: "Peut-on commander du CBD breton partout en France ?",
    answer:
      "La boutique livre les références disponibles en France selon les modes proposés pendant la commande. Vérifiez sur chaque fiche le stock, le producteur et l'origine : une livraison depuis la Bretagne ne transforme pas une référence partenaire en produit cultivé en Bretagne.",
  },
];

export const metadata: Metadata = {
  title: "CBD breton : production, origine et traçabilité",
  description:
    "Comprendre ce que signifie CBD breton : chanvre cultivé, transformé ou expédié de Bretagne. Production propre et producteurs partenaires clairement distingués.",
  alternates: {
    canonical: `https://www.leschanvriersbretons.com/${PAGE_SLUG}`,
  },
  keywords: [
    "cbd breton",
    "cbd bretagne",
    "producteur cbd bretagne",
    "chanvre breton",
    "fleur cbd bretonne",
    "cbd naturel breton",
    "cbd direct producteur bretagne",
    "cbd cultivé en bretagne",
    "acheter cbd breton",
  ],
  openGraph: {
    title: "CBD breton : production, origine et traçabilité | Les Chanvriers Bretons",
    description:
      "Un guide transparent pour distinguer culture, transformation, conditionnement et expédition depuis la Bretagne.",
    url: `https://www.leschanvriersbretons.com/${PAGE_SLUG}`,
    type: "article",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "CBD breton — origine, production et traçabilité",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CBD breton : production, origine et traçabilité",
    description: "Comment vérifier le lien réel entre un produit CBD et la Bretagne.",
    images: ["/og-default.png"],
  },
};

function selectBretonProducts(
  products: Awaited<ReturnType<typeof readPublicStoreByBackend>>["products"],
) {
  const ownProducts = dedupeProducts(products).filter(isOwnProduct);
  const inStock = ownProducts.filter(
    (product) =>
      !product.trackStock ||
      typeof product.stockQuantity !== "number" ||
      product.stockQuantity > 0,
  );

  return (inStock.length > 0 ? inStock : ownProducts).slice(0, 6);
}

export default async function CbdBretonPage() {
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/${PAGE_SLUG}`;
  const store = await readPublicStoreByBackend();
  const ownProducer = getOwnProducer(store.content.boutique);
  const featuredProducts = selectBretonProducts(store.products);

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: baseUrl },
          { name: "CBD breton", url: pageUrl },
        ]}
      />
      <WebPageJsonLd
        name="CBD breton : production, origine et traçabilité"
        description="Définition du CBD breton et méthode pour distinguer culture, transformation, conditionnement et expédition en Bretagne."
        url={pageUrl}
        about={["CBD breton", "Chanvre breton", "Producteur CBD Bretagne", "Traçabilité du CBD"]}
        dateModified={LAST_REVIEWED}
      />
      <ArticleJsonLd
        title="CBD breton : production, origine et traçabilité"
        description="Guide pour vérifier le lien géographique réel entre un produit CBD, son producteur et la Bretagne."
        url={pageUrl}
        image={`${baseUrl}/og-default.png`}
        datePublished={FIRST_PUBLISHED}
        dateModified={LAST_REVIEWED}
        category="Origine et production du chanvre"
        about={["CBD breton", "Chanvre", "Bretagne", "Origine", "Traçabilité"]}
        citations={PUBLIC_SOURCES.map(({ name, url }) => ({ name, url }))}
      />
      <FaqJsonLd questions={FAQ_ITEMS} />
      {featuredProducts.length > 0 ? (
        <ProductListJsonLd products={featuredProducts} producers={[ownProducer, ...store.producers]} />
      ) : null}

      <div className="retro-container">
        <header className="cartoon-border bg-cream p-8">
          <nav className="mb-4 text-sm text-charcoal" aria-label="Fil d'Ariane">
            <Link href="/" className="underline hover:text-ink">Accueil</Link>
            {" > "}
            <span className="font-bold text-ink">CBD breton</span>
          </nav>
          <h1 className="section-title text-ink">CBD breton : quelle origine réelle ?</h1>
          <p className="mt-4 max-w-4xl text-lg leading-relaxed text-charcoal">
            Une marque bretonne, un colis expédié de Bretagne et un chanvre cultivé en Bretagne ne décrivent
            pas la même chose. Cette page explique comment reconnaître un <strong>CBD breton</strong> à partir
            d’informations vérifiables et comment nous séparons notre production des références partenaires.
          </p>
          <p className="mt-4 text-sm text-charcoal">
            Publié par <Link href="/a-propos" className="underline hover:text-ink">Les Chanvriers Bretons</Link>
            {" · "}<time dateTime={LAST_REVIEWED}>Vérifié le 23 août 2026</time>
          </p>
        </header>

        <div className="cartoon-border mt-8 bg-white p-8" aria-labelledby="reponse-cbd-breton">
          <h2 id="reponse-cbd-breton" className="mb-4 text-3xl font-display text-ink">Le CBD breton en bref</h2>
          <p className="max-w-4xl leading-relaxed text-charcoal">
            Un produit peut être qualifié de CBD breton lorsque son lien avec la Bretagne est expliqué : le
            chanvre peut y être cultivé, le produit transformé ou conditionné, ou la commande simplement
            expédiée depuis la région. Pour vérifier une origine cultivée en Bretagne, recherchez le producteur,
            sa localisation et un lot identifiable. Le nom d’une marque ou son adresse d’expédition ne suffisent pas.
          </p>
          <dl className="mt-6 grid gap-4 md:grid-cols-3">
            <div><dt className="font-bold text-ink">Origine agricole</dt><dd className="mt-1 text-sm leading-relaxed text-charcoal">Où le chanvre a réellement été cultivé.</dd></div>
            <div><dt className="font-bold text-ink">Intervenants</dt><dd className="mt-1 text-sm leading-relaxed text-charcoal">Qui produit, transforme et commercialise.</dd></div>
            <div><dt className="font-bold text-ink">Preuves</dt><dd className="mt-1 text-sm leading-relaxed text-charcoal">Lot, composition et analyse correspondant au produit.</dd></div>
          </dl>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-4 text-3xl font-display text-ink">Que peut vouloir dire « produit en Bretagne » ?</h2>
          <p className="max-w-4xl leading-relaxed text-charcoal">
            Plusieurs étapes peuvent relier un produit à la région. Les distinguer évite de confondre l’origine
            de la plante avec le lieu où un sachet a été préparé ou une commande remise au transporteur.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm text-charcoal">
              <caption className="sr-only">Différences entre culture, transformation, expédition et marque bretonne</caption>
              <thead><tr className="border-b-2 border-ink text-ink"><th scope="col" className="p-3 font-bold">Mention</th><th scope="col" className="p-3 font-bold">Ce qu’elle signifie</th><th scope="col" className="p-3 font-bold">Ce qu’il faut vérifier</th></tr></thead>
              <tbody>
                {GEOGRAPHY_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-charcoal/30 align-top">
                    <th scope="row" className="p-3 font-bold text-ink">{row.label}</th>
                    <td className="p-3 leading-relaxed">{row.meaning}</td>
                    <td className="p-3 leading-relaxed">{row.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-5 text-3xl font-display text-ink">Notre méthode d’attribution de l’origine</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-xl font-display text-ink">Production des Chanvriers Bretons</h3>
              <p className="mt-2 leading-relaxed text-charcoal">Les produits rattachés aux Chanvriers Bretons sont identifiés comme notre production. La fiche sert de référence pour l’origine déclarée, le mode de culture, le format et l’analyse disponible.</p>
            </div>
            <div>
              <h3 className="text-xl font-display text-ink">Producteurs partenaires</h3>
              <p className="mt-2 leading-relaxed text-charcoal">Les autres références conservent le nom et la région de leur producteur. Elles ne deviennent pas bretonnes parce qu’elles sont proposées sur notre site ou préparées avec une commande en Bretagne.</p>
            </div>
          </div>
          <p className="mt-6 leading-relaxed text-charcoal">
            Cette séparation est également expliquée dans notre page <Link href="/a-propos" className="font-bold underline hover:text-ink">À propos et méthode éditoriale</Link>.
            Pour comprendre le terme « naturel » indépendamment de l’origine géographique, consultez notre guide
            sur le <Link href="/cbd-naturel" className="font-bold underline hover:text-ink">CBD naturel</Link>.
          </p>
        </div>

        <div className="cartoon-border mt-8 bg-white p-8">
          <h2 className="mb-4 text-3xl font-display text-ink">La checklist avant de choisir</h2>
          <ol className="grid gap-4 text-sm leading-relaxed text-charcoal md:grid-cols-2">
            <li className="cartoon-border-sm bg-[#f7f4ee] p-4"><strong className="text-ink">1. Identifier le producteur.</strong><br />Son nom doit être associé à la référence, pas seulement cité dans une page générale.</li>
            <li className="cartoon-border-sm bg-[#f7f4ee] p-4"><strong className="text-ink">2. Localiser la culture.</strong><br />La commune, le département ou au minimum la région doivent décrire le lieu de culture déclaré.</li>
            <li className="cartoon-border-sm bg-[#f7f4ee] p-4"><strong className="text-ink">3. Lire la composition.</strong><br />Origine bretonne, origine végétale et absence de substance ajoutée sont trois informations différentes.</li>
            <li className="cartoon-border-sm bg-[#f7f4ee] p-4"><strong className="text-ink">4. Relier le lot à l’analyse.</strong><br />Le document doit permettre d’identifier l’échantillon et les paramètres effectivement testés.</li>
            <li className="cartoon-border-sm bg-[#f7f4ee] p-4"><strong className="text-ink">5. Vérifier les certifications.</strong><br />Une pratique déclarée ne doit pas être confondue avec une certification biologique ou un label officiel.</li>
            <li className="cartoon-border-sm bg-[#f7f4ee] p-4"><strong className="text-ink">6. Contrôler la catégorie.</strong><br />Les obligations diffèrent entre fleur, cosmétique, vapotage et produit présenté pour un usage alimentaire.</li>
          </ol>
        </div>

        <div className="cartoon-border mt-8 bg-yellow p-8" aria-labelledby="cadre-legal-cbd-breton">
          <h2 id="cadre-legal-cbd-breton" className="mb-4 text-3xl font-display text-ink">Origine bretonne et conformité : deux vérifications séparées</h2>
          <div className="space-y-4 leading-relaxed text-charcoal">
            <p>La MILDECA indique notamment que la culture française concerne des variétés autorisées à teneur en THC inférieure ou égale à 0,3 %, cultivées par des agriculteurs actifs à partir de semences certifiées. Un produit fini reste soumis aux règles correspondant à sa composition et à son usage.</p>
            <p>Le ministère de l’Agriculture indique qu’en 2026 les denrées alimentaires incluant du CBD ne sont pas autorisées à la vente. Il distingue les graines de chanvre et leurs dérivés ainsi que les feuilles exclusivement destinées à l’infusion aqueuse, sous conditions et sans enrichissement en extraits de cannabinoïdes. Une origine bretonne, un taux de THC conforme ou le mot « naturel » ne remplacent donc pas l’examen de la composition et de l’usage exacts.</p>
            <p>Aucun produit CBD ne doit être présenté comme un médicament sans autorisation. Des traces de THC peuvent aussi conduire à un dépistage positif : ne conduisez pas après consommation et demandez conseil à un professionnel de santé en cas de traitement ou de situation particulière.</p>
          </div>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-3 text-3xl font-display text-ink">Références rattachées à notre production</h2>
          <p className="max-w-4xl leading-relaxed text-charcoal">Cette sélection automatique n’inclut que les produits rattachés aux Chanvriers Bretons dans le catalogue actuel. Consultez chaque fiche pour vérifier les informations propres au lot et le stock.</p>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} producer={ownProducer} addButtonLabel={store.content.boutique.addButtonLabel} lowStockThresholdGrams={store.content.boutique.lowStockThresholdGrams} imagePriority={index < 2} />
            ))}
          </div>
        ) : (
          <div className="cartoon-border mt-6 bg-white p-6 text-charcoal">Les références de notre production sont momentanément indisponibles. Le catalogue partenaire reste consultable avec l’origine de chaque produit.</div>
        )}

        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-5 text-3xl font-display text-ink">Questions fréquentes sur le CBD breton</h2>
          <div className="space-y-5">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question}><h3 className="mb-2 font-bold text-ink">{item.question}</h3><p className="text-sm leading-relaxed text-charcoal">{item.answer}</p></div>
            ))}
          </div>
        </div>

        <div className="cartoon-border mt-8 bg-white p-8">
          <h2 className="mb-4 text-2xl font-display text-ink">Sources publiques consultées</h2>
          <p className="max-w-4xl text-sm leading-relaxed text-charcoal">La réglementation évolue. Vérifiez les textes et informations publiques avant de tirer une conclusion sur une référence précise.</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-charcoal">
            {PUBLIC_SOURCES.map((source) => (
              <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">{source.name}</a></li>
            ))}
          </ul>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="mb-4 text-2xl font-display text-ink">Le CBD en Bretagne, ville par ville</h2>
          <p className="mb-4 text-sm leading-relaxed text-charcoal">Ces pages présentent la livraison vers les principales villes bretonnes. Elles ne modifient jamais l’origine attribuée au produit sur sa fiche.</p>
          <div className="flex flex-wrap gap-2">
            {bretonCities.map((city) => (
              <Link key={city.slug} href={`/${city.slug}`} className="pill-cartoon inline-flex items-center justify-center px-4 py-2 text-xs uppercase tracking-[0.08em]">CBD {city.name}</Link>
            ))}
          </div>
        </div>

        <div className="cartoon-border mt-8 bg-yellow p-6 text-center">
          <h2 className="mb-4 text-2xl font-display text-ink">Comparer l’origine avant le produit</h2>
          <p className="mx-auto mb-6 max-w-3xl text-charcoal">Consultez le producteur, la région, la composition et l’analyse disponible sur chaque fiche.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/boutique" className="btn-cartoon btn-primary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]">Voir la boutique</Link>
            <Link href="/cbd-naturel" className="btn-cartoon btn-secondary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]">Comprendre le CBD naturel</Link>
            <Link href="/analyse-laboratoire-cbd" className="btn-cartoon btn-secondary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]">Lire une analyse CBD</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
