# Connexion automatique des statistiques sociales — BLFesport

## Objectif

Alimenter la table Airtable **Réseaux sociaux** avec les statistiques réelles des comptes BLFesport, puis conserver un relevé par période. Aucune valeur ne doit être inventée ni remplacée par zéro lorsqu'une API échoue.

Comptes concernés :
- YouTube : https://www.youtube.com/@BLFesport
- Twitch : https://www.twitch.tv/blfesport
- TikTok : @blfesport
- Instagram : @blf_esport
- X : @BLFesport_

## Architecture cible

1. Chaque compte autorise l'application officielle de sa plateforme via OAuth.
2. Le Worker BLFesport récupère les statistiques à intervalle régulier.
3. Les jetons d'accès et de renouvellement sont conservés dans un stockage privé (KV ou D1), jamais dans le dépôt GitHub ni dans le navigateur.
4. Le Worker met à jour l'entrée Airtable du mois et de la plateforme concernés.
5. En fin de mois, l'historique est conservé et la formule Airtable calcule l'évolution par rapport au relevé précédent.
6. Chaque synchronisation renseigne la date, le statut et le détail de l'erreur éventuelle.

## Données visées

| Plateforme | Données envisageables | Conditions importantes |
|---|---|---|
| YouTube | Abonnés publics, vues, vidéos publiées ; analytics détaillées (vues, likes, commentaires, partages) | YouTube Data API pour les données publiques ; YouTube Analytics API avec OAuth du propriétaire pour les rapports privés |
| Twitch | Followers, vues/activité disponibles selon les endpoints autorisés | Application Twitch enregistrée et OAuth ; certaines données nécessitent des scopes et un accès utilisateur |
| TikTok | Followers, following, likes cumulés, nombre de vidéos ; données vidéo disponibles | L'application doit obtenir les produits/scopes TikTok adaptés, notamment `user.info.stats` et `video.list`. L'approbation n'est pas garantie |
| Instagram | Followers, portée, interactions et métriques de contenu disponibles | Compte professionnel/créateur et autorisations Meta adaptées ; les métriques disponibles dépendent du type de compte et de l'API |
| X | Followers, nombre de posts et autres métriques publiques disponibles | Application développeur X et niveau d'accès/API actif ; les métriques privées/organique nécessitent des autorisations spécifiques |

## Autorisations et limites officielles

- YouTube Analytics : `https://developers.google.com/youtube/analytics/reference/reports/query`
- Twitch API : `https://dev.twitch.tv/docs/api/reference/` et `https://dev.twitch.tv/docs/authentication/scopes`
- TikTok scopes : `https://developers.tiktok.com/docs/en/tiktok-api-scopes`
- Instagram Insights : `https://developers.facebook.com/docs/insights/references/`
- X API : `https://developer.x.com/en/docs`

Les API ne donnent pas toutes les mêmes métriques. Le système doit enregistrer uniquement les champs réellement renvoyés et autorisés. Une métrique indisponible doit rester vide, avec une note explicative.

## Pré-requis de déploiement

Le code du Worker devra utiliser un stockage privé persistant pour les jetons OAuth (KV ou D1). Prévoir les secrets/identifiants d'application par plateforme dans les paramètres privés du Worker :
- YouTube Data API publique : clé `YOUTUBE_API_KEY` (compteur public d'abonnés). Les rapports privés YouTube Analytics nécessiteront ensuite OAuth propriétaire.
- Twitch : `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI` et un binding KV `TWITCH_TOKEN_STORE`. Le Worker gère l'autorisation via `/oauth/twitch/start` puis `/oauth/twitch/callback` et stocke les jetons tournants dans KV.
- TikTok : Client Key, Client Secret, Refresh Token
- Meta / Instagram : App ID, App Secret, jeton utilisateur renouvelable
- X : identifiants OAuth et jeton autorisé correspondant au type d'accès retenu

Les noms définitifs des variables seront fixés dans le code avant le paramétrage. Ne jamais envoyer ces valeurs dans une conversation, un ticket public ou un commit GitHub.

## Statut réel au démarrage

- Les cinq lignes de réseaux sociaux existent dans Airtable pour novembre 2026.
- Les champs de calcul des nouveaux abonnés existent.
- Le Worker relie automatiquement chaque relevé à celui du mois précédent pour la même plateforme, lorsque le relevé précédent existe.
- Une route manuelle protégée par `SYNC_SECRET` est disponible : `POST /admin/social-links-sync`.
- Le Worker contient un collecteur Twitch pour le total des followers, avec OAuth et renouvellement des jetons via KV. L'autorisation doit être faite sur le compte propriétaire `blfesport` via `/oauth/twitch/start`.
- Le Worker contient un premier collecteur YouTube public, exécuté par le Cron et appelable via `POST /admin/social-sync/youtube`.
- Ce collecteur met à jour le relevé du mois avec le compteur public d'abonnés, si `YOUTUBE_API_KEY` est configurée. Il ne transforme pas les vues ou vidéos cumulées en statistiques mensuelles.
- Les collecteurs TikTok, Instagram et X ne sont pas encore développés. YouTube n'est pas opérationnel tant que la clé API n'est pas configurée. Twitch n'est pas opérationnel tant que l'application Twitch, le binding KV et l'autorisation du compte ne sont pas configurés.
- La collecte automatique complète des cinq plateformes n'est donc pas active à ce stade.


## Mise en service Twitch

Le code fournit maintenant :
- `GET /oauth/twitch/start` : lance l'autorisation Twitch avec le scope minimal `moderator:read:followers`.
- `GET /oauth/twitch/callback` : vérifie l'état OAuth, échange le code côté serveur, vérifie que le compte autorisé est bien `blfesport`, puis conserve les jetons dans KV.
- `POST /admin/social-sync/twitch` : synchronisation manuelle protégée par `SYNC_SECRET`.
- Le Cron exécute aussi le collecteur Twitch toutes les 15 minutes. Les appels répétés mettent à jour le même relevé mensuel.

Configuration à effectuer dans les paramètres privés du Worker Cloudflare :
1. Créer une application Twitch de type serveur/confidentielle.
2. Déclarer comme OAuth Redirect URL exacte : `https://blfesport-airtable-api.enzo-reuziault.workers.dev/oauth/twitch/callback`.
3. Ajouter les variables/secrets `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` et `TWITCH_REDIRECT_URI` (cette dernière reprend exactement l'URL ci-dessus).
4. Créer un namespace KV et le lier au Worker sous le nom exact `TWITCH_TOKEN_STORE`.
5. Ouvrir `https://blfesport-airtable-api.enzo-reuziault.workers.dev/oauth/twitch/start` dans le navigateur, connecté au compte Twitch propriétaire `blfesport`, puis autoriser l'application.
6. Le callback confirme la connexion. Le prochain Cron peut alors synchroniser le total de followers.

Ne jamais mettre le Client Secret ou les jetons dans GitHub, Airtable ou une conversation. Le point de terminaison Twitch exige un jeton utilisateur avec `moderator:read:followers` et que l'identité autorisée soit le diffuseur ou un modérateur de la chaîne. Ici le code impose l'identité `blfesport` pour éviter d'enregistrer les statistiques d'un autre compte.

## Ordre de mise en service

1. YouTube et Twitch : intégrations OAuth + collecte des métriques accessibles.
2. Instagram : vérifier le statut professionnel/créateur et autoriser les Insights.
3. TikTok : demander les scopes statistiques nécessaires et vérifier l'approbation.
4. X : confirmer le niveau d'accès API disponible avant de développer la collecte.
5. Ajouter les cinq collecteurs au Worker, tester les réponses et les erreurs, puis activer la planification.

La synchronisation doit être idempotente : une exécution répétée met à jour la même ligne mensuelle au lieu de créer des doublons.
