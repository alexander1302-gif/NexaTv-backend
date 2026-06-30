// lib/store.js
// Capa de almacenamiento del catálogo ya parseado.
//
// IMPORTANTE: @vercel/kv quedó deprecado en diciembre de 2024 — todas las
// bases de datos existentes se migraron a Upstash/Redis Cloud, y los nuevos
// proyectos reciben una variable REDIS_URL (conexión estándar tipo
// redis://...) en vez del par KV_REST_API_URL/KV_REST_API_TOKEN. Por eso
// este módulo usa el paquete `redis` (cliente TCP estándar) en vez de
// `@vercel/kv`.
//
// CUIDADO DE DISEÑO: process.env.REDIS_URL se lee EN CADA LLAMADA, nunca
// se cachea en una variable de módulo evaluada una sola vez al cargar el
// archivo. En funciones serverless, leerla una sola vez en el top-level
// puede congelar `false` para siempre en una instancia si el cold start
// inicializa el módulo antes de que la env var esté completamente
// disponible en el proceso — eso causaba que /api/status reportara
// memory-fallback aun cuando /api/sync, en otra invocación, sí veía la
// variable y escribía en Redis correctamente.
//
// Si no hay REDIS_URL configurada (ej. desarrollo local sin variables),
// cae a un cache en memoria del propio proceso para que el código siga
// siendo ejecutable sin depender de un servicio externo.

const CATALOG_KEY = "nexatv:catalog";
const META_KEY = "nexatv:meta";
const SOURCES_KEY = "nexatv:sources";
const MANUAL_KEY = "nexatv:manual";

function isRedisConfigured() {
  return !!process.env.REDIS_URL;
}

// Las funciones serverless de Vercel reutilizan el mismo proceso entre
// invocaciones "calientes". Cacheamos la conexión (no la disponibilidad)
// en una variable de módulo para no abrir una conexión TCP nueva en
// cada request dentro de la misma instancia caliente.
let clientPromise = null;

function getClient() {
  if (!isRedisConfigured()) return null;
  if (!clientPromise) {
    // eslint-disable-next-line global-require
    const { createClient } = require("redis");
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err) => {
      console.error("Redis client error:", err.message);
      // Si la conexión se cae, forzamos reconexión en el próximo intento
      // en vez de seguir reutilizando un cliente roto.
      clientPromise = null;
    });
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

// Fallback en memoria — solo persiste mientras la función esté "caliente".
// NO usar como única fuente en producción real; está pensado como
// red de seguridad para desarrollo/demo sin Redis configurado.
const memory = {
  catalog: [],
  meta: null,
  sources: null,
  manual: [],
};

async function getCatalog() {
  if (isRedisConfigured()) {
    try {
      const client = await getClient();
      const raw = await client.get(CATALOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Redis getCatalog falló, usando memoria:", e.message);
      return memory.catalog;
    }
  }
  return memory.catalog;
}

async function setCatalog(items) {
  if (isRedisConfigured()) {
    try {
      const client = await getClient();
      await client.set(CATALOG_KEY, JSON.stringify(items));
      return;
    } catch (e) {
      console.error("Redis setCatalog falló, usando memoria:", e.message);
    }
  }
  memory.catalog = items;
}

async function getMeta() {
  if (isRedisConfigured()) {
    try {
      const client = await getClient();
      const raw = await client.get(META_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("Redis getMeta falló, usando memoria:", e.message);
      return memory.meta;
    }
  }
  return memory.meta;
}

async function setMeta(meta) {
  if (isRedisConfigured()) {
    try {
      const client = await getClient();
      await client.set(META_KEY, JSON.stringify(meta));
      return;
    } catch (e) {
      console.error("Redis setMeta falló, usando memoria:", e.message);
    }
  }
  memory.meta = meta;
}

async function getSources(defaults) {
  if (isRedisConfigured()) {
    try {
      const client = await getClient();
      const raw = await client.get(SOURCES_KEY);
      return raw ? JSON.parse(raw) : defaults;
    } catch (e) {
      console.error("Redis getSources falló, usando memoria:", e.message);
      return memory.sources || defaults;
    }
  }
  return memory.sources || defaults;
}

async function setSources(sources) {
  if (isRedisConfigured()) {
    try {
      const client = await getClient();
      await client.set(SOURCES_KEY, JSON.stringify(sources));
      return;
    } catch (e) {
      console.error("Redis setSources falló, usando memoria:", e.message);
    }
  }
  memory.sources = sources;
}

async function getManualItems() {
  if (isRedisConfigured()) {
    try {
      const client = await getClient();
      const raw = await client.get(MANUAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Redis getManualItems falló, usando memoria:", e.message);
      return memory.manual;
    }
  }
  return memory.manual;
}

async function setManualItems(items) {
  if (isRedisConfigured()) {
    try {
      const client = await getClient();
      await client.set(MANUAL_KEY, JSON.stringify(items));
      return;
    } catch (e) {
      console.error("Redis setManualItems falló, usando memoria:", e.message);
    }
  }
  memory.manual = items;
}

module.exports = {
  // Getter, no propiedad fija — se re-evalúa cada vez que se lee,
  // igual que isRedisConfigured() internamente.
  get kvAvailable() {
    return isRedisConfigured();
  },
  getCatalog,
  setCatalog,
  getMeta,
  setMeta,
  getSources,
  setSources,
  getManualItems,
  setManualItems,
};
