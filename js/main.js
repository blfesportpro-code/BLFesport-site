
/* BLFesport — moteur du site multipages */
(() => {
  "use strict";

  const data = window.BLF_DATA || {};
  const $ = (selector, root = document) => root.querySelector(selector);

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  
const validUrl = value => {
  if (!value) return "";

  try {
    const url = new URL(value, document.baseURI);
    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
};


  const empty = message =>
    `<div class="empty-state">${esc(message)}</div>`;

  const formatDate = value => {
    if (!value) return "Date à annoncer";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date à annoncer"
      : new Intl.DateTimeFormat("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }).format(date);
  };

  const formatDateTime = value => {
    if (!value) return "Date à annoncer";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date à annoncer"
      : new Intl.DateTimeFormat("fr-FR", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        }).format(date);
  };

  const initials = value =>
    String(value || "BLF")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0] || "")
      .join("")
      .toUpperCase() || "BLF";


  /* =========================
     ACTUALITÉS
  ========================= */

  function renderNews() {
    const host = $("#newsGrid");
    if (!host) return;

    const cacheKey = "blfesport_discord_announcements_v1";

    const normalize = items => items.map(item => ({
      title: item.title || item.name || "Annonce Discord",
      description: item.description || item.content || item.message || "",
      date: item.date || item.posted_at || item.created_at || item.timestamp || "",
      category: item.category || "Discord",
      important: Boolean(item.important)
    }));

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
                <span>${esc(formatDate(item.date))}</span>
                <span class="news-arrow">↗</span>
              </div>
            </article>
          `).join("")
        : empty("Aucune annonce disponible pour le moment.");
    };

    let cached = [];

    try {
      const saved = JSON.parse(localStorage.getItem(cacheKey) || "[]");
      if (Array.isArray(saved)) cached = saved;
    } catch (error) {
      console.warn("Cache des annonces indisponible.", error);
    }

    const localAnnouncements = Array.isArray(data.announcements)
      ? data.announcements
      : [];

    render(cached.length ? cached : localAnnouncements);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    fetch(
      "https://api.dispresso.co/api/espresso/servers/1305208753150365697/site-feed",
      {
        signal: controller.signal,
        cache: "no-store"
      }
    )
      .then(response => {
        if (!response.ok) {
          throw new Error("Flux Discord indisponible : " + response.status);
        }
        return response.json();
      })
      .then(feed => {
        const announcements =
          feed.announcements || feed.data?.announcements;

        if (!Array.isArray(announcements) || !announcements.length) {
          throw new Error("Aucune annonce exploitable.");
        }

        const items = normalize(announcements);
        render(items);

        try {
          localStorage.setItem(cacheKey, JSON.stringify(items));
        } catch (error) {
          console.warn("Impossible de sauvegarder les annonces.", error);
        }
      })
      .catch(error => {
        console.warn("Flux Discord indisponible :", error);
      })
      .finally(() => clearTimeout(timeout));
  }


  /* =========================
     MATCHS ET ÉVÉNEMENTS
  ========================= */

  let discordMatches = [];
  let discordEvents = [];

  function isEventCurrentlyActive(event) {
    const now = Date.now();
    const start = new Date(event.scheduled_start_time).getTime();

    if (!Number.isFinite(start) || start > now) return false;

    const end = event.scheduled_end_time
      ? new Date(event.scheduled_end_time).getTime()
      : null;

    if (end && Number.isFinite(end) && now >= end) return false;

    // Statut 2 : événement Discord déjà commencé.
    // Statut 1 : événement programmé dont l'heure de début est passée.
    return event.status === 2 || event.status === 1;
  }

  function renderLiveEvent() {
    const section = $("#liveEventSection");
    const host = $("#liveEvent");

    if (!section || !host) return;

    const currentEvent = discordEvents.find(isEventCurrentlyActive);

    if (!currentEvent) {
      section.hidden = true;
      host.innerHTML = "";
      return;
    }

    section.hidden = false;

    const endText = currentEvent.scheduled_end_time
      ? formatDateTime(currentEvent.scheduled_end_time)
      : "Heure de fin non renseignée";

    host.innerHTML = `
      <div class="live-event-box">
        <div class="live-event-label">
          <span class="live-event-dot"></span>
          ÉVÉNEMENT EN COURS
        </div>

        <h2>${esc(currentEvent.name || "Événement BLFesport")}</h2>

        ${
          currentEvent.description
            ? `<p>${esc(currentEvent.description)}</p>`
            : ""
        }

        <div class="live-event-time">
          FIN PRÉVUE · ${esc(endText)}
        </div>
      </div>
    `;
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

      discordEvents = events;

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

      renderLiveEvent();
window.BLF_MATCH?.setDiscordMatches(discordMatches);

    } catch (error) {
      console.error("Synchronisation Discord impossible :", error);
      renderLiveEvent();
    }
  }

  
/* =========================
   DERNIERS RÉSULTATS — ACCUEIL
========================= */



  /* =========================
     ÉQUIPES
  ========================= */

  async function renderRosters() {
    const host = $("#rosterGrid");
    if (!host) return;

    const rosterNames = ["ROSTER A", "ROSTER B", "ROSTER C"];
    const localRosters = data.rosters || [];

    host.innerHTML = empty("Chargement des équipes BLFesport…");

    try {
      const response = await fetch(
        "https://blfesport-rosters.enzo-reuziault.workers.dev/",
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Erreur Worker : " + response.status);
      }

      const result = await response.json();

      if (!Array.isArray(result.players)) {
        throw new Error("Données des joueurs invalides.");
      }

      host.innerHTML = rosterNames.map((rosterName, index) => {
        const roster = localRosters[index] || {};

        const players = result.players.filter(player =>
          player.roster === rosterName
        );

        return `
          <article class="roster-card">
            <div class="roster-top">
              <div class="roster-emblem">
                BLF<span style="font-size:10px">${String.fromCharCode(65 + index)}</span>
              </div>
              <span class="roster-game">${esc(roster.game || "Rocket League")}</span>
            </div>

            <h3>${esc(rosterName)}</h3>

            <div class="roster-subtitle">
              ${esc(roster.subtitle || "Équipe BLFesport")}
            </div>

            <p>${esc(roster.description || "Roster officiel de BLFesport.")}</p>

            <span class="roster-status">
              ${players.length ? "ROSTER ACTIF" : "RECRUTEMENT / À ANNONCER"}
            </span>

            <div class="players-wrap">
              <h4>JOUEURS · ${players.length}</h4>

              ${
                players.length
                  ? players.map(player => `
                      <div class="player-chip">
                        <div class="player-avatar">
                          ${
                            validUrl(player.avatar)
                              ? `<img loading="lazy" src="${esc(validUrl(player.avatar))}" alt="Avatar de ${esc(player.displayName || player.username)}">`
                              : esc(initials(player.displayName || player.username))
                          }
                        </div>
                        <div>
                          <strong>${esc(player.displayName || player.username)}</strong>
                          <small>@${esc(player.username || "")}</small>
                        </div>
                      </div>
                    `).join("")
                  : empty("Aucun joueur annoncé officiellement.")
              }
            </div>

            <div class="roster-foot">
              ${esc(roster.game || "Rocket League")} / BLFESPORT
            </div>
          </article>
        `;
      }).join("");

    } catch (error) {
      console.error("Synchronisation des rosters impossible :", error);

      host.innerHTML = localRosters.length
        ? localRosters.map((roster, index) => {
            const players = roster.players || [];

            return `
              <article class="roster-card">
                <div class="roster-top">
                  <div class="roster-emblem">
                    BLF<span style="font-size:10px">${String.fromCharCode(65 + index)}</span>
                  </div>
                  <span class="roster-game">${esc(roster.game || "Rocket League")}</span>
                </div>

                <h3>${esc(roster.name || rosterNames[index] || "Roster")}</h3>
                <div class="roster-subtitle">${esc(roster.subtitle || "Équipe BLFesport")}</div>
                <p>${esc(roster.description || "Présentation à venir.")}</p>

                <span class="roster-status">${esc(roster.status || "Informations à venir")}</span>

                <div class="players-wrap">
                  <h4>JOUEURS · ${players.length}</h4>

                  ${
                    players.length
                      ? players.map(player => `
                          <div class="player-chip">
                            <div class="player-avatar">
                              ${
                                validUrl(player.avatar)
                                  ? `<img loading="lazy" src="${esc(validUrl(player.avatar))}" alt="">`
                                  : esc(initials(player.nickname))
                              }
                            </div>
                            <div>
                              <strong>${esc(player.nickname || "Pseudo à renseigner")}</strong>
                              <small>${esc(player.role || "Joueur")}</small>
                            </div>
                          </div>
                        `).join("")
                      : empty("Aucun joueur disponible.")
                  }
                </div>

                <div class="roster-foot">
                  ${esc(roster.game || "Esport")} / BLFESPORT
                </div>
              </article>
            `;
          }).join("")
        : empty("Impossible de charger les rosters pour le moment.");
    }
  }


  /* =========================
     VIDÉOS
  ========================= */

  function renderVideos() {
    const host = $("#videoGrid");
    if (!host) return;

    const videos = Array.isArray(data.videos) ? data.videos : [];

    const render = items => {
      host.innerHTML = items.length
        ? items.map(video => {
            const id = video.youtubeId || "";
            const url = validUrl(video.url) ||
              (id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "");

            const thumbnail = id
              ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`
              : "";

            return `
              <article class="video-card">
                ${
                  thumbnail
                    ? `<a class="video-thumb" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
                         <img loading="lazy" src="${esc(thumbnail)}" alt="${esc(video.title || "Vidéo BLFesport")}">
                       </a>`
                    : ""
                }
                <div class="video-body">
                  <small>${esc(video.type || "Publication")} · ${esc(formatDate(video.date))}</small>
                  <h4>${esc(video.title || "Vidéo BLFesport")}</h4>
                  <p>${esc(video.description || "")}</p>
                  ${
                    url
                      ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Regarder la vidéo ↗</a>`
                      : ""
                  }
                </div>
              </article>
            `;
          }).join("")
        : empty("Aucune vidéo publiée pour le moment.");
    };

    // Affiche les vidéos renseignées dans data.js.
    render(videos);

    /*
      Pour activer la récupération automatique YouTube,
      une clé API devra être configurée séparément dans
      window.BLF_YOUTUBE_API_KEY.

      La clé qui était écrite directement dans l'ancien
      main.js n'est volontairement pas recopiée ici.
    */
    const apiKey = window.BLF_YOUTUBE_API_KEY;
    const handle = "@BLFesport";

    if (!apiKey) return;

    fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(handle)}&key=${encodeURIComponent(apiKey)}`
    )
      .then(response => {
        if (!response.ok) throw new Error("Erreur de récupération de la chaîne.");
        return response.json();
      })
      .then(channel => {
        const playlist = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (!playlist) throw new Error("Playlist YouTube introuvable.");

        return fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlist)}&maxResults=3&key=${encodeURIComponent(apiKey)}`
        );
      })
      .then(response => {
        if (!response.ok) throw new Error("Erreur de récupération des vidéos.");
        return response.json();
      })
      .then(result => {
        if (!result.items?.length) return;

        const latestVideos = result.items.map(item => ({
          title: item.snippet.title,
          description: item.snippet.description,
          date: item.snippet.publishedAt,
          youtubeId: item.snippet.resourceId?.videoId,
          type: "YouTube"
        }));

        render(latestVideos);
      })
      .catch(error => {
        console.warn("Synchronisation YouTube impossible :", error);
      });
  }


  /* =========================
     STAFF
  ========================= */

 
function renderStaff() {
  const host = $("#staffGrid");
  if (!host) return;

  const items = Array.isArray(data.staff) ? data.staff : [];

  host.innerHTML = items.length
    ? items.map(member => `
        <article class="staff-card">
          <div class="staff-avatar">
            ${
              validUrl(member.avatar)
                ? `<img
                    loading="lazy"
                    src="${esc(member.avatar)}"
                    alt="Photo de ${esc(member.nickname || "membre du staff")}"
                  >`
                : `<span>${esc(initials(member.nickname))}</span>`
            }
          </div>

          <div class="staff-info">
            <span class="staff-label">BLFESPORT STAFF</span>
            <h3>${esc(member.nickname || "Pseudo à renseigner")}</h3>
            <div class="staff-role">${esc(member.role || "Fonction à renseigner")}</div>
            <p>${esc(member.bio || "Présentation à venir.")}</p>
          </div>
        </article>
      `).join("")
    : empty("Les responsables seront présentés ici.");
}



  /* =========================
     PARTENAIRES
  ========================= */

  function renderPartners() {
    const host = $("#partnerGrid");
    if (!host) return;

    const items = data.partners || [];

    host.innerHTML = items.length
      ? items.map(partner => `
          <article class="partner-card">
            ${
              validUrl(partner.logo)
                ? `<img class="partner-logo" loading="lazy" src="${esc(validUrl(partner.logo))}" alt="">`
                : `<div class="partner-placeholder">${esc(initials(partner.name))}</div>`
            }

            <strong>${esc(partner.name || "Partenaire à annoncer")}</strong>
            <p>${esc(partner.description || "Informations à venir.")}</p>

            ${
              validUrl(partner.url)
                ? `<a href="${esc(validUrl(partner.url))}" target="_blank" rel="noopener noreferrer">Visiter le site ↗</a>`
                : ""
            }
          </article>
        `).join("")
      : empty("Les partenaires officiels seront affichés ici.");
  }


  /* =========================
     BOUTIQUE
  ========================= */

  function renderShop() {
    const host = $("#shopGrid");
    if (!host) return;

    const items = data.shop || [];

    host.innerHTML = items.length
      ? items.map(product => `
          <article class="shop-card">
            <div class="shop-image">
              ${
                validUrl(product.image)
                  ? `<img loading="lazy" src="${esc(validUrl(product.image))}" alt="">`
                  : "BLF"
              }
            </div>

            <div class="shop-body">
              <h3>${esc(product.name || "Produit BLFesport")}</h3>
              <div class="shop-price">${esc(product.price || "Prix à définir")}</div>
              <p>${esc(product.description || "Description à venir.")}</p>

              <button
                class="button button-ghost"
                type="button"
                disabled
                title="La boutique n'est pas encore ouverte">
                ${product.available ? "Bientôt disponible" : "Indisponible pour le moment"}
              </button>
            </div>
          </article>
        `).join("")
      : empty("Les produits seront annoncés ici.");
  }


  /* =========================
     RÉSEAUX SOCIAUX
  ========================= */

  function renderSocial() {
    const social = data.site?.social || {};

    const labels = {
      discord: "Discord",
      twitch: "Twitch",
      youtube: "YouTube",
      tiktok: "TikTok",
      instagram: "Instagram",
      x: "X"
    };

    document.querySelectorAll(".external-social").forEach(link => {
      const key = link.dataset.social;
      const url = validUrl(social[key] || "");

      if (url) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.classList.remove("unavailable");
      } else {
        link.href = "#";
        link.classList.add("unavailable");
        link.setAttribute(
          "aria-label",
          `${labels[key] || key} : lien à renseigner`
        );
        link.addEventListener("click", event => event.preventDefault());
      }
    });

    const host = $("#socialLinks");

    if (host) {
      host.innerHTML = Object.entries(labels)
        .map(([key, label]) => {
          const url = validUrl(social[key] || "");

          return url
            ? `<a class="social-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`
            : `<span class="social-link unavailable">${esc(label)} · À renseigner</span>`;
        })
        .join("");
    }
  }


  /* =========================
     INITIALISATION
  ========================= */

  function setup() {
    if (data.site) {
      const tagline = $("#heroTagline");
      const description = $("#heroDescription");

      if (tagline) {
        tagline.textContent =
          data.site.tagline || "L'ambition. La précision. La victoire.";
      }

      if (description) {
        description.textContent = data.site.description || "";
      }

      document.title =
        `${data.site.name || "BLFesport"} — Organisation esport`;
    }

    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();

    renderNews();
    window.BLF_MATCH?.render();
    renderLiveEvent();
    loadDiscordEvents();
    renderRosters();
    renderVideos();
    renderStaff();
    renderPartners();
    renderShop();
    renderSocial();

    setInterval(updateCountdown, 1000);
    setInterval(renderLiveEvent, 1000);

    const toggle = $("#menuToggle");
    const nav = $("#mainNav");

    toggle?.addEventListener("click", () => {
      if (!nav) return;

      const open = nav.classList.toggle("open");

      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute(
        "aria-label",
        open ? "Fermer le menu" : "Ouvrir le menu"
      );
    });

    nav?.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle?.setAttribute("aria-expanded", "false");
      });
    });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08 });

      document.querySelectorAll(".hero-copy, .hero-visual").forEach(element => {
        element.classList.add("reveal");
        observer.observe(element);
      });
    } else {
      document.querySelectorAll(".reveal").forEach(element => {
        element.classList.add("visible");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", setup);

})();
