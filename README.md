# Apagón PR

Partes de la Empresa Eléctrica de Pinar del Río: circuitos afectados, horas
con y sin corriente por circuito, avisos push por circuito.

## Fuente (verificado 14 nov 2026)

- **Canal vivo pedido por Johan:** @EmpresaElectricaPROficial — público pero
  con el contenido protegido: t.me/s/ no muestra los mensajes sin iniciar
  sesión. El lector en vivo (MTProto) está pendiente de su decisión; sin
  sesión no hay feed en vivo. La empresa además tiene un canal de WhatsApp
  paralelo (https://whatsapp.com/channel/0029Vb9zBJRCxoAxiNhZfk2d) que no se
  lee desde fuera.
- **Semilla (demo):** canal viejo @elecpinar, legible por web
  (https://t.me/s/elecpinar) pero congelado en oct 2024: NOTAs 3–12 del
  12 oct 2024 + anuncio de migración. Todo lo que venga de ahí se marca
  `demo=1` y la UI lo rotula "Datos de demostración — no vigentes".
- **Canal vivo:** lector MTProto real con teleproto (`lib/mtproto.ts`):
  necesita `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` y
  `TELEGRAM_SESSION_STRING` en Vercel; `/api/sync?source=mtproto` lee los
  últimos 40 mensajes de @EmpresaElectricaPROficial. Sin sesión, el
  endpoint lo dice y no inventa datos.
- **Bot para enviar partes a mano:** crea el bot en @BotFather y pon en
  Vercel `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (secreto del
  webhook) y `TELEGRAM_ALLOWED_USER_IDS` (tu id numérico de Telegram,
  lo da @userinfobot). Activa el webhook:
  `curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook -d url=https://apagon-pr.vercel.app/api/telegram/webhook -d secret_token=<SECRETO>`.
  Después basta reenviarle un parte del canal (o pegarle el texto).

## Modelo honesto de horas (la empresa NO publica horas por circuito)

El estado SIN/CON se reconstruye de parte en parte (`lib/history.ts`):
afectado desde la primera NOTA que lo lista hasta la NOTA que lo
restablece o lo saca de la lista (este segundo caso, marcado como
`restauracion_inferida`). Una NOTA sin lista de circuitos no cambia el
estado de ninguno. "La provincia no presenta afectación por déficit"
restablece a todos. Las horas se cuentan hasta el último parte (si los
datos son viejos, no se inventan meses de apagón).

## Datos

Turso (base compartida con Klick/CubaOnline), tablas `apagonpr_*`:
mensajes crudos + parseo, circuitos, periodos CON/SIN, suscripciones push,
metadatos. El esquema se crea solo al primer acceso (`ensureSchema()`).

- Desarrollo local: `TURSO_DATABASE_URL=file:./.dev.db` (libsql en archivo,
  mismo código y esquema). Lo escribe `scripts/fetch-env.py` cuando Vercel
  no responde (403 al equipo tecnobum, situación desde el 9 nov 2026).
- Producción (Vercel): las env vars `TURSO_DATABASE_URL` /
  `TURSO_AUTH_TOKEN` ya existen en el proyecto klick; al desplegar este
  proyecto hay que copiarlas (nunca commitearlas, nunca imprimirlas).

## Rutas

- `/` inicio por secciones: estado actual, sin corriente, restablecidos,
  últimos partes, resumen del día.
- `/partes` feed completo (resumen con iconos + texto original sin emojis).
- `/circuitos` listado y búsqueda por código o zona (sin corriente primero).
- `/circuito/[id]` ficha: horas CON/SIN, línea de tiempo, partes que lo mencionan.
- `/estadisticas` ranking de circuitos, totales, historial del déficit, por día.
- `/avisos` avisos push de todos los circuitos + sin corriente ahora.
- Navegación inferior con pestañas (Inicio, Circuitos, Partes, Estadísticas,
  Avisos), estilo APK, minimalista.
- **Sin emojis en NINGÚN sitio**: los emojis de los partes se sustituyen por
  iconos SVG por campo y el texto crudo pasa por `stripEmoji()`
  (`lib/stripEmoji.ts`).
- `GET /api/sync?source=elecpinar|mtproto|all` — lee fuentes y reconstruye
  los periodos (también `POST /api/admin/pegar` con `ADMIN_SECRET` para
  pegar partes a mano).
- `POST /api/telegram/webhook` — bot de Telegram: reenviar un parte del canal
  (o pegar su texto) actualiza la app; verifica el secreto del webhook y solo
  acepta a los usuarios de `TELEGRAM_ALLOWED_USER_IDS`. Comandos /start y /estado.
- `GET /api/partes`, `GET /api/circuitos?q=`, `GET /api/circuito/[id]`.
- `POST/DELETE /api/push/subscribe`, `GET /api/push/check` (objetivo de cron).

## Push

Web Push con VAPID (claves en `.env.local`, generadas por
`scripts/fetch-env.py`; nunca commitear). Service worker en `public/sw.js`.
La campana por circuito suscribe solo ese circuito; en el inicio, todos.

## Desarrollo

```sh
python3 scripts/fetch-env.py   # .env.local (Turso local + VAPID + ADMIN_SECRET)
npm run dev                    # http://localhost:3000
curl "http://localhost:3000/api/sync?source=elecpinar"  # semilla demo
npx tsc --noEmit               # verificación de tipos (next build cuelga aquí)
```

`next build` cuelga en este entorno: verificar con `tsc --noEmit` + dev server.
Despliegue por el PANEL de Vercel (el conector está bloqueado, 403).
La APK WebView (aapt2) se hace después de la web en vivo.
