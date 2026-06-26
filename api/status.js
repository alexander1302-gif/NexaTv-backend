// api/status.js
// Endpoint liviano de salud: confirma si KV está conectado, cuándo fue
// el último sync, y si hubo errores en la última corrida. Útil para
// monitoreo externo (UptimeRobot, etc.) o para un chequeo manual rápido.

const { getMeta, kvAvailable } = require("../lib/store");

module.exports = async function handler(req, res) {
  const meta = await getMeta();
  const hasFailures = (meta?.sources || []).some((s) => !s.ok);

  res.status(200).json({
    ok: true,
    storage: kvAvailable ? "redis" : "memory-fallback (no persiste entre invocaciones frías)",
    lastSync: meta?.lastSync || null,
    totalItems: meta?.totalItems ?? 0,
    sourcesWithErrors: hasFailures ? meta.sources.filter((s) => !s.ok) : [],
  });
};
