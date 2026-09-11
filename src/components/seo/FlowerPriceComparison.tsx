import Link from "next/link";
import { PRODUCT_CULTURE_LABELS, type Product } from "@/data/products";
import { formatEuro, getFlowerPriceComparison } from "@/lib/product-discovery";
import { resolveProductProducer } from "@/lib/own-producer";
import type { Producer } from "@/types/store";

export function FlowerPriceComparison({ products, producers, ownProducer }: {
  products: Product[];
  producers: Producer[];
  ownProducer: Producer;
}) {
  const rows = getFlowerPriceComparison(products);
  if (!rows.length) return null;
  const producersById = new Map(producers.map(producer => [producer.id, producer]));
  return (
    <section id="prix-au-gramme" className="cartoon-border mt-8 scroll-mt-28 bg-white p-5 sm:p-8" aria-labelledby="prix-fleurs-title" data-price-comparison>
      <h2 id="prix-fleurs-title" className="font-display text-3xl text-ink">Fleurs CBD pas chères : comparer le prix au gramme</h2>
      <p className="mt-3 max-w-3xl text-charcoal">Pour chaque fleur en stock, voici le format au prix par gramme le plus bas. Le prix du format est le montant à payer pour ce conditionnement, hors livraison. Un plus grand format peut coûter moins cher au gramme tout en demandant un budget plus élevé.</p>
      <div className="mt-5 overflow-x-auto" role="region" aria-label="Comparatif des fleurs en stock" tabIndex={0}>
        <table className="w-full min-w-[620px] table-fixed text-left text-sm text-ink">
          <caption className="mb-3 text-left text-xs text-charcoal">Prix TTC du catalogue, triés par €/g croissant. Formats indisponibles et poids non renseignés exclus. Faites défiler le tableau horizontalement sur mobile.</caption>
          <thead className="border-b-2 border-ink bg-mint"><tr>
            <th scope="col" className="w-[145px] p-3">Fleur / producteur</th><th scope="col" className="w-[105px] p-3">Prix / g</th><th scope="col" className="p-3">Format</th><th scope="col" className="p-3">Prix du format</th><th scope="col" className="p-3">Culture</th>
          </tr></thead>
          <tbody>{rows.map(({ product, format }) => <tr key={product.id} className="border-b border-ink/15">
            <th scope="row" className="p-3 font-normal"><Link className="font-bold underline underline-offset-4" href={`/boutique/fleurs-cbd/${product.id}`}>{product.name}</Link><span className="mt-1 block text-xs text-charcoal">{resolveProductProducer(product, producersById, ownProducer)?.name ?? "Producteur non renseigné"}</span></th>
            <td className="p-3 whitespace-nowrap font-bold">{formatEuro(format.pricePerGram)} / g</td><td className="p-3 whitespace-nowrap">{format.label}</td><td className="p-3 whitespace-nowrap">{formatEuro(format.price)}</td>
            <td className="p-3">{product.cultureMode ? PRODUCT_CULTURE_LABELS[product.cultureMode] : "Non renseignée"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-charcoal">Le prix ne renseigne pas à lui seul sur la composition. Consultez l’origine et les <Link href="/analyse-laboratoire-cbd" className="font-bold underline">analyses disponibles</Link> sur chaque fiche. <Link href="/boutique/fleurs-cbd" className="font-bold underline">Voir toutes les fleurs CBD</Link>.</p>
    </section>
  );
}
