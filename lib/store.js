// lib/store.js
// Capa de almacenamiento del catálogo ya parseado.
// Usa Vercel KV (Redis) en producción. Si no hay credenciales de KV
// configuradas (ej. desarrollo local sin `vercel env pull`), cae a un
// cache en memoria del propio proceso para que el código siga siendo
// ejecutable sin depender de un servicio externo.

const CATALOG_KEY = "nexatv:catalog";
const META_KEY = "nexatv:meta";
const SOURCES_KEY = "nexatv:sources";

let kv = null;
let kvAvailable = false;

try {
  // Solo se activa si las env vars de KV existen; si no, lanza y caemos al fallback.
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    // eslint-disable-next-line global-require
    kv = require("@vercel/kv").kv;
    kvAvailable = true;
  }
} catch (e) {
  kvAvailable = false;
}

// Fallback en memoria — solo persiste mientras la función esté "caliente".
// NO usar como única fuente en producción real; está pensado como
// red de seguridad para desarrollo/demo sin KV configurado.
const memory = {
  catalog: [],
  meta: null,
  sources: null,
};

async function getCatalog() {
  if (kvAvailable) return (await kv.get(CATALOG_KEY)) || [];
  return memory.catalog;
}

async function setCatalog(items) {
  if (kvAvailable) {
    await kv.set(CATALOG_KEY, items);
    return;
  }
  memory.catalog = items;
}

async function getMeta() {
  if (kvAvailable) return (await kv.get(META_KEY)) || null;
  return memory.meta;
}

async function setMeta(meta) {
  if (kvAvailable) {
    await kv.set(META_KEY, meta);
    return;
  }
  memory.meta = meta;
}

async function getSources(defaults) {
  if (kvAvailable) {
    const stored = await kv.get(SOURCES_KEY);
    return stored || defaults;
  }
  return memory.sources || defaults;
}

async function setSources(sources) {
  if (kvAvailable) {
    await kv.set(SOURCES_KEY, sources);
    return;
  }
  memory.sources = sources;
}

module.exports = {
  kvAvailable,
  getCatalog,
  setCatalog,
  getMeta,
  setMeta,
  getSources,
  setSources,
};
