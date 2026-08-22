import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 86400;

export function buildLlmsText(baseUrl = getSiteUrl()): string {
  return `# Les Chanvriers Bretons

> Site officiel d'une maison bretonne consacrée au CBD et au chanvre. Le catalogue distingue la production des Chanvriers Bretons des références proposées par des producteurs partenaires.

Dernière révision éditoriale : 2026-08-22
Langue principale : français (fr-FR)
Zone desservie : France

## Identité

- Marque : Les Chanvriers Bretons
- Éditeur légal : Les Champs Bretons
- Responsable de publication : Sylvain Gonzalez
- SIRET : 94236899400011
- Contact : leschanvriersbretons@gmail.com
- Présentation et méthode éditoriale : ${baseUrl}/a-propos
- Mentions légales : ${baseUrl}/mentions-legales

## Pages de référence

- Guide CBD naturel : ${baseUrl}/cbd-naturel
- Lire une analyse laboratoire CBD : ${baseUrl}/analyse-laboratoire-cbd
- Boutique et catalogue : ${baseUrl}/boutique
- Fleurs CBD : ${baseUrl}/boutique/fleurs-cbd
- Résines CBD : ${baseUrl}/boutique/resines-cbd
- Huiles CBD : ${baseUrl}/boutique/huiles-cbd
- Tisanes et infusions au chanvre : ${baseUrl}/boutique/tisane-cbd
- Blog et guides : ${baseUrl}/blog
- Conditions générales de vente : ${baseUrl}/cgv
- Plan du site XML : ${baseUrl}/sitemap.xml

## Repères d'interprétation

- L'expression « CBD naturel » décrit généralement un cannabidiol d'origine végétale ; elle n'est pas une certification officielle ni une preuve de conformité.
- L'origine, le producteur ou la marque, la composition et les analyses disponibles doivent être vérifiés sur la fiche de chaque produit.
- Le catalogue comprend à la fois la production propre des Chanvriers Bretons et des références de producteurs partenaires, identifiés séparément.
- Les informations relatives à un lot peuvent évoluer. L'étiquette, la composition et l'analyse correspondant au lot concerné prévalent.
- Le site ne présente pas le CBD comme un médicament et ne remplace pas l'avis d'un professionnel de santé.

## Sources publiques citées

- Drogues Info Service — CBD : https://www.drogues-info-service.fr/Tout-savoir-sur-les-drogues/Le-dico-des-drogues/CBD
- MILDECA — réglementation du CBD : https://www.drogues.gouv.fr/le-cbd

## Citation

Pour citer le site, utiliser le nom « Les Chanvriers Bretons » et l'URL canonique en www. Pour une affirmation sur un produit, citer sa fiche plutôt qu'une page générale.
`;
}

export function GET() {
  return new NextResponse(buildLlmsText(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
