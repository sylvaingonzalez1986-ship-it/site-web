# Mesure du parcours boutique

La prévisualisation locale couvre trois événements. Elle utilise l’accord « Cookies analytiques » du site et diffuse les résultats dans un événement DOM `shop:measurement-preview` sur la page courante. Ce mode ne stocke aucun événement et ne transmet aucune donnée à Vercel.

| Événement | Déclenchement | Propriétés |
| --- | --- | --- |
| `shop_card_impression` | Titre et prix visibles chacun à au moins 50 % pendant une seconde consécutive. Une sortie du seuil, un document masqué ou une fenêtre modale par-dessus la carte redémarre le délai. Une seule impression par produit et par vue de liste, y compris après rerendu. | Identifiant produit, surface, position et sélection du Marché si applicable. |
| `shop_product_open` | Activation d’un lien vers la fiche depuis le titre, « Voir », le format ou les avis. | Même contexte de liste, plus le lien utilisé. |
| `shop_cart_add_success` | Confirmation de la mutation du panier depuis une carte ou la fiche. | Identifiants produit et variante, surface. Contexte de liste lorsqu’il existe. |

Le navigateur ne joint ni URL ni identifiant de visite, de reprise ou de commande à ces événements. Le filtre de Vercel Analytics masque aussi le paramètre `resume` dans l’URL des événements existants. Le filtre d’URL couvre les champs exposés par le SDK. Les liens newsletter sont exclus.

## Essai local

Utiliser une instance de développement arrêtée avant de la relancer, afin de conserver un seul processus Next.js pour le répertoire de travail.

```powershell
$env:NEXT_PUBLIC_SHOP_MEASUREMENT_PREVIEW = "1"
npm run dev -- --hostname 127.0.0.1
```

Ouvrir le site sur `localhost` ou `127.0.0.1`, puis ajouter un écouteur dans les outils de développement avant d’accorder l’option « Cookies analytiques ».

```js
window.addEventListener("shop:measurement-preview", ({ detail }) => console.table(detail));
```

Vérifier l’absence d’événements avant le consentement. Faire défiler la zone titre/prix, ouvrir une fiche, ajouter un format disponible et essayer un ajout qui dépasse le stock. Revenir à la liste et changer un filtre. La prévisualisation s’arrête au retrait du consentement. Le mode est réservé au développement sur l’adresse de bouclage. L’instance locale reprend ses réglages habituels après suppression de la variable.

Lors de la recette sur une page de test isolée dans Chrome (390 × 500), les modules de mesure et le cookie de consentement du site ont produit deux impressions pour deux sélections, une ouverture et un ajout de variante. Avant l’accord, après son retrait et pendant les interruptions de visibilité simulées, aucune émission. Le rerendu n’a pas produit de doublon. Le navigateur n’a tenté aucune requête externe.

## Coût et activation

La grille Vercel du 25 août 2026 inclut 50 000 événements mensuels sur Hobby, avec les événements personnalisés réservés aux offres Pro et Enterprise. Pro facture 0,03 USD par millier d’événements collectés sous réserve du crédit mutualisé et accepte deux propriétés par événement. Plus coûte 10 USD par mois et porte cette limite à huit. Les vues et événements de tous les projets de l’équipe comptent dans le même usage. [Tarifs et limites Vercel](https://vercel.com/docs/analytics/limits-and-pricing) · [Événements personnalisés](https://vercel.com/docs/analytics/custom-events)

Le plafond actuel pour ces trois événements est de zéro envoi. Avant une activation, vérifier le plan et le crédit réellement disponible à l’échelle de l’équipe, ajouter le volume maximal du nouveau lot au trafic existant du cycle et valider une projection du coût nul pour tout le cycle. Sur Pro, choisir au plus deux propriétés par événement ou vérifier qu’une extension compatible est déjà couverte. Conserver la catégorie « Cookies analytiques » et vérifier la charge utile avant un essai autorisé. Un plafond par visite dans le navigateur réduit le trafic. Un plafond réel de facturation exige un contrôle global du plan ou du collecteur. Les notifications Vercel seules servent à signaler le dépassement.

Pour interpréter les mesures, comparer les ouvertures aux impressions qualifiées d’un même produit et d’une même surface. Une estimation de conversion demanderait un dénominateur de visites ou de tentatives éligibles et des paiements confirmés attribuables à la même population.
