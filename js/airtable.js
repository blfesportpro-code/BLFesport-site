/* BLFesport — liaison publique avec BLFesport Manager.
   L'URL reste vide jusqu'au déploiement du Worker Cloudflare. */
(() => {
  "use strict";

  const API_BASE_URL = ""; // Exemple après déploiement : https://blfesport-airtable-api.<compte>.workers.dev

  async function loadMatches() {
    if (!API_BASE_URL) {
      console.info("BLFesport Manager : l'API Airtable sera activée après le déploiement du Worker.");
      return [];
    }

    const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/api/matches`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) throw new Error(`API Airtable HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Format de réponse Airtable invalide");

    return rows.map(row => ({
      id: row.externalId || row.id,
      date: row.date,
      roster: row.roster,
      opponent: row.opponent,
      competition: row.competition,
      format: row.format,
      result: row.result,
      status: row.status,
      players: [],
      replayUrl: "",
      example: false,
      source: "airtable"
    }));
  }

  window.BLF_AIRTABLE = { loadMatches };
})();
