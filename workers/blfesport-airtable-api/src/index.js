/**
 * BLFesport Manager — synchronisation SITE/DISCORD -> AIRTABLE.
 * Secrets Cloudflare : AIRTABLE_TOKEN (read + write), SYNC_SECRET.
 * Variables : AIRTABLE_BASE_ID, ALLOWED_ORIGIN.
 * Le site public ne reçoit jamais le token Airtable.
 */
const TABLES = {
  matches: "tbl0gdXNHAbElTV7x",
  playerStats: "tbl94FoKhudfqR0kW"
};
const F = {
  match: {
    name: "fld8Z5QXV1AJOOt4o", date: "fldtKv1Xo7G1iosH7",
    opponent: "fld3dJrvMyfFBQ0BM", competition: "fldV8UO1WnbWmH3Lg",
    format: "fldCHxTm8Z7wmBTpN", result: "fldA37wxrPd2eCUKu",
    blfScore: "fldOKoI21qqF5qcZy", opponentScore: "fldol80htLVjG1nde",
    notes: "fldvu82m8ZpHaTmuf", roster: "fldSpaHdZ51r19jJf",
    siteId: "fldBoNUaxwsuNqosq", sync: "fldDZy8fwMT9sCaBe"
  }
};
const SITE_DATA_URL = "https://raw.githubusercontent.com/blfesportpro-code/BLFesport-site/main/js/data.js";
const DISCORD_RESULTS_URL = "https://blfesport-scrim-results.enzo-reuziault.workers.dev/api/matches";
const json = (data, status = 200, origin = "*") => new Response(JSON.stringify(data), {
  status, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization"
  }
});
async function listRecords(env, tableId) {
  const rows = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("returnFieldsByFieldId", "true");
    if (offset) url.searchParams.set("offset", offset);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` } });
    if (!response.ok) throw new Error(`Airtable ${response.status}: ${(await response.text()).slice(0, 250)}`);
    const payload = await response.json();
    rows.push(...(payload.records || []));
    offset = payload.offset;
  } while (offset);
  return rows;
}
const val = (fields, id) => fields?.[id] ?? null;
const links = value => Array.isArray(value) ? value : [];
function extractArray(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`Donnée introuvable dans js/data.js : ${marker}`);
  const start = source.indexOf("[", at + marker.length);
  if (start < 0) throw new Error("Tableau de matchs introuvable");
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        const literal = source.slice(start, i + 1)
          .replace(/([{,]\\s*)([A-Za-z_$][\\w$]*)\\s*:/g, '$1"$2":')
          .replace(/,\\s*([}\\]])/g, "$1");
        return JSON.parse(literal);
      }
    }
  }
  throw new Error("Fin du tableau de matchs non trouvée");
}
function parseDate(value) {
  if (!value) return null;
  const french = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2})h(\d{2})$/);
  if (french) return new Date(Date.UTC(+french[3], +french[2] - 1, +french[1], +french[4], +french[5])).toISOString().slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function parseScore(match) {
  const raw = match.result || match.score || match.finalScore || "";
  const found = String(raw).match(/(\d+)\s*[-–:]\s*(\d+)/);
  if (!found) return { a: null, b: null };
  return { a: Number(found[1]), b: Number(found[2]) };
}
function normalizeMatch(match, source) {
  const score = parseScore(match);
  const opponent = String(match.opponent || match.opponentName || match.team || "Adversaire à renseigner").trim();
  const rawId = match.id ?? match.matchId ?? match.uuid;
  const fingerprint = [match.date || "", opponent.toLowerCase(), match.result || "", match.roster || ""].join("|");
  const externalId = source === "site"
    ? `site:${rawId || fingerprint}`
    : `discord:${rawId || fingerprint}`;
  const rawRoster = String(match.roster || "Roster A").toLowerCase();
  const roster = rawRoster.includes("academ") || rawRoster === "roster c" ? "Roster Académique"
    : rawRoster.includes("roster b") ? "Roster B" : "Roster A";
  const compText = String(match.competition || (source === "discord" ? "Scrim" : "Tournoi"));
  const competition = /scrim/i.test(compText) ? "Scrim" : /ligue|championnat/i.test(compText) ? "Ligue"
    : /amical/i.test(compText) ? "Amical" : "Tournoi";
  const fmt = String(match.format || (match.games?.length ? `BO${match.games.length}` : ""));
  const format = ["BO3", "BO5", "BO7"].includes(fmt.toUpperCase()) ? fmt.toUpperCase() : null;
  const outcome = score.a == null || score.b == null || score.a === score.b ? null : score.a > score.b ? "Victoire" : "Défaite";
  const date = parseDate(match.date);
  const playerNames = (match.players || []).map(player => player.name).filter(Boolean);
  const gameScores = (match.games || []).map(game => `M${game.game}: ${game.score}${game.overtime ? " (prolongation)" : ""}`).join(" | ");
  const notes = [
    "Source : résultats Discord",
    match.elo ? `Niveau : ${match.elo}` : "",
    playerNames.length ? `Joueurs : ${playerNames.join(", ")}` : "",
    gameScores ? `Détail des manches : ${gameScores}` : "",
    match.replayUrl ? `Replay : ${match.replayUrl}` : "",
    match.notes || ""
  ].filter(Boolean).join(" — ");
  const fields = {
    [F.match.name]: `BLFesport vs ${opponent}`,
    [F.match.opponent]: opponent,
    [F.match.roster]: roster,
    [F.match.competition]: competition,
    [F.match.sync]: "Synchronisé",
    [F.match.siteId]: externalId,
    [F.match.notes]: notes
  };
  if (date) fields[F.match.date] = date;
  if (format) fields[F.match.format] = format;
  if (outcome) fields[F.match.result] = outcome;
  if (score.a != null && score.b != null) {
    fields[F.match.blfScore] = score.a;
    fields[F.match.opponentScore] = score.b;
  }
  return { fields, externalId };
}
async function fetchSource(url, label) {
  const response = await fetch(url, { headers: { "user-agent": "BLFesport-Manager/1.0" } });
  if (!response.ok) throw new Error(`${label} indisponible (HTTP ${response.status})`);
  return response;
}
async function syncMatches(env) {
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) throw new Error("Configuration Airtable incomplète");
  // Source unique : la même API Discord que celle utilisée par js/match.js sur le site.
  const discordResponse = await fetchSource(DISCORD_RESULTS_URL, "Résultats compétitifs Discord");
  const discordMatches = await discordResponse.json();
  if (!Array.isArray(discordMatches)) throw new Error("Format inattendu de l'API des résultats Discord");
  const unique = [...new Map(discordMatches.map(match => {
    const item = normalizeMatch(match, "discord");
    return [item.externalId, item];
  })).values()];
  let createdOrUpdated = 0;
  for (let i = 0; i < unique.length; i += 10) {
    const url = new URL(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${TABLES.matches}`);
    url.searchParams.set("returnFieldsByFieldId", "true");
    const response = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: [F.match.siteId] },
        records: unique.slice(i, i + 10).map(item => ({ fields: item.fields }))
      })
    });
    if (!response.ok) throw new Error(`Écriture Airtable ${response.status}: ${(await response.text()).slice(0, 350)}`);
    const result = await response.json();
    createdOrUpdated += (result.records || []).length;
  }
  return { source: "Discord compétitions", received: discordMatches.length, processed: unique.length, createdOrUpdated };
}
async function handle(request, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || "https://blfesportpro-code.github.io";
  const origin = request.headers.get("Origin") || "";
  const corsOrigin = origin === allowedOrigin ? origin : allowedOrigin;
  if (request.method === "OPTIONS") return new Response(null, { headers: {
    "access-control-allow-origin": corsOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
    "access-control-max-age": "86400"
  }});
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) return json({ error: "Airtable non configuré" }, 503, corsOrigin);
  const path = new URL(request.url).pathname;
  if (request.method === "POST" && path === "/admin/sync") {
    if (!env.SYNC_SECRET || request.headers.get("Authorization") !== `Bearer ${env.SYNC_SECRET}`) {
      return json({ error: "Non autorisé" }, 401, corsOrigin);
    }
    try { return json({ status: "ok", sync: await syncMatches(env) }, 200, corsOrigin); }
    catch (error) { return json({ error: "Synchronisation échouée", detail: error.message }, 502, corsOrigin); }
  }
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, corsOrigin);
  try {
    if (path === "/health") return json({ service: "BLFesport Airtable API", status: "operational" }, 200, corsOrigin);
    if (path === "/api/matches") {
      const records = await listRecords(env, TABLES.matches);
      return json(records.map(record => {
        const x = record.fields || {};
        const a = val(x, F.match.blfScore), b = val(x, F.match.opponentScore);
        return {
          id: record.id, externalId: val(x, F.match.siteId), date: val(x, F.match.date),
          roster: val(x, F.match.roster) || "Roster non renseigné",
          opponent: val(x, F.match.opponent) || "Adversaire à renseigner",
          competition: val(x, F.match.competition) || "", format: val(x, F.match.format) || "",
          result: a != null && b != null ? `${a}-${b}` : "",
          resultType: val(x, F.match.result) || "",
          status: a != null && b != null ? "finished" : "scheduled",
          players: links(val(x, F.match.playerStats)), notes: val(x, F.match.notes) || ""
        };
      }), 200, corsOrigin);
    }
    if (path === "/api/player-stats") return json(await listRecords(env, TABLES.playerStats), 200, corsOrigin);
    if (path === "/api/summary") {
      const records = await listRecords(env, TABLES.matches);
      const played = records.filter(r => r.fields?.[F.match.blfScore] != null && r.fields?.[F.match.opponentScore] != null);
      const wins = played.filter(r => r.fields?.["fldZ0YV6tB0CAkEhi"] === 1).length;
      const losses = played.filter(r => r.fields?.["fld5sJkcO713XfqIV"] === 1).length;
      const goals = played.reduce((s, r) => s + (Number(r.fields?.[F.match.blfScore]) || 0), 0);
      const conceded = played.reduce((s, r) => s + (Number(r.fields?.[F.match.opponentScore]) || 0), 0);
      return json({ matchesPlayed: played.length, wins, losses, winRate: played.length ? Math.round(wins / played.length * 1000) / 10 : 0, goalsScored: goals, goalsConceded: conceded }, 200, corsOrigin);
    }
    return json({ error: "Not found" }, 404, corsOrigin);
  } catch (error) {
    return json({ error: "Unable to load BLFesport data", detail: error.message }, 502, corsOrigin);
  }
}
export default {
  fetch: handle,
  scheduled: async (event, env, ctx) => {
    ctx.waitUntil(
      syncMatches(env)
        .then(result => console.log("BLF_SYNC_OK", JSON.stringify(result)))
        .catch(error => console.error("BLF_SYNC_ERROR", error?.stack || error?.message || String(error)))
    );
  }
};
