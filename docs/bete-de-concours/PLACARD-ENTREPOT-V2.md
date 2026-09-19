# Entrepôt — composition et illustrations V2

Révision du 19 septembre 2026.

## Résultat

L'entrepôt conserve les treize emplacements et leurs interactions, dans un décor illustré panoramique de 1774×887 pixels. La zone de culture occupe la gauche, les deux appareils de table reposent sur le même établi, les machines au sol disposent de postes distincts, et le passage à droite mène à la pièce séchoir.

La navigation comporte trois activités : Cultiver, Transformer et Services. Sur mobile, la sélection conserve la position verticale dans l'atelier ; les boutons Voir le détail et Retour à l'entrepôt permettent de rejoindre explicitement le panneau. Une vue d'ensemble complète le décor agrandi et son déplacement horizontal.

## Proportions et placement

Les objets utilisent leur ratio intrinsèque, sans étirement. Les coordonnées de KqWarehouseScene sont des centres horizontaux et des ancrages bas, avec une échelle de référence d'environ 20% de la hauteur du décor par mètre à l'arrière et 24% au premier plan. Les supports et pompes font partie de la silhouette correspondante.

- Tente droite : environ 1,8 m au départ, 2 m pour la tente renforcée.
- Tambour sous capot et presse compacte : sur le plateau, à 48,8% de la hauteur.
- Séparateur statique : appareil vertical sur roues, presque aussi haut que la tente.
- Cuve inox, tamis circulaires et lyophilisateur : au sol sur leurs supports, sans bloquer leurs voisins.
- Lyophilisateur : porte circulaire et pompe externe ; chariot bas.
- Caméra et contrôleur : petits éléments muraux, également accessibles par la navigation.
- Pièce séchoir : rails à l'intérieur de la porte existante ; densité augmentée à partir du niveau 5.
- Les niveaux des autres machines n'agrandissent pas arbitrairement leur modèle.

Il s'agit d'une mise à l'échelle visuelle cohérente, pas d'un plan industriel coté. Les dimensions incomplètes du fabricant, les supports et les différences de perspective imposent des estimations. Voir [les références et leurs limites](PLACARD-ENTREPOT-REFERENCES-V2.md).

## Assets et génération

Les dix-neuf images finales et leurs dimensions sont enregistrées dans public/placard/warehouse-v2/. Le décor est room.webp ; les dix-huit illustrations d'équipement sont détourées avec alpha.

Génération avec l'outil intégré image_gen : un décor, trois planches de six objets, puis un passage de détourage. Les [prompts exacts](warehouse-v2-prompts.json) sont conservés. L'ancien décor sert uniquement de référence stylistique.

Les sources sélectionnées se trouvent localement dans output/imagegen/warehouse-v2/source/ : room.png, machines.png, grow-original.png et accessories.png. Le manifest indique les rectangles de découpe et le fichier source effectivement choisi. Le fond sombre visible dans certains aperçus des sources correspond aux canaux RGB masqués par l'alpha ; aucun fond coloré n'a été retiré approximativement.

Conditionnement reproductible avec node scripts/build-warehouse-assets.mjs une fois ces sources présentes : découpe sans redimensionner, rognage par l'alpha avec conservation des contours, marge transparente et WebP qualité 90. --dry-run vérifie sans écrire.

Les aperçus du hall et de l'essai guidé utilisent également le nouveau décor.

## Validation

- TypeScript sans émission et ESLint ciblé.
- 25 tests existants liés aux équipements et à l'inventaire.
- Audit navigateur : node scripts/audit-placard-warehouse.mjs, avec WAREHOUSE_AUDIT_OUTPUT pour choisir le dossier de captures.
- Audit validé sur 320, 390, 768, 844 et 1440 pixels ; 26 contrôles de sélection et vues d’ensemble sur 320/390 pixels.
- Captures avant : output/warehouse-before/.
- Captures après : output/warehouse-after-v2/.

Aucune migration de données n'est nécessaire pour cette refonte visuelle.
