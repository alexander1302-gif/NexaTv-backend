// api/debug.js
// ENDPOINT TEMPORAL DE DIAGNÓSTICO. Borra este archivo cuando termines de
// depurar — no expongas info de entorno en producción a largo plazo.
// Te dice exactamente qué ve el proceso de Vercel en este momento.

module.exports = async function handler(req, res) {
  const hasRedisUrl = !!process.env.REDIS_URL;
  const hasCronSecret = !!process.env.CRON_SECRET;

  let redisPingResult = "no intentado";
  if (hasRedisUrl) {
    try {
      const { createClient } = require("redis");
      const client = createClient({ url: process.env.REDIS_URL });
      await client.connect();
      const pong = await client.ping();
      await client.set("nexatv:debug:ping", new Date().toISOString());
      const readBack = await client.get("nexatv:debug:ping");
      await client.quit();
      redisPingResult = { ping: pong, wroteAndReadBack: readBack };
    } catch (e) {
      redisPingResult = { error: String(e.message || e) };
    }
  }

  res.status(200).json({
    hasRedisUrl,
    hasCronSecret,
    redisUrlPrefix: hasRedisUrl ? process.env.REDIS_URL.slice(0, 12) + "..." : null,
    redisPingResult,
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV || "no definido",
    region: process.env.VERCEL_REGION || "no definido",
  });
};
