# Équipe Codex du Quartier

Dans VS Code, ouvre le dépôt dans un espace de travail approuvé par Codex et démarre une nouvelle conversation. La [configuration du projet](../../.codex/config.toml) sélectionne GPT-6.2 Astra pour le fil principal et GPT-6.2 Sol pour les sous-agents, avec un effort moyen. Elle permet jusqu’à trois fils de sous-agents ouverts en plus du fil principal. La mission détermine les rôles à lancer. [Documentation des sous-agents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

| Rôle | Périmètre et preuve attendue |
| --- | --- |
| `jeu_3d` | Scènes, bâtiments et personnages. Actif chargé, geste et observation en scène. |
| `interface_mobile` | Composants, styles, navigation et accessibilité. Parcours, fenêtre, capture ou mesure. |
| `gameplay` | Règles, progression et équilibre. Valeurs utilisées et cas vérifiable. |
| `performance` | Temps de chargement et de rendu, mémoire ou réseau. Scénario et mesures comparables. |
| `sauvegardes_securite` | Persistance et sécurité défensive. Chemin serveur, invariant et vérification locale. |
| `qa` | Relecture indépendante et tests ciblés. Étapes ou commandes et résultats observés. |

## Déléguer une mission

Garde un seul agent pour une question ciblée. Pour les travaux qui gagnent à être menés en parallèle, donne à chaque spécialiste une question distincte, ses fichiers, sa preuve attendue et son droit d’écriture éventuel. Le coordinateur tranche les choix partagés, intègre les résultats et vérifie le parcours complet. Pour une interaction en scène, les rôles jeu et interface examinent le même geste dans la même situation. Un diagnostic se fait en lecture seule.

Les procédures `$lcb-jeu-3d`, `$lcb-ui-ux` et `$lcb-seo` sont découvertes dans [`.agents/skills`](../../.agents/skills). Utilise ces compétences pour charger le contexte du métier au moment de la mission. [Documentation des compétences locales](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)

## Vérifier dans VS Code

Le 25 novembre 2026, l’App Server du binaire VS Code `0.171.0-alpha.13` a chargé les réglages de ce dépôt déjà approuvé. `model/list` a retourné les deux modèles et `skills/list` avec rechargement forcé a retourné les 13 compétences du projet actives, sans erreur. Les six profils TOML passent la lecture locale. La délégation Sol a servi durant la mission. L’appel des six rôles personnalisés par leur nom reste à vérifier dans un nouveau fil.

Depuis une nouvelle conversation ouverte à la racine du dépôt, tu peux tester un rôle avec cette demande.

> Délègue uniquement au rôle `qa`. En lecture seule, lis la première ligne de `.codex/agents/qa.toml` et rapporte-la avec le modèle du sous-agent si la session l’affiche.

La réponse attendue pour le fichier est `name = "qa"`. Le modèle et le rôle affichés dans le fil enfant permettent de vérifier l’exécution quand le client expose ces informations. Le choix effectif dépend du fil et des modèles disponibles dans la session. [Référence de configuration](https://learn.chatgpt.com/docs/config-file/config-reference)
