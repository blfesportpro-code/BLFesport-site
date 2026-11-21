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
- YouTube / Google : Client ID, Client Secret, Refresh Token
- Twitch : Client ID, Client Secret, Refresh Token
- TikTok : Client Key, Client Secret, Refresh Token
- Meta / Instagram : App ID, App Secret, jeton utilisateur renouvelable
- X : identifiants OAuth et jeton autorisé correspondant au type d'accès retenu

Les noms définitifs des variables seront fixés dans le code avant le paramétrage. Ne jamais envoyer ces valeurs dans une conversation, un ticket public ou un commit GitHub.

## Statut réel au démarrage

- Les cinq lignes de réseaux sociaux existent dans Airtable pour novembre 2026.
- Les champs de calcul des nouveaux abonnés existent.
- Le Worker relie automatiquement chaque relevé à celui du mois précédent pour la même plateforme, lorsque le relevé précédent existe.
- Une route manuelle protégée par `SYNC_SECRET` est disponible : `POST /admin/social-links-sync`.
- Les comptes ne sont pas encore autorisés par les API.
- Le Worker actuellement présent synchronise les matchs ; il ne synchronise pas encore les cinq plateformes sociales.
- La collecte automatique n'est donc pas active à ce stade.

## Ordre de mise en service

1. YouTube et Twitch : intégrations OAuth + collecte des métriques accessibles.
2. Instagram : vérifier le statut professionnel/créateur et autoriser les Insights.
3. TikTok : demander les scopes statistiques nécessaires et vérifier l'approbation.
4. X : confirmer le niveau d'accès API disponible avant de développer la collecte.
5. Ajouter les cinq collecteurs au Worker, tester les réponses et les erreurs, puis activer la planification.

La synchronisation doit être idempotente : une exécution répétée met à jour la même ligne mensuelle au lieu de créer des doublons.
