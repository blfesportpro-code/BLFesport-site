
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

  const normalizeOpponentName = value =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");

  const getOpponentLogo = match => {
    const opponent = normalizeOpponentName(match?.opponent);
    const logos = data.opponentLogos || {};
    const manualLogoKey = Object.keys(logos).find(key =>
      normalizeOpponentName(key) === opponent
    );
    return (manualLogoKey ? logos[manualLogoKey] : "") ||
      match?.opponentLogo ||
      "assets/nologo.png";
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


  function getStats(matches = activeMatches()) {
    const finished = matches.filter(match =>
      match.status === "finished" && !match.example
    );

    let played = 0;
    let wins = 0;
    let losses = 0;

    finished.forEach(match => {
      const score = String(match.result || "")
        .match(/(\d+)\s*[-–:]\s*(\d+)/);
      if (!score) return;

      const blf = Number(score[1]);
      const opponent = Number(score[2]);
      if (blf === opponent) return;

      played++;
      if (blf > opponent) wins++;
      else losses++;
    });

    const percentage = played
      ? ((wins / played) * 100).toFixed(1)
      : "0.0";

    return [
      { label: "Matchs joués", value: played },
      { label: "Victoires", value: wins },
      { label: "Défaites", value: losses },
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
  const opponent = match.opponent || "Adversaire non renseigné";
  const rosterKey = normalizeOpponentName(match.roster || "");
  const roster = ["roster c", "roster academique"].includes(rosterKey)
    ? "ROSTER ACADEMIQUE"
    : (match.roster || "Roster non renseigné");
  const date = match.date ? new Date(match.date) : null;
  const validDate = date && !Number.isNaN(date.getTime());
  const dateLabel = validDate
    ? new Intl.DateTimeFormat("fr-FR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric"
      }).format(date)
    : "Date non renseignée";
  const timeLabel = validDate
    ? new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit", minute: "2-digit"
      }).format(date)
    : "Heure non renseignée";
  const replayUrl = validUrl(match.replayUrl);
  const streamUrl = validUrl(match.streamUrl);
  const competition = match.competition || (match.type === "friendly" ? "Scrim" : "");
  const format = match.format || (games.length ? `BO${games.length}` : "");
  const statusLabel = match.status === "finished" ? "MATCH TERMINÉ" : "MATCH À VENIR";

  const playerNames = players.map(player => {
    if (typeof player === "string" || typeof player === "number") return String(player);
    return player?.name || player?.nickname || player?.displayName ||
      player?.username || player?.id || "Joueur";
  }).filter(Boolean);

  const gameCards = games.map((game, index) => {
    const gameNumber = game && typeof game === "object"
      ? (game.game ?? index + 1)
      : index + 1;
    const gameScore = game && typeof game === "object"
      ? (game.score || game.result || "Score non renseigné")
      : String(game || "Score non renseigné");
    const overtime = Boolean(game && typeof game === "object" && game.overtime);
    return `
      <div class="match-details-game">
        <span>GAME ${esc(gameNumber)}</span>
        <strong>${esc(gameScore)}</strong>
        ${overtime ? "<span class='match-game-ot'>OVERTIME</span>" : ""}
      </div>
    `;
  }).join("");

  return `
    <div class="match-details-panel">
      <div class="match-details-topline">
        <span class="match-details-status">${esc(statusLabel)}</span>
        ${competition ? `<span>${esc(competition)}</span>` : ""}
        ${format ? `<span>${esc(format)}</span>` : ""}
      </div>

      <div class="match-details-scoreboard">
        <div class="match-details-team">
          <img src="assets/blflogo.webp" alt="" loading="lazy">
          <strong>BLFesport</strong>
        </div>
        <div class="match-details-final-score">
          <span>RÉSULTAT FINAL</span>
          <strong>${esc(match.result || (match.status === "finished" ? "Score non renseigné" : "À venir"))}</strong>
        </div>
        <div class="match-details-team match-details-team-opponent">
          <img src="${esc(getOpponentLogo(match))}" alt="" loading="lazy"
            onerror="this.onerror=null;this.src='assets/nologo.png';">
          <strong>${esc(opponent)}</strong>
        </div>
      </div>

      <div class="match-details-meta">
        <div><span>ROSTER</span><strong>${esc(roster)}</strong></div>
        <div><span>DATE</span><strong>${esc(dateLabel)}</strong></div>
        <div><span>HEURE</span><strong>${esc(timeLabel)}</strong></div>
        ${match.elo ? `<div><span>CLASSEMENT</span><strong>${esc(match.elo)}</strong></div>` : ""}
      </div>

      <div class="match-details-section">
        <h4>JOUEURS PARTICIPANTS</h4>
        <div class="match-details-players">
          ${playerNames.length
            ? playerNames.map(name => `<span class="match-player-name">${esc(name)}</span>`).join("")
            : "<span class='match-details-unavailable'>Les joueurs n'ont pas été renseignés pour ce match.</span>"}
        </div>
      </div>

      <div class="match-details-section">
        <h4>DÉTAIL DES GAMES</h4>
        <div class="match-details-games">
          ${gameCards || "<span class='match-details-unavailable'>Les scores de chaque game ne sont pas disponibles.</span>"}
        </div>
      </div>

      ${replayUrl || streamUrl ? `
        <div class="match-details-links">
          ${replayUrl ? `<a href="${esc(replayUrl)}" target="_blank" rel="noopener noreferrer">VOIR LA REDIFFUSION ↗</a>` : ""}
          ${streamUrl ? `<a href="${esc(streamUrl)}" target="_blank" rel="noopener noreferrer">ACCÉDER AU STREAM ↗</a>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

  
  function initMatchFilters() {
    const toggle = $("#matchFiltersToggle");
    const panel = $("#matchFiltersPanel");
    const selects = ["#matchRosterFilter", "#matchResultFilter", "#matchTypeFilter"]
      .map(selector => $(selector))
      .filter(Boolean);
    const reset = $("#matchFiltersReset");

    if (toggle && panel) {
      toggle.onclick = () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute("aria-expanded", String(!panel.hidden));
        toggle.textContent = panel.hidden ? "FILTRER LES MATCHS" : "MASQUER LES FILTRES";
      };
    }

    selects.forEach(select => {
      select.onchange = () => {
        showAllMatches = false;
        renderMatches();
      };
    });

    if (reset) {
      reset.onclick = () => {
        selects.forEach(select => { select.value = "all"; });
        showAllMatches = false;
        renderMatches();
      };
    }
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
    let statsMatches = matches;

    if (list) {
      const recent = matches
        .filter(match => match.status === "finished")
        .sort(sortMatchesNewestFirst);

const rows = [
  ...upcoming,
  ...recent
];

const rosterValue = $("#matchRosterFilter")?.value || "all";
const resultValue = $("#matchResultFilter")?.value || "all";
const typeValue = $("#matchTypeFilter")?.value || "all";

const filteredRows = rows.filter(match => {
  const roster = normalizeOpponentName(match.roster || "");
  const rosterMatches = rosterValue === "all" ||
    (rosterValue === "roster academique"
      ? ["roster academique", "roster c"].includes(roster)
      : roster === rosterValue);

  const score = String(match.result || "").match(/(\d+)\s*[-–:]\s*(\d+)/);
  const result = score
    ? Number(score[1]) > Number(score[2]) ? "win"
      : Number(score[1]) < Number(score[2]) ? "loss" : "draw"
    : "";
  const resultMatches = resultValue === "all" ||
    (resultValue === "upcoming"
      ? match.status !== "finished" && new Date(match.date) >= now
      : match.status === "finished" && result === resultValue);

  const isScrim = normalizeOpponentName(match.competition || "").includes("scrim") ||
    normalizeOpponentName(match.type || "") === "friendly";
  const typeMatches = typeValue === "all" ||
    (typeValue === "scrim" ? isScrim : !isScrim);

  return rosterMatches && resultMatches && typeMatches;
});

statsMatches = filteredRows;
const visibleRows = showAllMatches ? filteredRows : filteredRows.slice(0, 3);

    
list.innerHTML = filteredRows.length
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
    <span>${esc(["roster c", "roster academique"].includes(normalizeOpponentName(match.roster)) ? "ROSTER ACADEMIQUE" : (match.roster || "Roster à confirmer"))}</span>
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
      this.setAttribute('aria-expanded', String(!panel.hidden));
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
  : empty(rows.length ? "Aucun match ne correspond aux filtres sélectionnés." : "Le calendrier sera publié dès que les dates et adversaires seront confirmés.");

const toggle = $("#matchListToggle");

if (toggle) {
toggle.style.display = filteredRows.length > 3 ? "" : "none";
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
      stats.innerHTML = getStats(statsMatches).map(stat => `
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
          const resolvedOpponentLogo = getOpponentLogo(match);
          const opponentLogo = resolvedOpponentLogo === "assets/nologo.png" ? "" : resolvedOpponentLogo;
          const opponentInitials = opponentName
            .split(/\s+/)
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

   initMatchFilters();
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
