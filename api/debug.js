// api/debug.js
// ENDPOINT TEMPORAL DE DIAGNÓSTICO. Borra este archivo cuando termines de
// depurar — no expongas info de entorno en producción a largo plazo.

const store = require("../lib/store");

module.exports = async function handler(req, res) {
  const hasRedisUrl = !!process.env.REDIS_URL;
  const hasCronSecret = !!process.env.CRON_SECRET;

  let redisPingResult = "no intentado";
  let directKeyRead = "no intentado";

  if (hasRedisUrl) {
    try {
      const { createClient } = require("redis");
      const client = createClient({ url: process.env.REDIS_URL });
      await client.connect();
      const pong = await client.ping();
      await client.set("nexatv:debug:ping", new Date().toISOString());
      const readBack = await client.get("nexatv:debug:ping");

      // Lee la MISMA key exacta que usa lib/store.js para meta y catálogo,
      // con una conexión fresca e independiente, para comparar contra lo
      // que devuelve store.getMeta() / store.getCatalog() más abajo.
      const rawMetaDirect = await client.get("nexatv:meta");
      const rawCatalogDirect = await client.get("nexatv:catalog");

      await client.quit();
      redisPingResult = { ping: pong, wroteAndReadBack: readBack };
      directKeyRead = {
        "nexatv:meta (raw)": rawMetaDirect,
        "nexatv:catalog length (raw)": rawCatalogDirect ? JSON.parse(rawCatalogDirect).length : null,
      };
    } catch (e) {
      redisPingResult = { error: String(e.message || e) };
    }
  }

  // Ahora, por separado, usamos exactamente las mismas funciones que usan
  // /api/sync y /api/status, para ver si ven lo mismo que la lectura directa.
  let viaStoreModule = "no intentado";
  try {
    const metaViaStore = await store.getMeta();
    const catalogViaStore = await store.getCatalog();
    viaStoreModule = {
      kvAvailableSegunStore: store.kvAvailable,
      metaViaStore,
      catalogLengthViaStore: catalogViaStore.length,
    };
  } catch (e) {
    viaStoreModule = { error: String(e.message || e) };
  }

  res.status(200).json({
    hasRedisUrl,
    hasCronSecret,
    redisUrlPrefix: hasRedisUrl ? process.env.REDIS_URL.slice(0, 20) + "..." : null,
    redisPingResult,
    directKeyRead,
    viaStoreModule,
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV || "no definido",
    region: process.env.VERCEL_REGION || "no definido",
  });
};
