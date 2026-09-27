# Lancement de culture avec des tentes différentes

Le lancement refusait systématiquement une installation dont les tentes avaient des équipements différents. La base appliquait déjà la migration `20260924000300_kq_individual_tents.sql`, alors que le site regroupait encore les équipements dans un seul profil répété sur toutes les tentes. Actualiser le devis ne pouvait pas résoudre cette différence.

Le serveur lit maintenant les équipements, leurs niveaux et leur usure par tente. Le devis électrique et le lancement utilisent ces mêmes profils. Le nouvel instantané est conservé dans la sauvegarde, avec une consommation et un rendement calculés par tente. Les anciennes cultures gardent leur calcul et leur format historiques.

Cette correction conserve les contrôles SQL de capacité, de propriété, de niveau et d'usure. Elle n'applique aucune nouvelle migration et ne change pas les méthodes d'achat, d'amélioration ou d'agrandissement. La migration existante est ajoutée à Git pour enregistrer le schéma déjà appliqué le 24 septembre.

La régression couvre une tente équipée et une tente de départ, les trois modes énergétiques, le montant annoncé égal au montant enregistré, la reprise de sauvegarde, les installations historiques et les instantanés falsifiés. Le test PostgreSQL local est `node scripts/test-placard-culture-start-compat.mjs` ; il utilise PGlite installé dans `output/reputation-test-tools`, comme les autres répétitions SQL du projet.
