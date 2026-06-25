# NexaTV Backend — sincronización automática de listas M3U

Backend serverless (Vercel Functions + Vercel KV) que descarga, parsea y
cachea listas M3U automáticamente, y expone un catálogo limpio para que
el frontend de NexaTV lo consuma sin tener que parsear nada en el navegador.

```
Cron diario (Vercel) ──┐
Disparo manual/externo ─┼──> /api/sync ──> descarga + parsea M3U ──> Vercel KV
                         │
Frontend NexaTV ─────────┴──> /api/catalog ──> lee de KV, responde rápido
```

## 1. Requisitos

- Cuenta de Vercel (gratis, plan Hobby sirve).
- Node 18+ si quieres probar localmente con `vercel dev`.

## 2. Desplegar

```bash
npm i -g vercel        # si no lo tienes
cd nexatv-backend
vercel                 # sigue las instrucciones, crea el proyecto
```

## 3. Activar Vercel KV (almacenamiento)

1. En el dashboard de Vercel → tu proyecto → pestaña **Storage** → **Create Database** → **KV**.
2. Conéctala al proyecto. Vercel agrega automáticamente las env vars
   `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. Si no haces este paso, el backend sigue funcionando pero usa un
   *fallback en memoria* que se borra cada vez que la función serverless
   se "enfría" — bueno para probar, no para producción real.

## 4. Configurar el secreto del cron

1. En **Settings → Environment Variables**, agrega `CRON_SECRET` con un
   valor aleatorio largo (puedes generarlo con `openssl rand -hex 24`).
2. Vercel ya envía este valor automáticamente como header
   `Authorization: Bearer <CRON_SECRET>` cuando dispara el cron — no
   tienes que hacer nada más para que el cron oficial funcione.

## 5. Redeploy

```bash
vercel --prod
```

Esto registra el cron de `vercel.json` y deja los endpoints activos en
tu dominio `https://tu-proyecto.vercel.app`.

## 6. Primera sincronización manual

El cron corre una vez al día (ver sección de límites abajo), así que
para no esperar, dispara el primer sync a mano:

```bash
curl -X GET "https://tu-proyecto.vercel.app/api/sync?secret=TU_CRON_SECRET"
```

Deberías ver algo como:

```json
{ "ok": true, "meta": { "lastSync": "...", "totalItems": 842, "sources": [...] } }
```

## 7. Conectar el frontend (NexaTV)

En el artifact de NexaTV, cambia la fuente de datos de "fetch directo a
M3U desde el navegador" a "fetch a tu API":

```js
const res = await fetch("https://tu-proyecto.vercel.app/api/catalog");
const { items, lastSync } = await res.json();
```

Esto resuelve además el problema de CORS que algunas listas M3U tienen
cuando se intentan leer directo desde el navegador.

---

## Límites del plan gratuito (Hobby) — importante

Vercel Cron en Hobby **solo permite una ejecución al día** (no "cada 30
minutos"). Cualquier expresión más frecuente falla al desplegar. Por
eso `vercel.json` está configurado con `"0 6 * * *"` (todos los días a
las 6:00 UTC, con hasta ~59 min de margen — Vercel no garantiza el
minuto exacto en Hobby).

### Si necesitas más de 1 sync al día sin pagar Pro

`/api/sync` es un endpoint HTTP normal — cualquier servicio externo que
pueda hacer un `GET` programado puede dispararlo. Opciones gratuitas:

- **cron-job.org** — cron externo gratuito, soporta cada 5-15 min.
  Configura un job que pegue a:
  `https://tu-proyecto.vercel.app/api/sync?secret=TU_CRON_SECRET`
- **GitHub Actions** (gratis en repos públicos) — agrega un workflow
  con `schedule: cron: '*/30 * * * *'` que haga `curl` a tu `/api/sync`.
- **UptimeRobot** (su modo "monitor" hace pings periódicos; puedes
  apuntarlo a `/api/sync` como si fuera un health check).

Con cualquiera de estas, sigues en $0 y tienes sincronización cada
pocos minutos. El cron nativo de Vercel queda como respaldo diario
garantizado por si el servicio externo falla.

### Otros límites relevantes de Hobby

- Logs de funciones se retienen solo 1 hora.
- Sin reintentos automáticos si un cron falla (por eso conviene el
  respaldo externo si la sincronización es crítica).
- Esto solo aplica al *cron nativo*; las llamadas manuales o externas a
  `/api/sync` no tienen este límite.

## Endpoints disponibles

| Endpoint | Método | Qué hace |
|---|---|---|
| `/api/sync` | GET | Descarga, parsea y cachea todas las fuentes habilitadas. Requiere `CRON_SECRET` si está configurado. |
| `/api/catalog` | GET | Devuelve el catálogo cacheado. Soporta `?cat=` y `?q=`. Lo consume el frontend. |
| `/api/sources` | GET/POST/PATCH/DELETE | Gestiona las fuentes M3U (agregar tu propia lista de proveedor, activar/desactivar, eliminar). |
| `/api/status` | GET | Salud rápida: última sync, errores, si KV está conectado. |

## Agregar tu propia lista M3U de proveedor

```bash
curl -X POST "https://tu-proyecto.vercel.app/api/sources" \
  -H "Content-Type: application/json" \
  -d '{"label":"Mi proveedor","url":"https://mi-proveedor.com/lista.m3u","enabled":true}'
```

Luego dispara `/api/sync` (manual o esperando el cron) para que se
incluya en el catálogo.
