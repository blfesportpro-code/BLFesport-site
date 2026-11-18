
/* BLFesport — Gestion complète des matchs */
(() => {
  "use strict";

  const data = window.BLF_DATA || {};
  const SCRIM_API =
  "https://blfesport-scrim-results.enzo-reuziault.workers.dev/api/matches";
  const $ = selector => document.querySelector(selector);

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

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

  const getOpponentLogo = match => {
    const opponent = String(match?.opponent || "").trim().toLowerCase();
    const logos = data.opponentLogos || {};
    return match?.opponentLogo || logos[opponent] || "assets/nologo.png";
  };

  const validUrl = value => {
    try {
      const url = new URL(value, document.baseURI);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

 let discordMatches = [];
  let selectedMatchDetails = null;
let showAllMatches = false;

async function loadDiscordMatches() {
  try {
    const response = await fetch(SCRIM_API);

    if (!response.ok) {
      throw new Error("Erreur API : " + response.status);
    }

    const matches = await response.json();

    discordMatches = Array.isArray(matches)
      ? matches.map(match => ({
          ...match,
          date: parseDiscordDate(match.date),
          status: "finished",
          type: "friendly",
          competition: "Scrim",
          format: `BO${match.games?.length || 0}`
        }))
      : [];

console.log("Résultats Discord chargés :", discordMatches.length);
    
    render();
  } catch (error) {
    console.error("Impossible de charger les résultats Discord :", error);
  }
}

function parseDiscordDate(value) {
  const match = String(value || "").match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2})h(\d{2})$/
  );

  if (!match) return value;

  return new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
    Number(match[4]),
    Number(match[5])
  ).toISOString();
}

function sortMatchesNewestFirst(a, b) {
  const dateDifference =
    new Date(b.date).getTime() - new Date(a.date).getTime();

  if (dateDifference !== 0) return dateDifference;

  return new Date(b.createdAt || 0).getTime() -
         new Date(a.createdAt || 0).getTime();
}
  
   
function activeMatches() {
  const local = (data.matches || [])
    .filter(match => !match.example);

  const localWithoutDiscordDuplicate = local.filter(localMatch => {
    return !discordMatches.some(discordMatch => {
      const sameOpponent =
        String(localMatch.opponent || "").trim().toLowerCase() ===
        String(discordMatch.opponent || "").trim().toLowerCase();

      const sameResult =
        String(localMatch.result || "") ===
        String(discordMatch.result || "");

      const sameDate =
        Math.abs(
          new Date(localMatch.date).getTime() -
          new Date(discordMatch.date).getTime()
        ) < 60000;

      return sameOpponent && sameResult && sameDate;
    });
  });

  return [...discordMatches, ...localWithoutDiscordDuplicate];
}


  function getStats() {
    const base = Array.isArray(data.seasonStats)
      ? data.seasonStats
      : [];

    const getBase = label => {
      const stat = base.find(item =>
        String(item.label || "").toLowerCase() === label.toLowerCase()
      );

      return Math.max(0, Number(stat?.value) || 0);
    };

    const basePlayed = getBase("Matchs officiels joués");
    const baseWins = getBase("Victoires officiels");
    const baseLosses = getBase("Défaites officiels");

   const finished = activeMatches().filter(match =>
      match.status === "finished" &&
      !match.example
    );

    let wins = 0;
    let losses = 0;
    let draws = 0;

    finished.forEach(match => {
      const score = String(match.result || "")
        .match(/(\d+)\s*[-–:]\s*(\d+)/);

      if (!score) return;

      const blf = Number(score[1]);
      const opponent = Number(score[2]);

      if (blf > opponent) wins++;
      else if (blf < opponent) losses++;
      else draws++;
    });

    const played = basePlayed + wins + losses + draws;
    const totalWins = baseWins + wins;
    const totalLosses = baseLosses + losses;

    const percentage = played
      ? ((totalWins / played) * 100).toFixed(1)
      : "0";

    return [
      { label: "Matchs officiels joués", value: played },
      { label: "Victoires officielles", value: totalWins },
      { label: "Défaites officielles", value: totalLosses },
      { label: "Taux de victoire", value: percentage + "%" }
    ];
  }

  function updateCountdown() {
    document.querySelectorAll("[data-countdown]").forEach(element => {
      const target = new Date(element.dataset.countdown).getTime();
      if (!Number.isFinite(target)) return;

      const diff = Math.max(0, target - Date.now());

      const values = {
        days: Math.floor(diff / 86400000),
        hours: Math.floor(diff % 86400000 / 3600000),
        minutes: Math.floor(diff % 3600000 / 60000),
        seconds: Math.floor(diff % 60000 / 1000)
      };

      Object.entries(values).forEach(([key, value]) => {
        const node = element.querySelector(`[data-${key}]`);
        if (node) node.textContent = String(value).padStart(2, "0");
      });
    });
  }


function renderMatchDetails(match) {
  const players = Array.isArray(match.players) ? match.players : [];
  const games = Array.isArray(match.games) ? match.games : [];

  return `
    <div class="match-details-panel">

      <div class="match-details-header">
        <div>
          <span>ADVERSAIRE</span>
          <strong>${esc(match.opponent || "Non renseigné")}</strong>
        </div>
        <div>
          <span>RÉSULTAT FINAL</span>
          <strong>${esc(match.result || "—")}</strong>
        </div>
        <div>
          <span>ROSTER</span>
          <strong>${esc(match.roster || "—")}</strong>
        </div>
      </div>

      <div class="match-details-section">
        <h4>INFORMATIONS DU MATCH</h4>
        <p>DATE : ${esc(formatDateTime(match.date))}</p>
        <p>CLASSEMENT : ${esc(match.elo || "Non renseigné")}</p>
      </div>

      <div class="match-details-section">
        <h4>JOUEURS PARTICIPANTS</h4>
        <div class="match-details-players">
          ${players.map((player, index) => `
            <span class="match-player-name">
              ${esc(player.name || player.id || player)}
            </span>
          `).join("") || "Aucun joueur renseigné"}
        </div>
      </div>

      <div class="match-details-section">
        <h4>DÉTAIL DES GAMES</h4>
        <div class="match-details-games">
          ${games.map(game => `
            <div class="match-details-game">
              <span>GAME ${esc(game.game ?? "—")}</span>
              <strong>${esc(game.score || "—")}</strong>
              ${game.overtime ? "<span>OT</span>" : ""}
            </div>
          `).join("") || "Aucun score disponible"}
        </div>
      </div>

    </div>
  `;
}

  
  function renderMatches() {
   const matches = activeMatches()
  .sort(sortMatchesNewestFirst);

    const now = new Date();

    const upcoming = matches.filter(match =>
      match.status !== "finished" &&
      new Date(match.date) >= now
    );

    const next = upcoming[0];
    const host = $("#nextMatch");

    if (host) {
      if (!next) {
        host.innerHTML = `
          <div>
            <span class="match-kicker">PROCHAIN RENDEZ-VOUS</span>
            <h3 class="match-title">LE PROCHAIN MATCH SE PRÉPARE.</h3>
            <p class="match-note">
              Aucun match confirmé pour le moment.
              Les informations seront publiées ici dès qu'elles seront disponibles.
            </p>
          </div>
          <div class="countdown-wrap">
            <div class="countdown-label">COMPTE À REBOURS</div>
            <div class="countdown">
              <div class="countdown-unit"><strong>—</strong><small>JOURS</small></div>
              <div class="countdown-unit"><strong>—</strong><small>HEURES</small></div>
              <div class="countdown-unit"><strong>—</strong><small>MIN</small></div>
            </div>
            <div class="match-note">En attente d'une date confirmée</div>
          </div>
        `;
      } else {
        const stream = validUrl(next.streamUrl);

        host.innerHTML = `
          <div>
            <span class="match-kicker">
              ✦ PROCHAIN RENDEZ-VOUS • ${esc(next.roster || "BLFesport")}
            </span>
            <h3 class="match-title">
              ${
                next.isDiscordEvent
                  ? esc(next.opponent)
                  : `BLF <span style="color:#c77aff">VS</span> ${esc(next.opponent || "Adversaire à confirmer")}`
              }
            </h3>
            <div class="match-detail">
              <span>◷ ${esc(formatDateTime(next.date))}</span>
              <span>⌁ ${esc(next.competition || "Compétition à confirmer")}</span>
              <span>▣ ${esc(next.format || "Format à confirmer")}</span>
            </div>
            ${
              stream
                ? `<p><a class="text-link" href="${esc(stream)}" target="_blank" rel="noopener">Accéder au stream ↗</a></p>`
                : ""
            }
          </div>
          <div class="countdown-wrap">
            <div class="countdown-label">LE MATCH COMMENCE DANS</div>
            <div class="countdown" data-countdown="${esc(next.date)}">
              <div class="countdown-unit"><strong data-days>00</strong><small>JOURS</small></div>
              <div class="countdown-unit"><strong data-hours>00</strong><small>HEURES</small></div>
              <div class="countdown-unit"><strong data-minutes>00</strong><small>MIN</small></div>
              <div class="countdown-unit"><strong data-seconds>00</strong><small>SEC</small></div>
            </div>
            <div class="match-note">Heure locale de votre appareil</div>
          </div>
        `;
      }
    }

    const list = $("#matchList");

    if (list) {
      const recent = matches
        .filter(match => match.status === "finished")
        .sort(sortMatchesNewestFirst);

const rows = [
  ...upcoming,
  ...recent
];

const visibleRows = showAllMatches ? rows : rows.slice(0, 3);

    
list.innerHTML = rows.length
  ? visibleRows.map(match => `

<div class="match-row">

  <div class="match-date">
   ${esc(match.roster === "Roster A" || match.roster === "Roster B" || match.roster === "Roster C"
  ? formatDateTime(match.date)
  : formatDate(match.date))}
  </div>

  <div class="match-teams">
  <div class="match-team-logo">
    <img src="assets/blflogo.png" alt="BLFesport">
  </div>

  <div class="match-team-name">
    <strong>BLFesport</strong>
    <span>VS</span>
    <strong>${esc(match.opponent || "Adversaire à confirmer")}</strong>
  </div>

  <div class="match-opponent-logo">
    <img
      src="${esc(getOpponentLogo(match))}"
      alt="Logo ${esc(match.opponent || "adversaire")}"
      onerror="this.onerror=null;this.src='assets/nologo.png';"
    >
  </div>
</div>

  <div class="match-info match-extra">
    <span>${esc(match.roster || "Roster à confirmer")}</span>
    <span>${esc(match.competition || "Scrim")}</span>
    <span>${esc(match.format || "Format à confirmer")}</span>
  </div>

  <span class="match-status ${
    match.status === "finished"
      ? (Number(String(match.result).split(/[-–:]/)[0]) > Number(String(match.result).split(/[-–:]/)[1])
          ? "win"
          : Number(String(match.result).split(/[-–:]/)[0]) < Number(String(match.result).split(/[-–:]/)[1])
            ? "loss"
            : "draw")
      : ""
  }">
    ${match.status === "finished"
      ? esc(match.result || "Résultat à renseigner")
      : "À venir"}
   </span>

  <button
    type="button"
    class="match-details-toggle"
    onclick="
      const panel = this.nextElementSibling;
      panel.hidden = !panel.hidden;
      this.textContent = panel.hidden
        ? 'EN SAVOIR PLUS'
        : 'MASQUER LES DÉTAILS';
    "
  >
    EN SAVOIR PLUS
  </button>

  <div class="match-details-content" hidden>
    ${renderMatchDetails(match)}
  </div>

  ${
    match.replayUrl && validUrl(match.replayUrl)
      ? (() => {
          const url = validUrl(match.replayUrl);
          const videoId = url.match(
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
          )?.[1];

          return videoId ? `
            <a class="match-replay"
               href="${esc(url)}"
               target="_blank"
               rel="noopener noreferrer">
              <img
                src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg"
                alt="Rediffusion du match"
                loading="lazy"
              >
              <span><span class="replay-play">▶</span> VOIR LA REDIFFUSION</span>
            </a>
          ` : "";
        })()
      : ""
  }

</div>

    `).join("")
  : empty("Le calendrier sera publié dès que les dates et adversaires seront confirmés.");

const toggle = $("#matchListToggle");

if (toggle) {
toggle.style.display = rows.length > 3 ? "" : "none";
  toggle.textContent = showAllMatches
    ? "Réduire ↑"
    : "Voir tous les matchs ↓";

  toggle.onclick = () => {
    showAllMatches = !showAllMatches;
    renderMatches();
  };
}

}
    
    const stats = $("#seasonStats");

        if (stats) {
      stats.innerHTML = getStats().map(stat => `
        <div class="stat-box">
          <strong>${esc(stat.value)}</strong>
          <span>${esc(stat.label)}</span>
        </div>
      `).join("");
    }

    updateCountdown();
  }

  function renderHomeResults() {
    const host = $("#homeResultsGrid");
    if (!host) return;

   const results = activeMatches()
      .filter(match => match.status === "finished" && !match.example)
      .sort(sortMatchesNewestFirst)
      .slice(0, 4);

    host.innerHTML = results.length
      ? results.map(match => {
          const score = String(match.result || "—");
          const numbers = score.match(/(\d+)\s*[-–:]\s*(\d+)/);

          let status = "";

          if (numbers) {
            status = Number(numbers[1]) > Number(numbers[2])
              ? "win"
              : Number(numbers[1]) < Number(numbers[2])
                ? "loss"
                : "draw";
          }

          const statusText = status === "win"
            ? "VICTOIRE"
            : status === "loss"
              ? "DÉFAITE"
              : status === "draw"
                ? "ÉGALITÉ"
                : "TERMINÉ";

          const opponentName = String(match.opponent || "Adversaire");
          const opponentKey = opponentName.trim().toLowerCase();
          const opponentLogo = match.opponentLogo || (data.opponentLogos || {})[opponentKey] || "";
          const opponentInitials = opponentName
            .split(/\\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join("");

          return `
            <article class="home-result-card">
              <div class="home-result-teams">
                <div class="home-result-team home-result-team--blf">
                  <img src="assets/blflogo.webp" alt="Logo BLFesport">
                  <strong>BLFesport</strong>
                </div>

                <div class="home-result-score">${esc(score)}</div>

                <div class="home-result-team home-result-team--opponent">
                  ${opponentLogo
                    ? `<img src="${esc(opponentLogo)}" alt="Logo ${esc(opponentName)}">`
                    : `<span class="home-result-monogram" aria-hidden="true">${esc(opponentInitials || "?")}</span>`
                  }
                  <strong>${esc(opponentName)}</strong>
                </div>
              </div>
              <div class="home-result-info">
                <span>${esc(match.competition || "Compétition")}</span>
                <span class="home-result-status ${status}">${statusText}</span>
              </div>
              <div class="home-result-info">
                <span>${esc(match.roster || "BLFesport")}</span>
                <span>${esc(formatDate(match.date))}</span>
              </div>
            </article>
          `;
        }).join("")
      : empty("Aucun résultat disponible pour le moment.");
  }

  function render() {
    renderMatches();
    renderHomeResults();
  }

   loadDiscordMatches();
  window.BLF_MATCH = {
    getStats,
    render,
    renderMatches,
    renderHomeResults,
    updateCountdown,
    setDiscordMatches(matches) {
      discordMatches = Array.isArray(matches) ? matches : [];
      renderMatches();
    }
  };
})();
