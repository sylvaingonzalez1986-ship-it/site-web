# Centre de missions : parcours de vérification manuelle

Implémentation du 28 septembre 2026, après validation du parcours par capture dans l’admin. Migration `20260928000200` appliquée sur le projet Supabase lié `eyowwwpdmfrulhkpvlnf`, à la demande de l’utilisateur.

## Parcours livré

- Centre commun au compte et au Placard, avec Sylvain, fond vert et cartes jaunes de l’Arène. Quatre missions par page, historique « Mes envois », accès « Tous mes défis » aux neuf défis existants.
- Le joueur joint une capture JPG/PNG/WebP (8 Mo maximum), éventuellement un lien HTTPS de publication ou de profil et un message. Une mission peut rendre la capture obligatoire. Aucun compte social à connecter.
- La preuve passe en vérification. L’admin voit le joueur, la capture privée, le lien, la version du dossier et le gain promis. Il valide, demande une correction ou refuse. Correction et refus exigent un message visible par le joueur.
- Une correction conserve le même dossier et augmente sa version ; le joueur peut garder la capture et corriger uniquement son message ou son lien. Une ancienne mission désactivée conserve son historique et les corrections déjà demandées restent possibles.
- La validation attribue le gain automatiquement. Types configurables : packs Buddies, points fidélité, packs La Botte de trois cartes, un Buddy défini par l’admin, argent virtuel du Placard. Les gains vont dans leurs collections/soldes respectifs.
- La file admin contient tous les dossiers encore ouverts et les 300 dernières décisions. Le catalogue et les réglages existants du parrainage ont leurs propres onglets.

Les nouvelles missions sont créées en brouillon par défaut. La migration prépare « Ta Fleur entre dans l’Arène », désactivée, avec un pack La Botte. Les anciennes missions et leurs acquis sont conservés. Aucune nouvelle campagne de follow ou post rémunéré n’est activée. Les captures restent des preuves à vérifier humainement : aucune détection automatique de fraude ou preuve d’identité sociale n’est annoncée.

## Garanties et permissions

`20260928000200_kq_community_mission_review.sql` réutilise le catalogue et les participations existants. Les RPC de dépôt et de revue sont exécutables uniquement par le serveur. Les participations sont lisibles, mais ne sont plus modifiables directement par les rôles de l’API ; les tables de reçus sont privées.

Au premier dépôt, titre, gain, Buddy et plafond sont figés dans le dossier. Une modification du catalogue ne change pas la récompense déjà promise. Une demande porte une clé UUID de rejeu ; une revue porte aussi la révision attendue. Les verrous et contraintes bloquent les validations répétées et la revue d’une preuve remplacée. Reçu, gain, statut et écritures de trésorerie sont inscrits dans une même transaction : une erreur annule l’ensemble.

Les fichiers sont vérifiés par décodage réel, plafonnés en poids et en pixels, réencodés en WebP et privés de leurs métadonnées. Leur emplacement dépend de l’utilisateur authentifié. Les URL de consultation sont signées et temporaires. Le serveur ne télécharge jamais le lien fourni. Les anciens liens non HTTPS ne sont pas ouverts par l’interface.

Les routes exigent la session adaptée, la même origine pour les mutations, des identifiants et montants valides, et limitent les tentatives et le volume des requêtes. Les réponses évitent les détails SQL. Un upload inutilisé après rejeu ou refus transactionnel certain est supprimé ; une erreur réseau ambiguë conserve le fichier privé pour ne pas effacer une preuve effectivement enregistrée. Les captures antérieures restent privées avec le dossier ; la suppression du compte supprime tous les fichiers de son préfixe, y compris anciennes versions et fichiers orphelins.

## Recette locale

Le test PostgreSQL utilise PGlite 0.5.8 dans les outils locaux isolés : `npm install --prefix output/reputation-test-tools --no-save @electric-sql/pglite@0.5.8`. Cette dépendance de recette n’est pas incluse dans l’application déployée.

- `node scripts/test-community-missions.mjs` : intégration PostgreSQL via PGlite, cinq types de gains, rejeu, snapshots, correction avec ou sans nouveau fichier, révision périmée, anciens dossiers, limites, rollback et droits.
- Tests Vitest des routes, de l’encodage des preuves et de la suppression du compte.
- `node scripts/audit-community-missions.mjs` : composants joueurs réels avec données locales de démonstration, 320/390/768/1440 px, clavier, erreurs, reprise, historique, correction et ancien défi La Botte.
- `node scripts/audit-admin-community-missions.mjs` : composants admin réels avec API simulée, quatre largeurs, message de correction obligatoire, clé de reprise conservée, double clic, révision, sélection Buddy et conversion des euros virtuels en centimes.
- TypeScript, ESLint ciblé et `npm run check:supabase-grants`.

Les rapports et captures sont dans `output/community-missions/` et `output/admin-community-missions/`. L’aperçu joueur (`--preview`) et l’aperçu admin (`--serve`) sont des démonstrations locales isolées ; ils n’écrivent aucune donnée réelle. La recette navigateur n’est donc pas une validation de bout en bout sur Supabase distant. PGlite utilise un seul backend PostgreSQL : les rafales testent l’unicité et le rejeu, pas la contention réelle entre connexions indépendantes.

## Mise en service et limites connues

La migration est appliquée et le contrôle CLI confirme qu’aucune migration ne reste en attente. Les 27 contrôles distants en lecture seule confirment les nouvelles signatures RPC, les colonnes, les snapshots complets, le refus de lecture des reçus privés par `service_role` et le brouillon Fleur désactivé. Les 24 dossiers approuvés et leurs 24 gains sont inchangés ; aucun dossier n’était en attente au moment de l’application. Rapports dans `output/community-missions-migration/`. Les permissions d’écriture et du rôle `authenticated` sont couvertes par les tests SQL locaux, sans invocation mutative distante ; la lecture du schéma anonyme n’était pas disponible avec la configuration locale.

Déployer le nouveau code des routes avant d’utiliser les missions sur le site publié : l’ancien backend utilise des écritures directes désormais interdites, et son ancien ordre crédit/puis validation ne doit plus être utilisé. Faire ensuite une recette avec un compte de test et une mission dédiée : dépôt, correction, validation, contrôle du gain et rejeu. Les anciens dossiers approuvés ne sont jamais recrédités. Pour un dossier ancien encore en attente, l’ancien code pouvait avoir crédité un gain avant une panne sans marquer sa validation ; l’admin affiche un avertissement et demande de vérifier l’historique avant d’approuver. La migration ne prétend pas reconstituer les gains promis avant l’existence des snapshots.

La vérification OAuth X/Instagram, la publication automatique, la qualification automatique de nouveaux filleuls et la refonte transactionnelle du parrainage de commandes ne font pas partie de ce lot. Le parrainage actuel est conservé. Les restrictions sociales étudiées dans la proposition restent applicables à la rédaction des missions, même avec une validation manuelle. Aucun fichier, compte social ou message n’est envoyé à un réseau externe par ce parcours.
