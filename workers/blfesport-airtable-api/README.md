# Connexion BLFesport Manager ↔ site BLFesport

Cette passerelle Cloudflare Worker expose les données Airtable en **lecture seule** pour le site public.

## Endpoints
- `GET /health` : état du service.
- `GET /api/matches` : calendrier et résultats Rocket League.
- `GET /api/player-stats` : statistiques individuelles.
- `GET /api/summary` : bilan global des matchs.
- `GET /api/social-stats` : statistiques mensuelles des réseaux, comparaisons et historique pour le Statistics Center.

## Déploiement Cloudflare
1. Créer un Worker nommé `blfesport-airtable-api`.
2. Copier le contenu de `src/index.js` dans son éditeur.
3. Dans Settings → Variables and Secrets, ajouter le secret `AIRTABLE_TOKEN`.
4. Le token Airtable doit être un Personal Access Token limité à cette base, avec accès **lecture seule** aux enregistrements.
5. Garder `AIRTABLE_BASE_ID` et `ALLOWED_ORIGIN` comme variables, telles que définies dans `wrangler.toml`.
6. Déployer puis vérifier `/health`.

Ne jamais placer le token Airtable dans le JavaScript du site ou dans GitHub.

## Étape suivante
Une fois le Worker déployé, brancher son URL dans le site et faire afficher les données Airtable dans la page Compétitions. Le site conserve ses données actuelles tant que cette étape n'est pas activée.
