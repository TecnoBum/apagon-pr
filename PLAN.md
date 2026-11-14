# Apagón PR — Plan y especificación (14 nov 2026)

Pedido de Johan: app «Apagón PR» que lea los partes de https://t.me/EmpresaElectricaPROficial,
los muestre, analice el histórico de horas con/sin electricidad por circuito, dé toda la
información posible, se actualice sola y permita notificaciones push por circuito(s) elegido(s).

## Fuente y bloqueo (verificado 14 nov 2026)

- El canal ES público («Empresa Eléctrica de Pinar del Río Oficial», 16.304 suscriptores,
  último mensaje entre el n.º 11750 (10 nov 23:37) y el 12000) pero tiene el contenido
  protegido: t.me/s/ NO muestra los mensajes sin iniciar sesión («Please open Telegram
  to view this post»). Control: @durov sí se ve. tgstat = muro anti-bots. RSSHub = rechazado.
- Espejo que SÍ muestra mensajes: **https://telegramian.com/elecpinar/** (la URL
  /EmpresaElectricaPROficial/ da 404; la correcta se encontró con el buscador interno).
  PERO está desactualizado: todos los mensajes visibles son del **10 oct 2024**. Sirve
  como REFERENCIA DE FORMATO, no como feed en vivo.
- **SEMILLA REAL (actualización 14 nov 09:37): el canal VIEJO @elecpinar es PÚBLICO
  Y LEGIBLE por web — https://t.me/s/elecpinar muestra los mensajes íntegros con
  fecha/hora real (atributo datetime, ISO UTC) y paginación ?before=.** NOTAs 3-12
  del 12 oct 2024 + anuncio de migración; renombrado «Canal Viejo», congelado
  (último post 24 mar 2025, aviso del canal de WhatsApp). **La app usa ESTA
  página como semilla (lib/elecpinar.ts), NO telegramian** (siguen siendo datos
  de oct 2024: demo/no vigentes). La empresa además abrió un canal de WhatsApp
  paralelo: https://whatsapp.com/channel/0029Vb9zBJRCxoAxiNhZfk2d (150K
  seguidores; en web solo se ve la tarjeta, no los mensajes; la conexión de
  WhatsApp de Muse NO lee canales).
- elalambique.net (proyecto que lee canales de empresas eléctricas) dice de Pinar:
  «no encontramos un canal de su empresa eléctrica que podamos leer» — corrobora el bloqueo.
- **Feed en vivo pendiente de decisión de Johan:** sesión MTProto de Telegram (código único,
  sesión guardada en el servidor, revocable) o que él pegue los partes a mano.
- PENDIENTE de Johan: UN parte actual para confirmar que el formato de 2024 sigue igual.

## Formato real de los mensajes (ejemplos íntegros del 10 oct 2024, telegramian)

### NOTA de actualización del SEN (la más frecuente; 11 notas en ~5 h ese día, cada 10-67 min)

```
❗️Actualización del SEN ❗
📆NOTA 18 ⏰Hora: 4:54 pm
🛎Se le informa a la población que la provincia presenta afectaciones de Déficit por Capacidad de Generación. Se trabaja fuera de planificación.
📈Déficit de Generación: 45 MW
🔰Bloque Afectado: 1 y 2
⏰Tiempo de Afectación: 🚫
⚠Circuitos Afectados:
⚜️P 916 / ⚜️PD 1082 / ⚜️PD 100 / ⚜️ PD 105 / ⚜️P 961 / ⚜️P 512 / ⚜️ P 915 / ⚜️PD 60 / ⚜️P 919 / ⚜️P523 / ⚜️P 60 / ⚜️PD 415 / ⚜️ P 90 / ⚜️ P 70 / ⚜️PD 45 / ⚜️ PD 1081 / ⚜️PD 2175
📌 Les mantendremos informados.
Equipo de Atención al cliente
```

Variantes: a veces añade `💡Circuito Restablecido: ⚜️P 80` (puede ser lista).
Evolución del déficit ese día: 25 MW (NOTA 13, 2:22 pm) → 30 → 30 → 35 → 40 → 45 MW (NOTA 18).
La lista de afectados crece y se encoge de nota en nota (8 → 11 → 11 → 14 → 16 → 17 circuitos).

### Avería (intercalada entre las NOTAs)

```
📍Avería Primaria: Se estan realizando celajes para encontrar el origen de la falla
🛎 Circuito: ⚜️PD 2190
📌Municipio: PINAR
```
Otras formas: `Avería Primario: Disparo` (con circuitos P 266, P 526, PD 45),
`Avería Primario: RESTABLECIDO` (P 266 Briones, Cayo el Pilar),
`Se le restablecerá el servicio eléctrico en cuanto sea posible` (sin hora).

### Previsión (no es un horario de apagón)

`☀Horario Diurno: 600 MW / 🌑Pico Nocturno: 1235 MW` — previsión de déficit, NO horarios
por circuito. NO hay programa diario con bloques horarios: repiten
«Se trabaja fuera de planificación».

### Identificación de circuitos

- Patrón: letra + número: `P 916`, `PD 1082`, `PD 100`, `P 80`, `S 606`.
  Normalizar: quitar espacios (`P916`, `PD1082`), mayúsculas. Prefijos vistos: P, PD, S.
- **QUIRK VERIFICADO 14 nov (canal viejo, 12 oct 2024): la empresa escribe el
  mismo circuito con prefijo distinto según la NOTA** — `P1082`/`P2180` en las
  NOTAs 3-4 y `PD1082`/`PD2180` en las 10-12; igual `P60` vs `PD60`. La app
  los trata como códigos distintos (fiel a lo publicado); si Johan confirma
  que son el mismo circuito, añadir un mapa de alias. NO fusionar a ciegas.
- A veces con lugar: `P 526 Reparto Hermanos Cruz (Micro I, III, IV y V), EIDE Ormany Arenado`,
  `P 266 Briones, Cayo el Pilar`, `PD 45 Minas, Pica Pica, Cabeza, Pons, Sumidero, La Güira y El Moncada`.
  Guardar el texto de lugar como `zona` del circuito cuando venga.
- «Bloque Afectado: 1 y 2» es OTRA cosa (bloques de rotación), no el circuito.
- **La cabecera de afectados puede ser singular: `⚠Circuito Afectado:`** (NOTA 5,
  un solo circuito) o plural `⚠Circuitos Afectados:`. El parser acepta ambas.
- **La «Nota informativa» diaria menciona «las averías» en prosa** (unidades
  fuera de servicio) sin nombrar circuito: NO es una avería. El parser solo
  clasifica avería si hay línea `Circuito:`; sin ella, no se extraen códigos
  del texto (antes salían basura tipo `DE2024`, `LAS24`, `EL12`).
- **«En estos momentos la provincia no presenta afectación por déficit» es un
  restablecimiento TOTAL** (kind `restaurado_total`): todos los circuitos SIN
  vuelven a CON en ese momento.
- **El corte de datos lo marca el último mensaje que INFORMA del estado**
  (NOTA/avería/restablecido), no el último mensaje de cualquier tipo: un
  anuncio sin contenido eléctrico (migración, convocatoria) no alarga el
  corte (la semilla llegaría hasta mar 2025 si no).
- **Una NOTA sin lista de afectados no cambia ningún estado** (solo trae
  déficit/bloque). La restauración inferida solo se aplica cuando la NOTA
  trae lista (`has_afectados_section`).

## Modelo de datos (¡sin horas publicadas por circuito!)

La empresa NO publica hora de inicio/fin por circuito. Las horas con/sin electricidad se
RECONSTRUYEN de nota en nota:
- Un circuito está SIN corriente desde la primera NOTA que lo lista en «Circuitos Afectados»
  (o desde que aparece en una avería) hasta la NOTA que lo lista en «Circuito Restablecido»
  o que deja de incluirlo en afectados (marcar este segundo caso como `restauracion_inferida`).
- La precisión depende de la frecuencia de lectura (NOTAs cada 10-67 min en crisis).
- El histórico empieza a acumularse cuando el lector empieza a leer. No hay retroactivo.
- Guardar SIEMPRE el texto crudo de cada mensaje + su fecha/hora + fuente, aunque el
  parser no lo reconozca (fallback: mostrar el texto tal cual).

## Arquitectura

- Web: Next.js (App Router) en `~/workspace/apagon-pr/`, mobile-first, interruptor
  claro/oscuro por defecto, iconos SVG (sin emojis en la UI; el TEXTO de los partes sí
  lleva sus emojis, es contenido).
- Datos: Turso (base compartida de Klick). Tablas `apagonpr_*`: mensajes crudos, estados
  por circuito, series de horas, suscripciones push. Credenciales: patrón
  `~/workspace/cubaonline/medir-turso.py` (LEER de runtime, NUNCA imprimir ni guardar).
- API: /api/partes (lista), /api/circuitos, /api/circuito/[id] (línea de tiempo + totales),
  /api/sync (lee fuentes), /api/push/subscribe, /api/push/check.
  Fuentes del lector (en orden): MTProto (sesión en env `TELEGRAM_SESSION_STRING`,
  implementar con GramJS; si no hay sesión, el endpoint lo indica y NO inventa datos),
  t.me/s/elecpinar (canal viejo, solo semilla/demo, MARCAR fecha 2024 y «no vigente»),
  pegado manual (endpoint admin con secreto en env).
- **BOT DE TELEGRAM PARA ENVIAR PARTES A MANO (añadido 14 nov, pedido de Johan):**
  `POST /api/telegram/webhook` — Johan reenvía un parte del canal al bot (o pega su
  texto) y la app se actualiza: mismo parseo que el canal, deduplicación por hash,
  reconstrucción de estados, respuesta de confirmación. Verifica la cabecera
  `x-telegram-bot-api-secret-token` (= `TELEGRAM_WEBHOOK_SECRET`) y solo acepta a los
  ids de `TELEGRAM_ALLOWED_USER_IDS` (fail closed si está vacía). Comandos: /start
  (ayuda), /estado (totales + último parte). Fecha del parte: `forward_date` si es
  reenvío. Env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
  `TELEGRAM_ALLOWED_USER_IDS`. Puesta en marcha (Johan crea el bot en @BotFather;
  el agente pone las vars en Vercel y hace setWebhook con el secreto). El pegado
  manual por API (`POST /api/admin/pegar` con `ADMIN_SECRET`) sigue disponible.
- **MTProto (revisado 14 nov, pedido de Johan):** lector REAL con teleproto (fork
  mantenido de GramJS; `telegram` está archivado, no usar). `lib/mtproto.ts` lee los
  últimos 40 mensajes de @EmpresaElectricaPROficial con `TELEGRAM_API_ID` /
  `TELEGRAM_API_HASH` / `TELEGRAM_SESSION_STRING`, y `/api/sync` ya ingiere sus
  mensajes igual que la semilla. Sin credenciales reporta `no_api_configured` o
  `no_session_configured` y NO inventa datos. Falta: api_id/api_hash — reintento de
  creación en my.telegram.org programado (cron `apagonpr-reintento-api-telegram`,
  14 nov 23:49 UTC = 19:49 hora Cuba, una sola vez) y luego la sesión de usuario.
- Verificación local: `TURSO_DATABASE_URL=file:./.dev.db` (libsql en archivo) cuando
  Vercel no responde (403 al equipo tecnobum) — mismo código y esquema; en
  producción valen las env vars de Turso del proyecto klick.
- Push: Web Push con VAPID (generar claves, en .env.local, no commitear) + service worker.
  Notificar: circuito afectado, circuito restablecido, nueva NOTA con cambio de déficit.
- Despliegue: Vercel por el PANEL con el navegador (el conector está bloqueado, 403).
  El subagente NO despliega. Verificación local: `npx tsc --noEmit` (next build cuelga).
- APK WebView (aapt2) después de la web en vivo — lo hace el agente principal, no el subagente.

- **Confirmado por Johan 14 nov 09:47: P y PD son circuitos DIFERENTES** (P1082 ≠ PD1082; igual P60 ≠ PD60, P2180 ≠ PD2180). No hacer mapa de alias: cada código es su propio circuito con su propio historial.

- **DISEÑO WEB (orden de Johan 14 nov 09:48): minimalista, estilo APK, SIN emojis, con iconos, varias secciones con bastante información, bien distribuida para vista móvil.** Aplica a TODA la app, incluido el contenido de los partes: los emojis de los mensajes de la empresa se sustituyen por iconos SVG según el campo (déficit, bloque, afectados, restablecido, avería, hora) y el texto crudo se muestra sin emojis. Navegación inferior con pestañas (Inicio, Circuitos, Partes, Estadísticas, Avisos). (Rediseño encargado 14 nov 09:48.)
