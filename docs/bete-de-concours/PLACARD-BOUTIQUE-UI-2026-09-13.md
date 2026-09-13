# La Botte : boutique intégrée au décor

Le comptoir remplace les trois objets flottants et le bandeau du catalogue. Les zones interactives suivent les objets dessinés : récompenses de duel, packs possédés, caisse et livre du matériel. Les étiquettes affichent les quantités, le coût et les états indisponibles. Les coordonnées sont adaptées à deux compositions distinctes, paysage et portrait, sans recadrer les objets hors écran.

Sylvain conserve le visage, la casquette et la tenue de `booster-shop-interior-v4.webp`, référence utilisée pour les nouvelles illustrations. Les trois images WebP pèsent environ 744 Kio au total ; le navigateur choisit une seule composition du comptoir. Le décor du matériel est chargé à l'ouverture du rayon.

Le rayon matériel présente les machines sur des étagères, avec leurs avantages et leurs prix en euros sur des étiquettes. Les catégories prennent la forme de panneaux. Les filtres se déplient à la demande et le panier devient une caisse escamotable, y compris sur ordinateur. L'ordinateur et l'abonnement sont regroupés dans « Vente en ligne ».

Les contrats des API et les règles de prix, de possession et d'installation restent identiques. Un verrou empêche le double déclenchement des achats et ouvertures de packs. Le clavier reste dans la fenêtre active ; Échap ferme d'abord la confirmation, la fiche ou le panier. Le focus du panier ne fait plus défiler horizontalement le décor pendant son animation.

## Vérification

- `node scripts/audit-placard-shop.mjs` : composants réels et CSS du jeu, API simulées, accès distant bloqué. Formats 320×740, 390×844, 768×1024, 1440×1000 et 844×390. Achat et ouverture de packs, filtres, ordinateur, panier, achat du matériel, sortie au clavier, états sans points, sans packs, erreur d'achat et collection fermée. Aucun débordement de page ni erreur JavaScript. Quatre zones de comptoir d'au moins 44 px, toutes visibles.
- 21 tests existants boutique et matériel réussis ; TypeScript et ESLint réussis.
- Compilation Next terminée avec code 0. Le préchargement du cache public Supabase signale des erreurs réseau dans l'environnement restreint ; les transactions de l'audit sont exclusivement simulées.
- Contrôle des traces serveur : 207 routes, aucune au-dessus du budget ; maximum 102,2 Mio.

Captures et rapport local : `output/placard-shop/` (ignoré par Git).
