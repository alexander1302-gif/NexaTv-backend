// api/catalog.js
// Endpoint que consume el frontend de NexaTV. Solo lee lo que el último
// /api/sync dejó en KV — nunca descarga M3U en caliente, así la app
// responde rápido y no depende de la disponibilidad de cada lista en
// el momento exacto en que el usuario abre la app.
//
// Query params opcionales:
//   ?cat=Película   -> filtra por categoría (TV, Película, Series, Kids, Anime)
//   ?q=texto         -> búsqueda simple por título/tags (además de la
//                       búsqueda semántica que ya hace el frontend)

const { getCatalog, getMeta, getManualItems } = require("../lib/store");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const [catalog, meta, manual] = await Promise.all([
    getCatalog(),
    getMeta(),
    getManualItems(),
  ]);

  // El contenido manual va primero — así los títulos agregados a mano
  // (normalmente más cuidados/curados) aparecen antes que los canales
  // M3U masivos dentro de cada categoría.
  let items = [...manual, ...catalog];
  const cat = req.query?.cat;
  const q = (req.query?.q || "").toLowerCase().trim();

  if (cat) items = items.filter((i) => i.cat === cat);
  if (q) {
    items = items.filter((i) =>
      (i.title + " " + i.tags.join(" ")).toLowerCase().includes(q)
    );
  }

  // Cache de borde corto: si varias personas abren la app a la vez,
  // no golpean KV en cada request. stale-while-revalidate evita que
  // alguien vea un "loading" si la función se reinicia.
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  res.status(200).json({
    ok: true,
    count: items.length,
    lastSync: meta?.lastSync || null,
    sources: meta?.sources || [],
    items,
  });
};
