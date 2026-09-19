# Menu mobile et badges de fidélité

Le menu smartphone reprend la palette de l’Arène : vert profond, papier crème et jaune, avec une navigation numérotée et la page active mise en avant. Une boîte de dialogue native gère le focus et le fond inactif ; fermeture par bouton, Échap, lien, historique ou retour au format ordinateur. Le panier et les avantages du membre sont accessibles depuis le bas du menu. Les liens CMS et les règles de visibilité existantes sont conservés.

Seuls les cinq badges de fidélité sont redessinés : Bronze (pousse), Argent (feuille), Or (bouclier), Platine (couronne) et Diamant (gemme). Les SVG partagent une forme d’écusson, des lauriers et des repères de palier. Leur variante verrouillée porte un cadenas. Le composant existant diffuse les nouveaux visuels dans la navigation, le profil, la page fidélité et l’administration. Les seuils, remises et conditions restent ceux du système actuel.

Vérifications : `node scripts/audit-mobile-menu-badges.mjs` (composants réels, comptes et CMS simulés), `npx.cmd vitest run`, `npm.cmd run build` et ESLint sur les composants modifiés. L’audit couvre 320 px, 390 px, le paysage 667 × 390, le retour au bureau, les liens CMS longs, le focus, le panier et les variantes des cinq badges. Les captures sont dans `output/mobile-menu-badges/`.

La barre fixe du smartphone reprend aussi cette palette : fond vert profond, nom du site au centre, sans logo, Menu clair et Panier jaune, libellés visibles et cibles tactiles de 48 px. Sa hauteur et son alignement restent stables au défilement. Le compteur affiche 99+ au-delà de 99 articles, avec la quantité exacte disponible aux lecteurs d’écran. L’audit vérifie les compteurs 0/3/120, les pages avec et sans bandeau et la barre avant/après défilement.
