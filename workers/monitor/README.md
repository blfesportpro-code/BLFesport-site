# BLFesport — Worker de supervision

Ce Worker vérifie à la demande l'état des Workers BLFesport configurés.

## Ce que fait cette première version

- Vérifie les Workers rosters, Discord et résultats de scrims en parallèle.
- Mesure leur temps de réponse.
- Signale les erreurs HTTP, les délais dépassés et les Workers injoignables.
- Lit `updatedAt` et `cacheWarning` lorsqu'ils sont présents dans la réponse JSON.
- Signale les données de plus de 30 minutes comme potentiellement périmées.
- N'écrit rien dans KV : aucune consommation d'écriture KV.
- N'expose aucun token ni secret.

## Déploiement Cloudflare

Créer un Worker nommé par exemple `blfesport-monitor`, puis copier le contenu de `index.js`.

Dans **Settings → Variables and Secrets → Variables**, ajouter :

| Variable | Valeur |
|---|---|
| `ROSTERS_URL` | `https://blfesport-rosters.enzo-reuziault.workers.dev/` |
| `DISCORD_URL` | `https://blfesport-discord.enzo-reuziault.workers.dev/` |
| `SCRIM_RESULTS_URL` | `https://blfesport-scrim-results.enzo-reuziault.workers.dev/` |

Aucun secret n'est nécessaire pour cette première version.

## Tester

Ouvrir l'URL du Worker, puis `/health`.

Le résultat JSON contient un état global et le détail de chaque Worker.

## Limites connues

- Cette version réalise les vérifications lorsqu'on appelle `/health` ; elle ne lance pas encore de vérification planifiée.
- Elle ne mesure pas la consommation KV : cette information n'est pas exposée par les réponses publiques des Workers.
- Les états reflètent la disponibilité HTTP et les métadonnées renvoyées par les Workers, pas une inspection interne de Cloudflare.
