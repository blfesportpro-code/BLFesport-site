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
  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(4500) });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
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

    const [rosters, matches, discord] = await Promise.all([
      readSource("https://blfesport-rosters.enzo-reuziault.workers.dev/"),
      readSource("https://blfesport-scrim-results.enzo-reuziault.workers.dev/api/matches"),
      readSource("https://blfesport-discord.enzo-reuziault.workers.dev/")
    ]);

    const context = [
      "ROSTERS DISCORD : " + safeString(rosters, 7000),
      "RÉSULTATS / MATCHS : " + safeString(matches, 5000),
      "ACTUALITÉS DISCORD : " + safeString(discord, 3000)
    ].join("\n\n");

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "Tu es l'assistant officiel de BLFesport, organisation esport française principalement sur Rocket League. Réponds en français, naturellement, de façon concise et utile. Aide sur les équipes, joueurs, résultats, recrutement, staff, événements et le site. Utilise uniquement les informations du contexte ci-dessous pour les faits BLFesport. Si une donnée manque ou si une source ne répond pas, dis clairement que tu n'as pas l'information et invite à consulter le Discord officiel https://discord.com/invite/Jg9G6TgAen. N'invente jamais de joueur, résultat, date, rôle ou condition de recrutement. Ne révèle jamais les identifiants techniques bruts. N'affirme pas qu'une action a été effectuée.\n\nCONTEXTE ACTUEL :\n" + context
          },
          { role: "user", content: message }
        ],
        max_tokens: 450,
        temperature: 0.35,
        chat_template_kwargs: { enable_thinking: false }
      });
      const answer = result?.response || result?.result?.response || result?.choices?.[0]?.message?.content || "";
      if (!answer) throw new Error("Réponse IA vide");
      return json({ answer: String(answer).slice(0, 3500) }, 200, origin);
    } catch (error) {
      return json({ error: "L'assistant rencontre un problème temporaire. Réessaie dans un instant." }, 502, origin);
    }
  }
};

export class RateLimiter {
  constructor(ctx) { this.ctx = ctx; }
  async fetch(request) {
    if (new URL(request.url).pathname !== "/check") return new Response("Not found", { status: 404 });
    const global = new URL(request.url).searchParams.has("global");
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
