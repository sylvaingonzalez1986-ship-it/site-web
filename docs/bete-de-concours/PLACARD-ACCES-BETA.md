# Accès privé au Placard en production

L'accès de test utilise les comptes existants de l'Arène :

- compte client connecté dont l'adresse vérifiée appartient à la liste admin ;
- compte client connecté avec `contestBetaEnabled=true`, enregistré côté serveur dans `contest_beta_testers`.

Le module Arène doit être activé (`CONTEST_FEATURE_ENABLED` et, en production,
`CONTEST_FEATURE_ALLOW_PRODUCTION`). L'accès privé ne demande ni activation de
`KQ_PLAYER_API_LIVE`, ni validation artificielle du dossier de lancement.

Le contrôle `isKqPlayerRequestEnabled` est utilisé par la page Placard, ses API,
les classements et les récompenses de l'Arène. Il relit les droits du compte à
chaque requête, sans cache partagé. Désactiver l'accès bêta du compte révoque
donc son accès privé dès la requête suivante. Désactiver les restrictions bêta
générales de l'Arène ne donne pas accès au Placard aux comptes ordinaires.

Le joueur conserve sa propre identité client pour ses achats, cartes, cultures
et duels. Aucune identité admin fictive n'est utilisée. Les opérations de test
utilisent les données de ce compte ; elles ne sont pas simulées.

Le lancement public et ses validations restent contrôlés séparément par
`isKqPublicPlayerApiEnabled`. Les fonctionnalités commerciales encore dormantes
conservent leurs propres conditions d'activation.
