# BLFesport — Worker de supervision

Ce Worker vérifie l'état des Workers BLFesport et peut conserver un historique des indisponibilités.

## Vérifications

- Vérifie les Workers rosters, Discord et résultats de scrims en parallèle.
- Utilise des Cloudflare Service Bindings (pas des URL publiques).
- Mesure leur temps de réponse.
- Signale les erreurs HTTP, les délais dépassés et les Workers injoignables.
- Lit `updatedAt` et `cacheWarning` lorsqu'ils sont présents dans la réponse JSON.
- Signale les données de plus de 30 minutes comme potentiellement périmées.

## Bindings nécessaires

Dans **Settings → Bindings**, ajouter les Service Bindings :

| Variable (binding name) | Service Worker |
|---|---|
| `ROSTERS` | `blfesport-rosters` |
| `DISCORD` | `blfesport-discord` |
| `SCRIM_RESULTS` | `blfesport-scrim-results` |

Pour activer l'historique, créer un namespace Cloudflare KV nommé par exemple `BLFESPORT_MONITOR_HISTORY`, puis ajouter un binding KV :

| Variable name | KV namespace |
|---|---|
| `HISTORY` | `BLFESPORT_MONITOR_HISTORY` |

Le namespace est séparé des autres données BLFesport. Le Worker n'y écrit que lorsqu'un état change. Les événements sont conservés au maximum 90 jours et limités aux 100 plus récents.

## Déploiement

Déployer le contenu de `index.js` dans le Worker `blfesport-monitor`, puis sauvegarder les bindings et redéployer.

Aucune variable URL ni aucun secret URL n'est nécessaire.

## Routes

- `/` ou `/health` : vérifie les trois Workers et met à jour l'historique.
- `/history` : renvoie les incidents enregistrés et les incidents toujours actifs.

## Important : fréquence des vérifications

Les vérifications ont lieu lorsqu'un appel est fait à `/health`. Ce Worker ne lance pas encore de vérifications planifiées tout seul. Pour détecter une panne, il faut donc qu'un service externe appelle régulièrement `/health` (par exemple un Cron Trigger ou un service de monitoring).

L'historique commence à enregistrer les changements d'état après l'activation du binding KV ; il ne peut pas reconstituer les pannes passées.

## Données et limites

- L'historique ne contient que les changements d'état observés lors des appels à `/health`.
- Les états reflètent la disponibilité HTTP et les métadonnées renvoyées par les Workers, pas une inspection interne de Cloudflare.
- Le Worker n'expose aucun token.
