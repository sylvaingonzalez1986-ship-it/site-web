import type { Metadata } from "next";
import Link from "next/link";
import {
  BreadcrumbJsonLd,
  FaqJsonLd,
  ProductListJsonLd,
  WebPageJsonLd,
} from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { dedupeProducts } from "@/lib/product-dedup";
import { getOwnProducer, resolveProductProducer } from "@/lib/own-producer";
import { getSiteUrl } from "@/lib/site-url";
import { bretonCities } from "@/lib/local-seo-data";
import type { Producer } from "@/types/store";

const PAGE_SLUG = "cbd-naturel";

const FAQ_ITEMS = [
  {
    question: "Qu'est-ce que le CBD naturel ?",
    answer:
      "Le CBD naturel désigne un cannabidiol extrait de plants de chanvre cultivés sans pesticide ni engrais chimique. Chez Les Chanvriers Bretons, le chanvre est cultivé en Bretagne selon des méthodes respectueuses du sol, sans OGM ni traitement synthétique. Le produit final conserve l'intégralité de ses cannabinoïdes, terpènes et flavonoïdes d'origine.",
  },
  {
    question: "Comment reconnaître un CBD vraiment naturel ?",
    answer:
      "Un CBD naturel se distingue par trois critères vérifiables : des analyses laboratoire indépendantes publiées pour chaque lot, une traçabilité complète de la culture à la mise en vente, et l'absence d'additifs, solvants résiduels ou arômes artificiels. Chez un producteur direct, vous pouvez exiger ces informations.",
  },
  {
    question: "Le CBD naturel est-il légal en France ?",
    answer:
      "Oui. Le CBD est légal en France à condition que le taux de THC soit inférieur au seuil réglementaire. Tous les produits des Chanvriers Bretons sont conformes à la législation française et accompagnés d'analyses laboratoire certifiant leur conformité.",
  },
  {
    question: "Quelle est la différence entre CBD naturel et CBD de synthèse ?",
    answer:
      "Le CBD naturel est extrait directement du plant de chanvre et conserve le spectre complet des molécules (effet d'entourage). Le CBD de synthèse est fabriqué chimiquement en laboratoire, il est souvent isolé et ne bénéficie pas du même profil moléculaire. Le CBD naturel offre une expérience plus riche et une meilleure tolérance.",
  },
  {
    question: "Pourquoi acheter du CBD naturel direct producteur ?",
    answer:
      "Acheter du CBD naturel en direct du producteur garantit un prix juste sans surcoût intermédiaire, une traçabilité totale du champ à l'expédition, et un accompagnement personnalisé. En circuit court breton, vous soutenez aussi l'agriculture locale et réduisez l'empreinte carbone de votre achat.",
  },
  {
    question: "Quels formats de CBD naturel proposez-vous ?",
    answer:
      "Nous proposons des fleurs de CBD naturelles, des résines, des huiles full spectrum et broad spectrum, des tisanes chanvre artisanales, des cosmétiques au CBD et des produits gourmands au chanvre. Chaque format conserve les propriétés naturelles du chanvre breton.",
  },
  {
    question: "Le CBD naturel a-t-il des effets secondaires ?",
    answer:
      "Le CBD naturel est généralement très bien toléré. Les effets indésirables rapportés (somnolence légère, bouche sèche) sont rares et dépendent du dosage. Si vous suivez un traitement médical, consultez votre médecin avant utilisation. Nos produits ne contiennent aucun additif susceptible de provoquer des réactions indésirables.",
  },
  {
    question: "Comment conserver le CBD naturel ?",
    answer:
      "Conservez vos produits CBD naturels à l'abri de la lumière, de la chaleur et de l'humidité. Les fleurs et résines se gardent idéalement dans un contenant hermétique. Les huiles CBD se conservent au réfrigérateur après ouverture. Bien stocké, un produit CBD naturel conserve ses propriétés pendant 6 à 12 mois.",
  },
];

const CATEGORY_LINKS = [
  { href: "/boutique/fleurs-cbd", label: "Fleurs CBD", description: "Fleurs de chanvre cultivées naturellement, arômes intacts et terpènes préservés." },
  { href: "/boutique/huiles-cbd", label: "Huiles CBD", description: "Full spectrum et broad spectrum, extraction douce, dosage précis." },
  { href: "/boutique/resines-cbd", label: "Résines CBD", description: "Concentration élevée, texture maîtrisée, saveurs authentiques." },
  { href: "/boutique/tisane-cbd", label: "Tisanes Chanvre", description: "Infusions artisanales bretonnes, détente au quotidien." },
  { href: "/boutique/cosmetiques-cbd", label: "Cosmétiques CBD", description: "Soins naturels au chanvre pour la peau et le corps." },
  { href: "/boutique/miam-cbd", label: "Miam CBD", description: "Gourmandises au chanvre breton, plaisir et bien-être." },
];

const featuredCategoryOrder = ["fleurs", "huiles", "resines", "alimentaire", "cosmetiques", "miam"] as const;

export const metadata: Metadata = {
  title: "CBD Naturel | Chanvre Breton Sans Pesticide Direct Producteur",
  description:
    "CBD naturel direct producteur breton : fleurs de CBD, huiles full spectrum, résines, tisanes chanvre artisanales. Chanvre cultivé sans pesticide en Bretagne. Circuit court, analyses laboratoire, livraison rapide France.",
  alternates: {
    canonical: `https://leschanvriersbretons.com/${PAGE_SLUG}`,
  },
  keywords: [
    "cbd naturel",
    "cbd naturel france",
    "cbd naturel breton",
    "acheter cbd naturel",
    "cbd sans pesticide",
    "cbd direct producteur",
    "chanvre naturel",
    "fleur cbd naturelle",
    "huile cbd naturelle",
    "cbd bio breton",
    "cbd circuit court",
    "cbd artisanal",
  ],
  openGraph: {
    title: "CBD Naturel – Chanvre Breton Direct Producteur | Les Chanvriers Bretons",
    description:
      "Découvrez le CBD naturel des Chanvriers Bretons : fleurs de CBD, huiles spectre complet, résines et tisanes chanvre artisanales. Chanvre cultivé en Bretagne sans pesticide, circuit court.",
    url: `https://leschanvriersbretons.com/${PAGE_SLUG}`,
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "CBD Naturel – Les Chanvriers Bretons, producteur de chanvre en Bretagne",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CBD Naturel – Chanvre Breton Direct Producteur",
    description:
      "Fleurs CBD, huiles, résines et tisanes chanvre naturelles. Direct producteur breton, sans pesticide, livraison rapide France.",
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

export default async function CbdNaturelPage() {
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/${PAGE_SLUG}`;
  const store = await readPublicStoreByBackend();
  const featuredProducts = selectFeaturedProducts(store.products);
  const ownProducer = getOwnProducer(store.content.boutique);
  const producersById = new Map<string, Producer>(
    store.producers.map((producer) => [producer.id, producer]),
  );

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
            Du chanvre cultivé en Bretagne sans pesticide, transformé avec soin et vendu en direct producteur.
            Chez Les Chanvriers Bretons, le CBD naturel n&apos;est pas un argument marketing : c&apos;est une méthode
            de culture, un engagement de transparence et un circuit court réel, du champ à votre porte.
          </p>
        </div>

        {/* Qu'est-ce que le CBD naturel */}
        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-4 text-3xl font-display text-ink">
            Qu&apos;est-ce que le CBD naturel ?
          </h2>
          <div className="space-y-4 leading-relaxed text-charcoal">
            <p>
              Le CBD naturel est un cannabidiol issu de plants de chanvre (<em>Cannabis sativa L.</em>)
              cultivés selon des pratiques agricoles respectueuses du vivant. Concrètement, cela signifie
              qu&apos;aucun pesticide de synthèse, aucun herbicide chimique et aucun engrais artificiel
              n&apos;intervient dans la culture. Le plant pousse dans un sol vivant, développe ses
              cannabinoïdes et ses terpènes de manière organique, et le produit final conserve
              l&apos;intégralité de son profil moléculaire.
            </p>
            <p>
              Chez Les Chanvriers Bretons, le CBD naturel est cultivé en Bretagne. Le terroir breton
              — climat océanique, sols fertiles, rotation des cultures — offre des conditions idéales
              pour un chanvre robuste et aromatique. Chaque récolte est analysée en laboratoire
              indépendant pour certifier le taux de CBD, l&apos;absence de métaux lourds,
              de pesticides résiduels et la conformité réglementaire du taux de THC.
            </p>
            <p>
              Le terme <strong>CBD naturel</strong> se distingue du CBD de synthèse (fabriqué chimiquement)
              et du CBD issu de cultures intensives traitées. Il implique aussi une transformation douce :
              extraction sans solvant agressif, séchage lent pour préserver les terpènes, conditionnement
              sans additif. Le résultat est un produit qui conserve l&apos;effet d&apos;entourage —
              la synergie entre cannabinoïdes, terpènes et flavonoïdes — reconnu pour optimiser
              les bienfaits du CBD.
            </p>
          </div>
        </div>

        {/* Pourquoi choisir un CBD naturel */}
        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-6 text-3xl font-display text-ink">
            Pourquoi choisir un CBD naturel plutôt qu&apos;un CBD conventionnel ?
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-lg font-display text-ink">Pureté et transparence</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Un CBD naturel garanti sans pesticide, sans solvant résiduel et sans additif.
                Chaque lot est accompagné d&apos;une analyse laboratoire consultable.
                Vous savez exactement ce que vous consommez.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-display text-ink">Effet d&apos;entourage préservé</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                La culture naturelle préserve le spectre complet des cannabinoïdes (CBD, CBG, CBN)
                et des terpènes. Cette richesse moléculaire crée un effet d&apos;entourage
                que le CBD isolé ne reproduit pas.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-display text-ink">Respect de l&apos;environnement</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Pas de produit chimique dans le sol, pas de pollution des nappes phréatiques.
                Le chanvre est naturellement résistant et contribue à la régénération des sols.
                Une culture qui respecte le vivant.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-display text-ink">Circuit court breton</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                En achetant du CBD naturel direct producteur en Bretagne, vous supprimez
                les intermédiaires, réduisez l&apos;empreinte carbone et soutenez
                l&apos;agriculture locale. Prix juste, qualité vérifiable.
              </p>
            </div>
          </div>
        </div>

        {/* Produits CBD naturel */}
        <div className="cartoon-border mt-10 bg-cream p-8">
          <h2 className="mb-3 text-3xl font-display text-ink">
            Nos produits CBD naturels
          </h2>
          <p className="mb-6 max-w-3xl text-charcoal">
            Chaque produit est issu de chanvre breton cultivé sans pesticide. Fleurs séchées lentement,
            huiles extraites en douceur, résines pressées artisanalement, tisanes composées à la main.
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
            Les formats de CBD naturel disponibles
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_LINKS.map((cat) => (
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
            Comment est cultivé notre CBD naturel en Bretagne ?
          </h2>
          <div className="space-y-4 leading-relaxed text-charcoal">
            <p>
              Notre chanvre est cultivé en pleine terre bretonne, dans le respect des cycles naturels.
              Pas de culture hors-sol, pas de lumière artificielle permanente, pas d&apos;accélérateur
              chimique. Les plants bénéficient du climat océanique breton — une humidité régulière,
              des températures douces et un ensoleillement suffisant — qui favorise un développement
              lent et une concentration optimale en cannabinoïdes.
            </p>
            <p>
              La rotation des cultures, l&apos;utilisation de compost naturel et le désherbage mécanique
              remplacent les intrants chimiques. Le résultat : un chanvre plus résistant, des arômes
              plus complexes et un profil terpénique riche. Après récolte, le séchage se fait à basse
              température pour préserver les molécules fragiles. Chaque lot est ensuite envoyé en
              analyse laboratoire avant mise en vente.
            </p>
            <p>
              Cette approche demande plus de temps et de soin qu&apos;une culture conventionnelle.
              Mais c&apos;est précisément ce qui distingue un <strong>CBD naturel</strong> d&apos;un
              CBD produit en masse. Vous achetez un produit dont vous pouvez retracer chaque étape,
              du semis à l&apos;expédition.
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
              <strong>CBD naturel</strong> : issu de chanvre cultivé sans pesticide ni engrais chimique,
              avec une transformation douce qui préserve le profil moléculaire complet. C&apos;est
              l&apos;approche que nous privilégions chez Les Chanvriers Bretons.
            </p>
            <p>
              <strong>CBD bio</strong> : un CBD qui répond aux critères de la certification biologique
              européenne (AB ou équivalent). La certification bio implique des contrôles externes
              réguliers. En France, la filière chanvre CBD bio est encore en structuration. Nos
              pratiques agricoles sont alignées sur les exigences du bio, même si la certification
              formelle suit son propre calendrier réglementaire.
            </p>
            <p>
              <strong>CBD de synthèse</strong> : fabriqué en laboratoire par synthèse chimique.
              Il reproduit la molécule de CBD mais sans les terpènes, flavonoïdes et cannabinoïdes
              mineurs présents dans le plant. L&apos;effet d&apos;entourage est absent. Les risques
              de résidus chimiques sont plus élevés et la traçabilité souvent opaque.
            </p>
            <p>
              En résumé, le CBD naturel breton offre le meilleur compromis entre pureté, efficacité,
              traçabilité et respect de l&apos;environnement.
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

        {/* CTA boutique */}
        <div className="cartoon-border mt-8 bg-yellow p-6 text-center">
          <h2 className="mb-4 text-2xl font-display text-ink">Découvrir notre CBD naturel breton</h2>
          <p className="mb-6 text-charcoal">
            Parcourez la boutique et choisissez le format qui vous convient. Fleurs, huiles, résines,
            tisanes — tout est cultivé ou sélectionné avec la même exigence de naturalité.
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
            nos pages locales pour chaque ville bretonne avec livraison rapide.
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

        {/* Bloc SEO de clôture */}
        <div className="cartoon-border mt-8 space-y-3 bg-cream p-6 text-sm text-charcoal">
          <p>
            <strong>CBD naturel breton direct producteur :</strong> fleurs de CBD cultivées
            sans pesticide, huiles full spectrum extraites en douceur, résines artisanales
            et tisanes chanvre composées à la main en Bretagne.
          </p>
          <p>
            <strong>Achat CBD naturel en circuit court :</strong> pas d&apos;intermédiaire entre
            le producteur et vous. Prix producteur, traçabilité complète, analyses laboratoire
            pour chaque lot.
          </p>
          <p>
            <strong>Livraison CBD naturel France :</strong> expédition rapide depuis la Bretagne.
            Livraison à domicile ou en point relais Mondial Relay dans toute la France métropolitaine.
          </p>
        </div>
      </div>
    </section>
  );
}
