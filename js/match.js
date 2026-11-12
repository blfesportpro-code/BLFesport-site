
/* BLFesport — Gestion des matchs et statistiques */
(() => {
  "use strict";

  const data = window.BLF_DATA || {};

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

    const basePlayed = getBase("Matchs joués");
    const baseWins = getBase("Victoires");
    const baseLosses = getBase("Défaites");

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
      { label: "Matchs joués", value: played },
      { label: "Victoires", value: totalWins },
      { label: "Défaites", value: totalLosses },
      { label: "Taux de victoire", value: percentage + "%" }
    ];
  }

  window.BLF_MATCH = {
    getStats
  };
})();

