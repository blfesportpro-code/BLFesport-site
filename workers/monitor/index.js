const DEFAULT_TARGETS = [
  { id: "rosters", name: "Worker des rosters", binding: "ROSTERS", path: "/" },
  { id: "discord", name: "Worker Discord", binding: "DISCORD", path: "/" },
  { id: "scrim-results", name: "Worker des résultats de scrims", binding: "SCRIM_RESULTS", path: "/api/matches" }
];

const TIMEOUT_MS = 8000;
const FRESHNESS_LIMIT_MS = 30 * 60 * 1000;
const HISTORY_KEY = "monitor:incident-history";
const HISTORY_LIMIT = 100;
const HISTORY_TTL_SECONDS = 90 * 24 * 60 * 60;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };
}

function isUnavailable(status) {
  return status === "offline" || status === "error";
}

async function readHistory(env) {
  if (!env.HISTORY || typeof env.HISTORY.get !== "function") return null;
  try {
    const stored = await env.HISTORY.get(HISTORY_KEY, "json");
    return stored && typeof stored === "object"
      ? { states: stored.states || {}, incidents: Array.isArray(stored.incidents) ? stored.incidents : [] }
      : { states: {}, incidents: [] };
  } catch {
    return { states: {}, incidents: [] };
  }
}

async function updateIncidentHistory(env, checks) {
  const history = await readHistory(env);
  if (!history || typeof env.HISTORY.put !== "function") {
    return { enabled: false, recorded: 0 };
  }

  const now = new Date().toISOString();
  const nextStates = { ...history.states };
  const incidents = [...history.incidents];
  let changed = false;
  let recorded = 0;

  for (const check of checks) {
    const previous = history.states[check.id];
    const current = check.status;
    if (previous === current) continue;

    changed = true;
    nextStates[check.id] = current;

    if (!previous) continue;

    if (!isUnavailable(previous) && isUnavailable(current)) {
      incidents.unshift({
        id: crypto.randomUUID(),
        workerId: check.id,
        workerName: check.name,
        type: "incident_started",
        startedAt: now,
        recoveredAt: null,
        durationMs: null,
        status: current
      });
      recorded++;
    } else if (isUnavailable(previous) && !isUnavailable(current)) {
      const activeIndex = incidents.findIndex(
        item => item.workerId === check.id && item.type === "incident_started" && !item.recoveredAt
      );
      if (activeIndex !== -1) {
        const incident = incidents[activeIndex];
        const durationMs = Math.max(0, Date.parse(now) - Date.parse(incident.startedAt));
        incidents[activeIndex] = {
          ...incident,
          recoveredAt: now,
          durationMs,
          recoveryStatus: current
        };
        recorded++;
      }
    }
  }

  if (changed) {
    await env.HISTORY.put(HISTORY_KEY, JSON.stringify({
      updatedAt: now,
      states: nextStates,
      incidents: incidents.slice(0, HISTORY_LIMIT)
    }), { expirationTtl: HISTORY_TTL_SECONDS });
  }

  return { enabled: true, recorded };
}

async function checkTarget(target, service) {
  if (!service || typeof service.fetch !== "function") {
    return {
      id: target.id,
      name: target.name,
      status: "not_configured",
      message: `Service Binding ${target.binding} non configuré`
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const request = new Request(`https://blfesport.internal${target.path}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    const response = await service.fetch(request);

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

    const result = {
      id: target.id,
      name: target.name,
      binding: target.binding,
      path: target.path,
      status: response.ok ? "online" : "error",
      httpStatus: response.status,
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
        result.dataFreshness = Number.isFinite(ageMs) && ageMs > FRESHNESS_LIMIT_MS ? "stale" : "fresh";
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

async function handleRequest(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (request.method !== "GET" || !["/", "/health", "/history"].includes(url.pathname)) {
      return Response.json(
        { error: "Route introuvable. Utilise /health ou /history." },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (url.pathname === "/history") {
      const history = await readHistory(env);
      return Response.json({
        service: "BLFesport Worker Supervisor",
        historyEnabled: Boolean(history),
        retentionDays: 90,
        limit: HISTORY_LIMIT,
        incidents: history ? history.incidents : [],
        activeIncidents: history ? history.incidents.filter(item => !item.recoveredAt) : []
      }, { headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" } });
    }

    const checks = await Promise.all(
      DEFAULT_TARGETS.map(target => checkTarget(target, env[target.binding]))
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

    const historyResult = await updateIncidentHistory(env, checks);

    return Response.json({
      service: "BLFesport Worker Supervisor",
      status: overall,
      checkedAt: new Date().toISOString(),
      summary: counts,
      history: {
        enabled: historyResult.enabled,
        newEventsRecorded: historyResult.recorded,
        endpoint: "/history"
      },
      workers: checks
    }, {
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json; charset=utf-8"
      }
    });
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
  scheduled(controller, env, ctx) {
    const task = handleRequest(new Request("https://blfesport.internal/health"), env)
      .catch(error => console.error("BLFesport monitor scheduled check failed:", error));
    ctx.waitUntil(task);
  }
};
