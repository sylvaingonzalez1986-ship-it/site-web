import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd, FaqJsonLd, ProductListJsonLd, WebPageJsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { FlowerPriceComparison } from "@/components/seo/FlowerPriceComparison";
import { formatEuro, getAffordableProducts, getFlowerPriceComparison } from "@/lib/product-discovery";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getOwnProducer, resolveProductProducer } from "@/lib/own-producer";
import { getSiteUrl } from "@/lib/site-url";
import type { Producer } from "@/types/store";

const PAGE_SLUG = "cbd-pas-cher";

const FAQ_ITEMS = [
  { question: "Où acheter du CBD pas cher et de qualité ?", answer: "Privilégiez un vendeur qui affiche clairement l'origine, la composition, le prix et les analyses de ses produits. Le circuit court permet de proposer un CBD à prix accessible sans supprimer les contrôles de qualité." },
  { question: "Pourquoi votre CBD est-il proposé à prix juste ?", answer: "Notre modèle en circuit court limite les intermédiaires entre producteurs et clients. Nous privilégions des prix lisibles, des formats variés et des promotions ponctuelles plutôt qu'une qualité artificiellement gonflée par le marketing." },
  { question: "CBD pas cher signifie-t-il CBD de mauvaise qualité ?", answer: "Non. Un petit prix peut venir du format, du mode de culture ou d'un circuit de distribution plus court. Vérifiez toujours la traçabilité, le taux de THC réglementaire, la composition et les analyses disponibles." },
  { question: "Quels produits CBD sont les moins chers ?", answer: "La sélection classe les références en stock selon le prix de leur format achetable le moins cher, hors accessoires et frais de livraison. Le tableau des fleurs compare séparément le prix au gramme, avec le conditionnement correspondant. Les prix sont calculés à partir du catalogue actuel." },
  { question: "Comment calculer le prix au gramme d’une fleur CBD ?", answer: "Divisez le prix du conditionnement par son poids en grammes. Par exemple, un sachet de 5 g à 15 € revient à 3 €/g, hors livraison. Comparez aussi le montant total à payer : le meilleur prix au gramme ne correspond pas toujours au plus petit budget." },
  { question: "Pourquoi certaines fleurs CBD coûtent-elles moins cher ?", answer: "Le format, la taille des têtes, le mode de culture et les coûts de distribution peuvent influer sur le prix. Les small buds désignent de petites têtes : leur taille ne permet pas de conclure à leur composition. Comparez les informations du lot et le producteur, sans déduire la qualité du prix seul." },
  { question: "Livrez-vous le CBD pas cher partout en France ?", answer: "Oui, les produits disponibles sur notre boutique peuvent être expédiés en France métropolitaine, à domicile ou en point relais selon les options proposées lors de la commande." },
];

const baseMetadata: Metadata = {
  title: "CBD pas cher : prix au gramme et produits en stock",
  description: "Comparez le CBD pas cher : fleurs au prix par gramme, formats en stock et producteurs identifiés. Prix TTC, hors livraison, issus du catalogue actuel.",
  alternates: { canonical: `https://www.leschanvriersbretons.com/${PAGE_SLUG}` },
  keywords: ["cbd pas cher", "cbd pas cher france", "acheter cbd pas cher", "fleur cbd pas cher", "e-liquide cbd", "cbd naturel pas cher", "cbd prix producteur"],
  openGraph: {
    title: "CBD Pas Cher et Naturel à Prix Juste | Les Chanvriers Bretons",
    description: "Découvrez une sélection de CBD à prix accessible, classée du moins cher au plus cher, en circuit court et avec une origine transparente.",
    url: `https://www.leschanvriersbretons.com/${PAGE_SLUG}`,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "CBD pas cher et naturel à prix juste" }],
  },
  twitter: { card: "summary_large_image", title: "CBD Pas Cher et Naturel à Prix Juste", description: "Références CBD disponibles classées par prix croissant, en circuit court.", images: ["/og-default.png"] },
};

export async function generateMetadata(): Promise<Metadata> {
  const store = await readPublicStoreByBackend();
  const cheapestFlower = getFlowerPriceComparison(store.products, 1)[0];
  const title = cheapestFlower
    ? `CBD pas cher : fleurs dès ${formatEuro(cheapestFlower.format.pricePerGram)}/g`
    : "CBD pas cher : prix et formats disponibles";
  const description = cheapestFlower
    ? `Fleurs CBD dès ${formatEuro(cheapestFlower.format.pricePerGram)}/g : comparez les prix TTC, les formats en stock et les producteurs. Hors livraison. Catalogue actualisé.`
    : "Comparez les formats et prix du CBD dans notre catalogue. Les sélections affichent les produits en stock, leur origine et les analyses disponibles.";
  return { ...baseMetadata, title, description, openGraph: { ...baseMetadata.openGraph, title, description }, twitter: { ...baseMetadata.twitter, title, description } };
}

export default async function CbdPasCherPage() {
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/${PAGE_SLUG}`;
  const store = await readPublicStoreByBackend();
  const affordableSelection = getAffordableProducts(store.products);
  const affordableProducts = affordableSelection.map(({ product }) => product);
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
          <div className="mt-6 flex flex-wrap gap-3"><Link href="#selection" className="btn-cartoon btn-primary px-6 py-3 text-sm uppercase tracking-[0.08em]">Voir les petits prix</Link><Link href="#prix-au-gramme" className="btn-cartoon btn-secondary px-6 py-3 text-sm uppercase tracking-[0.08em]">Comparer les fleurs au gramme</Link><Link href="/cbd-naturel" className="px-2 py-3 text-sm font-bold underline">Choisir un CBD naturel</Link></div>
        </div>

        <FlowerPriceComparison products={store.products} producers={store.producers} ownProducer={ownProducer} />

        <div className="cartoon-border mt-8 bg-cream p-8">
          <h2 className="mb-4 text-3xl font-display text-ink">Comment proposer un CBD moins cher sans rogner sur l&apos;essentiel ?</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div><h3 className="font-bold text-ink">Circuit court</h3><p className="mt-2 text-sm leading-relaxed text-charcoal">Moins d&apos;intermédiaires permet de limiter les marges successives et de conserver un prix producteur cohérent.</p></div>
            <div><h3 className="font-bold text-ink">Prix transparents</h3><p className="mt-2 text-sm leading-relaxed text-charcoal">Le prix de chaque référence et les éventuelles promotions sont affichés clairement avant l&apos;ajout au panier.</p></div>
            <div><h3 className="font-bold text-ink">Qualité vérifiable</h3><p className="mt-2 text-sm leading-relaxed text-charcoal">Un prix accessible n&apos;empêche ni la traçabilité, ni le respect de la réglementation, ni les analyses disponibles.</p></div>
          </div>
        </div>

        <div id="selection" className="scroll-mt-28">
          <div className="cartoon-border mt-8 bg-yellow p-6"><h2 className="text-3xl font-display text-ink">Notre sélection CBD à petit prix</h2><p className="mt-2 text-charcoal">{affordableProducts.length ? `Les ${affordableProducts.length} références en stock les plus accessibles, classées par prix du format achetable le moins cher. Prix TTC hors livraison, sans accessoires.` : "Aucune référence en stock dans cette sélection pour le moment. Consultez la boutique pour suivre les disponibilités."}</p></div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {affordableSelection.map(({ product, format }) => <div key={product.id}><p className="mb-2 text-sm font-bold text-ink">Dès {formatEuro(format.price)} · {format.label}</p><ProductCard product={product} producer={resolveProductProducer(product, producersById, ownProducer)} addButtonLabel={store.content.boutique.addButtonLabel} lowStockThresholdGrams={store.content.boutique.lowStockThresholdGrams} /></div>)}
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
