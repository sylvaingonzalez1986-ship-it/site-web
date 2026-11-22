# Recette de la bêta fermée

Le jeu compte deux testeurs selon le responsable de la bêta. Le Carnet de dégustation est ouvert. Le responsable teste personnellement. Au lancement de cette campagne, aucune séance de découverte, de suivi longitudinal ni de mesure physique n’a encore été consignée. Renseigner la version exacte dans chaque ligne. [Registre de séances](../observations-debutants.csv) · [Grille et seuils](../audit-global-2026-11-22/plan-80.md)

## Préparer la séance

| Identifiants à affecter sur l’instance d’essai | État initial et tâche |
|---|---|
| D01 à D04 sur mobile, D05 à D08 sur ordinateur | Parties indépendantes, profil vierge, 1 000 € de jeu, collection vide, pack de départ disponible, sol sans zone. Conserver une deuxième sauvegarde avec un lot prêt à la vente pour chaque participant. |
| A01 à A04, puis A05 et A06 si disponibles | Ferme développée avec deux zones opérationnelles, quatre variétés distinctes, heures de travail et factures déjà enregistrées. Préparer également le cas de trois variétés. |
| T01 et T02 pour les appareils | Deux comptes synthétiques distincts, un vierge et un développé. Noter le stock en dixièmes de gramme, la caisse et le détail des factures en centimes avant les essais. |

Les données locales de Loïc sont disponibles dans la fixture avec `/arene/placard?view=hub&welcome&empty&persist&poor&avatar`. Lancer `node scripts/audit-placard-journey-continuity.mjs --loic-welcome --preview` et ouvrir l’adresse locale affichée avec ces paramètres dans un profil de navigateur neuf pour chaque séance. Les commandes de cette fixture sont simulées. Les tests financiers hébergés demandent des comptes créés dans la base de recette et des reçus relus après reconnexion.

Sur le poste de recette, le [parcours de départ](http://127.0.0.1:3674/arene/placard?view=hub&welcome&empty&persist&poor&avatar) et le [raccourci vers la zone 01 avec trois Buddies](http://127.0.0.1:3674/arene/placard?view=workshop&zone=premiere-zone&zone-choice) utilisent le même serveur local. Le raccourci initialise une ferme déjà installée dans un nouvel onglet sans sauvegarde du jeu de démonstration. Le même onglet conserve sa sauvegarde aux rechargements.

## Observer sans guider

Le 22 novembre, le testeur de la bêta a signalé qu’à l’étape 3 il voyait « Glisse un Buddie du carrousel dans cette zone » sans trouver le carrousel. Il a ensuite trouvé le passage par **Aménager** et précisé que Loïc n’indiquait pas ce chemin. La capture fournie mesure 968 × 536 pixels. Le modèle d’appareil, la taille CSS et la durée du détour sont inconnus. Ce signalement spontané est conservé à part du dénominateur des huit séances de découverte. Rejouer cette étape avec le testeur sur la version corrigée.

1. Dire « Installe ta ferme et sème ta première culture. » Laisser le participant choisir le guide ou le jeu libre. Noter le temps actif, le premier détour, les aides ouvertes et les demandes d’indice.
2. Au devis, demander « Que paies-tu maintenant ? Si tu vas jusqu’à la récolte, combien pourras-tu encore dépenser ? » Noter les mots et montants donnés. Laisser le participant poursuivre après un refus simulé, puis interrompre et reprendre le guide.
3. Sur la sauvegarde avec un lot prêt, demander « Choisis à qui vendre. Combien arrivera en caisse ? » Comparer sa réponse au reçu. Garder les abandons dans le dénominateur. Compter séparément les parcours et les explications des coûts réussis sans indice, avec une cible de six sur huit pour chacun.
4. Pour les profils avancés, consigner à J0, J+1, J+7, J+14 et J+21 la décision réelle, l’alternative disponible, les heures, le solde et les lots avant/après. À J+7, relever l’évolution attendue par le joueur, les faits du journal et la possibilité de relancer. Rappeler uniquement les rendez-vous convenus. Conserver motifs d’arrêt et observations manquantes.

## Mesurer la version hébergée

Utiliser une application d’essai et un projet Supabase jetable. Sur le déploiement et sur le poste de mesure, renseigner `PLACARD_TEST_APP_ORIGIN`, `PLACARD_TEST_DATABASE_ORIGIN` et `PLACARD_TEST_VERSION`. Le serveur compare l’origine Supabase effective avant d’annoncer la cible. Le chargeur vérifie cette annonce avant d’envoyer des sessions. Le bootstrap peut créditer des packs ou des récompenses. Le rapport distingue ses délais de ceux des autres routes.

Fournir deux comptes de recette au script Lighthouse via `PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON`, au format décrit dans `scripts/audit-placard-mobile.mjs`, et l’URL via `PLACARD_MOBILE_AUDIT_BASE_URL`. Exécuter `node scripts/audit-placard-mobile.mjs`. Conserver HUD, catalogue et marché, LCP ≤ 4 s, CLS ≤ 0,1, performance ≥ 75, accessibilité ≥ 90 et transfert ≤ 2 Mo. Pour un essai de charge explicitement prévu, le chargeur distant attend `PLACARD_LOAD_TEST_CONFIRM_TARGET=ISOLATED_STAGING`, l’autorisation distante et l’hôte exact.

Sur l’Android de milieu de gamme, l’iPhone et l’ordinateur de référence, noter modèle, OS, navigateur, réseau, DPR, version et état de partie. Faire trois passages avec cache vierge et trois avec cache conservé. Utiliser les traces du navigateur et la capture de l’écran. Chronométrer séparément l’arrivée du premier contrôle activable, le retour visuel au toucher ou au clavier et la fin de la confirmation serveur. Conserver le Server-Timing, l’erreur éventuelle et le numéro du reçu. Dans le village, mesurer la médiane des images/s pendant le même déplacement, avec cible ≥ 30 sur le téléphone de référence. Refaire le trajet village → entrepôt → devis, l’ouverture d’un article, le retour à la ferme développée et la vente jusqu’à la relecture du reçu après reconnexion. [Feuille des mesures](mesures-terrain.csv)
