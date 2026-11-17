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
      title: "Problème avec les annonces Discord !",
      date: "2026-10-27",
      category: "Organisation",
      important: true,
      image: "",
      description: "Le système d'annonce relié à Discord est surement en cours de ralancement ou à un petit soucis, n'hésite pas à revenir dans 2-3min !",
      label: "Annonce d'erreur"
    },
    {
      id: "Bienvenue",
      title: "Le système d'annonce est activé !",
      date: "2026-10-27",
      category: "Organisation",
      important: false,
      image: "",
      description: "Un sistème d'annonce relié à Discord est désormais disponible !",
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
    id: "match-3",
    date: "2026-11-11T15:00:00",
    roster: "Roster ACADEMIQUE",
    opponent: "NOVA esport",
    opponentLogo: "",
    replayUrl: "",
    type: "friendly",
    format: "BO5",
    streamUrl: "",
    status: "official",
    result: "3-2",
    example: false
  },
  {
    id: "match-4",
    date: "2026-11-14T17:00:00",
    roster: "Roster ACADEMIQUE",
    opponent: "Spiny esport",
    opponentLogo: "assets/spiny.png",
    replayUrl: "",
    type: "official",
    format: "BO5",
    streamUrl: "",
    status: "finished",
    result: "3-0",
    example: false
  },
  {
    id: "match-5",
    date: "2026-11-15T15:00:00",
    roster: "Roster ACADEMIQUE",
    opponent: "Shadow esport",
    opponentLogo: "assets/shadow.png",
    replayUrl: "https://youtu.be/8BbcXd8PteI",
    type: "official",
    format: "BO5",
    streamUrl: "",
    status: "finished",
    result: "1-3",
    example: false
  },
  {
    id: "match-6",
    date: "2026-11-17T21:00:00",
    roster: "Roster A",
    opponent: "Voltrik esport",
    opponentLogo: "assets/voltrik.png",
    replayUrl: "https://youtu.be/JtMZg3CTTpc",
    type: "official",
    format: "BO7",
    streamUrl: "",
    status: "finished",
    result: "2-4",
    example: false
  }
],
 seasonStats: [
  { label: "Matchs officiels joués", value: "0" },
  { label: "Victoires officiels", value: "0" },
  { label: "Défaites officiels", value: "0" }
],
  tournaments: [],
  videos: [
  {
    "title": "REDIFFUSION SCRIM BLFESPORT VS SHADOW ESPORT ! (Rocket League)",
    "type": "YouTube",
    "date": "2026-11-16T20:32:03Z",
    "url": "https://www.youtube.com/watch?v=8BbcXd8PteI",
    "youtubeId": "8BbcXd8PteI",
    "description": "Rediffusion du scrim BLFesport VS Shadow Esport du 16/11/2026 !\n\nTwitch : blfesport\nTikTok : blfesport"
  },
  {
    "title": "First scrim Roster ACADEMIQUE ! @Bifyud_ | Twitch @THE👑🤴TUFFSIE🫡 @thelio #rocketleague #gaming",
    "type": "YouTube",
    "date": "2026-11-12T14:48:18Z",
    "url": "https://www.youtube.com/watch?v=utDJWBRPbq8",
    "youtubeId": "utDJWBRPbq8",
    "description": ""
  },
  {
    "title": "Le 1er joueur du Roster ACADEMIQUE ! @THE👑🤴TUFFSIE🫡  #rocketleague #fyp #roster #rl #esport",
    "type": "YouTube",
    "date": "2026-11-09T10:58:31Z",
    "url": "https://www.youtube.com/watch?v=Mlg7se0iJwQ",
    "youtubeId": "Mlg7se0iJwQ",
    "description": ""
  }
],
  staff: [
  {
    nickname: "Bifyud_",
    role: "Fondateur",
    avatar: "assets/Bifyud.png",
    bio: "Fondateur de BLFesport et streamer."
  },
  {
    nickname: "Zaiox_gaming",
    role: "Gérant STAFF",
    avatar: "assets/Zaiox.png",
    bio: "Gérant STAFF de la BLFesport, fondateur de la Shadow Esport et streamer."
  },
  {
    nickname: "SkyRell",
    role: "Caster",
    avatar: "assets/IMG_1289.jpeg",
    bio: "Caster de la BLFesport."
  }
],
  partners: [
    { name: "Instant Gaming", description: "Instant Gaming × BLFesport : Envie de jouer à prix réduit ? Retrouvez vos jeux préférés sur Instant Gaming grâce à notre lien partenaire ! En passant par notre lien, vous soutenez également le développement de BLFesport et nos projets esports.", url: "https://www.instant-gaming.com/?igr=blfesportoff", logo: "assets/instant-gaming-serios-logo-2.png" }
  ],
  shop: [
    { name: "Maillot BLFesport", price: "Prix à définir", description: "Produit en préparation — aucune commande ni aucun paiement disponible.", image: "assets/IMG_1302.png", available: false },
    { name: "Accessoire BLFesport", price: "Prix à définir", description: "Emplacement pour un futur produit officiel.", image: "assets/Design_sans_titre__3_-removebg-preview.png", available: false }
  ]
};
