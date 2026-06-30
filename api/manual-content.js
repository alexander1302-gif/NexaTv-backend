// api/manual-content.js
// CRUD de contenido agregado a mano (no proviene de listas M3U). Se
// guarda separado del catálogo M3U y se mezcla en /api/catalog para
// que la app no tenga que distinguir entre ambas fuentes.
//
// GET    /api/manual-content        -> lista todo el contenido manual
// POST   /api/manual-content        -> agrega un item nuevo
// PATCH  /api/manual-content?id=xxx -> edita un item existente
// DELETE /api/manual-content?id=xxx -> elimina un item

const { getManualItems, setManualItems } = require("../lib/store");
const { fallbackGradient, slugify } = require("../lib/m3u");

const VALID_CATEGORIES = ["Película", "Series", "Kids", "Anime"];

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeManualItem(input, existingId) {
  const title = String(input.title || "").trim();
  const cat = VALID_CATEGORIES.includes(input.cat) ? input.cat : "Película";
  const logoUrl = input.logoUrl ? String(input.logoUrl).trim() : null;
  const streamUrl = String(input.streamUrl || "").trim();
  const blurb = input.blurb ? String(input.blurb).trim() : `Agregado manualmente · ${cat}`;
  const year = input.year ? Number(input.year) || null : null;
  const mins = input.mins ? Number(input.mins) || null : null;
  const tags = Array.isArray(input.tags)
    ? input.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
    : [cat.toLowerCase()];

  const fallback = fallbackGradient(title || existingId || "x");
  const id = existingId || slugify(`manual-${title}-${Date.now()}`);

  return {
    id,
    title,
    cat,
    tags,
    year,
    mins,
    blurb,
    logoUrl,
    img: logoUrl ? `url("${logoUrl}")` : fallback,
    fallbackGrad: fallback,
    isLogoImg: !!logoUrl,
    streamUrl,
    live: false, // contenido manual se trata como VOD, no "en vivo"
    source: "manual",
    manual: true,
  };
}

function validate(input) {
  if (!input.title || !String(input.title).trim()) return "Falta 'title'.";
  if (!input.streamUrl || !String(input.streamUrl).trim()) return "Falta 'streamUrl'.";
  if (input.cat && !VALID_CATEGORIES.includes(input.cat)) {
    return `'cat' debe ser uno de: ${VALID_CATEGORIES.join(", ")}.`;
  }
  return null;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const items = await getManualItems();

  if (req.method === "GET") {
    res.status(200).json({ ok: true, items });
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const error = validate(body);
    if (error) {
      res.status(400).json({ ok: false, error });
      return;
    }
    const newItem = normalizeManualItem(body);
    const next = [...items, newItem];
    await setManualItems(next);
    res.status(201).json({ ok: true, item: newItem, items: next });
    return;
  }

  if (req.method === "PATCH") {
    const id = req.query?.id;
    if (!id) {
      res.status(400).json({ ok: false, error: "Falta '?id='." });
      return;
    }
    const existing = items.find((i) => i.id === id);
    if (!existing) {
      res.status(404).json({ ok: false, error: "Item no encontrado." });
      return;
    }
    const body = req.body || {};
    const merged = { ...existing, ...body };
    const error = validate(merged);
    if (error) {
      res.status(400).json({ ok: false, error });
      return;
    }
    const updatedItem = normalizeManualItem(merged, id);
    const next = items.map((i) => (i.id === id ? updatedItem : i));
    await setManualItems(next);
    res.status(200).json({ ok: true, item: updatedItem, items: next });
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query?.id;
    if (!id) {
      res.status(400).json({ ok: false, error: "Falta '?id='." });
      return;
    }
    const next = items.filter((i) => i.id !== id);
    await setManualItems(next);
    res.status(200).json({ ok: true, items: next });
    return;
  }

  res.status(405).json({ ok: false, error: "Método no permitido." });
};
