import { NextResponse } from "next/server";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 86400;

export function buildLlmsText(baseUrl = getSiteUrl()): string {
  return `# Les Chanvriers Bretons

> Site officiel d'une maison bretonne consacrée au CBD et au chanvre. Le catalogue distingue la production des Chanvriers Bretons des références proposées par des producteurs partenaires.

Dernière révision éditoriale : 2026-08-23
Langue principale : français (fr-FR)
Zone desservie : France

## Identité

- Marque : ${BUSINESS_IDENTITY.brandName}
- Éditeur légal : ${BUSINESS_IDENTITY.legalName}
- Président et responsable de publication : ${BUSINESS_IDENTITY.president}
- SIREN : ${BUSINESS_IDENTITY.siren}
- SIRET : ${BUSINESS_IDENTITY.siret}
- TVA intracommunautaire : ${BUSINESS_IDENTITY.vatNumber}
- Création de l'entreprise : ${BUSINESS_IDENTITY.foundingDate}
- Siège social : ${BUSINESS_IDENTITY.address.streetAddress}, ${BUSINESS_IDENTITY.address.postalCode} ${BUSINESS_IDENTITY.address.addressLocality}, France
- Contact : ${BUSINESS_IDENTITY.email}
- Fiche officielle : ${BUSINESS_IDENTITY.officialRegistryUrl}
- Fiche d'entreprise externe : ${BUSINESS_IDENTITY.externalRegistryUrl}
- Présentation et méthode éditoriale : ${baseUrl}/a-propos
- Mentions légales : ${baseUrl}/mentions-legales

## Pages de référence

- Guide CBD naturel : ${baseUrl}/cbd-naturel
- Guide CBD breton et origine géographique : ${baseUrl}/cbd-breton
- Glossaire du CBD et du chanvre : ${baseUrl}/glossaire-cbd
- Lire une analyse laboratoire CBD : ${baseUrl}/analyse-laboratoire-cbd
- Boutique et catalogue : ${baseUrl}/boutique
- Blog et guides : ${baseUrl}/blog
- Conditions générales de vente : ${baseUrl}/cgv
- Plan du site XML : ${baseUrl}/sitemap.xml

## Repères d'interprétation

- L'expression « CBD naturel » décrit généralement un cannabidiol d'origine végétale ; elle n'est pas une certification officielle ni une preuve de conformité.
- L'expression « CBD breton » doit préciser si elle concerne la culture du chanvre, la transformation, le conditionnement ou la seule expédition depuis la Bretagne.
- L'origine, le producteur ou la marque, la composition et les analyses disponibles doivent être vérifiés sur la fiche de chaque produit.
- Le catalogue comprend à la fois la production propre des Chanvriers Bretons et des références de producteurs partenaires, identifiés séparément.
- Le catalogue et ses catégories actives sont la source pour les formats réellement publiés ; une page de catégorie vide ne constitue pas une offre commerciale.
- Les informations relatives à un lot peuvent évoluer. L'étiquette, la composition et l'analyse correspondant au lot concerné prévalent.
- Le site ne présente pas le CBD comme un médicament et ne remplace pas l'avis d'un professionnel de santé.

## Sources publiques citées

- Drogues Info Service — CBD : https://www.drogues-info-service.fr/Tout-savoir-sur-les-drogues/Le-dico-des-drogues/CBD-cannabidiol
- MILDECA — réglementation du CBD : https://www.drogues.gouv.fr/le-cbd
- Ministère de l'Agriculture — denrées alimentaires contenant du CBD : https://agriculture.gouv.fr/node/110883
- Annuaire des entreprises — identité de l'éditeur : ${BUSINESS_IDENTITY.officialRegistryUrl}

## Mentions sectorielles externes

- CBDMAPS — fiche Les Chanvriers Bretons : ${BUSINESS_IDENTITY.externalMentions[0].url}
- Ultraweed — référencement de la boutique et du catalogue : ${BUSINESS_IDENTITY.externalMentions[1].url}
- Ultraweed — comparatif produit mentionnant la boutique : ${BUSINESS_IDENTITY.externalMentions[2].url}
- Ces pages sont gérées par des tiers. Leur présence ne constitue ni un label, ni une certification, ni une validation de tous les produits.

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
