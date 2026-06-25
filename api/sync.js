// api/sync.js
// Descarga todas las fuentes M3U habilitadas, las parsea, deduplica
// y guarda el resultado en KV. Lo invoca:
//   1) El cron diario de Vercel (gratis en plan Hobby — ver vercel.json)
//   2) Un disparador externo gratuito (cron-job.org, GitHub Actions,
//      UptimeRobot...) si quieres más de 1 sync al día sin pagar Pro
//   3) Una llamada manual con el secreto correcto, para forzar un refresh
//
// Seguridad: Vercel envía automáticamente `Authorization: Bearer
// $CRON_SECRET` en las invocaciones de cron. Cualquier otra llamada
// debe traer ese mismo header o un `?secret=` con el mismo valor.

const { parseM3U, normalizeItem, dedupe } = require("../lib/m3u");
const { setCatalog, setMeta, getSources } = require("../lib/store");
const { DEFAULT_SOURCES } = require("../lib/sources");

const FETCH_TIMEOUT_MS = 20000;

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sin secreto configurado: abierto (solo recomendado en desarrollo)
  const authHeader = req.headers["authorization"];
  if (authHeader === `Bearer ${secret}`) return true;
  const querySecret = req.query?.secret;
  if (querySecret === secret) return true;
  return false;
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ ok: false, error: "No autorizado." });
    return;
  }

  const startedAt = Date.now();
  const sources = await getSources(DEFAULT_SOURCES);
  const enabled = sources.filter((s) => s.enabled);

  const perSourceResults = await Promise.all(
    enabled.map(async (src) => {
      try {
        const r = await fetchWithTimeout(src.url, FETCH_TIMEOUT_MS);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        const items = parseM3U(text, src.label).map(normalizeItem);
        return { sourceId: src.id, label: src.label, ok: true, count: items.length, items };
      } catch (err) {
        return { sourceId: src.id, label: src.label, ok: false, error: String(err.message || err), count: 0, items: [] };
      }
    })
  );

  const merged = dedupe(perSourceResults.flatMap((r) => r.items));
  await setCatalog(merged);

  const meta = {
    lastSync: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    totalItems: merged.length,
    sources: perSourceResults.map(({ items, ...rest }) => rest), // no guardamos items duplicados en meta
  };
  await setMeta(meta);

  const anyFailed = perSourceResults.some((r) => !r.ok);
  res.status(200).json({ ok: !anyFailed, meta });
};
