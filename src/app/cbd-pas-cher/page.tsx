import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd, FaqJsonLd, ProductListJsonLd, WebPageJsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { dedupeProducts } from "@/lib/product-dedup";
import { getOwnProducer, resolveProductProducer } from "@/lib/own-producer";
import { getSiteUrl } from "@/lib/site-url";
import type { Producer } from "@/types/store";

const PAGE_SLUG = "cbd-pas-cher";

const FAQ_ITEMS = [
  { question: "Où acheter du CBD pas cher et de qualité ?", answer: "Privilégiez un vendeur qui affiche clairement l'origine, la composition, le prix et les analyses de ses produits. Le circuit court permet de proposer un CBD à prix accessible sans supprimer les contrôles de qualité." },
  { question: "Pourquoi votre CBD est-il proposé à prix juste ?", answer: "Notre modèle en circuit court limite les intermédiaires entre producteurs et clients. Nous privilégions des prix lisibles, des formats variés et des promotions ponctuelles plutôt qu'une qualité artificiellement gonflée par le marketing." },
  { question: "CBD pas cher signifie-t-il CBD de mauvaise qualité ?", answer: "Non. Un petit prix peut venir du format, du mode de culture ou d'un circuit de distribution plus court. Vérifiez toujours la traçabilité, le taux de THC réglementaire, la composition et les analyses disponibles." },
  { question: "Quels produits CBD sont les moins chers ?", answer: "Les petits conditionnements, certaines fleurs cultivées en extérieur et les infusions figurent souvent parmi les choix les plus accessibles. La sélection affichée sur cette page est automatiquement classée par prix croissant." },
  { question: "Livrez-vous le CBD pas cher partout en France ?", answer: "Oui, les produits disponibles sur notre boutique peuvent être expédiés en France métropolitaine, à domicile ou en point relais selon les options proposées lors de la commande." },
];

export const metadata: Metadata = {
  title: "CBD Pas Cher et Naturel | Prix Justes Direct Producteur",
  description: "CBD pas cher et naturel en circuit court : fleurs, huiles, résines et tisanes à prix accessibles. Producteurs sélectionnés, traçabilité et livraison en France.",
  alternates: { canonical: `https://www.leschanvriersbretons.com/${PAGE_SLUG}` },
  keywords: ["cbd pas cher", "cbd pas cher france", "acheter cbd pas cher", "fleur cbd pas cher", "huile cbd pas cher", "cbd naturel pas cher", "cbd prix producteur"],
  openGraph: {
    title: "CBD Pas Cher et Naturel à Prix Juste | Les Chanvriers Bretons",
    description: "Découvrez une sélection de CBD à prix accessible, classée du moins cher au plus cher, en circuit court et avec une origine transparente.",
    url: `https://www.leschanvriersbretons.com/${PAGE_SLUG}`,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "CBD pas cher et naturel à prix juste" }],
  },
  twitter: { card: "summary_large_image", title: "CBD Pas Cher et Naturel à Prix Juste", description: "Fleurs, huiles, résines et tisanes CBD à prix accessibles en circuit court.", images: ["/og-default.png"] },
};

export default async function CbdPasCherPage() {
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/${PAGE_SLUG}`;
  const store = await readPublicStoreByBackend();
  const affordableProducts = dedupeProducts(store.products).filter((product) => product.price > 0).sort((a, b) => a.price - b.price).slice(0, 9);
  const ownProducer = getOwnProducer(store.content.boutique);
  const producersById = new Map<string, Producer>(store.producers.map((producer) => [producer.id, producer]));

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd items={[{ name: "Accueil", url: baseUrl }, { name: "CBD pas cher", url: pageUrl }]} />
      <WebPageJsonLd
        name="CBD pas cher et naturel au prix juste"
        description="Comparer les prix et les formats de CBD naturel avec une origine, une traçabilité et des analyses clairement présentées."
        url={pageUrl}
        about={["CBD pas cher", "Prix du CBD", "CBD naturel", "Circuit court breton"]}
      />
      <FaqJsonLd questions={FAQ_ITEMS} />
      <ProductListJsonLd products={affordableProducts} producers={store.producers} />
      <div className="retro-container">
        <div className="cartoon-border bg-cream p-8">
          <nav className="mb-4 text-sm text-charcoal" aria-label="Fil d'Ariane"><Link href="/" className="underline hover:text-ink">Accueil</Link>{" > "}<span className="font-bold text-ink">CBD pas cher</span></nav>
          <h1 className="section-title text-ink">CBD pas cher, naturel et au prix juste</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-charcoal">Acheter du <strong>CBD pas cher</strong> ne devrait pas obliger à renoncer à la traçabilité. Notre sélection réunit des produits aux prix accessibles, issus de notre production bretonne ou de producteurs partenaires choisis avec soin. Les références sont classées par prix croissant.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="#selection" className="btn-cartoon btn-primary px-6 py-3 text-sm uppercase tracking-[0.08em]">Voir les petits prix</Link><Link href="/cbd-naturel" className="btn-cartoon btn-secondary px-6 py-3 text-sm uppercase tracking-[0.08em]">Comprendre le CBD naturel</Link></div>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-4 text-3xl font-display text-ink">Comment proposer un CBD moins cher sans rogner sur l&apos;essentiel ?</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div><h3 className="font-bold text-ink">Circuit court</h3><p className="mt-2 text-sm leading-relaxed text-charcoal">Moins d&apos;intermédiaires permet de limiter les marges successives et de conserver un prix producteur cohérent.</p></div>
            <div><h3 className="font-bold text-ink">Prix transparents</h3><p className="mt-2 text-sm leading-relaxed text-charcoal">Le prix de chaque référence et les éventuelles promotions sont affichés clairement avant l&apos;ajout au panier.</p></div>
            <div><h3 className="font-bold text-ink">Qualité vérifiable</h3><p className="mt-2 text-sm leading-relaxed text-charcoal">Un prix accessible n&apos;empêche ni la traçabilité, ni le respect de la réglementation, ni les analyses disponibles.</p></div>
          </div>
        </div>

        <div id="selection" className="scroll-mt-28">
          <div className="cartoon-border mt-8 bg-yellow p-6"><h2 className="text-3xl font-display text-ink">Notre sélection CBD à petit prix</h2><p className="mt-2 text-charcoal">Les {affordableProducts.length} références les plus accessibles du catalogue actuel, classées du prix le plus bas au plus élevé.</p></div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {affordableProducts.map((product, index) => <ProductCard key={product.id} product={product} producer={resolveProductProducer(product, producersById, ownProducer)} addButtonLabel={store.content.boutique.addButtonLabel} lowStockThresholdGrams={store.content.boutique.lowStockThresholdGrams} imagePriority={index < 2} />)}
          </div>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-4 text-3xl font-display text-ink">Bien comparer les prix du CBD</h2>
          <div className="space-y-4 leading-relaxed text-charcoal"><p>Le prix affiché ne suffit pas toujours pour comparer deux produits. Regardez le poids ou le volume, le type de produit, son origine et son mode de culture. Pour les fleurs et résines, le prix au gramme est souvent l&apos;indicateur le plus utile.</p><p>Méfiez-vous des offres anormalement basses sans origine, composition ou analyse identifiable. Un <strong>CBD naturel pas cher</strong> reste un produit dont la provenance et la conformité doivent pouvoir être vérifiées.</p><p>Selon votre usage, un petit format permet de découvrir un produit à faible coût, tandis qu&apos;un conditionnement plus grand peut réduire le prix par gramme. Consultez chaque fiche produit pour comparer les variantes disponibles.</p></div>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-8"><h2 className="mb-6 text-3xl font-display text-ink">Questions fréquentes sur le CBD pas cher</h2><div className="space-y-5">{FAQ_ITEMS.map((item) => <div key={item.question}><h3 className="mb-2 font-bold text-ink">{item.question}</h3><p className="text-sm leading-relaxed text-charcoal">{item.answer}</p></div>)}</div></div>
        <div className="cartoon-border mt-8 bg-yellow p-6 text-center"><h2 className="text-2xl font-display text-ink">Tous nos produits CBD au même endroit</h2><p className="mx-auto mt-2 max-w-2xl text-charcoal">Comparez les catégories, les formats et les producteurs pour trouver le meilleur rapport entre votre budget et vos préférences.</p><Link href="/boutique" className="btn-cartoon btn-primary mt-5 inline-flex px-6 py-3 text-sm uppercase tracking-[0.08em]">Découvrir la boutique CBD</Link></div>
      </div>
    </section>
  );
}
