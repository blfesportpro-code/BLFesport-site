const DEFAULT_TARGETS = [
  { id: "rosters", name: "Worker des rosters", envKey: "ROSTERS_URL" },
  { id: "discord", name: "Worker Discord", envKey: "DISCORD_URL" },
  { id: "scrim-results", name: "Worker des résultats de scrims", envKey: "SCRIM_RESULTS_URL" }
];

const TIMEOUT_MS = 8000;
const FRESHNESS_LIMIT_MS = 30 * 60 * 1000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };
}

async function checkTarget(target, url) {
  if (!url) {
    return {
      id: target.id,
      name: target.name,
      status: "not_configured",
      message: "URL non configurée"
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    const latencyMs = Date.now() - startedAt;
    const contentType = response.headers.get("content-type") || "";
    const responseText = await response.text();
    let data = null;

    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = null;
      }
    }

    const checkedUrl = new URL(url);
    const result = {
      id: target.id,
      name: target.name,
      status: response.ok ? "online" : "error",
      httpStatus: response.status,
      checkedUrl: checkedUrl.origin + checkedUrl.pathname,
      responseUrl: response.url,
      latencyMs,
      checkedAt: new Date().toISOString()
    };

    if (!response.ok) {
      result.message = "Le Worker distant a répondu avec une erreur HTTP.";
      result.responseBody = responseText.slice(0, 300);
    }
    if (data && typeof data === "object") {
      if (data.updatedAt) {
        result.updatedAt = data.updatedAt;
        const ageMs = Date.now() - new Date(data.updatedAt).getTime();
        if (Number.isFinite(ageMs) && ageMs > FRESHNESS_LIMIT_MS) {
          result.dataFreshness = "stale";
        } else {
          result.dataFreshness = "fresh";
        }
      }
      if (data.cacheWarning) result.warning = String(data.cacheWarning);
      if (data.error) result.remoteError = String(data.error);
    }

    if (result.warning || result.remoteError || result.dataFreshness === "stale") {
      result.status = response.ok ? "warning" : "error";
    }

    return result;
  } catch (error) {
    return {
      id: target.id,
      name: target.name,
      status: "offline",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      message: error && error.name === "AbortError"
        ? "Délai de réponse dépassé (8 secondes)."
        : "Impossible de joindre le Worker distant."
    };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (request.method !== "GET" || (url.pathname !== "/" && url.pathname !== "/health")) {
      return Response.json(
        { error: "Route introuvable. Utilise /health." },
        { status: 404, headers: corsHeaders() }
      );
    }

    const checks = await Promise.all(
      DEFAULT_TARGETS.map(target => checkTarget(target, env[target.envKey]))
    );

    const counts = {
      online: checks.filter(item => item.status === "online").length,
      warning: checks.filter(item => item.status === "warning").length,
      offline: checks.filter(item => item.status === "offline" || item.status === "error").length,
      notConfigured: checks.filter(item => item.status === "not_configured").length
    };

    const overall = counts.offline > 0
      ? "degraded"
      : counts.warning > 0 || counts.notConfigured > 0
        ? "warning"
        : "operational";

    return Response.json({
      service: "BLFesport Worker Supervisor",
      status: overall,
      checkedAt: new Date().toISOString(),
      summary: counts,
      workers: checks
    }, {
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  }
};
