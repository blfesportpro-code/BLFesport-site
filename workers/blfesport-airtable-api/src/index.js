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
    siteId: "fldBoNUaxwsuNqosq", sync: "fldDZy8fwMT9sCaBe", playerStats: "fldmMcYeVSEYtIQfw"
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

const SOCIAL = {
  table: "tblSBSZwyhOqpUOy7",
  periods: "tblWim9FzbegjIgj9",
  periodLink: "fld6lEMD8yfmanPRe",
  platform: "fldCPgNpDnR4pOe5S",
  previousLink: "fldvnJMvpp86qMieR",
  periodName: "fldhaW4RtCuaeZtXN"
};
function parisMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit"
  }).formatToParts(date);
  const year = parts.find(x => x.type === "year")?.value;
  const month = parts.find(x => x.type === "month")?.value;
  return year && month ? `${year}-${month}` : null;
}
function periodNameToKey(name) {
  const match = String(name || "").trim().match(/^([A-Za-zÀ-ÿ]+)\s+(\d{4})$/);
  if (!match) return null;
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const index = months.indexOf(match[1].toLocaleLowerCase("fr-FR"));
  return index < 0 ? null : match[2] + "-" + String(index + 1).padStart(2, "0");
}
function previousMonthKey(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 2, 1));
  return date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0");
}
async function linkPreviousSocialRecords(env) {
  const [periodRows, socialRows] = await Promise.all([
    listRecords(env, SOCIAL.periods),
    listRecords(env, SOCIAL.table)
  ]);
  const periodKeyById = new Map(periodRows.map(row => [
    row.id, val(row.fields, SOCIAL.periodName)
  ]));
  const socialByPeriodPlatform = new Map();
  for (const row of socialRows) {
    const fields = row.fields || {};
    const periodIds = links(val(fields, SOCIAL.periodLink));
    const platform = val(fields, SOCIAL.platform);
    if (!platform) continue;
    for (const periodId of periodIds) {
      const key = periodNameToKey(periodKeyById.get(periodId));
      if (key) socialByPeriodPlatform.set(`${key}|${platform}`, row.id);
    }
  }
  const updates = [];
  for (const row of socialRows) {
    const fields = row.fields || {};
    if (links(val(fields, SOCIAL.previousLink)).length) continue;
    const platform = val(fields, SOCIAL.platform);
    const periodIds = links(val(fields, SOCIAL.periodLink));
    for (const periodId of periodIds) {
      const key = periodNameToKey(periodKeyById.get(periodId));
      const previousKey = previousMonthKey(key);
      const previousId = previousKey && socialByPeriodPlatform.get(`${previousKey}|${platform}`);
      if (previousId && previousId !== row.id) {
        updates.push({ id: row.id, fields: { [SOCIAL.previousLink]: [previousId] } });
        break;
      }
    }
  }
  let linked = 0;
  for (let i = 0; i < updates.length; i += 10) {
    const response = await fetch(
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${SOCIAL.table}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ records: updates.slice(i, i + 10) })
      }
    );
    if (!response.ok) throw new Error(`Lien mensuel Airtable ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const result = await response.json();
    linked += (result.records || []).length;
  }
  return {
    checked: socialRows.length,
    linked,
    currentMonth: parisMonthKey(),
    note: linked ? "Liens vers le relevé du mois précédent créés." : "Aucun lien manquant avec un relevé précédent disponible."
  };
}


const SOCIAL_FIELDS = {
  entry: "fldVAc6U6BHj3Gsj2", period: "fld6lEMD8yfmanPRe",
  platform: "fldCPgNpDnR4pOe5S", followers: "fldJVoRsh5vlSwPqm",
  source: "fldZBQ4ubK3Hp8knU",
  status: "fldFgxFaR2y25tjLf", syncedAt: "fldoodNBxf2YBwkcW",
  syncDetail: "fld2MPZ9nTMTU3C4Q"
};
const PERIOD_FIELDS = {
  name: "fldhaW4RtCuaeZtXN", start: "fldNsRA3SaSwmNc4m",
  end: "fldcNGT7WNj2bH512", status: "fldNeYyxbVfKIYmOr"
};
function currentParisPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit"
  }).formatToParts(new Date());
  const year = Number(parts.find(x => x.type === "year")?.value);
  const month = Number(parts.find(x => x.type === "month")?.value);
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const date = new Date(Date.UTC(year, month - 1, 1));
  const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "Europe/Paris" }).format(date);
  const name = `${monthName.charAt(0).toLocaleUpperCase("fr-FR")}${monthName.slice(1)} ${year}`;
  const start = `${key}-01`;
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { key, name, start, end: `${key}-${String(endDay).padStart(2, "0")}` };
}
async function airtableUpsert(env, tableId, mergeFieldId, records) {
  const url = new URL(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${tableId}`);
  url.searchParams.set("returnFieldsByFieldId", "true");
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      performUpsert: { fieldsToMergeOn: [mergeFieldId] },
      records: records.map(fields => ({ fields }))
    })
  });
  if (!response.ok) throw new Error(`Airtable upsert ${response.status}: ${(await response.text()).slice(0, 350)}`);
  return (await response.json()).records || [];
}
async function syncYoutubePublicStats(env) {
  if (!env.YOUTUBE_API_KEY) return { platform: "YouTube", skipped: true, reason: "YOUTUBE_API_KEY non configurée" };
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) throw new Error("Configuration Airtable incomplète");
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/channels");
  endpoint.searchParams.set("part", "snippet,statistics");
  endpoint.searchParams.set("forHandle", "@BLFesport");
  endpoint.searchParams.set("key", env.YOUTUBE_API_KEY);
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`YouTube Data API ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json();
  const channel = payload.items?.[0];
  if (!channel) throw new Error("Chaîne YouTube @BLFesport introuvable via l'API officielle");
  const stats = channel.statistics || {};
  const period = currentParisPeriod();
  const periodRecords = await airtableUpsert(env, SOCIAL.periods, PERIOD_FIELDS.name, [{
    [PERIOD_FIELDS.name]: period.name,
    [PERIOD_FIELDS.start]: period.start,
    [PERIOD_FIELDS.end]: period.end,
    [PERIOD_FIELDS.status]: "En cours"
  }]);
  const periodId = periodRecords[0]?.id;
  if (!periodId) throw new Error("Airtable n'a pas retourné l'identifiant de la période");
  const fields = {
    [SOCIAL_FIELDS.entry]: `${period.name} — YouTube`,
    [SOCIAL_FIELDS.period]: [periodId],
    [SOCIAL_FIELDS.platform]: "YouTube",
    [SOCIAL_FIELDS.source]: "API",
    [SOCIAL_FIELDS.status]: "Synchronisée",
    [SOCIAL_FIELDS.syncedAt]: new Date().toISOString(),
    [SOCIAL_FIELDS.syncDetail]: "Import via YouTube Data API : abonnés publics uniquement. Les compteurs cumulés de vues et de vidéos ne sont pas présentés comme des statistiques mensuelles."
  };
  const hasSubscribers = stats.hiddenSubscriberCount !== true && stats.subscriberCount != null;
  if (hasSubscribers) fields[SOCIAL_FIELDS.followers] = Number(stats.subscriberCount);
  const socialRecords = await airtableUpsert(env, SOCIAL.table, SOCIAL_FIELDS.entry, [fields]);
  const linked = await linkPreviousSocialRecords(env);
  return {
    platform: "YouTube", channel: channel.snippet?.title || "BLFesport",
    period: period.name, subscribersImported: hasSubscribers,
    subscribers: hasSubscribers ? Number(stats.subscriberCount) : null,
    views: "non importées : le point de terminaison public fournit un cumul",
    recordId: socialRecords[0]?.id || null,
    previousMonthLinksCreated: linked.linked
  };
}

async function getTwitchUserToken(env) {
  if (!env.TWITCH_TOKEN_STORE) return { skipped: true, reason: 'Binding KV TWITCH_TOKEN_STORE non configuré' };
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) return { skipped: true, reason: 'Identifiants application Twitch manquants' };
  let refreshToken = await env.TWITCH_TOKEN_STORE.get('refresh_token');
  if (!refreshToken) refreshToken = env.TWITCH_REFRESH_TOKEN || null;
  if (!refreshToken) return { skipped: true, reason: 'Refresh token Twitch non configuré' };
  const cached = await env.TWITCH_TOKEN_STORE.get('access_token');
  if (cached) {
    const check = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + cached } });
    if (check.ok) {
      const info = await check.json();
      if (info.client_id === env.TWITCH_CLIENT_ID && (info.scopes || []).includes('moderator:read:followers')) return { accessToken: cached };
    }
  }
  const form = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET });
  const response = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  if (!response.ok) throw new Error('Renouvellement OAuth Twitch ' + response.status + ': ' + (await response.text()).slice(0, 250));
  const token = await response.json();
  if (!(token.scope || []).includes('moderator:read:followers')) throw new Error('Le jeton Twitch ne possède pas le scope moderator:read:followers');
  if (!token.access_token || !token.refresh_token) throw new Error('Réponse OAuth Twitch incomplète');
  await Promise.all([
    env.TWITCH_TOKEN_STORE.put('access_token', token.access_token, { expirationTtl: Math.max(60, Number(token.expires_in || 14400) - 120) }),
    env.TWITCH_TOKEN_STORE.put('refresh_token', token.refresh_token)
  ]);
  return { accessToken: token.access_token };
}
async function syncTwitchStats(env) {
  if (!env.TWITCH_TOKEN_STORE || !env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) return { platform: 'Twitch', skipped: true, reason: 'Configuration OAuth/KV Twitch incomplète' };
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) throw new Error('Configuration Airtable incomplète');
  const auth = await getTwitchUserToken(env);
  if (auth.skipped) return { platform: 'Twitch', skipped: true, reason: auth.reason };
  const headers = { Authorization: 'Bearer ' + auth.accessToken, 'Client-Id': env.TWITCH_CLIENT_ID };
  const userUrl = new URL('https://api.twitch.tv/helix/users');
  userUrl.searchParams.set('login', 'blfesport');
  const userResponse = await fetch(userUrl, { headers });
  if (!userResponse.ok) throw new Error('Twitch Get Users ' + userResponse.status + ': ' + (await userResponse.text()).slice(0, 250));
  const user = (await userResponse.json()).data?.[0];
  if (!user?.id) throw new Error('Compte Twitch blfesport introuvable');
  const followersUrl = new URL('https://api.twitch.tv/helix/channels/followers');
  followersUrl.searchParams.set('broadcaster_id', user.id);
  followersUrl.searchParams.set('first', '1');
  let response = await fetch(followersUrl, { headers });
  if (response.status === 401) {
    await env.TWITCH_TOKEN_STORE.delete('access_token');
    const refreshed = await getTwitchUserToken(env);
    if (refreshed.skipped) throw new Error(refreshed.reason);
    headers.Authorization = 'Bearer ' + refreshed.accessToken;
    response = await fetch(followersUrl, { headers });
  }
  if (!response.ok) throw new Error('Twitch Get Channel Followers ' + response.status + ': ' + (await response.text()).slice(0, 250));
  const result = await response.json();
  if (!Number.isFinite(Number(result.total))) throw new Error('Twitch n’a pas renvoyé le total des followers');
  const period = currentParisPeriod();
  const periods = await airtableUpsert(env, SOCIAL.periods, PERIOD_FIELDS.name, [{
    [PERIOD_FIELDS.name]: period.name, [PERIOD_FIELDS.start]: period.start, [PERIOD_FIELDS.end]: period.end, [PERIOD_FIELDS.status]: 'En cours'
  }]);
  if (!periods[0]?.id) throw new Error('Identifiant de période Airtable absent');
  const fields = {
    [SOCIAL_FIELDS.entry]: period.name + ' — Twitch', [SOCIAL_FIELDS.period]: [periods[0].id],
    [SOCIAL_FIELDS.platform]: 'Twitch', [SOCIAL_FIELDS.followers]: Number(result.total),
    [SOCIAL_FIELDS.source]: 'API', [SOCIAL_FIELDS.status]: 'Synchronisée', [SOCIAL_FIELDS.syncedAt]: new Date().toISOString(),
    [SOCIAL_FIELDS.syncDetail]: 'Total des followers récupéré via Twitch Helix Get Channel Followers.'
  };
  const records = await airtableUpsert(env, SOCIAL.table, SOCIAL_FIELDS.entry, [fields]);
  const linksResult = await linkPreviousSocialRecords(env);
  return { platform: 'Twitch', channel: user.display_name || user.login, period: period.name, followers: Number(result.total), recordId: records[0]?.id || null, previousMonthLinksCreated: linksResult.linked };
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
  if (request.method === "POST" && path === "/admin/social-sync/twitch") {
    if (!env.SYNC_SECRET || request.headers.get("Authorization") !== `Bearer ${env.SYNC_SECRET}`) return json({ error: "Non autorisé" }, 401, corsOrigin);
    try { return json({ status: "ok", sync: await syncTwitchStats(env) }, 200, corsOrigin); }
    catch (error) { return json({ error: "Synchronisation Twitch échouée", detail: error.message }, 502, corsOrigin); }
  }
  if (request.method === "POST" && path === "/admin/social-sync/youtube") {
    if (!env.SYNC_SECRET || request.headers.get("Authorization") !== `Bearer ${env.SYNC_SECRET}`) {
      return json({ error: "Non autorisé" }, 401, corsOrigin);
    }
    try {
      return json({ status: "ok", sync: await syncYoutubePublicStats(env) }, 200, corsOrigin);
    } catch (error) {
      return json({ error: "Synchronisation YouTube échouée", detail: error.message }, 502, corsOrigin);
    }
  }
  if (request.method === "POST" && path === "/admin/social-links-sync") {
    if (!env.SYNC_SECRET || request.headers.get("Authorization") !== `Bearer ${env.SYNC_SECRET}`) {
      return json({ error: "Non autorisé" }, 401, corsOrigin);
    }
    try {
      return json({ status: "ok", sync: await linkPreviousSocialRecords(env) }, 200, corsOrigin);
    } catch (error) {
      return json({ error: "Synchronisation des liens sociaux échouée", detail: error.message }, 502, corsOrigin);
    }
  }
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
      Promise.allSettled([syncMatches(env), linkPreviousSocialRecords(env), syncYoutubePublicStats(env), syncTwitchStats(env)])
        .then(([matches, socialLinks, youtube, twitch]) => {
          if (matches.status === "fulfilled") console.log("BLF_SYNC_OK", JSON.stringify(matches.value));
          else console.error("BLF_SYNC_ERROR", matches.reason?.stack || matches.reason?.message || String(matches.reason));
          if (socialLinks.status === "fulfilled") console.log("BLF_SOCIAL_LINKS_OK", JSON.stringify(socialLinks.value));
          else console.error("BLF_SOCIAL_LINKS_ERROR", socialLinks.reason?.stack || socialLinks.reason?.message || String(socialLinks.reason));
          if (youtube.status === "fulfilled") console.log("BLF_YOUTUBE_SYNC", JSON.stringify(youtube.value));
          else console.error("BLF_YOUTUBE_SYNC_ERROR", youtube.reason?.stack || youtube.reason?.message || String(youtube.reason));
          if (twitch.status === "fulfilled") console.log("BLF_TWITCH_SYNC", JSON.stringify(twitch.value));
          else console.error("BLF_TWITCH_SYNC_ERROR", twitch.reason?.stack || twitch.reason?.message || String(twitch.reason));
        })
    );
  }
};
