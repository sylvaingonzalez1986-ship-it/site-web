import type { Metadata } from "next";
import Link from "next/link";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  DatasetJsonLd,
  FaqJsonLd,
  ProductListJsonLd,
  WebPageJsonLd,
} from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { getActiveCatalogCategories } from "@/lib/catalog-categories";
import { buildCatalogTransparencySnapshot } from "@/lib/catalog-transparency";
import { CBD_NATUREL_CANONICAL_ANSWER } from "@/lib/cbd-natural-answer";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { dedupeProducts } from "@/lib/product-dedup";
import { getOwnProducer, resolveProductProducer } from "@/lib/own-producer";
import { getSiteUrl } from "@/lib/site-url";
import { bretonCities } from "@/lib/local-seo-data";
import type { Producer } from "@/types/store";

const PAGE_SLUG = "cbd-naturel";
const FIRST_PUBLISHED = "2026-08-22";
const LAST_REVIEWED = "2026-08-23";

const PUBLIC_SOURCES = [
  {
    name: "OFDT — définition du cannabidiol (CBD)",
    url: "https://www.ofdt.fr/glossaire/cbd-cannabidiol",
  },
  {
    name: "MILDECA — cadre applicable au CBD",
    url: "https://www.drogues.gouv.fr/le-cbd",
  },
  {
    name: "MILDECA — étude de composition de produits CBD",
    url: "https://www.drogues.gouv.fr/etude-cbd",
  },
  {
    name: "Ministère de l’Agriculture — certification biologique",
    url: "https://agriculture.gouv.fr/la-certification-en-agriculture-biologique",
  },
  {
    name: "Drogues Info Service — CBD : effets, interactions et précautions",
    url: "https://www.drogues-info-service.fr/Tout-savoir-sur-les-drogues/Le-dico-des-drogues/CBD-cannabidiol",
  },
  {
    name: "Ministère de l’Agriculture — denrées alimentaires contenant du CBD",
    url: "https://agriculture.gouv.fr/node/110883",
  },
] as const;

const COMPARISON_ROWS = [
  {
    term: "CBD naturel",
    meaning: "Expression commerciale généralement employée pour un cannabidiol provenant du chanvre.",
    evidence: "Origine végétale, composition, producteur et analyse correspondant au lot.",
  },
  {
    term: "CBD bio",
    meaning: "Référence à une production ou à un produit relevant de la certification biologique applicable.",
    evidence: "Logo autorisé, organisme certificateur et informations de certification vérifiables.",
  },
  {
    term: "Sans molécule de synthèse",
    meaning: "Allégation distincte de l’origine végétale et du caractère biologique.",
    evidence: "Liste des ingrédients, procédé documenté et analyse couvrant les substances recherchées.",
  },
  {
    term: "Full spectrum",
    meaning: "Extrait présenté comme conservant plusieurs constituants naturellement présents dans le chanvre.",
    evidence: "Type d’extrait déclaré et profil analytique détaillant les cannabinoïdes mesurés.",
  },
  {
    term: "Analysé en laboratoire",
    meaning: "Un échantillon a été testé pour les paramètres effectivement listés dans le rapport.",
    evidence: "Laboratoire, date, méthode, numéro de rapport, lot et périmètre des essais.",
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "Qu'est-ce que le CBD naturel ?",
    answer: CBD_NATUREL_CANONICAL_ANSWER,
  },
  {
    question: "Comment reconnaître un CBD vraiment naturel ?",
    answer:
      "Vérifiez l'identité du producteur, l'origine du chanvre, la liste complète des ingrédients, le numéro de lot et une analyse de laboratoire récente. Recherchez aussi les éventuels cannabinoïdes ajoutés, arômes ou supports. Le mot « naturel » ne remplace pas ces preuves.",
  },
  {
    question: "Le CBD naturel est-il légal en France ?",
    answer:
      "La commercialisation dépend de la catégorie, de la composition, de l'origine et de l'usage présenté. En mai 2026, le ministère de l'Agriculture a rappelé que les denrées alimentaires incluant du CBD ne sont pas autorisées. Il distingue notamment les graines et leurs dérivés ainsi que les feuilles exclusivement destinées à l'infusion aqueuse, sous conditions et sans enrichissement en cannabinoïdes. Le seuil de THC n'est donc pas le seul critère.",
  },
  {
    question: "Quelle est la différence entre CBD naturel et CBD de synthèse ?",
    answer:
      "Le CBD d'origine végétale est obtenu à partir du chanvre, tandis que le CBD de synthèse est produit par un procédé chimique. L'origine végétale ne signifie pas automatiquement « spectre complet » : un extrait de chanvre peut aussi être purifié en isolat. La composition et l'analyse du lot permettent de les distinguer.",
  },
  {
    question: "Pourquoi acheter du CBD naturel direct producteur ?",
    answer:
      "La vente directe facilite le dialogue sur l'origine, la méthode de culture et le lot, mais elle ne dispense pas de vérifier les preuves. Chez Les Chanvriers Bretons, les fiches distinguent notre production bretonne des références sélectionnées auprès de producteurs partenaires.",
  },
  {
    question: "Quels formats de CBD naturel proposez-vous ?",
    answer:
      "Le catalogue évolue selon les références réellement publiées et leur disponibilité. La boutique affiche uniquement les produits actifs, avec leur catégorie, leur producteur ou marque, leur origine déclarée et les analyses disponibles. Une catégorie vide ne constitue pas une offre commerciale.",
  },
  {
    question: "Le CBD naturel a-t-il des effets secondaires ?",
    answer:
      "Le CBD peut provoquer des effets indésirables et interagir avec certains médicaments. Si vous suivez un traitement, êtes enceinte ou allaitez, demandez conseil à un professionnel de santé. La consommation peut aussi exposer à un dépistage positif au THC : ne conduisez pas après en avoir consommé.",
  },
  {
    question: "Comment conserver le CBD naturel ?",
    answer:
      "Suivez en priorité les instructions figurant sur l'emballage. En règle générale, conservez le produit fermé, au sec et à l'abri de la lumière et de la chaleur. Respectez sa date de durabilité et n'utilisez pas un produit dont l'aspect, l'odeur ou l'emballage s'est altéré.",
  },
];

const CATEGORY_LINKS = [
  { category: "fleurs", href: "/boutique/fleurs-cbd", label: "Fleurs CBD", description: "Origine, producteur, mode de culture et analyse disponibles selon la référence." },
  { category: "resines", href: "/boutique/resines-cbd", label: "Résines CBD", description: "Composition, origine, producteur ou marque et formats consultables par produit." },
  { category: "huiles", href: "/boutique/huiles-cbd", label: "Huiles CBD", description: "Composition, type d'extrait, dosage et usage déclaré indiqués sur chaque fiche." },
  { category: "e-liquide", href: "/boutique/e-liquide-cbd", label: "E-liquides CBD", description: "Dosage, composition, volume, marque et précautions indiqués par référence." },
  { category: "cosmetiques", href: "/boutique/cosmetiques-cbd", label: "Cosmétiques CBD", description: "Composition, marque, format et conseils d'utilisation à consulter sur la fiche." },
  { category: "alimentaire", href: "/boutique/tisane-cbd", label: "Infusions au chanvre", description: "Ingrédients, origine et conformité à vérifier pour chaque référence." },
  { category: "miam", href: "/boutique/miam-cbd", label: "Produits gourmands", description: "Composition, allergènes, origine et statut réglementaire détaillés selon le produit." },
];

const featuredCategoryOrder = ["fleurs", "e-liquide", "resines", "huiles", "cosmetiques", "alimentaire", "miam"] as const;

export const metadata: Metadata = {
  title: "CBD naturel : origine, analyses et traçabilité",
  description:
    "Comprendre le CBD naturel : origine végétale, analyses de lot, différences avec le bio et le CBD de synthèse. Production bretonne et partenaires identifiés.",
  alternates: {
    canonical: `https://www.leschanvriersbretons.com/${PAGE_SLUG}`,
  },
  keywords: [
    "cbd naturel",
    "cbd naturel france",
    "cbd naturel breton",
    "acheter cbd naturel",
    "analyse cbd naturel",
    "cbd direct producteur",
    "chanvre naturel",
    "fleur cbd naturelle",
    "huile cbd naturelle",
    "origine cbd naturel",
    "cbd circuit court",
    "cbd artisanal",
  ],
  openGraph: {
    title: "CBD naturel : origine, analyses et traçabilité | Les Chanvriers Bretons",
    description:
      "Un guide pour vérifier l'origine, la composition et les analyses d'un produit CBD, avec une sélection de producteurs clairement identifiés.",
    url: `https://www.leschanvriersbretons.com/${PAGE_SLUG}`,
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "CBD naturel – origine, composition et analyses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CBD naturel : origine, analyses et traçabilité",
    description:
      "Comment vérifier l'origine, la composition et l'analyse d'un produit CBD naturel.",
    images: ["/og-default.png"],
  },
};

function selectFeaturedProducts(
  products: Awaited<ReturnType<typeof readPublicStoreByBackend>>["products"],
) {
  const uniqueProducts = dedupeProducts(products);
  const featured = featuredCategoryOrder
    .map((category) => uniqueProducts.find((product) => product.category === category))
    .filter((product): product is (typeof uniqueProducts)[number] => Boolean(product));

  if (featured.length >= 6) {
    return featured.slice(0, 6);
  }

  const selectedIds = new Set(featured.map((product) => product.id));
  const fallback = uniqueProducts
    .filter((product) => !selectedIds.has(product.id))
    .slice(0, 6 - featured.length);
  return [...featured, ...fallback];
}

function formatCatalogObservationDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(date);
}

export default async function CbdNaturelPage() {
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/${PAGE_SLUG}`;
  const store = await readPublicStoreByBackend();
  const activeCategories = new Set<string>(
    getActiveCatalogCategories(store.products).map(({ category }) => category),
  );
  const activeCategoryLinks = CATEGORY_LINKS.filter(({ category }) => activeCategories.has(category));
  const featuredProducts = selectFeaturedProducts(store.products);
  const ownProducer = getOwnProducer(store.content.boutique);
  const producersById = new Map<string, Producer>(
    store.producers.map((producer) => [producer.id, producer]),
  );
  const transparencySnapshot = buildCatalogTransparencySnapshot(
    store.products,
    store.producers,
    ownProducer,
  );
  const observationDate = formatCatalogObservationDate(transparencySnapshot.lastCatalogUpdate);
  const transparencyDataUrl = `${pageUrl}/catalogue-transparence.json`;

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: baseUrl },
          { name: "CBD Naturel", url: pageUrl },
        ]}
      />
      <WebPageJsonLd
        name="CBD naturel : origine, culture et traçabilité"
        description="Comprendre le CBD naturel, sa culture, son origine bretonne, sa traçabilité et les analyses disponibles."
        url={pageUrl}
        about={["CBD naturel", "Chanvre breton", "Circuit court", "Traçabilité du CBD"]}
        dateModified={LAST_REVIEWED}
      />
      <ArticleJsonLd
        title="CBD naturel : origine, analyses et traçabilité"
        description="Guide pour distinguer origine végétale, certification biologique, composition et analyse de lot d’un produit CBD."
        url={pageUrl}
        image={`${baseUrl}/og-default.png`}
        datePublished={FIRST_PUBLISHED}
        dateModified={LAST_REVIEWED}
        category="Guide CBD et traçabilité"
        about={["CBD naturel", "Cannabidiol", "Chanvre", "Traçabilité", "Analyse de laboratoire"]}
        citations={PUBLIC_SOURCES.map(({ name, url }) => ({ name, url }))}
      />
      <DatasetJsonLd
        name="Observatoire de transparence du catalogue CBD"
        description="Mesures calculées automatiquement à partir des références réellement publiées dans le catalogue des Chanvriers Bretons."
        url={pageUrl}
        distributionUrl={transparencyDataUrl}
        isBasedOn={`${baseUrl}/boutique`}
        dateModified={transparencySnapshot.lastCatalogUpdate}
        variables={[
          { name: "Références publiées", value: transparencySnapshot.publishedReferences },
          { name: "Producteurs identifiés", value: transparencySnapshot.producerIdentified },
          { name: "Origines identifiées", value: transparencySnapshot.originIdentified },
          { name: "Analyses disponibles", value: transparencySnapshot.analysesAvailable },
        ]}
      />
      <FaqJsonLd questions={FAQ_ITEMS} />
      <ProductListJsonLd products={featuredProducts} producers={store.producers} />

      <div className="retro-container">
        {/* Hero */}
        <div className="cartoon-border bg-cream p-8">
          <nav className="mb-4 text-sm text-charcoal" aria-label="Fil d'Ariane">
            <Link href="/" className="hover:text-ink underline">
              Accueil
            </Link>
            {" > "}
            <span className="font-bold text-ink">CBD Naturel</span>
          </nav>

          <h1 className="section-title text-ink">CBD Naturel</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-charcoal">
            Le CBD naturel ne se reconnaît pas à une promesse, mais à des informations vérifiables : origine,
            composition, producteur et analyse du lot. Nous présentons notre production bretonne et les références
            de producteurs partenaires en indiquant leur provenance sur chaque fiche produit.
          </p>
          <p className="mt-4 text-sm text-charcoal">
            Contenu publié par{" "}
            <Link href="/a-propos" className="underline hover:text-ink">
              Les Chanvriers Bretons
            </Link>{" "}
            · <time dateTime={LAST_REVIEWED}>Vérifié le 23 août 2026</time>
          </p>
        </div>

        {/* Réponse courte, facilement extractible par les moteurs de réponse */}
        <div className="cartoon-border mt-8 bg-white p-8" aria-labelledby="cbd-naturel-en-bref">
          <h2 id="cbd-naturel-en-bref" className="mb-4 text-3xl font-display text-ink">
            Le CBD naturel en bref
          </h2>
          <p className="max-w-4xl leading-relaxed text-charcoal">
            {CBD_NATUREL_CANONICAL_ANSWER}
          </p>
          <dl className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <dt className="font-bold text-ink">Origine</dt>
              <dd className="mt-1 text-sm leading-relaxed text-charcoal">Chanvre et producteur clairement identifiés.</dd>
            </div>
            <div>
              <dt className="font-bold text-ink">Traçabilité</dt>
              <dd className="mt-1 text-sm leading-relaxed text-charcoal">Lot relié à une analyse consultable et datée.</dd>
            </div>
            <div>
              <dt className="font-bold text-ink">Composition</dt>
              <dd className="mt-1 text-sm leading-relaxed text-charcoal">Ingrédients et cannabinoïdes ajoutés explicitement indiqués.</dd>
            </div>
          </dl>
          <p className="mt-6 text-sm leading-relaxed text-charcoal">
            Pour contrôler un document lot par lot, suivez notre guide{" "}
            <Link href="/analyse-laboratoire-cbd" className="font-bold underline hover:text-ink">
              comment lire une analyse laboratoire CBD
            </Link>.
            {" "}Pour distinguer l&apos;origine agricole du simple lieu d&apos;expédition, consultez aussi notre guide{" "}
            <Link href="/cbd-breton" className="font-bold underline hover:text-ink">
              CBD breton
            </Link>.
            {" "}Retrouvez enfin les termes techniques dans notre{" "}
            <Link href="/glossaire-cbd" className="font-bold underline hover:text-ink">
              glossaire du CBD
            </Link>.
          </p>
        </div>

        <div className="cartoon-border mt-8 bg-yellow p-6 md:p-8" aria-labelledby="observatoire-catalogue-cbd">
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-charcoal">Données originales du catalogue</p>
          <h2 id="observatoire-catalogue-cbd" className="mt-2 text-3xl font-display text-ink">
            Observatoire de transparence
          </h2>
          <p className="mt-4 max-w-4xl leading-relaxed text-charcoal">
            Ces chiffres sont calculés automatiquement à partir des références réellement publiées, après
            déduplication. Ils ne constituent ni une note de qualité ni une estimation commerciale.
            {observationDate ? (
              <> Dernière donnée catalogue observée le <time dateTime={transparencySnapshot.lastCatalogUpdate}>{observationDate}</time>.</>
            ) : null}
          </p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="cartoon-border-sm bg-white p-4">
              <dt className="text-sm font-bold text-charcoal">Références publiées</dt>
              <dd className="mt-1 text-3xl font-display text-ink">{transparencySnapshot.publishedReferences}</dd>
            </div>
            <div className="cartoon-border-sm bg-white p-4">
              <dt className="text-sm font-bold text-charcoal">Producteur identifié</dt>
              <dd className="mt-1 text-3xl font-display text-ink">
                {transparencySnapshot.producerIdentified}/{transparencySnapshot.publishedReferences}
              </dd>
            </div>
            <div className="cartoon-border-sm bg-white p-4">
              <dt className="text-sm font-bold text-charcoal">Origine indiquée</dt>
              <dd className="mt-1 text-3xl font-display text-ink">
                {transparencySnapshot.originIdentified}/{transparencySnapshot.publishedReferences}
              </dd>
            </div>
            <div className="cartoon-border-sm bg-white p-4">
              <dt className="text-sm font-bold text-charcoal">Analyses accessibles</dt>
              <dd className="mt-1 text-3xl font-display text-ink">{transparencySnapshot.analysesAvailable}</dd>
            </div>
            <div className="cartoon-border-sm bg-white p-4">
              <dt className="text-sm font-bold text-charcoal">Production maison / partenaires</dt>
              <dd className="mt-1 text-3xl font-display text-ink">
                {transparencySnapshot.ownReferences}/{transparencySnapshot.partnerReferences}
              </dd>
            </div>
            <div className="cartoon-border-sm bg-white p-4">
              <dt className="text-sm font-bold text-charcoal">Producteurs distincts</dt>
              <dd className="mt-1 text-3xl font-display text-ink">{transparencySnapshot.distinctProducers}</dd>
            </div>
          </dl>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse bg-white text-left text-sm text-charcoal">
              <caption className="sr-only">Références et analyses disponibles par catégorie</caption>
              <thead>
                <tr>
                  <th scope="col" className="border border-ink p-3 text-ink">Catégorie</th>
                  <th scope="col" className="border border-ink p-3 text-ink">Références publiées</th>
                  <th scope="col" className="border border-ink p-3 text-ink">Analyses accessibles</th>
                </tr>
              </thead>
              <tbody>
                {transparencySnapshot.categories.map((category) => (
                  <tr key={category.category}>
                    <th scope="row" className="border border-ink p-3 font-bold text-ink">{category.label}</th>
                    <td className="border border-ink p-3">{category.publishedReferences}</td>
                    <td className="border border-ink p-3">{category.analysesAvailable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {transparencySnapshot.unresolvedProducerReferences > 0 ? (
            <p className="mt-4 text-sm font-bold text-charcoal">
              {transparencySnapshot.unresolvedProducerReferences} référence(s) possède(nt) une association producteur à compléter.
            </p>
          ) : null}

          <p className="mt-5 text-sm leading-relaxed text-charcoal">
            « Analyse accessible » signifie qu&apos;un document public est relié à la fiche ; cela ne préjuge pas de son
            périmètre. La méthode et les données sont disponibles dans le{" "}
            <Link href="/cbd-naturel/catalogue-transparence.json" className="font-bold underline hover:text-ink">
              jeu de données JSON
            </Link>.
          </p>
        </div>

        {/* Qu'est-ce que le CBD naturel */}
        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-4 text-3xl font-display text-ink">
            Qu&apos;est-ce que le CBD naturel ?
          </h2>
          <div className="space-y-4 leading-relaxed text-charcoal">
            <p>
              Le CBD est une molécule naturellement présente dans le chanvre (<em>Cannabis sativa L.</em>).
              Dans le commerce, l&apos;expression <strong>CBD naturel</strong> désigne généralement un cannabidiol
              d&apos;origine végétale, par opposition à une molécule obtenue par synthèse chimique.
            </p>
            <p>
              Ce terme ne définit cependant ni une méthode agricole unique, ni un niveau de pureté garanti.
              Il ne remplace pas une certification biologique et ne prouve pas, à lui seul, l&apos;absence de
              pesticide, de solvant ou d&apos;additif. Pour évaluer un produit, il faut rapprocher sa fiche,
              son numéro de lot et son analyse de laboratoire.
            </p>
            <p>
              Chez Les Chanvriers Bretons, notre production est identifiée comme telle. Les autres références
              sont rattachées au producteur partenaire concerné. Une origine végétale n&apos;implique pas non plus
              automatiquement un spectre complet : la composition doit préciser s&apos;il s&apos;agit d&apos;un extrait
              full spectrum, broad spectrum ou d&apos;un isolat.
            </p>
          </div>
        </div>

        {/* Pourquoi choisir un CBD naturel */}
        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-6 text-3xl font-display text-ink">
            Quels critères vérifier pour choisir un CBD naturel ?
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-lg font-display text-ink">Traçabilité vérifiable</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Une fiche utile relie le produit à son origine, son producteur, sa composition et son lot.
                L&apos;analyse disponible doit être suffisamment récente et correspondre à la référence vendue.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-display text-ink">Composition lisible</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Le type d&apos;extrait, les ingrédients, les arômes et les cannabinoïdes ajoutés doivent être
                explicitement indiqués. L&apos;origine végétale ne suffit pas à décrire la composition finale.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-display text-ink">Méthode de culture documentée</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Une certification ou des informations précises sur la culture sont plus utiles qu&apos;une
                mention générale « naturel ». Elles doivent être attribuées au producteur concerné.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-display text-ink">Circuit identifié</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                La vente directe facilite les questions sur la récolte et le lot. Pour une référence partenaire,
                nous affichons le nom et la région du producteur afin de rendre le circuit compréhensible.
              </p>
            </div>
          </div>
        </div>

        {/* Produits CBD naturel */}
        <div className="cartoon-border mt-10 bg-cream p-8">
          <h2 className="mb-3 text-3xl font-display text-ink">
            Une sélection de produits disponibles
          </h2>
          <p className="mb-6 max-w-3xl text-charcoal">
            Cette sélection réunit notre production et des références de producteurs partenaires.
            L&apos;origine affichée sur chaque carte permet de les distinguer ; consultez ensuite la fiche
            pour vérifier la composition et l&apos;analyse disponible.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featuredProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              producer={resolveProductProducer(product, producersById, ownProducer)}
              addButtonLabel={store.content.boutique.addButtonLabel}
              lowStockThresholdGrams={store.content.boutique.lowStockThresholdGrams}
              imagePriority={index < 2}
            />
          ))}
        </div>

        {/* Catégories CBD naturel */}
        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-6 text-3xl font-display text-ink">
            Les formats actuellement présents dans le catalogue
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeCategoryLinks.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="cartoon-border-sm block bg-[#f7f4ee] p-4 transition-colors hover:bg-[#e8f7f2]"
              >
                <h3 className="text-base font-bold text-ink">{cat.label}</h3>
                <p className="mt-1 text-sm text-charcoal">{cat.description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Comment nous cultivons */}
        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-4 text-3xl font-display text-ink">
            Comment cultivons-nous notre chanvre en Bretagne ?
          </h2>
          <div className="space-y-4 leading-relaxed text-charcoal">
            <p>
              Notre production propre est cultivée en Bretagne. Cette présentation concerne uniquement
              les produits rattachés aux Chanvriers Bretons ; les références partenaires suivent les méthodes
              décrites sur leur fiche et portent le nom de leur producteur d&apos;origine.
            </p>
            <p>
              Pour juger une méthode de culture, nous vous conseillons de rechercher des éléments précis :
              localisation, type de culture, pratiques agricoles, certifications éventuelles, date de récolte
              et analyse correspondant au lot. Ces informations sont plus fiables qu&apos;une promesse générale.
            </p>
            <p>
              Nous enrichissons progressivement les fiches avec ces preuves. Lorsqu&apos;une analyse est publiée,
              un bouton permet de la consulter depuis le produit concerné.
            </p>
          </div>
        </div>

        {/* CBD naturel vs autres */}
        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-4 text-3xl font-display text-ink">
            CBD naturel, CBD bio, CBD de synthèse : quelles différences ?
          </h2>
          <div className="space-y-4 leading-relaxed text-charcoal">
            <p>
              <strong>CBD d&apos;origine végétale</strong> : extrait du chanvre. Le mot « naturel » n&apos;est pas
              une certification officielle et doit être complété par l&apos;origine, la composition et l&apos;analyse.
            </p>
            <p>
              <strong>CBD bio</strong> : un CBD qui répond aux critères de la certification biologique
              européenne (AB ou équivalent). La certification bio implique des contrôles externes
              réguliers. Une pratique annoncée comme proche du bio ne doit pas être présentée comme certifiée
              si le produit ou le producteur ne dispose pas du label correspondant.
            </p>
            <p>
              <strong>CBD de synthèse</strong> : fabriqué en laboratoire par synthèse chimique.
              Il reproduit la molécule de CBD sans être extrait de la plante. Sa nature et sa composition
              doivent être clairement déclarées au consommateur.
            </p>
            <p>
              Dans tous les cas, choisissez à partir de preuves vérifiables plutôt qu&apos;à partir du seul mot
              « naturel ».
            </p>
          </div>
        </div>

        <div className="cartoon-border mt-8 bg-yellow p-8" aria-labelledby="cadre-alimentaire-cbd-2026">
          <h2 id="cadre-alimentaire-cbd-2026" className="mb-4 text-3xl font-display text-ink">
            Produits alimentaires au CBD : point de vigilance 2026
          </h2>
          <div className="space-y-4 leading-relaxed text-charcoal">
            <p>
              Le ministère de l’Agriculture indique que les denrées alimentaires incluant du CBD dans leurs
              ingrédients ne sont pas autorisées à la vente et font l’objet de contrôles renforcés en 2026.
            </p>
            <p>
              Il distingue les graines de chanvre et leurs dérivés, ainsi que les feuilles exclusivement destinées
              à la préparation d’une infusion aqueuse. Ces produits restent soumis à leurs propres conditions,
              notamment aux teneurs maximales en THC, et ne doivent pas être enrichis en extraits de cannabinoïdes.
            </p>
            <p className="text-sm">
              Une appellation commerciale comme « huile », « tisane » ou « naturel » ne suffit donc pas : la
              composition et l’usage présenté sur la fiche et l’étiquette doivent être contrôlés référence par référence.
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-6 text-3xl font-display text-ink">
            Questions fréquentes sur le CBD naturel
          </h2>
          <div className="space-y-5">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question}>
                <h3 className="mb-2 font-bold text-ink">{item.question}</h3>
                <p className="text-sm leading-relaxed text-charcoal">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="cartoon-border mt-8 bg-white p-6 md:p-8" aria-labelledby="tableau-comparatif-cbd">
          <h2 id="tableau-comparatif-cbd" className="mb-4 text-3xl font-display text-ink">
            Quel justificatif demander pour chaque mention ?
          </h2>
          <p className="max-w-4xl leading-relaxed text-charcoal">
            Ces expressions ne sont pas interchangeables. Le tableau sépare leur sens courant de la preuve
            concrète à rechercher avant de comparer deux produits.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm text-charcoal">
              <caption className="sr-only">
                Comparaison entre CBD naturel, CBD bio, absence de molécules de synthèse, full spectrum et analyse en laboratoire
              </caption>
              <thead>
                <tr className="border-b-2 border-ink text-ink">
                  <th scope="col" className="p-3 font-bold">Mention</th>
                  <th scope="col" className="p-3 font-bold">Ce qu’elle décrit</th>
                  <th scope="col" className="p-3 font-bold">Éléments à vérifier</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.term} className="border-b border-charcoal/30 align-top">
                    <th scope="row" className="p-3 font-bold text-ink">{row.term}</th>
                    <td className="p-3 leading-relaxed">{row.meaning}</td>
                    <td className="p-3 leading-relaxed">{row.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-charcoal">
            Une analyse ne permet de conclure que sur l’échantillon, le lot et les paramètres indiqués dans le rapport.
          </p>
        </div>

        <div className="cartoon-border mt-8 bg-white p-8">
          <h2 className="mb-4 text-2xl font-display text-ink">Sources publiques et précautions</h2>
          <p className="max-w-4xl text-sm leading-relaxed text-charcoal">
            Les règles et connaissances évoluent. Pour vérifier la réglementation, les interactions
            médicamenteuses et les précautions de conduite, consultez en priorité les informations publiques.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-charcoal">
            {PUBLIC_SOURCES.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-ink"
                >
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-charcoal">
            Ces informations générales ne remplacent pas l&apos;avis d&apos;un professionnel de santé.
          </p>
        </div>

        {/* CTA boutique */}
        <div className="cartoon-border mt-8 bg-yellow p-6 text-center">
          <h2 className="mb-4 text-2xl font-display text-ink">Comparer les produits et leur origine</h2>
          <p className="mb-6 text-charcoal">
            Parcourez les fiches pour identifier le producteur, la région, la composition et les analyses
            disponibles avant de choisir un format.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/boutique"
              className="btn-cartoon btn-primary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]"
            >
              Voir la boutique
            </Link>
            <Link
              href="/blog"
              className="btn-cartoon btn-secondary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]"
            >
              Lire nos guides CBD
            </Link>
            <Link
              href="/cbd-pas-cher"
              className="btn-cartoon btn-secondary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]"
            >
              Voir le CBD à prix accessible
            </Link>
          </div>
        </div>

        {/* Maillage villes */}
        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="mb-4 text-2xl font-display text-ink">
            CBD naturel livré partout en Bretagne
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-charcoal">
            Notre CBD naturel est expédié depuis la Bretagne vers toute la France. Retrouvez
            nos pages locales pour chaque ville bretonne avec les modes de livraison proposés lors de la commande.
          </p>
          <div className="flex flex-wrap gap-2">
            {bretonCities.map((city) => (
              <Link
                key={city.slug}
                href={`/${city.slug}`}
                className="pill-cartoon inline-flex items-center justify-center px-4 py-2 text-xs uppercase tracking-[0.08em]"
              >
                CBD {city.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Repères de clôture */}
        <div className="cartoon-border mt-8 space-y-3 bg-cream p-6 text-sm text-charcoal">
          <h2 className="text-2xl font-display text-ink">Nos repères de transparence</h2>
          <p>
            <strong>Origine :</strong> notre production bretonne et les produits de partenaires sont
            distingués par le nom et la localisation du producteur.
          </p>
          <p>
            <strong>Analyse :</strong> lorsqu&apos;un document de laboratoire est disponible, il est relié
            à la fiche du produit concerné.
          </p>
          <p>
            <strong>Expédition :</strong> les commandes sont préparées en Bretagne puis livrées à domicile
            ou en point relais en France métropolitaine.
          </p>
        </div>
      </div>
    </section>
  );
}
