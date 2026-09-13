# Sécurité et frais du compagnon

Deux alternatives dans l’emplacement Sécurité : caméra de surveillance (69,99 €,
12 W) et chien de garde (1 000 €, régularité +8 %, aucune électricité). Toutes deux
protègent intégralement le poids contre l’incident de vol existant. Les bonus ne se
cumulent pas entre ces deux choix.

La clôture électrique est retirée par `20260913000800_kq_retire_electric_fence.sql` :
catalogue désactivé et emplacement libéré. L’application la masque dans l’inventaire
et refuse achat, installation et amélioration. Son ancienne définition et son image
restent des archives pour lire les parties et factures déjà enregistrées. Les informations
de création ci-dessous décrivent la version initiale, avant ce retrait.

Le chien possédé coûte 8 € par culture terminée et 40 € supplémentaires tous les
10 cycles terminés depuis son adoption. Le propriétaire reste responsable des soins
même si le chien n’est pas la protection active. Ni le temps hors ligne ni les abandons
ne sont facturés. Un achat pendant une partie entraîne les soins à sa prochaine récolte.
Le serveur déduit les soins disponibles dans la caisse, garde le solde restant dans
la facture du cycle et préserve la règle existante de règlement par les ventes (50 %
au maximum) ou paiement manuel. Aucun portefeuille négatif, aucun blocage de culture.

La migration `20260913000700_kq_security_equipment_care.sql` ajoute les deux articles
et un détail `dog_care` aux factures. Le verrou du portefeuille sérialise les fins de
cultures ; la clé unique de facture empêche les doubles débits. Le devis énergétique
reste immuable et conserve uniquement l’électricité. Le total de facture inclut les
soins ; les champs API historiques `electricityPaidCents` représentent désormais les
charges réglées. Les libellés de vente et l’onglet du HUD sont adaptés en conséquence.
La nouvelle illustration de caméra utilise v3. Le parseur accepte encore son ancien
nom dans les devis sauvegardés, sans accepter un montant ou appareil modifié.

## Inspirations

La participation de 300 € pour l’adoption d’un chien adulte est documentée dans le
[barème SPA de Mulhouse](https://www.spa-mulhouse.fr/app/data/userfiles/participation%20aux%20frais%20dadoption%20chiens.pdf).
Le prix du chien dans le jeu est fixé à 1 000 € à la demande du créateur.
Le principe de clôture et électrificateur s’inspire du
[Gallagher M50](https://www.gallagher.eu/fr_fr/m50-electrificateur-sur-secteur-0-5-j-230-v/038332).
Les coûts de nourriture et de vétérinaire, les cycles, les statistiques, la puissance
de 35 W et le prix du kit complet sont des paramètres de jeu, pas des tarifs ni
caractéristiques réelles attribuées à ces organismes. La fiche boutique le précise.

## Illustrations

Outil intégré `image_gen`, sans CLI. Images générées puis converties en WebP 1200 × 1200
avec Sharp, qualité 84, sans changer les sujets. Fichiers dans `public/app/kanab-quest/equipment/` :

- `equipment-SECURITY-CAMERA-hero-v3.webp`
- `equipment-SECURITY-DOG-hero-v1.webp`
- `equipment-SECURITY-FENCE-hero-v1.webp`

Prompts utilisés :

1. Edit this game equipment illustration. Replace the damaged security camera with a pristine modern security camera, cream shell, turquoise mounting bracket, black lens with clear blue glass and infrared LEDs. No dents, stitches, scratches or repairs. Keep the square composition, bold black outlines, retro comic screenprint texture and teal/cream/golden yellow starburst backdrop matching the arena game. Camera should read immediately at thumbnail size. No text, logos or border. Save the generated image.
2. Square game equipment illustration for a French retro comic arena shop. A healthy confident friendly watchdog, sturdy brown and black shepherd dog sitting alert beside its cream food bowl and a small turquoise doghouse, centered full body. Bold black outlines, halftone screenprint texture, dark teal background with cream and golden yellow radial starburst. Match collectible equipment illustration, clear silhouette at thumbnail size, charming gaming style, no realistic photograph, no text, no collar spikes, no aggression, no logos. Single illustration.
3. Square retro comic game equipment illustration matching a French arena shop: a short freestanding electric security fence with three sturdy dark teal posts and horizontal wires with cream insulators, a compact turquoise electric energizer box attached to the front post and a small yellow plate bearing only a black lightning bolt symbol. Whole object centered in three-quarter view with margins. Bold black outlines, halftone screenprint texture, dark teal background with cream and golden yellow radial starburst. Charming collectible equipment illustration clearly legible at thumbnail size. No words, numbers, logos, barbed wire, characters or sparks. Single illustration.

## Vérification

`scripts/test-placard-security-care.mjs` exécute la migration et les vraies fonctions
de facturation/règlement dans PostgreSQL local PGlite : échéances 10/20, rejeu,
trésorerie insuffisante, isolation entre joueurs, annulation transactionnelle et
anciennes parties. Aucun accès à la base distante.

Validation : 1 149 tests sur 212 fichiers avec couverture, TypeScript et ESLint,
build de production réussi. `scripts/audit-placard-security.mjs` vérifie 12 vues
réelles du panneau (320, 390, 768 et 1440 px), le changement de mode, la trésorerie
insuffisante et le rejeu du règlement. Aucun débordement ni erreur JavaScript.
La migration est préparée et testée localement ; elle n’est pas appliquée en base distante.
