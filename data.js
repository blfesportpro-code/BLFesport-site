/* Données du site BLFesport — modifiez ce fichier pour personnaliser le contenu.
   Les valeurs contenant "À renseigner" sont des emplacements temporaires, pas des informations officielles. */
window.BLF_DATA = {
  site: {
    name: "BLFesport",
    tagline: "L'ambition. La précision. La victoire.",
    description: "BLFesport est une organisation esport tournée vers la compétition, la progression et l'esprit d'équipe.",
    season: "SAISON À RENSEIGNER",
    social: {
      discord: "", twitch: "", youtube: "", tiktok: "", instagram: "", x: ""
    },
    streamChannel: "",
    youtubeChannel: ""
  },
  announcements: [
    {
      id: "welcome",
      title: "Bienvenue sur le site officiel",
      date: "2026-10-23",
      category: "Organisation",
      important: true,
      image: "",
      description: "Le site officiel de BLFesport centralise nos équipes, nos actualités et nos rendez-vous compétitifs. Les informations seront mises à jour au fil des annonces.",
      label: "Annonce de lancement"
    },
    {
      id: "rosters",
      title: "Les rosters arrivent",
      date: "2026-10-23",
      category: "Équipes",
      important: false,
      image: "",
      description: "Les compositions, rôles et profils des joueurs seront publiés ici dès leur confirmation officielle.",
      label: "À venir"
    }
  ],
  rosters: [
    { id: "roster-a", name: "Roster A", subtitle: "Équipe compétitive principale", game: "Rocket League", status: "Composition à renseigner", accent: "violet", description: "La composition officielle et les objectifs du Roster A seront annoncés prochainement.", players: [] },
    { id: "roster-b", name: "Roster B", subtitle: "Développement & compétition", game: "Rocket League", status: "Composition à renseigner", accent: "silver", description: "Un espace dédié aux joueurs en progression et aux compétitions à venir.", players: [] },
    { id: "roster-c", name: "Roster C", subtitle: "Projet compétitif", game: "Rocket League", status: "Composition à renseigner", accent: "dark", description: "Ce roster sera présenté lorsque ses informations seront confirmées.", players: [] }
  ],
  matches: [
    /* Exemple désactivé : renseignez date au format ISO local, adversaire et compétition, puis passez example à false. */
    { id: "match-example", date: "", roster: "Roster A", opponent: "Adversaire à renseigner", competition: "Compétition à renseigner", format: "BO5", streamUrl: "", status: "upcoming", result: "", example: true }
  ],
  seasonStats: [
    { label: "Matchs joués", value: "—" },
    { label: "Victoires", value: "—" },
    { label: "Tournois", value: "—" },
    { label: "Classement", value: "À renseigner" }
  ],
  tournaments: [],
  videos: [
    /* Ajoutez une vidéo : { title, type, date, url, youtubeId, description } */
  ],
  staff: [
    { nickname: "Staff à renseigner", role: "Responsable", avatar: "", bio: "Les profils du staff seront ajoutés après confirmation." }
  ],
  partners: [
    { name: "Votre marque ici", description: "Emplacement réservé à un futur partenaire officiel.", url: "", logo: "" }
  ],
  shop: [
    { name: "Maillot BLFesport", price: "Prix à définir", description: "Produit en préparation — aucune commande ni aucun paiement disponible.", image: "", available: false },
    { name: "Accessoire BLFesport", price: "Prix à définir", description: "Emplacement pour un futur produit officiel.", image: "", available: false }
  ]
};
