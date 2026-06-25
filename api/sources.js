// api/sources.js
// CRUD simple de fuentes M3U, respaldado en KV. El panel "Fuentes M3U"
// del frontend habla con este endpoint en vez de guardar la lista solo
// en el estado local del navegador — así, una vez configuradas, las
// fuentes sobreviven a recargas y las usa también /api/sync.
//
// GET    /api/sources            -> lista las fuentes actuales
// POST   /api/sources            -> agrega una fuente { label, url }
// PATCH  /api/sources?id=xxx     -> actualiza { enabled } o { label, url }
// DELETE /api/sources?id=xxx     -> elimina una fuente

const { getSources, setSources } = require("../lib/store");
const { DEFAULT_SOURCES } = require("../lib/sources");
const { slugify } = require("../lib/m3u");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const sources = await getSources(DEFAULT_SOURCES);

  if (req.method === "GET") {
    res.status(200).json({ ok: true, sources });
    return;
  }

  if (req.method === "POST") {
    const { label, url, enabled = true } = req.body || {};
    if (!url || typeof url !== "string") {
      res.status(400).json({ ok: false, error: "Falta 'url'." });
      return;
    }
    const id = slugify(label || url);
    if (sources.some((s) => s.id === id)) {
      res.status(409).json({ ok: false, error: "Ya existe una fuente con ese nombre/URL." });
      return;
    }
    const next = [...sources, { id, label: label || id, url, enabled: !!enabled }];
    await setSources(next);
    res.status(201).json({ ok: true, sources: next });
    return;
  }

  if (req.method === "PATCH") {
    const id = req.query?.id;
    if (!id) {
      res.status(400).json({ ok: false, error: "Falta '?id='." });
      return;
    }
    const updates = req.body || {};
    let found = false;
    const next = sources.map((s) => {
      if (s.id !== id) return s;
      found = true;
      return { ...s, ...updates, id: s.id };
    });
    if (!found) {
      res.status(404).json({ ok: false, error: "Fuente no encontrada." });
      return;
    }
    await setSources(next);
    res.status(200).json({ ok: true, sources: next });
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query?.id;
    if (!id) {
      res.status(400).json({ ok: false, error: "Falta '?id='." });
      return;
    }
    const next = sources.filter((s) => s.id !== id);
    await setSources(next);
    res.status(200).json({ ok: true, sources: next });
    return;
  }

  res.status(405).json({ ok: false, error: "Método no permitido." });
};
