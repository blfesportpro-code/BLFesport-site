# BLFesport — site officiel

Site statique en HTML, CSS et JavaScript, conçu pour GitHub Pages. Le logo fourni est intégré localement dans `assets/logo.png`.

## Contenu du projet

- `index.html` : page d'accueil et toutes les sections.
- `admin.html` : éditeur local de données de démonstration (pas un backend, ne publie pas directement).
- `css/style.css` : identité visuelle responsive violet/noir.
- `js/data.js` : **source centrale des données** à modifier.
- `js/main.js` : rendu des cartes, navigation mobile, liens sociaux et compte à rebours.
- `assets/logo.png` : logo officiel fourni.
- `assets/favicon.png` : favicon dérivé du logo.

## Tester en local

Ouvrez `index.html` dans un navigateur. Pour éviter certaines restrictions locales et tester comme sur un hébergement, vous pouvez lancer un petit serveur local, par exemple avec l'extension Live Server de VS Code. Aucun processus de compilation n'est requis.

## Publier gratuitement sur GitHub Pages

1. Connectez-vous à GitHub et créez un dépôt public nommé par exemple `blfesport-site`.
2. Décompressez le ZIP et téléversez **le contenu** du dossier (notamment `index.html`, `admin.html`, `css/`, `js/`, `assets/`) à la racine du dépôt. Ne téléversez pas uniquement le ZIP.
3. Dans le dépôt, ouvrez **Settings → Pages**.
4. Dans **Build and deployment**, choisissez **Deploy from a branch**.
5. Sélectionnez la branche `main` et le dossier `/ (root)`, puis cliquez sur **Save**.
6. Attendez la fin du déploiement. GitHub affichera l'adresse du site dans Settings → Pages, généralement `https://VOTRE-PSEUDO.github.io/blfesport-site/`.
7. Après chaque commit sur `main`, GitHub Pages republie automatiquement le site. Le premier déploiement peut prendre quelques minutes.

## Modifier les données

Toutes les données éditoriales se trouvent dans `js/data.js` dans l'objet `window.BLF_DATA`.

### Ajouter ou modifier un roster/joueur

Dans `rosters`, chaque roster contient `name`, `subtitle`, `game`, `status`, `description` et `players`. Exemple :

```js
{
  id: "roster-a",
  name: "Roster A",
  subtitle: "Équipe compétitive principale",
  game: "Rocket League",
  status: "Roster confirmé",
  description: "Présentation officielle.",
  players: [
    {
      nickname: "PseudoDuJoueur",
      avatar: "assets/joueurs/pseudo.png",
      role: "Capitaine",
      bio: "Courte biographie.",
      stats: "Rang : à renseigner",
      social: "https://exemple.com/profil"
    }
  ]
}
```

Les champs avatar, stats et social sont facultatifs. Les URL d'images peuvent être des chemins locaux (ex. `assets/joueurs/pseudo.png`) ou des URL HTTPS.

### Ajouter une annonce

Ajoutez un objet dans `announcements` :

```js
{
  id: "annonce-unique",
  title: "Titre de l'annonce",
  date: "2026-11-15",
  category: "Organisation",
  important: true,
  image: "",
  description: "Texte de l'annonce.",
  label: "Annonce officielle"
}
```

La page d'accueil affiche les trois annonces les plus récentes, avec les annonces prioritaires en premier. Aucune image n'est nécessaire.

### Ajouter un match et son compte à rebours

Dans `matches`, utilisez une date ISO locale comme `2026-11-15T20:00:00`. Renseignez `roster`, `opponent`, `competition`, `format`, `streamUrl` et `status: "upcoming"`. Retirez `example: true` ou mettez `example: false`. Le compte à rebours se met à jour chaque seconde selon l'heure locale du visiteur.

Pour archiver un match, utilisez `status: "finished"` et renseignez `result` (par exemple `3–1`) **uniquement si le résultat est réel et confirmé**. Le site ne calcule pas automatiquement un classement : les statistiques dans `seasonStats` sont éditoriales et doivent être mises à jour par le staff.

### Ajouter une vidéo

Exemple : `{ title: "Best-of", type: "BEST-OF", date: "2026-11-15", url: "https://youtube.com/watch?v=ID", youtubeId: "ID", description: "Description." }`. Le `youtubeId` sert à afficher la miniature. Les vidéos ne sont pas intégrées automatiquement en lecture dans cette version : le lien ouvre le contenu sur YouTube. Pour une lecture intégrée, un bloc iframe YouTube peut être ajouté ultérieurement.

### Réseaux sociaux

Remplacez les chaînes vides dans `site.social` par vos URL complètes (avec `https://`). Tant qu'un lien est vide, il est signalé comme « À renseigner » ou ouvre un message d'information au clic, plutôt que d'inventer une URL.

### Staff, partenaires et boutique

Modifiez les tableaux `staff`, `partners` et `shop`. Laissez les URL vides tant qu'elles ne sont pas confirmées. La boutique est une vitrine uniquement : aucun paiement ni commande n'est simulé.

## Fonctionnalités et limites

### Fonctionnelles dès maintenant
- Navigation responsive et menu mobile.
- Actualités, rosters, joueurs, matchs, résultats, statistiques éditoriales, staff, partenaires, boutique et vidéos alimentés par `js/data.js`.
- Compte à rebours dynamique pour le prochain match valide.
- Liens sociaux désactivés proprement tant que les URL ne sont pas renseignées.
- Page d'éditeur local avec validation JSON et export `data.json`.
- SEO de base, favicon, animation discrète et prise en compte de `prefers-reduced-motion`.

### Nécessitent une information ou un service externe
- **Administration en ligne sécurisée** : GitHub Pages ne fournit pas de base de données ni de connexion administrateur. L'éditeur `admin.html` n'est pas sécurisé et n'écrit pas dans GitHub. Pour publier sans modifier le code, connecter un CMS avec authentification et stockage (ex. Decap CMS + service d'authentification compatible, ou un CMS hébergé). Ne jamais mettre de jeton GitHub dans le JavaScript public.
- **Notifications automatiques** : le compte à rebours fonctionne quand la page est ouverte, mais un site statique ne peut pas envoyer seul des notifications push fiables ou des rappels lorsque le visiteur a fermé le site. Il faut un service push et l'accord du visiteur, ou utiliser Discord/bot, calendrier ou une plateforme de notification.
- **Lives Twitch** : les liens sont prêts à recevoir les URL. L'affichage automatique du statut live nécessite l'API Twitch et généralement un backend ou un service tiers.
- **Paiements** : utiliser une plateforme de boutique et de paiement sécurisée (par ex. Shopify, Stripe Checkout via backend/fournisseur compatible, ou autre prestataire). Ne stockez jamais de données bancaires sur ce site.
- **Classements et résultats en direct** : la version actuelle utilise les données renseignées manuellement. Une API esport et un service d'intégration seront nécessaires pour l'automatisation.
- **Polices web** : Google Fonts est appelé en ligne. En cas d'absence de connexion, les polices système de secours seront utilisées.

## Sécurité et confidentialité

Ce projet ne collecte aucune donnée, n'utilise aucun formulaire d'inscription et ne possède pas de backend. Les données et fichiers publiés dans le dépôt sont publics. N'ajoutez aucune information privée de joueur ou du staff sans autorisation.
