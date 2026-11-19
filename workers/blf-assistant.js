/**
 * BLFesport Assistant — Cloudflare Worker + Durable Object rate limiter.
 * Bindings required: AI (Workers AI), RATE_LIMITER (Durable Object).
 */
const ALLOWED_ORIGINS = new Set([
  "https://blfesportpro-code.github.io",
  "https://blfesport.fr",
  "https://www.blfesport.fr"
]);
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const INITIAL_ROSTER_CACHE = {
  updatedAt: "2026-11-18T02:05:46.830Z",
  stale: true,
  warning: "Sauvegarde de secours initiale ; en attente d'une actualisation Discord.",
  players: [
    { id: "1152587086856200252", username: "p1n_depice", displayName: "HUGO", roster: "ROSTER A" },
    { id: "759713940049100821", username: "a4rthurrl", displayName: "KC_a4rthurrl", roster: "ROSTER A" },
    { id: "562591959181426693", username: "uniity_rdz", displayName: "𝑼𝒏𝒊𝒊𝒕𝒚", roster: "ROSTER A" },
    { id: "1209830095108186136", username: "elor73", displayName: "Astral7105", roster: "ROSTER B" },
    { id: "1030938619055198301", username: "b_387", displayName: "B_387", roster: "ROSTER B" },
    { id: "1488475320796581921", username: "foamy2151", displayName: "𝐹♡𝒶𝓂𝓎", roster: "ROSTER B" },
    { id: "1475871504821522564", username: "redwanedeal", displayName: "Redwane", roster: "ROSTER B" },
    { id: "1189878452145373327", username: "kc_noxx", displayName: "NoXx", roster: "ROSTER C" },
    { id: "1314517363286347819", username: "theli0x", displayName: "Thelio_09", roster: "ROSTER C" },
    { id: "1547660638464245824", username: "tuffsie3467", displayName: "tuffsie", roster: "ROSTER C" },
    { id: "1150421316780949615", username: "bifyudgaming", displayName: "Twitch : Bifyud_", roster: "ROSTER C" }
  ]
};

const SITE_DATA_URL = "https://blfesportpro-code.github.io/BLFesport-site/js/data.js";
const SOURCE_CACHE = new Map();
async function withShortCache(key, ttl, loader) {
  const now = Date.now();
  const existing = SOURCE_CACHE.get(key);
  if (existing && existing.expiresAt > now) return existing.value;
  const pending = loader().catch(error => {
    SOURCE_CACHE.delete(key);
    throw error;
  });
  SOURCE_CACHE.set(key, { value: pending, expiresAt: now + ttl });
  const value = await pending;
  SOURCE_CACHE.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}
function parseSiteData(source) {
  const assignment = source.indexOf("window.BLF_DATA");
  const begin = source.indexOf("{", assignment);
  if (assignment < 0 || begin < 0) throw new Error("BLF_DATA introuvable");
  let i = begin;
  function ws() {
    while (i < source.length) {
      if (/\s/.test(source[i])) { i++; continue; }
      if (source.slice(i,i+2) === "//") { i += 2; while (i < source.length && source[i] !== "\n") i++; continue; }
      if (source.slice(i,i+2) === "/*") { const e = source.indexOf("*/",i+2); if (e < 0) throw new Error("Commentaire incomplet"); i = e+2; continue; }
      break;
    }
  }
  function str() {
    const q = source[i++]; let out = "";
    while (i < source.length) {
      const c = source[i++];
      if (c === q) return out;
      if (c === "\\") { const n = source[i++]; const m = {n:"\n",r:"\r",t:"\t",b:"\b",f:"\f"}; out += Object.prototype.hasOwnProperty.call(m,n) ? m[n] : n; }
      else out += c;
    }
    throw new Error("Chaîne incomplète");
  }
  function val() {
    ws(); const c = source[i];
    if (c === "{") return obj();
    if (c === "[") return arr();
    if (c === '"' || c === "'") return str();
    const rest = source.slice(i), n = rest.match(/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (n) { i += n[0].length; return Number(n[0]); }
    const w = rest.match(/^[A-Za-z_$][\w$]*/);
    if (w) { i += w[0].length; if (w[0] === "true") return true; if (w[0] === "false") return false; if (w[0] === "null") return null; throw new Error("Valeur inconnue"); }
    throw new Error("Valeur invalide");
  }
  function obj() {
    const o = {}; i++;
    while (i < source.length) {
      ws(); if (source[i] === "}") { i++; return o; }
      let k;
      if (source[i] === '"' || source[i] === "'") k = str();
      else { const m = source.slice(i).match(/^[A-Za-z_$][\w$]*/); if (!m) throw new Error("Clé invalide"); k = m[0]; i += k.length; }
      ws(); if (source[i++] !== ":") throw new Error("Deux-points attendu");
      o[k] = val(); ws();
      if (source[i] === ",") { i++; continue; }
      if (source[i] === "}") { i++; return o; }
      throw new Error("Objet invalide");
    }
    throw new Error("Objet incomplet");
  }
  function arr() {
    const a = []; i++;
    while (i < source.length) {
      ws(); if (source[i] === "]") { i++; return a; }
      a.push(val()); ws();
      if (source[i] === ",") { i++; continue; }
      if (source[i] === "]") { i++; return a; }
      throw new Error("Tableau invalide");
    }
    throw new Error("Tableau incomplet");
  }
  return obj();
}
async function readSiteContext() {
  return withShortCache("site-context", 15000, async () => {
    try {
      const r = await fetch(SITE_DATA_URL, { headers: {Accept:"text/javascript"}, signal:AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = parseSiteData(await r.text());
      return JSON.stringify({
        site:d.site, announcements:d.announcements, rosters:d.rosters, matches:d.matches,
        seasonStats:d.seasonStats, tournaments:d.tournaments, videos:d.videos,
        staff:d.staff, partners:d.partners, shop:d.shop
      }).slice(0,12500);
    } catch {
      return "Échec de lecture des données du site en direct. Ne pas supposer que les anciennes données sont à jour.";
    }
  });
}

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://blfesportpro-code.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, X-BLF-Client",
    "Vary": "Origin"
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) }
  });
}
async function readSource(url) {
  return withShortCache("source:" + url, 15000, async () => {
    try {
      const response = await fetch(url, { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) return null;
      return await response.json();
    } catch { return null; }
  });
}
function safeString(value, max = 12000) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text || "").slice(0, max);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, service: "BLFesport Assistant", status: "online" }, 200, origin);
    }
    if (request.method !== "POST" || url.pathname !== "/chat") {
      return json({ error: "Route introuvable." }, 404, origin);
    }
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origine non autorisée." }, 403, origin);
    }
    if (!env.AI || !env.RATE_LIMITER) {
      return json({ error: "Le service IA n'est pas encore configuré sur Cloudflare." }, 503, origin);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: "Message invalide." }, 400, origin); }
    const message = String(body?.message || "").trim();
    if (!message || message.length > 1000) {
      return json({ error: "Le message doit contenir entre 1 et 1 000 caractères." }, 400, origin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const clientId = request.headers.get("X-BLF-Client") || "";
    const clientKey = /^[a-z0-9-]{20,64}$/i.test(clientId) ? clientId : ip;
    const limiter = (key) => env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(key));
    const clientLimit = await limiter("client:" + ip + ":" + clientKey).fetch("https://limiter/check");
    const clientResult = await clientLimit.json();
    if (!clientResult.allowed) {
      return json({ error: clientResult.reason, retryAfter: clientResult.retryAfter || 10 }, 429, origin);
    }
    const globalLimit = await limiter("global").fetch("https://limiter/check?global=1");
    const globalResult = await globalLimit.json();
    if (!globalResult.allowed) {
      return json({ error: "Le chat est très sollicité. Réessaie dans quelques instants.", retryAfter: 15 }, 429, origin);
    }

    // Réutilise pendant 2 minutes les réponses exactes aux questions non liées aux rosters.
    const rosterQuestion = /\\b(roster|rosters|composition|compositions|equipe|équipe|équipes|joueurs|joueur)\\b/i.test(message);
    let answerCacheKey = "";
    const rosterCache = limiter("global");
    if (!rosterQuestion) {
      const normalizedQuestion = message.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/\\s+/g, " ").trim();
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizedQuestion));
      answerCacheKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      try {
        const cachedAnswer = await rosterCache.fetch("https://limiter/answer-cache?key=" + answerCacheKey);
        if (cachedAnswer.ok) {
          const cached = await cachedAnswer.json();
          if (cached?.answer) return json({ answer: cached.answer, cached: true }, 200, origin);
        }
      } catch {}
    }

    // Sauvegarde persistante des compositions dans le stockage du Durable Object.
    // Elle reste disponible même si le Worker Discord est temporairement indisponible.
    const rosterCache = limiter("global");
    let cachedRosters = null;
    try {
      const cachedResponse = await rosterCache.fetch("https://limiter/roster-cache");
      if (cachedResponse.ok) cachedRosters = await cachedResponse.json();
    } catch {}

    const [siteData, liveRosters, matches, discord] = await Promise.all([
      readSiteContext(),
      readSource("https://blfesport-rosters.enzo-reuziault.workers.dev/"),
      readSource("https://blfesport-scrim-results.enzo-reuziault.workers.dev/api/matches"),
      readSource("https://blfesport-discord.enzo-reuziault.workers.dev/")
    ]);

    let rosters = null;
    if (Array.isArray(liveRosters?.players)) {
      if (liveRosters.stale !== true) {
        rosters = liveRosters;
        try {
          await rosterCache.fetch("https://limiter/roster-cache", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(liveRosters)
          });
        } catch {}
      } else {
        rosters = Array.isArray(cachedRosters?.players)
          ? { ...cachedRosters, stale: true, cacheFallback: true }
          : liveRosters;
        if (!Array.isArray(cachedRosters?.players)) {
          try {
            await rosterCache.fetch("https://limiter/roster-cache", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(rosters)
            });
          } catch {}
        }
      }
    } else if (Array.isArray(cachedRosters?.players)) {
      rosters = { ...cachedRosters, stale: true, cacheFallback: true };
    } else {
      rosters = INITIAL_ROSTER_CACHE;
      try {
        await rosterCache.fetch("https://limiter/roster-cache", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(INITIAL_ROSTER_CACHE)
        });
      } catch {}
    }

    const rosterNames = ["ROSTER A", "ROSTER B", "ROSTER ACADEMIQUE"];
    const normalizeRoster = value => {
      const name = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
      if (name === "ROSTER C" || name === "ROSTER ACADEMIQUE") return "ROSTER ACADEMIQUE";
      return name;
    };
    const discordPlayers = Array.isArray(rosters?.players) ? rosters.players : [];
    const groupedPlayers = rosterNames.map(roster => ({
      roster,
      joueurs: discordPlayers
        .filter(player => normalizeRoster(player.roster) === roster)
        .map(player => player.displayName || player.username || "Joueur")
    }));
    const discordRosterContext = rosters
      ? JSON.stringify({
          source: "Worker des rôles Discord",
          equipes: groupedPlayers,
          totalJoueurs: discordPlayers.length,
          updatedAt: rosters.updatedAt || null,
          donneesPerimees: rosters.stale === true,
          avertissement: rosters.warning || null
        })
      : "ERREUR : le Worker des rôles Discord n'a fourni aucune donnée.";

    const context = [
      "DONNÉES DIRECTES DU SITE (js/data.js) : " + siteData,
      "ÉQUIPES ET JOUEURS DISCORD EN DIRECT : " + safeString(discordRosterContext, 9000),
      "RÉSULTATS / MATCHS EN DIRECT : " + safeString(matches, 5000),
      "ACTUALITÉS DISCORD EN DIRECT : " + safeString(discord, 3000)
    ].join("\n\n");

    // Les compositions sont renvoyées directement depuis Discord pour éviter
    // que le modèle les remplace par les compositions statiques du site.
    const rosterQuestion = /\b(roster|rosters|composition|compositions|equipe|équipe|équipes|joueurs|joueur)\b/i.test(message);
    if (rosterQuestion) {
      if (!Array.isArray(rosters?.players)) {
        return json({ answer: "La récupération des compositions Discord est momentanément indisponible. Réessaie un peu plus tard ou consulte le Discord officiel : https://discord.com/invite/Jg9G6TgAen." }, 200, origin);
      }
      const rosterLines = groupedPlayers.map(group =>
        group.roster + " : " + (group.joueurs.length ? group.joueurs.join(", ") : "Aucun joueur trouvé.")
      );
      const freshness = rosters.stale === true
        ? "\\n\nNote : les données Discord disponibles sont anciennes et peuvent ne pas refléter les derniers changements."
        : "";
      return json({ answer: rosterLines.join("\n") + freshness }, 200, origin);
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "Tu es l'assistant officiel de BLFesport. Réponds en français, naturellement, avec des réponses précises et concises. Réponds directement à la question. Utilise les données directes du site et les sources live ci-dessous. Les données Discord live priment pour les rosters et les actualités. Pour toute question sur les rosters ou les joueurs, lis obligatoirement le bloc ÉQUIPES ET JOUEURS DISCORD EN DIRECT. Il contient les trois équipes déjà regroupées et la liste de leurs joueurs. ROSTER C est l'ancien nom de ROSTER ACADEMIQUE. N'affirme jamais ne pas avoir accès aux compositions si le bloc contient des joueurs. Si donneesPerimees vaut true, précise seulement que les données peuvent ne pas être à jour, mais donne quand même les joueurs présents dans le bloc. Si le bloc indique une erreur, explique que la récupération Discord est momentanément indisponible. Les données du site priment pour les pages, le staff, les médias, la boutique et les informations éditoriales. Si une source ne répond pas, ne prétends pas qu'elle est à jour. Si l'information manque, dis-le clairement et renvoie vers le Discord officiel https://discord.com/invite/Jg9G6TgAen. N'invente jamais de joueur, score, date, rôle, événement ou condition. Ne révèle pas les identifiants techniques ni les détails d'infrastructure. N'affirme jamais qu'une action a été effectuée. Pour les questions hors sujet, réponds brièvement en précisant ta spécialité BLFesport.\n\nCONTEXTE ACTUEL :\n" + context
          },
          { role: "user", content: message }
        ],
        max_tokens: 450,
        temperature: 0.35,
        chat_template_kwargs: { enable_thinking: false }
      });
      const answer = result?.response || result?.result?.response || result?.choices?.[0]?.message?.content || "";
      if (!answer) throw new Error("Réponse IA vide");
      const finalAnswer = String(answer).slice(0, 3500);
      if (answerCacheKey) {
        try {
          await rosterCache.fetch("https://limiter/answer-cache?key=" + answerCacheKey, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answer: finalAnswer, expiresAt: Date.now() + 120000 })
          });
        } catch {}
      }
      return json({ answer: finalAnswer }, 200, origin);
    } catch (error) {
      return json({ error: "L'assistant rencontre un problème temporaire. Réessaie dans un instant." }, 502, origin);
    }
  }
};

export class RateLimiter {
  constructor(ctx) { this.ctx = ctx; }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/roster-cache" && request.method === "GET") {
      return Response.json(await this.ctx.storage.get("roster-cache") || null);
    }
    if (url.pathname === "/roster-cache" && request.method === "PUT") {
      try {
        const data = await request.json();
        if (!data || !Array.isArray(data.players)) {
          return Response.json({ ok: false, error: "Invalid roster cache" }, { status: 400 });
        }
        const current = await this.ctx.storage.get("roster-cache");
        if (JSON.stringify(current) !== JSON.stringify(data)) {
          await this.ctx.storage.put("roster-cache", data);
        }
        return Response.json({ ok: true });
      } catch {
        return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
      }
    }
    if (url.pathname === "/answer-cache" && request.method === "GET") {
      const key = url.searchParams.get("key") || "";
      if (!/^[a-f0-9]{64}$/.test(key)) return Response.json(null);
      const entry = await this.ctx.storage.get("answer:" + key);
      if (!entry || entry.expiresAt <= Date.now()) {
        if (entry) await this.ctx.storage.delete("answer:" + key);
        return Response.json(null);
      }
      return Response.json(entry);
    }
    if (url.pathname === "/answer-cache" && request.method === "PUT") {
      const key = url.searchParams.get("key") || "";
      if (!/^[a-f0-9]{64}$/.test(key)) return Response.json({ ok: false }, { status: 400 });
      try {
        const entry = await request.json();
        if (typeof entry?.answer !== "string" || !Number.isFinite(entry.expiresAt)) {
          return Response.json({ ok: false }, { status: 400 });
        }
        await this.ctx.storage.put("answer:" + key, entry);
        return Response.json({ ok: true });
      } catch {
        return Response.json({ ok: false }, { status: 400 });
      }
    }
    if (url.pathname !== "/check") return new Response("Not found", { status: 404 });
    const global = url.searchParams.has("global");
    const now = Date.now();
    const state = await this.ctx.storage.get("state") || { timestamps: [], last: 0 };
    const timestamps = state.timestamps.filter(t => now - t < (global ? 60000 : 3600000));
    if (!global && now - state.last < 10000) {
      return Response.json({ allowed: false, reason: "Attends 10 secondes avant ton prochain message.", retryAfter: Math.ceil((10000 - (now - state.last)) / 1000) });
    }
    const minuteCount = timestamps.filter(t => now - t < 60000).length;
    if (global && minuteCount >= 200) {
      return Response.json({ allowed: false, reason: "Le chat est très sollicité. Réessaie dans quelques instants.", retryAfter: 15 });
    }
    if (!global && minuteCount >= 5) {
      return Response.json({ allowed: false, reason: "Tu as atteint la limite de 5 messages par minute.", retryAfter: 60 });
    }
    if (!global && timestamps.length >= 30) {
      return Response.json({ allowed: false, reason: "Tu as atteint la limite de 30 messages par heure.", retryAfter: 3600 });
    }
    timestamps.push(now);
    await this.ctx.storage.put("state", { timestamps, last: global ? state.last : now });
    return Response.json({ allowed: true });
  }
}
