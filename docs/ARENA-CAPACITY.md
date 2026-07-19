# Validation de capacité de l'Arène

## Pré-requis

Le test doit viser une préproduction disposant d'un jeu de données représentatif. Ne pas le lancer contre la production sans fenêtre de test et supervision Supabase/Sentry.

## Exécution

```powershell
$env:LOAD_TEST_BASE_URL="https://preproduction.example.com"
$env:LOAD_TEST_PARTICIPANTS="500"
$env:LOAD_TEST_RAMP_MS="120000"
$env:LOAD_TEST_TIMEOUT_MS="10000"
npm.cmd run load-test:arena
```

Chaque participant consulte successivement la page de l'Arène et quatre API publiques. Le processus retourne un code d'échec si le taux d'erreur dépasse 1 % ou si la latence p95 dépasse 2,5 secondes.

## Paliers recommandés

1. 25 participants sur 30 secondes pour vérifier la configuration.
2. 100 participants sur 60 secondes pour établir la référence.
3. 500 participants sur 120 secondes pour la validation nominale.
4. 500 participants avec une rampe nulle pour mesurer un pic, uniquement après réussite du palier nominal.

Pendant le test, relever la latence et les erreurs Vercel, les connexions et requêtes lentes Supabase, ainsi que les erreurs Sentry. Une réussite HTTP ne suffit pas : vérifier aussi qu'aucun avis, vote, point ou badge n'a été dupliqué.

## Critères d'acceptation

- moins de 1 % d'erreurs ;
- p95 inférieur à 2,5 secondes pour le scénario complet ;
- aucune saturation durable des connexions PostgreSQL ;
- aucun doublon ou enregistrement partiel ;
- retour aux latences normales en moins d'une minute après le pic.
