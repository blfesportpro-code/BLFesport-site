/* Rendu du site à partir de js/data.js. Aucune donnée officielle n'est inventée. */
(() => {
  "use strict";
  const data = window.BLF_DATA || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const validUrl = value => {
    try { const url = new URL(value); return ["http:","https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
  };
  const formatDate = value => {
    if (!value) return "Date à annoncer";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Date à annoncer" : new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric"}).format(d);
  };
  const formatDateTime = value => {
    if (!value) return "Date à annoncer";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Date à annoncer" : new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(d);
  };
  const initials = value => (String(value || "BLF").trim().split(/\s+/).slice(0,2).map(s=>s[0]||"").join("").toUpperCase() || "BLF");
  const empty = (message) => `<div class="empty-state">${esc(message)}</div>`;


function renderNews() {
  const host = $("#newsGrid");
  if (!host) return;

  const CACHE_KEY = "blfesport_discord_announcements_v1";

  const render = items => {
    const sorted = [...items]
      .sort((a, b) =>
        Number(Boolean(b.important)) - Number(Boolean(a.important)) ||
        String(b.date || "").localeCompare(String(a.date || ""))
      )
      .slice(0, 3);

    host.innerHTML = sorted.length
      ? sorted.map(item => `
        <article class="news-card">
          <div class="news-meta">
            <span class="category-pill">${esc(item.category || "Discord")}</span>
            ${item.important ? '<span class="important-pill">✦ PRIORITAIRE</span>' : ""}
          </div>
          <h3>${esc(item.title || "Annonce BLFesport")}</h3>
          <p>${esc(item.description || "")}</p>
          <div class="news-bottom">
            <span>${esc(item.date ? formatDate(item.date) : "Date à annoncer")}</span>
            <span class="news-arrow">↗</span>
          </div>
        </article>
      `).join("")
      : empty("Aucune annonce disponible pour le moment.");
  };

  const normalize = items => items.map(item => ({
    title: item.title || item.name || "Annonce Discord",
    description: item.description || item.content || item.message || "",
    date: item.date || item.posted_at || item.created_at || item.timestamp || "",
    category: item.category || "Discord",
    important: Boolean(item.important)
  }));

  let cached = [];

  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
    if (Array.isArray(saved)) cached = saved;
  } catch (error) {
    console.warn("Cache des annonces indisponible.", error);
  }

  const localAnnouncements = Array.isArray(data.announcements)
    ? data.announcements
    : [];

  // Affiche immédiatement les dernières annonces disponibles.
  render(cached.length ? cached : localAnnouncements);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  fetch("https://api.dispresso.co/api/espresso/servers/1305208753150365697/site-feed", {
    signal: controller.signal,
    cache: "no-store"
  })
    .then(response => {
      if (!response.ok) {
        throw new Error("Flux Dispresso indisponible : " + response.status);
      }
      return response.json();
    })
    .then(feed => {
      const announcements =
        feed.announcements ||
        feed.data?.announcements;

      if (!Array.isArray(announcements) || !announcements.length) {
        throw new Error("Aucune annonce exploitable dans le flux.");
      }

      const items = normalize(announcements);

      // Ne remplace pas les annonces visibles par du contenu vide.
      if (!items.some(item => item.title || item.description)) {
        throw new Error("Le flux ne contient aucune annonce exploitable.");
      }

      render(items);

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(items));
      } catch (error) {
        console.warn("Impossible de sauvegarder les annonces.", error);
      }
    })
    .catch(error => {
      console.warn(
        "Flux Discord temporairement indisponible : conservation des annonces.",
        error
      );

      // Les annonces déjà affichées restent visibles.
      if (cached.length) {
        render(cached);
      } else {
        render(localAnnouncements);
      }
    })
    .finally(() => clearTimeout(timeout));
}

let discordMatches = null;

function activeMatches() {
  const localMatches = (data.matches || [])
    .filter(match => !match.example);

  if (discordMatches === null || discordMatches.length === 0) {
    return localMatches;
  }

  return discordMatches.filter(match => !match.example);
}

async function loadDiscordEvents() {
  try {
    const response = await fetch(
      "https://blfesport-discord.enzo-reuziault.workers.dev/",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Erreur Worker : " + response.status);
    }

    const events = await response.json();

    if (!Array.isArray(events)) {
      throw new Error("Réponse Discord invalide.");
    }

    const now = Date.now();

    discordMatches = events
      .filter(event =>
        event.status === 1 &&
        event.scheduled_start_time &&
        new Date(event.scheduled_start_time).getTime() >= now
      )
      .map(event => ({
        id: "discord-" + event.id,
        date: event.scheduled_start_time,
        opponent: event.name,
        competition: "Événement Discord",
        format: "Événement officiel",
        roster: "BLFesport",
        streamUrl: "",
        status: "upcoming",
        result: "",
        example: false,
        isDiscordEvent: true
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    renderMatches();
  } catch (error) {
    console.error("Synchronisation Discord impossible :", error);
  }
}


function renderMatches() {
  const matches = activeMatches().sort((a,b) => new Date(a.date)-new Date(b.date));
  const upcoming = matches.filter(m=>m.status !== "finished" && new Date(m.date) >= new Date());
  const next = upcoming[0];
  const host = $("#nextMatch");
    if (host) {
      if (!next) host.innerHTML = `<div><span class="match-kicker">PROCHAIN RENDEZ-VOUS</span><h3 class="match-title">LE PROCHAIN MATCH SE PRÉPARE.</h3><p class="match-note">Aucun match confirmé pour le moment. Les informations seront publiées ici dès qu'elles seront disponibles.</p></div><div class="countdown-wrap"><div class="countdown-label">COMPTE À REBOURS</div><div class="countdown"><div class="countdown-unit"><strong>—</strong><small>JOURS</small></div><div class="countdown-unit"><strong>—</strong><small>HEURES</small></div><div class="countdown-unit"><strong>—</strong><small>MIN</small></div></div><div class="match-note">En attente d'une date confirmée</div></div>`;
      else host.innerHTML = `<div><span class="match-kicker">✦ PROCHAIN RENDEZ-VOUS • ${esc(next.roster || "BLFesport")}</span><h3 class="match-title">${next.isDiscordEvent ? esc(next.opponent) : `BLF <span style="color:#c77aff">VS</span> ${esc(next.opponent || "Adversaire à confirmer")}`}</h3><div class="match-detail"><span>◷ ${esc(formatDateTime(next.date))}</span><span>⌁ ${esc(next.competition || "Compétition à confirmer")}</span><span>▣ ${esc(next.format || "Format à confirmer")}</span></div>${validUrl(next.streamUrl) ? `<p><a class="text-link" href="${esc(validUrl(next.streamUrl))}" target="_blank" rel="noopener">Accéder au stream ↗</a></p>` : ""}</div><div class="countdown-wrap"><div class="countdown-label">LE MATCH COMMENCE DANS</div><div class="countdown" data-countdown="${esc(next.date)}"><div class="countdown-unit"><strong data-days>00</strong><small>JOURS</small></div><div class="countdown-unit"><strong data-hours>00</strong><small>HEURES</small></div><div class="countdown-unit"><strong data-minutes>00</strong><small>MIN</small></div><div class="countdown-unit"><strong data-seconds>00</strong><small>SEC</small></div></div><div class="match-note">Heure locale de votre appareil</div></div>`;
    }
    const list = $("#matchList");
    if (list) {
      const recent = matches.filter(m=>m.status==="finished").sort((a,b)=>new Date(b.date)-new Date(a.date));
      const rows = [...upcoming.slice(0,4),...recent.slice(0,3)];
      list.innerHTML = rows.length ? rows.map(m=>`<div class="match-row"><div class="match-date">${esc(formatDate(m.date))}</div><div><div class="match-opponent">${m.isDiscordEvent ? "" : "BLFesport vs "}${esc(m.opponent || "Adversaire à confirmer")}</div><div class="match-info">${esc(m.roster || "Roster à confirmer")} · ${esc(m.competition || "Compétition à confirmer")}</div></div><div class="match-info">${esc(m.format || "Format à confirmer")}</div><span class="match-status ${m.status==="finished"?"result":""}">${m.status==="finished" ? esc(m.result || "Résultat à renseigner") : "À venir"}</span></div>`).join("") : empty("Le calendrier sera publié dès que les dates et adversaires seront confirmés.");
    }
    const stats = $("#seasonStats");
    if (stats) stats.innerHTML = (data.seasonStats || []).map(s=>`<div class="stat-box"><strong>${esc(s.value || "—")}</strong><span>${esc(s.label || "")}</span></div>`).join("") || empty("Statistiques à renseigner.");
    updateCountdown();
  }
  function updateCountdown() {
    document.querySelectorAll("[data-countdown]").forEach(el=>{
      const target = new Date(el.dataset.countdown).getTime(), diff = Math.max(0,target-Date.now());
      const values = {days:Math.floor(diff/86400000),hours:Math.floor(diff%86400000/3600000),minutes:Math.floor(diff%3600000/60000),seconds:Math.floor(diff%60000/1000)};
      Object.entries(values).forEach(([key,val])=>{const node=el.querySelector(`[data-${key}]`);if(node)node.textContent=String(val).padStart(2,"0")});
    });
  }
  function renderRosters() {
    const host=$("#rosterGrid"); if(!host)return;
    const rosters=data.rosters||[];
    host.innerHTML=rosters.length?rosters.map((r,i)=>{
      const players=r.players||[];
      return `<article class="roster-card"><div class="roster-top"><div class="roster-emblem">BLF<span style="font-size:10px">${String.fromCharCode(65+i)}</span></div><span class="roster-game">${esc(r.game||"Jeu à renseigner")}</span></div><h3>${esc(r.name)}</h3><div class="roster-subtitle">${esc(r.subtitle||"Équipe BLFesport")}</div><p>${esc(r.description||"Présentation à venir.")}</p><span class="roster-status">${esc(r.status||"Informations à venir")}</span><div class="players-wrap"><h4>JOUEURS ${players.length ? `· ${players.length}` : "· À ANNONCER"}</h4>${players.length?players.map(p=>`<div class="player-chip"><div class="player-avatar">${p.avatar?`<img src="${esc(p.avatar)}" alt="">`:esc(initials(p.nickname))}</div><div><strong>${esc(p.nickname||"Pseudo à renseigner")}</strong><small>${esc(p.role||"Rôle à renseigner")}${p.bio?` · ${esc(p.bio)}`:""}</small>${p.stats?`<small>${esc(p.stats)}</small>`:""}${p.social?`<br><a class="text-link" href="${esc(validUrl(p.social))}" target="_blank" rel="noopener">Profil ↗</a>`:""}</div></div>`).join(""):empty("Aucun joueur annoncé officiellement.")}</div><div class="roster-foot">${esc(r.game||"Esport")} / BLFESPORT</div></article>`;
    }).join(""):empty("Les rosters seront présentés prochainement.");
  }
    async function renderVideos() {
    const host = $("#videoGrid");
    if (!host) return;

    // Remplace cette valeur par ta nouvelle clé API YouTube
    const API_KEY = "AIzaSyD8xrem1cDT_OW2-nADBKsP8Xj5FUiIlqc";
    const HANDLE = "@BLFesport";

    host.innerHTML = empty("Chargement de la dernière vidéo de BLFesport…");

    try {
      const channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(HANDLE)}&key=${encodeURIComponent(API_KEY)}`
      );

      const channel = await channelResponse.json();

      if (!channelResponse.ok || !channel.items?.length) {
  throw new Error(
    channel.error?.message ||
    JSON.stringify(channel.error) ||
    "Aucune chaîne trouvée pour ce handle."
  );
}

      const uploads = channel.items[0].contentDetails.relatedPlaylists.uploads;

      const videoResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(uploads)}&maxResults=1&key=${encodeURIComponent(API_KEY)}`
      );

      const result = await videoResponse.json();

      if (!videoResponse.ok || !result.items?.length) {
        throw new Error("Aucune vidéo trouvée ou accès API refusé.");
      }

      const video = result.items[0].snippet;
      const id = result.items[0].contentDetails?.videoId
        || video.resourceId?.videoId;

      if (!id) throw new Error("Identifiant vidéo introuvable.");

      host.innerHTML = `
        <article class="video-card">
          <a class="video-thumb"
             href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}"
             target="_blank" rel="noopener noreferrer">
            <img loading="lazy"
                 src="https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg"
                 alt="${esc(video.title)}">
          </a>
          <div class="video-body">
            <small>DERNIÈRE PUBLICATION · ${esc(formatDate(video.publishedAt))}</small>
            <h4>${esc(video.title)}</h4>
            <p>La dernière vidéo publiée sur la chaîne YouTube officielle de BLFesport.</p>
            <a href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}"
               target="_blank" rel="noopener noreferrer">
              Regarder la vidéo ↗
            </a>
          </div>
        </article>
      `;

    } catch (error) {
      console.error("Erreur YouTube BLFesport :", error);
      host.innerHTML = empty(
        "Erreur YouTube : " + error.message
      );
    }
  }

  function renderStaff() {
    const host=$("#staffGrid");if(!host)return;const items=data.staff||[];
    host.innerHTML=items.length?items.map(s=>`<article class="staff-card"><div class="staff-avatar">${s.avatar?`<img loading="lazy" src="${esc(s.avatar)}" alt="">`:esc(initials(s.nickname))}</div><div><h3>${esc(s.nickname||"Pseudo à renseigner")}</h3><small>${esc(s.role||"Fonction à renseigner")}</small><p>${esc(s.bio||"Présentation à venir.")}</p></div></article>`).join(""):empty("Les responsables seront présentés ici.");
  }
  function renderPartners() {
    const host=$("#partnerGrid");if(!host)return;const items=data.partners||[];
    host.innerHTML=items.length?items.map(p=>`<article class="partner-card">${p.logo?`<img class="partner-logo" loading="lazy" src="${esc(p.logo)}" alt="">`:`<div class="partner-placeholder">${esc(initials(p.name))}</div>`}<strong>${esc(p.name||"Partenaire à annoncer")}</strong><p>${esc(p.description||"Informations à venir.")}</p>${validUrl(p.url)?`<a href="${esc(validUrl(p.url))}" target="_blank" rel="noopener">Visiter le site ↗</a>`:""}</article>`).join(""):empty("Les partenaires officiels seront affichés ici.");
  }
  function renderShop() {
    const host=$("#shopGrid");if(!host)return;const items=data.shop||[];
    host.innerHTML=items.length?items.map(p=>`<article class="shop-card"><div class="shop-image">${p.image?`<img loading="lazy" src="${esc(p.image)}" alt="">`:"BLF"}</div><div class="shop-body"><h3>${esc(p.name||"Produit BLF")}</h3><div class="shop-price">${esc(p.price||"Prix à définir")}</div><p>${esc(p.description||"Description à venir.")}</p><button class="button button-ghost" type="button" disabled title="La boutique n'est pas encore ouverte">${p.available?"Bientôt disponible":"Indisponible pour le moment"}</button></div></article>`).join(""):empty("Les produits seront annoncés ici.");
  }
  function renderSocial() {
    const social=data.site?.social||{};
    const labels={discord:"Discord",twitch:"Twitch",youtube:"YouTube",tiktok:"TikTok",instagram:"Instagram",x:"X"};
    document.querySelectorAll(".external-social").forEach(a=>{
      const key=a.dataset.social, url=validUrl(social[key]||"");
      if(url){a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.classList.remove("unavailable");}
      else {a.href="#communaute";a.classList.add("unavailable");a.setAttribute("aria-label",`${labels[key]||key} : lien à renseigner`);a.addEventListener("click",e=>{e.preventDefault();alert(`Le lien ${labels[key]||key} de BLFesport n'a pas encore été renseigné dans js/data.js.`)});}
    });
    const host=$("#socialLinks");if(host)host.innerHTML=Object.entries(labels).map(([key,label])=>validUrl(social[key]||"")?`<a class="social-link" href="${esc(validUrl(social[key]))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:`<span class="social-link unavailable" title="Lien à renseigner">${esc(label)} · À renseigner</span>`).join("");
  }
  function setup() {
    if(data.site){const tag=$("#heroTagline"),desc=$("#heroDescription");if(tag)tag.textContent=data.site.tagline||"L'ambition. La précision. La victoire.";if(desc)desc.textContent=data.site.description||"";document.title=`${data.site.name||"BLFesport"} — Organisation esport`;}
    
const year = $("#year");
if (year) year.textContent = new Date().getFullYear();

    renderNews();renderMatches();loadDiscordEvents();renderRosters();renderVideos();renderStaff();renderPartners();renderShop();renderSocial();
    setInterval(updateCountdown,1000);
    const toggle=$("#menuToggle"),nav=$("#mainNav");
    toggle?.addEventListener("click",()=>{const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));toggle.setAttribute("aria-label",open?"Fermer le menu":"Ouvrir le menu")});
    nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");toggle?.setAttribute("aria-expanded","false")}));
    if("IntersectionObserver" in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target)}}),{threshold:.08});document.querySelectorAll(".hero-copy,.hero-visual").forEach(el=>{el.classList.add("reveal");observer.observe(el)})}else document.querySelectorAll(".reveal").forEach(el=>el.classList.add("visible"));
  }
  document.addEventListener("DOMContentLoaded",setup);
})();
