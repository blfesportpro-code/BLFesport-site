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
  periodName: "fldhaW4RtCuaeZtXN",
  previousPeriod: "fldtyD5Wa4McyOs6n"
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
async function ensureCurrentPeriod(env) {
  const period = currentParisPeriod();
  const records = await airtableUpsert(env, SOCIAL.periods, PERIOD_FIELDS.name, [{
    [PERIOD_FIELDS.name]: period.name,
    [PERIOD_FIELDS.start]: period.start,
    [PERIOD_FIELDS.end]: period.end,
    [PERIOD_FIELDS.status]: "En cours"
  }]);
  if (!records[0]?.id) throw new Error("Impossible de créer/récupérer la période mensuelle actuelle.");
  return { key: period.key, name: period.name, id: records[0].id };
}

async function generatePreviousMonthBilan(env) {
  const current = currentParisPeriod();
  // Attendre le 5 du mois pour laisser le temps aux plateformes de publier leurs statistiques différées.
  if (current.day < 5) return { skipped: true, reason: "Génération différée au 5 du mois pour laisser remonter les statistiques." };
  const previousKey = previousMonthKey(current.key);
  const periodRows = await listRecords(env, SOCIAL.periods);
  const previousPeriod = periodRows.find(row =>
    periodNameToKey(val(row.fields, PERIOD_FIELDS.name)) === previousKey
  );
  if (!previousPeriod) return { skipped: true, reason: `Aucune période ${previousKey} à clôturer.` };

  const reportRows = await listRecords(env, REPORTS.table);
  const existing = reportRows.find(row =>
    links(val(row.fields, REPORTS.period)).some(link => link.id === previousPeriod.id)
  );
  if (existing) return { created: false, reportId: existing.id, period: previousKey, reason: "Bilan déjà présent." };

  await airtableUpsert(env, SOCIAL.periods, PERIOD_FIELDS.name, [{
    [PERIOD_FIELDS.name]: val(previousPeriod.fields, PERIOD_FIELDS.name),
    [PERIOD_FIELDS.status]: "Clôturée"
  }]);

  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const today = `${todayParts.find(x => x.type === "year")?.value}-${todayParts.find(x => x.type === "month")?.value}-${todayParts.find(x => x.type === "day")?.value}`;
  const created = await airtableUpsert(env, REPORTS.table, REPORTS.name, [{
    [REPORTS.name]: `Bilan ${previousKey}`,
    [REPORTS.period]: [previousPeriod.id],
    [REPORTS.generatedAt]: today,
    [REPORTS.status]: "Généré"
  }]);
  if (!created[0]?.id) throw new Error("Airtable n'a pas confirmé la création du bilan mensuel.");
  return { created: true, reportId: created[0].id, period: previousKey };
}

async function linkPreviousSocialRecords(env) {
  const [periodRows, socialRows] = await Promise.all([
    listRecords(env, SOCIAL.periods),
    listRecords(env, SOCIAL.table)
  ]);
  const periodKeyById = new Map(periodRows.map(row => [
    row.id, val(row.fields, SOCIAL.periodName)
  ]));
  const periodIdByKey = new Map();
  for (const row of periodRows) {
    const key = periodNameToKey(val(row.fields, SOCIAL.periodName));
    if (key) periodIdByKey.set(key, row.id);
  }

  // Relier les périodes entre elles pour alimenter les comparaisons mensuelles.
  const periodUpdates = [];
  for (const row of periodRows) {
    const key = periodNameToKey(val(row.fields, SOCIAL.periodName));
    const previousKey = previousMonthKey(key);
    const previousId = previousKey && periodIdByKey.get(previousKey);
    const existing = links(val(row.fields, SOCIAL.previousPeriod));
    if (previousId && previousId !== row.id && !existing.includes(previousId)) {
      periodUpdates.push({ id: row.id, fields: { [SOCIAL.previousPeriod]: [previousId] } });
    }
  }

  const socialByPeriodPlatform = new Map();
  for (const row of socialRows) {
    const fields = row.fields || {};
    const platform = val(fields, SOCIAL.platform);
    if (!platform) continue;
    for (const periodId of links(val(fields, SOCIAL.periodLink))) {
      const key = periodNameToKey(periodKeyById.get(periodId));
      if (key) socialByPeriodPlatform.set(`${key}|${platform}`, row.id);
    }
  }
  const socialUpdates = [];
  for (const row of socialRows) {
    const fields = row.fields || {};
    if (links(val(fields, SOCIAL.previousLink)).length) continue;
    const platform = val(fields, SOCIAL.platform);
    for (const periodId of links(val(fields, SOCIAL.periodLink))) {
      const key = periodNameToKey(periodKeyById.get(periodId));
      const previousKey = previousMonthKey(key);
      const previousId = previousKey && socialByPeriodPlatform.get(`${previousKey}|${platform}`);
      if (previousId && previousId !== row.id) {
        socialUpdates.push({ id: row.id, fields: { [SOCIAL.previousLink]: [previousId] } });
        break;
      }
    }
  }

  async function patch(tableId, records, label) {
    let count = 0;
    for (let i = 0; i < records.length; i += 10) {
      const response = await fetch(
        `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${tableId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({ records: records.slice(i, i + 10) })
        }
      );
      if (!response.ok) throw new Error(`${label} Airtable ${response.status}: ${(await response.text()).slice(0, 300)}`);
      count += ((await response.json()).records || []).length;
    }
    return count;
  }

  const linkedPeriods = await patch(SOCIAL.periods, periodUpdates, "Lien entre périodes");
  const linkedSocial = await patch(SOCIAL.table, socialUpdates, "Lien mensuel");
  return {
    checkedPeriods: periodRows.length,
    linkedPeriods,
    checked: socialRows.length,
    linked: linkedSocial,
    currentMonth: parisMonthKey(),
    note: linkedPeriods || linkedSocial
      ? "Liens vers le mois précédent créés pour les périodes et les réseaux disponibles."
      : "Aucun lien manquant avec un mois précédent disponible."
  };
}


const REPORTS = {
  table: "tblK22dlumiLewC0x",
  name: "fldSIKd8IM5jaw0JU",
  period: "fldbYgvVBvnJLlYX6",
  generatedAt: "fldHo1nW8uglQZqM0",
  status: "fldOOBKuiZiVtPGiC"
};
const SOCIAL_FIELDS = {
  entry: "fldVAc6U6BHj3Gsj2", period: "fld6lEMD8yfmanPRe",
  platform: "fldCPgNpDnR4pOe5S", followers: "fldJVoRsh5vlSwPqm",
  newFollowers: "fld5UYbUBilrz7Vpu", views: "fld2Szh4ZElmDcT5j",
  interactions: "fldQFy3rJPrNaesUX", notes: "fldbjI3G4i9YuuH2U",
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
  return { key, name, start, end: `${key}-${String(endDay).padStart(2, "0")}`, day: Number(parts.find(x => x.type === "day")?.value || 1) };
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
async function youtubeAccessToken(env) {
  if (!env.YOUTUBE_TOKEN_STORE || !env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REDIRECT_URI) {
    return { skipped: true, reason: "OAuth YouTube incomplet : KV YOUTUBE_TOKEN_STORE, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET et YOUTUBE_REDIRECT_URI requis." };
  }
  const refreshToken = await env.YOUTUBE_TOKEN_STORE.get("refresh_token");
  if (!refreshToken) return { skipped: true, reason: "Compte propriétaire YouTube non autorisé : ouvrir /oauth/youtube/start." };
  const cached = await env.YOUTUBE_TOKEN_STORE.get("access_token");
  if (cached) {
    const check = await fetch("https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=" + encodeURIComponent(cached));
    if (check.ok) return { accessToken: cached };
  }
  const form = new URLSearchParams({
    client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET,
    refresh_token: refreshToken, grant_type: "refresh_token"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form
  });
  if (!response.ok) throw new Error("Renouvellement OAuth YouTube " + response.status + ": " + (await response.text()).slice(0, 250));
  const token = await response.json();
  if (!token.access_token) throw new Error("Google n’a pas renvoyé de jeton YouTube");
  await env.YOUTUBE_TOKEN_STORE.put("access_token", token.access_token, {
    expirationTtl: Math.max(60, Number(token.expires_in || 3600) - 120)
  });
  return { accessToken: token.access_token };
}
function parisDateDaysAgo(days) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const y = Number(parts.find(x => x.type === "year")?.value);
  const m = Number(parts.find(x => x.type === "month")?.value);
  const d = Number(parts.find(x => x.type === "day")?.value);
  const date = new Date(Date.UTC(y, m - 1, d - days));
  return date.toISOString().slice(0, 10);
}
async function syncYoutubeAnalytics(env) {
  const auth = await youtubeAccessToken(env);
  if (auth.skipped) return auth;
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "id,snippet");
  channelUrl.searchParams.set("mine", "true");
  const channelResponse = await fetch(channelUrl, { headers });
  if (!channelResponse.ok) throw new Error("Vérification du compte YouTube " + channelResponse.status + ": " + (await channelResponse.text()).slice(0, 250));
  const channel = (await channelResponse.json()).items?.[0];
  if (!channel?.id) throw new Error("Aucune chaîne YouTube associée au compte Google autorisé");
  if (env.YOUTUBE_API_KEY) {
    const publicUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    publicUrl.searchParams.set("part", "id");
    publicUrl.searchParams.set("forHandle", "@BLFesport");
    publicUrl.searchParams.set("key", env.YOUTUBE_API_KEY);
    const publicResponse = await fetch(publicUrl);
    if (publicResponse.ok) {
      const expected = (await publicResponse.json()).items?.[0]?.id;
      if (expected && expected !== channel.id) throw new Error("Le compte Google autorisé ne possède pas la chaîne @BLFesport. Recommence avec le bon compte.");
    }
  }
  const period = currentParisPeriod();
  const endDate = parisDateDaysAgo(3);
  if (endDate < period.start) return { skipped: true, reason: "Les données Analytics du mois ne sont pas encore disponibles." };
  const reportUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  reportUrl.searchParams.set("ids", "channel==MINE");
  reportUrl.searchParams.set("startDate", period.start);
  reportUrl.searchParams.set("endDate", endDate);
  reportUrl.searchParams.set("metrics", "views,subscribersGained,likes,comments,shares,estimatedMinutesWatched");
  const reportResponse = await fetch(reportUrl, { headers });
  if (!reportResponse.ok) throw new Error("YouTube Analytics API " + reportResponse.status + ": " + (await reportResponse.text()).slice(0, 350));
  const report = await reportResponse.json();
  const values = report.rows?.[0] || [];
  const [views, gained, likes, comments, shares, minutes] = values.map(value => Number(value) || 0);
  const periodRecords = await airtableUpsert(env, SOCIAL.periods, PERIOD_FIELDS.name, [{
    [PERIOD_FIELDS.name]: period.name, [PERIOD_FIELDS.start]: period.start,
    [PERIOD_FIELDS.end]: period.end, [PERIOD_FIELDS.status]: "En cours"
  }]);
  if (!periodRecords[0]?.id) throw new Error("Identifiant de période Airtable absent pour Analytics");
  const fields = {
    [SOCIAL_FIELDS.entry]: period.name + " — YouTube",
    [SOCIAL_FIELDS.period]: [periodRecords[0].id],
    [SOCIAL_FIELDS.platform]: "YouTube",
    [SOCIAL_FIELDS.newFollowers]: gained,
    [SOCIAL_FIELDS.views]: views,
    [SOCIAL_FIELDS.interactions]: likes + comments + shares,
    [SOCIAL_FIELDS.notes]: "YouTube Analytics du " + period.start + " au " + endDate +
      " : " + gained + " abonnés gagnés, " + likes + " j’aime, " + comments +
      " commentaires, " + shares + " partages, " + minutes + " minutes de visionnage.",
    [SOCIAL_FIELDS.source]: "API",
    [SOCIAL_FIELDS.status]: "Synchronisée",
    [SOCIAL_FIELDS.syncedAt]: new Date().toISOString(),
    [SOCIAL_FIELDS.syncDetail]: "Statistiques mensuelles issues de YouTube Analytics. Les données s’arrêtent au " + endDate +
      " pour tenir compte du délai de traitement habituel de 48 à 72 heures."
  };
  const records = await airtableUpsert(env, SOCIAL.table, SOCIAL_FIELDS.entry, [fields]);
  return {
    platform: "YouTube Analytics", period: period.name, through: endDate,
    views, subscribersGained: gained, likes, comments, shares,
    estimatedMinutesWatched: minutes, recordId: records[0]?.id || null
  };
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
  async function twitchFetch(url) {
    let result = await fetch(url, { headers });
    if (result.status === 401) {
      await env.TWITCH_TOKEN_STORE.delete('access_token');
      const refreshed = await getTwitchUserToken(env);
      if (refreshed.skipped) throw new Error(refreshed.reason);
      headers.Authorization = 'Bearer ' + refreshed.accessToken;
      result = await fetch(url, { headers });
    }
    return result;
  }
  const userUrl = new URL('https://api.twitch.tv/helix/users');
  userUrl.searchParams.set('login', 'blfesport');
  const userResponse = await twitchFetch(userUrl);
  if (!userResponse.ok) throw new Error('Twitch Get Users ' + userResponse.status + ': ' + (await userResponse.text()).slice(0, 250));
  const user = (await userResponse.json()).data?.[0];
  if (!user?.id) throw new Error('Compte Twitch blfesport introuvable');

  const followersUrl = new URL('https://api.twitch.tv/helix/channels/followers');
  followersUrl.searchParams.set('broadcaster_id', user.id);
  followersUrl.searchParams.set('first', '1');
  const followersResponse = await twitchFetch(followersUrl);
  if (!followersResponse.ok) throw new Error('Twitch Get Channel Followers ' + followersResponse.status + ': ' + (await followersResponse.text()).slice(0, 250));
  const followersResult = await followersResponse.json();
  const followers = Number(followersResult.total);
  if (!Number.isFinite(followers)) throw new Error('Twitch n’a pas renvoyé le total des followers');

  const period = currentParisPeriod();
  const previousFollowersKey = 'last_followers_total';
  const monthlyFollowersKey = 'monthly_new_followers:' + period.key;
  const previousFollowersRaw = await env.TWITCH_TOKEN_STORE.get(previousFollowersKey);
  const previousFollowers = previousFollowersRaw == null ? null : Number(previousFollowersRaw);
  const monthlyStored = Number(await env.TWITCH_TOKEN_STORE.get(monthlyFollowersKey) || 0);
  const gainedSinceLastSync = previousFollowers == null ? 0 : Math.max(0, followers - previousFollowers);
  const monthlyNewFollowers = monthlyStored + gainedSinceLastSync;

  // Vues cumulées des VODs et clips publiés pendant le mois en cours.
  // Elles ne représentent pas les vues obtenues uniquement pendant ce mois.
  const videos = [];
  let videoCursor = null;
  for (let page = 0; page < 5; page++) {
    const videosUrl = new URL('https://api.twitch.tv/helix/videos');
    videosUrl.searchParams.set('user_id', user.id);
    videosUrl.searchParams.set('first', '100');
    if (videoCursor) videosUrl.searchParams.set('after', videoCursor);
    const videoResponse = await twitchFetch(videosUrl);
    if (!videoResponse.ok) throw new Error('Twitch Get Videos ' + videoResponse.status + ': ' + (await videoResponse.text()).slice(0, 250));
    const payload = await videoResponse.json();
    videos.push(...(payload.data || []));
    videoCursor = payload.pagination?.cursor || null;
    if (!videoCursor) break;
  }
  const clips = [];
  let clipCursor = null;
  const clipsUrlBase = new URL('https://api.twitch.tv/helix/clips');
  clipsUrlBase.searchParams.set('broadcaster_id', user.id);
  clipsUrlBase.searchParams.set('started_at', period.start + 'T00:00:00Z');
  clipsUrlBase.searchParams.set('ended_at', new Date().toISOString());
  clipsUrlBase.searchParams.set('first', '100');
  for (let page = 0; page < 5; page++) {
    const clipsUrl = new URL(clipsUrlBase);
    if (clipCursor) clipsUrl.searchParams.set('after', clipCursor);
    const clipResponse = await twitchFetch(clipsUrl);
    if (!clipResponse.ok) throw new Error('Twitch Get Clips ' + clipResponse.status + ': ' + (await clipResponse.text()).slice(0, 250));
    const payload = await clipResponse.json();
    clips.push(...(payload.data || []));
    clipCursor = payload.pagination?.cursor || null;
    if (!clipCursor) break;
  }
  const monthStart = period.start + 'T00:00:00';
  const monthVideos = videos.filter(item => item.published_at && item.published_at >= monthStart);
  const monthClips = clips;
  const videoViews = monthVideos.reduce((sum, item) => sum + (Number(item.view_count) || 0), 0);
  const clipViews = monthClips.reduce((sum, item) => sum + (Number(item.view_count) || 0), 0);
  const totalViews = videoViews + clipViews;

  const periods = await airtableUpsert(env, SOCIAL.periods, PERIOD_FIELDS.name, [{
    [PERIOD_FIELDS.name]: period.name, [PERIOD_FIELDS.start]: period.start, [PERIOD_FIELDS.end]: period.end, [PERIOD_FIELDS.status]: 'En cours'
  }]);
  if (!periods[0]?.id) throw new Error('Identifiant de période Airtable absent');
  const fields = {
    [SOCIAL_FIELDS.entry]: period.name + ' — Twitch',
    [SOCIAL_FIELDS.period]: [periods[0].id],
    [SOCIAL_FIELDS.platform]: 'Twitch',
    [SOCIAL_FIELDS.followers]: followers,
    [SOCIAL_FIELDS.newFollowers]: monthlyNewFollowers,
    [SOCIAL_FIELDS.views]: totalViews,
    [SOCIAL_FIELDS.notes]: 'Abonnés gagnés : estimation calculée entre les synchronisations depuis l’activation du suivi. Vues : cumul des vues des VODs et clips publiés pendant le mois (pas uniquement les vues gagnées ce mois). Interactions : non disponibles via les points de terminaison publics Twitch utilisés.',
    [SOCIAL_FIELDS.source]: 'API',
    [SOCIAL_FIELDS.status]: 'Synchronisée',
    [SOCIAL_FIELDS.syncedAt]: new Date().toISOString(),
    [SOCIAL_FIELDS.syncDetail]: 'Followers via Twitch Helix. Vues = ' + videoViews + ' sur ' + monthVideos.length + ' VOD(s) + ' + clipViews + ' sur ' + monthClips.length + ' clip(s) publiés depuis le ' + period.start + '. Interactions non disponibles via Helix public.'
  };
  const records = await airtableUpsert(env, SOCIAL.table, SOCIAL_FIELDS.entry, [fields]);
  await Promise.all([
    env.TWITCH_TOKEN_STORE.put(previousFollowersKey, String(followers)),
    env.TWITCH_TOKEN_STORE.put(monthlyFollowersKey, String(monthlyNewFollowers))
  ]);
  const linksResult = await linkPreviousSocialRecords(env);
  return {
    platform: 'Twitch', channel: user.display_name || user.login, period: period.name,
    followers, newFollowers: monthlyNewFollowers, views: totalViews,
    videoViews, clipViews, interactions: 'non disponibles via l’API publique Twitch',
    recordId: records[0]?.id || null, previousMonthLinksCreated: linksResult.linked
  };
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
  if (request.method === "GET" && path === "/oauth/youtube/start") {
    if (!env.YOUTUBE_TOKEN_STORE || !env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_REDIRECT_URI) return json({ error: "Configuration OAuth YouTube/KV incomplète" }, 503, corsOrigin);
    const state = crypto.randomUUID();
    await env.YOUTUBE_TOKEN_STORE.put("oauth_state:" + state, "pending", { expirationTtl: 600 });
    const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorize.searchParams.set("client_id", env.YOUTUBE_CLIENT_ID);
    authorize.searchParams.set("redirect_uri", env.YOUTUBE_REDIRECT_URI);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly");
    authorize.searchParams.set("access_type", "offline");
    authorize.searchParams.set("prompt", "consent");
    authorize.searchParams.set("state", state);
    return Response.redirect(authorize.toString(), 302);
  }
  if (request.method === "GET" && path === "/oauth/youtube/callback") {
    if (!env.YOUTUBE_TOKEN_STORE || !env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REDIRECT_URI) return json({ error: "Configuration OAuth YouTube/KV incomplète" }, 503, corsOrigin);
    const query = new URL(request.url).searchParams;
    const state = query.get("state");
    if (!state || await env.YOUTUBE_TOKEN_STORE.get("oauth_state:" + state) !== "pending") return json({ error: "État OAuth YouTube invalide ou expiré" }, 400, corsOrigin);
    await env.YOUTUBE_TOKEN_STORE.delete("oauth_state:" + state);
    if (query.get("error")) return json({ error: "Autorisation Google refusée", detail: query.get("error_description") || query.get("error") }, 400, corsOrigin);
    const code = query.get("code");
    if (!code) return json({ error: "Code OAuth Google manquant" }, 400, corsOrigin);
    const form = new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET,
      code, grant_type: "authorization_code", redirect_uri: env.YOUTUBE_REDIRECT_URI
    });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form
    });
    if (!tokenResponse.ok) return json({ error: "Échange OAuth Google impossible", detail: (await tokenResponse.text()).slice(0, 250) }, 502, corsOrigin);
    const token = await tokenResponse.json();
    if (!token.access_token || !token.refresh_token) return json({ error: "Google n’a pas fourni de refresh token. Révoque l’accès de l’application puis recommence avec le consentement." }, 400, corsOrigin);
    const headers = { Authorization: "Bearer " + token.access_token };
    const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    channelUrl.searchParams.set("part", "id,snippet");
    channelUrl.searchParams.set("mine", "true");
    const channelResponse = await fetch(channelUrl, { headers });
    if (!channelResponse.ok) return json({ error: "Impossible de vérifier la chaîne Google autorisée", detail: (await channelResponse.text()).slice(0, 250) }, 502, corsOrigin);
    const channel = (await channelResponse.json()).items?.[0];
    if (!channel?.id) return json({ error: "Le compte Google autorisé ne possède aucune chaîne YouTube." }, 403, corsOrigin);
    if (env.YOUTUBE_API_KEY) {
      const publicUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
      publicUrl.searchParams.set("part", "id");
      publicUrl.searchParams.set("forHandle", "@BLFesport");
      publicUrl.searchParams.set("key", env.YOUTUBE_API_KEY);
      const publicResponse = await fetch(publicUrl);
      if (publicResponse.ok) {
        const expected = (await publicResponse.json()).items?.[0]?.id;
        if (expected && expected !== channel.id) return json({ error: "Ce compte Google ne possède pas la chaîne @BLFesport. Connecte le bon compte Google." }, 403, corsOrigin);
      }
    }
    await Promise.all([
      env.YOUTUBE_TOKEN_STORE.put("refresh_token", token.refresh_token),
      env.YOUTUBE_TOKEN_STORE.put("access_token", token.access_token, { expirationTtl: Math.max(60, Number(token.expires_in || 3600) - 120) }),
      env.YOUTUBE_TOKEN_STORE.put("authorized_channel_id", channel.id)
    ]);
    return new Response("Connexion YouTube BLFesport réussie. Les statistiques Analytics seront importées lors du prochain passage automatique.", {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
  if (request.method === "GET" && path === "/oauth/twitch/start") {
    if (!env.TWITCH_TOKEN_STORE || !env.TWITCH_CLIENT_ID || !env.TWITCH_REDIRECT_URI) return json({ error: "Configuration OAuth Twitch/KV incomplète" }, 503, corsOrigin);
    const state = crypto.randomUUID();
    await env.TWITCH_TOKEN_STORE.put("oauth_state:" + state, "pending", { expirationTtl: 600 });
    const authorize = new URL("https://id.twitch.tv/oauth2/authorize");
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", env.TWITCH_CLIENT_ID);
    authorize.searchParams.set("redirect_uri", env.TWITCH_REDIRECT_URI);
    authorize.searchParams.set("scope", "moderator:read:followers");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("force_verify", "true");
    return Response.redirect(authorize.toString(), 302);
  }
  if (request.method === "GET" && path === "/oauth/twitch/callback") {
    if (!env.TWITCH_TOKEN_STORE || !env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET || !env.TWITCH_REDIRECT_URI) return json({ error: "Configuration OAuth Twitch/KV incomplète" }, 503, corsOrigin);
    const query = new URL(request.url).searchParams;
    const state = query.get("state");
    if (!state || await env.TWITCH_TOKEN_STORE.get("oauth_state:" + state) !== "pending") return json({ error: "État OAuth invalide ou expiré" }, 400, corsOrigin);
    await env.TWITCH_TOKEN_STORE.delete("oauth_state:" + state);
    if (query.get("error")) return json({ error: "Autorisation Twitch refusée", detail: query.get("error_description") || query.get("error") }, 400, corsOrigin);
    const code = query.get("code");
    if (!code) return json({ error: "Code OAuth manquant" }, 400, corsOrigin);
    const form = new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: env.TWITCH_REDIRECT_URI });
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
    if (!tokenResponse.ok) return json({ error: "Échange OAuth Twitch impossible", detail: (await tokenResponse.text()).slice(0, 250) }, 502, corsOrigin);
    const token = await tokenResponse.json();
    if (!(token.scope || []).includes("moderator:read:followers") || !token.access_token || !token.refresh_token) return json({ error: "Twitch n’a pas accordé le scope requis" }, 400, corsOrigin);
    const validation = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: "OAuth " + token.access_token } });
    if (!validation.ok) return json({ error: "Validation du jeton Twitch impossible" }, 502, corsOrigin);
    const identity = await validation.json();
    const userResponse = await fetch("https://api.twitch.tv/helix/users", { headers: { Authorization: "Bearer " + token.access_token, "Client-Id": env.TWITCH_CLIENT_ID } });
    if (!userResponse.ok) return json({ error: "Lecture du compte Twitch autorisé impossible" }, 502, corsOrigin);
    const user = (await userResponse.json()).data?.[0];
    if (!user || user.login?.toLowerCase() !== "blfesport") return json({ error: "Connecte-toi au compte Twitch BLFesport (@blfesport), puis recommence." }, 403, corsOrigin);
    await Promise.all([
      env.TWITCH_TOKEN_STORE.put("access_token", token.access_token, { expirationTtl: Math.max(60, Number(token.expires_in || 14400) - 120) }),
      env.TWITCH_TOKEN_STORE.put("refresh_token", token.refresh_token),
      env.TWITCH_TOKEN_STORE.put("broadcaster_id", user.id),
      env.TWITCH_TOKEN_STORE.put("authorized_login", user.login),
      env.TWITCH_TOKEN_STORE.put("authorized_user_id", identity.user_id || user.id)
    ]);
    return new Response("Connexion Twitch BLFesport réussie. Tu peux fermer cette page. Le Worker synchronisera les followers lors du prochain passage automatique.", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
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
    ctx.waitUntil((async () => {
      try {
        console.log("BLF_PERIOD_CURRENT", JSON.stringify(await ensureCurrentPeriod(env)));
      } catch (error) {
        console.error("BLF_PERIOD_CURRENT_ERROR", error?.stack || error?.message || String(error));
      }

      const results = await Promise.allSettled([
        syncMatches(env),
        syncYoutubePublicStats(env),
        syncYoutubeAnalytics(env),
        syncTwitchStats(env)
      ]);
      const labels = ["BLF_SYNC", "BLF_YOUTUBE_SYNC", "BLF_YOUTUBE_ANALYTICS_SYNC", "BLF_TWITCH_SYNC"];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") console.log(labels[index] + "_OK", JSON.stringify(result.value));
        else console.error(labels[index] + "_ERROR", result.reason?.stack || result.reason?.message || String(result.reason));
      });

      try {
        console.log("BLF_SOCIAL_LINKS_OK", JSON.stringify(await linkPreviousSocialRecords(env)));
      } catch (error) {
        console.error("BLF_SOCIAL_LINKS_ERROR", error?.stack || error?.message || String(error));
      }
      try {
        console.log("BLF_MONTHLY_BILAN", JSON.stringify(await generatePreviousMonthBilan(env)));
      } catch (error) {
        console.error("BLF_MONTHLY_BILAN_ERROR", error?.stack || error?.message || String(error));
      }
    })());
  }
};
