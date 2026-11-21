# BLFesport — Worker de supervision

Ce Worker vérifie à la demande l'état des Workers BLFesport configurés.

## Ce que fait cette version

- Vérifie les Workers rosters, Discord et résultats de scrims en parallèle.
- Utilise des Cloudflare Service Bindings (pas des URL publiques).
- Mesure leur temps de réponse.
- Signale les erreurs HTTP, les délais dépassés et les Workers injoignables.
- Lit `updatedAt` et `cacheWarning` lorsqu'ils sont présents dans la réponse JSON.
- Signale les données de plus de 30 minutes comme potentiellement périmées.
- N'écrit rien dans KV et n'expose aucun token.

## Déploiement

Créer ou ouvrir le Worker `blfesport-monitor`, puis déployer le contenu de `index.js`.

Dans **Settings → Bindings → Add → Service**, ajouter ces trois Service Bindings :

| Variable (binding name) | Service Worker |
|---|---|
| `ROSTERS` | `blfesport-rosters` |
| `DISCORD` | `blfesport-discord` |
| `SCRIM_RESULTS` | `blfesport-scrim-results` |

Sélectionner le service correspondant dans le même compte Cloudflare pour chaque binding, puis sauvegarder et redéployer le Worker.

Aucune variable URL ni aucun secret URL n'est nécessaire avec cette configuration.

## Routes vérifiées

- Rosters : `/`
- Discord : `/`
- Résultats de scrims : `/api/matches`

## Tester

Ouvrir `https://blfesport-monitor.<sous-domaine>.workers.dev/health`.

Le JSON renvoie l'état global et le détail de chaque vérification. Un binding absent apparaît comme `not_configured`.

## Limites

- Les vérifications sont effectuées lorsqu'on appelle `/health) ; aucune vérification planifiée n'est lancée.
- Les états reflètent la disponibilité HTTP et les métadonnées renvoyées par les Workers, pas une inspection interne de Cloudflare.
