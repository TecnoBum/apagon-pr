/**
 * Apagón PR — lector MTProto de Telegram (canal vivo).
 *
 * El canal @EmpresaElectricaPROficial tiene el contenido protegido:
 * t.me/s/ no muestra los mensajes sin iniciar sesión. La única vía
 * directa y en vivo es una sesión MTProto (cliente Telegram) con
 * teleproto (fork mantenido de GramJS).
 *
 * Credenciales por variables de entorno (nunca en el código):
 * - TELEGRAM_API_ID / TELEGRAM_API_HASH: de my.telegram.org (apps API).
 * - TELEGRAM_SESSION_STRING: sesión de usuario guardada (StringSession).
 *
 * ESTADO: sin sesión configurada todavía. El reintento de creación de
 * la app API en my.telegram.org está programado para el 14 nov ~19:49
 * hora Cuba. Sin sesión, devuelve { ok: false, reason:
 * "no_session_configured" } y /api/sync lo reporta tal cual.
 * NUNCA se inventa un dato: sin credenciales no hay mensajes.
 */
import { messageId, parseMessage } from "./parser";
import type { StoredMessage } from "./types";

export const CHANNEL_USERNAME = "EmpresaElectricaPROficial";

export type MtprotoResult = {
  ok: boolean;
  fetched: number;
  reason?: string;
  detail?: string;
  messages: StoredMessage[];
};

const LIMIT = 40;

/** Mensajes de servicio de Telegram (cambio de nombre/foto): sin contenido. */
function isServiceMessage(text: string): boolean {
  return /^Channel (name|photo)/i.test(text.trim());
}

export async function readTelegramChannel(): Promise<MtprotoResult> {
  const apiId = Number(process.env.TELEGRAM_API_ID || 0);
  const apiHash = (process.env.TELEGRAM_API_HASH || "").trim();
  const sessionString = (process.env.TELEGRAM_SESSION_STRING || "").trim();
  if (!apiId || !apiHash) {
    return {
      ok: false,
      fetched: 0,
      reason: "no_api_configured",
      detail:
        "Faltan TELEGRAM_API_ID / TELEGRAM_API_HASH (my.telegram.org). Sin ellos no se puede abrir sesión MTProto.",
      messages: [],
    };
  }
  if (!sessionString) {
    return {
      ok: false,
      fetched: 0,
      reason: "no_session_configured",
      detail:
        "No hay sesión de Telegram configurada. El lector en vivo necesita TELEGRAM_SESSION_STRING. Sin sesión no se leen mensajes del canal.",
      messages: [],
    };
  }

  // Importación dinámica: teleproto solo se carga cuando hay sesión.
  const { TelegramClient } = await import("teleproto");
  const { StringSession } = await import("teleproto/sessions");
  const client = new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash,
    { connectionRetries: 2 }
  );
  try {
    await client.connect();
    const entity = await client.getEntity(CHANNEL_USERNAME);
    const out: StoredMessage[] = [];
    for await (const m of client.iterMessages(entity, { limit: LIMIT })) {
      const raw = (m.message || "").trim();
      if (!raw || isServiceMessage(raw)) continue;
      const parsed = parseMessage(raw);
      const parsedOk =
        parsed.kind !== "otro" ||
        parsed.afectados.length > 0 ||
        parsed.restablecidos.length > 0 ||
        parsed.averiaCircuitos.length > 0
          ? 1
          : 0;
      out.push({
        id: messageId("mtproto", raw),
        source: "mtproto",
        externalId: String(m.id),
        postedAt: new Date(m.date * 1000).toISOString(),
        postedAtInferred: 0,
        demo: 0,
        kind: parsed.kind,
        notaNum: parsed.notaNum,
        deficitMw: parsed.deficitMw,
        bloques: parsed.bloques,
        rawText: raw,
        hasAfetadosSection: parsed.hasAfetadosSection,
        afectados: parsed.afectados,
        restablecidos: parsed.restablecidos,
        averiaCircuitos: parsed.averiaCircuitos,
        averiaRestablecido: parsed.averiaRestablecido ? 1 : 0,
        zonas: parsed.zonas,
        municipio: parsed.municipio,
        parsedOk,
      });
    }
    out.sort((a, b) => a.postedAt.localeCompare(b.postedAt));
    if (!out.length) {
      return { ok: false, fetched: 0, reason: "sin_mensajes", messages: [] };
    }
    return { ok: true, fetched: out.length, messages: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "mtproto_failed";
    return {
      ok: false,
      fetched: 0,
      reason: "mtproto_failed",
      detail: msg.slice(0, 200),
      messages: [],
    };
  } finally {
    try {
      await client.disconnect();
    } catch {
      // La desconexión no debe tapar el resultado.
    }
  }
}
