
/* BLFesport — Gestion complète des matchs */
(() => {
  "use strict";

  const data = window.BLF_DATA || {};
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

  const validUrl = value => {
    try {
      const url = new URL(value, document.baseURI);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  let discordMatches = [];

  function activeMatches() {
    const local = (data.matches || [])
      .filter(match => !match.example);

    return [...local, ...discordMatches];
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

    const finished = (data.matches || []).filter(match =>
      match.status === "finished" &&
      !match.example &&
      match.type !== "friendly"
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

  function renderMatches() {
    const matches = activeMatches()
      .sort((a, b) => new Date(a.date) - new Date(b.date));

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
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const rows = [
        ...upcoming.slice(0, 4),
        ...recent.slice(0, 3)
      ];

      list.innerHTML = rows.length
        ? rows.map(match => `
            <div class="match-row">
              <div class="match-date">${esc(formatDate(match.date))}</div>
              <div>
                <div class="match-opponent">
                  ${match.isDiscordEvent ? "" : "BLFesport vs "}
                  ${esc(match.opponent || "Adversaire à confirmer")}
                </div>
                <div class="match-info">
                  ${esc(match.roster || "Roster à confirmer")} ·
                  ${esc(match.competition || "Compétition à confirmer")}
                </div>
              </div>
              <div class="match-info">${esc(match.format || "Format à confirmer")}</div>
              <span class="match-status ${match.status === "finished" ? "result" : ""}">
                ${
                  match.status === "finished"
                    ? esc(match.result || "Résultat à renseigner")
                    : "À venir"
                }
              </span>
            </div>
          `).join("")
        : empty("Le calendrier sera publié dès que les dates et adversaires seront confirmés.");
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

    const results = (data.matches || [])
      .filter(match => match.status === "finished" && !match.example)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
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

          return `
            <article class="home-result-card">
              <div class="home-result-teams">
                <div class="home-result-team"><strong>BLFesport</strong></div>
                <div class="home-result-score">${esc(score)}</div>
                <div class="home-result-team">
                  <strong>${esc(match.opponent || "Adversaire")}</strong>
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
