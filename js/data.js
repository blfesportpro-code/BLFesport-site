/* Données du site BLFesport — modifiez ce fichier pour personnaliser le contenu.
   Les valeurs contenant "À renseigner" sont des emplacements temporaires, pas des informations officielles. */
window.BLF_DATA = {
  site: {
    name: "BLFesport",
    tagline: "Gagner. Progresser. S'amuser.",
    description: "BLFesport est une organisation esport tournée vers la compétition, la progression et l'esprit d'équipe.",
    season: "SAISON À RENSEIGNER",
    social: {
      discord: "https://discord.com/invite/Jg9G6TgAen", twitch: "https://www.twitch.tv/blfesport", youtube: "https://www.youtube.com/@BLFesport", tiktok: "https://www.tiktok.com/@blfesport", instagram: "https://www.instagram.com/blf_esport/", x: "https://x.com/BLFesport_"
    },
    streamChannel: "https://www.twitch.tv/blfesport",
    youtubeChannel: "https://www.youtube.com/@BLFesport"
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
      title: "Le roster B est arrivé !",
      date: "2026-10-26",
      category: "Équipes",
      important: false,
      image: "",
      description: "Les compositions, rôles et profils des joueurs du roster B sont désormais disponible !",
      label: "Enfin disponible !"
    }
  ],
  rosters: [
    { id: "roster-a", name: "Roster A", subtitle: "Équipe compétitive principale", game: "Rocket League", status: "Composition à renseigner", accent: "violet", description: "La composition officielle et les objectifs du Roster A seront annoncés prochainement.", players: [] },
{
  id: "roster-b",
  name: "Roster B",
  subtitle: "Développement & compétition",
  game: "Rocket League",
  status: "Actif",
  accent: "silver",
  description: "Le Roster B de BLFesport entre en compétition.",
  players: [
    { nickname: "berat_smnl", avatar: "assets/Berat.png", role: "Joueur", bio: "", stats: "stats: Grand Champion • 2v2 • Compétitif", social: "https://www.tiktok.com/@berat_smnl?_r=1&_t=ZN-9AsxhApGSSk" },
    { nickname: "Foamy", avatar: "assets/Astr_.png", role: "Joueur", bio: "", stats: "stats: Grand Champion • 2v2 • Compétitif", social: "https://www.tiktok.com/@foamy2151?_r=1&_t=ZN-9Asv964G0t4" },
    { nickname: "Astr_", avatar: "assets/Foymi.png", role: "Joueur", bio: "", stats: "stats: Grand Champion • 2v2 • Compétitif", social: "https://www.tiktok.com/@elowan_athle?_r=1&_t=ZN-9AsxkZuKJYE" }
  ]
},
    { id: "roster-c", name: "Roster ACADEMIQUE", subtitle: "Projet compétitif", game: "Rocket League", status: "Composition à renseigner", accent: "dark", description: "Ce roster sera présenté lorsque ses informations seront confirmées.", players: [] }
  ],
  matches: [
  {
    id: "match-1",
    date: "2026-11-05T20:00:00",
    roster: "Roster B",
    opponent: "Nom de l'équipe adverse",
    competition: "Tournoi Rocket League",
    format: "BO5",
    streamUrl: "",
    status: "upcoming",
    result: "",
    example: false
  }
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
    { nickname: "Bifyud_", role: "Fondateur", avatar: "assets/Bifyud.png", bio: "Bifyud_ est le fondateur de la BLFesport et streamer sur Twitch !" }
  ],
  partners: [
    { name: "Instant Gaming", description: "Instant Gaming × BLFesport : Envie de jouer à prix réduit ? Retrouvez vos jeux préférés sur Instant Gaming grâce à notre lien partenaire ! En passant par notre lien, vous soutenez également le développement de BLFesport et nos projets esports.", url: "https://www.instant-gaming.com/?igr=blfesportoff", logo: "assets/instant-gaming-serios-logo-2.png" }
  ],
  shop: [
    { name: "Maillot BLFesport", price: "Prix à définir", description: "Produit en préparation — aucune commande ni aucun paiement disponible.", image: "assets/DFC1344A-1107-446D-885E-7632FB3649EE_L0_001-05_09_2025 21_47_34.png", available: false },
    { name: "Accessoire BLFesport", price: "Prix à définir", description: "Emplacement pour un futur produit officiel.", image: "assets/Design_sans_titre__3_-removebg-preview.png", available: false }
  ]
};
