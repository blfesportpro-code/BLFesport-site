/**
 * BLFesport — passerelle publique en lecture seule entre le site et Airtable.
 * Secrets Cloudflare requis : AIRTABLE_TOKEN (PAT en lecture seule).
 * Variables : AIRTABLE_BASE_ID, ALLOWED_ORIGIN (optionnelle).
 */
const TABLES = {
  matches: "tbl0gdXNHAbElTV7x",
  playerStats: "tbl94FoKhudfqR0kW"
};

const F = {
  match: {
    name: "fld8Z5QXV1AJOOt4o",
    period: "fldAfoaDsYi4kSAb7",
    date: "fldtKv1Xo7G1iosH7",
    opponent: "fld3dJrvMyfFBQ0BM",
    competition: "fldV8UO1WnbWmH3Lg",
    format: "fldCHxTm8Z7wmBTpN",
    result: "fldA37wxrPd2eCUKu",
    blfScore: "fldOKoI21qqF5qcZy",
    opponentScore: "fldol80htLVjG1nde",
    notes: "fldvu82m8ZpHaTmuf",
    scoreDiff: "fldPoTv9PKHp9SU6A",
    win: "fldZ0YV6tB0CAkEhi",
    loss: "fld5sJkcO713XfqIV",
    playerStats: "fldmMcYeVSEYtIQfw",
    roster: "fldSpaHdZ51r19jJf",
    siteId: "fldBoNUaxwsuNqosq",
    sync: "fldDZy8fwMT9sCaBe"
  },
  player: {
    name: "fldunpeOmwuZTiFyv",
    period: "fldvyti2RUOEZXm9O",
    member: "fldqWz0cpSCL21cbk",
    match: "fldw5hJq2A3fVARhV",
    goals: "fldi6P80k3pvYZ8jI",
    assists: "fldEYH2wUXdYGSzI8",
    saves: "fldz1PY97ciu0ePuT",
    shots: "fldb2ZHkzOkYY9Ttc",
    mvp: "fldkkCYl4lij61XRy",
    rating: "fld8m3K3Wzn475dlJ",
    notes: "fldeMycETJYaz0KpE"
  }
};

const json = (data, status = 200, origin = "*") => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=60, s-maxage=60",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type"
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
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` }
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Airtable API ${response.status}: ${detail.slice(0, 300)}`);
    }
    const payload = await response.json();
    rows.push(...(payload.records || []));
    offset = payload.offset;
  } while (offset);
  return rows;
}

const val = (fields, id) => fields?.[id] ?? null;
const links = value => Array.isArray(value) ? value : [];

async function handle(request, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || "https://blfesportpro-code.github.io";
  const origin = request.headers.get("Origin") || "";
  const corsOrigin = origin === allowedOrigin || origin === "https://blfesportpro-code.github.io"
    ? origin
    : allowedOrigin;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: {
      "access-control-allow-origin": corsOrigin,
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "access-control-max-age": "86400"
    }});
  }
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, corsOrigin);
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) {
    return json({ error: "Airtable connection is not configured" }, 503, corsOrigin);
  }

  const path = new URL(request.url).pathname;
  try {
    if (path === "/health") return json({ service: "BLFesport Airtable API", status: "operational" }, 200, corsOrigin);

    if (path === "/api/matches") {
      const records = await listRecords(env, TABLES.matches);
      const matches = records.map(record => {
        const x = record.fields || {};
        const date = val(x, F.match.date);
        const scoreA = val(x, F.match.blfScore);
        const scoreB = val(x, F.match.opponentScore);
        return {
          id: record.id,
          externalId: val(x, F.match.siteId),
          date,
          roster: val(x, F.match.roster) || "Roster non renseigné",
          opponent: val(x, F.match.opponent) || "Adversaire à renseigner",
          competition: val(x, F.match.competition) || "",
          format: val(x, F.match.format) || "",
          result: scoreA != null && scoreB != null ? `${scoreA}-${scoreB}` : "",
          resultType: val(x, F.match.result) || "",
          status: scoreA != null && scoreB != null ? "finished" : "scheduled",
          players: links(val(x, F.match.playerStats)),
          notes: val(x, F.match.notes) || ""
        };
      }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      return json(matches, 200, corsOrigin);
    }

    if (path === "/api/player-stats") {
      const records = await listRecords(env, TABLES.playerStats);
      return json(records.map(record => {
        const x = record.fields || {};
        return {
          id: record.id,
          player: links(val(x, F.player.member)),
          match: links(val(x, F.player.match)),
          period: links(val(x, F.player.period)),
          goals: val(x, F.player.goals) || 0,
          assists: val(x, F.player.assists) || 0,
          saves: val(x, F.player.saves) || 0,
          shots: val(x, F.player.shots) || 0,
          mvp: Boolean(val(x, F.player.mvp)),
          rating: val(x, F.player.rating)
        };
      }), 200, corsOrigin);
    }

    if (path === "/api/summary") {
      const records = await listRecords(env, TABLES.matches);
      const played = records.filter(r => r.fields?.[F.match.blfScore] != null && r.fields?.[F.match.opponentScore] != null);
      const wins = played.filter(r => r.fields?.[F.match.win] === 1).length;
      const losses = played.filter(r => r.fields?.[F.match.loss] === 1).length;
      const goals = played.reduce((sum, r) => sum + (Number(r.fields?.[F.match.blfScore]) || 0), 0);
      const conceded = played.reduce((sum, r) => sum + (Number(r.fields?.[F.match.opponentScore]) || 0), 0);
      return json({
        matchesPlayed: played.length,
        wins,
        losses,
        winRate: played.length ? Math.round(wins / played.length * 1000) / 10 : 0,
        goalsScored: goals,
        goalsConceded: conceded
      }, 200, corsOrigin);
    }

    return json({ error: "Not found" }, 404, corsOrigin);
  } catch (error) {
    return json({ error: "Unable to load BLFesport data", detail: error.message }, 502, corsOrigin);
  }
}

export default { fetch: handle };
