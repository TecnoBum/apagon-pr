/**
 * Apagón PR — lector del canal viejo @elecpinar por su vista web t.me/s/.
 *
 * El canal VIEJO ("Canal Viejo Empresa Eléctrica Pinar del Río") es PÚBLICO
 * Y LEGIBLE: https://t.me/s/elecpinar muestra los mensajes íntegros con
 * su fecha/hora real (atributo datetime, ISO UTC). Quedó congelado en
 * oct 2024 (último parte 12 oct 2024; anuncio de migración y, mucho después,
 * el aviso del canal de WhatsApp en mar 2025).
 *
 * Es la SEMILLA de la app: NOTAs reales del 12 oct 2024 (NOTA 3-12) con el
 * mismo formato del canal vivo. Todo lo que venga de aquí se marca demo=1
 * y la UI lo rotula "Datos de demostración — partes del 12 oct 2024, no
 * vigentes". El canal VIVO (@EmpresaElectricaPROficial) tiene el contenido
 * protegido y no se lee por web; su lector (MTProto) está pendiente de
 * decisión de Johan (ver lib/mtproto.ts). No se inventa ningún dato.
 */
import { htmlToText, messageId, parseMessage } from "./parser";
import type { StoredMessage } from "./types";

export const ELECIPINAR_URL = "https://t.me/s/elecpinar";

const MAX_PAGES = 3;

export type ElecpinarResult = {
  ok: boolean;
  fetched: number;
  reason?: string;
  messages: StoredMessage[];
};

/** Mensajes de servicio de Telegram (cambio de nombre/foto): sin contenido. */
function isServiceMessage(text: string): boolean {
  return /^Channel (name|photo)/i.test(text.trim());
}

/**
 * Extrae los mensajes de una página t.me/s: cada bloque
 * <div class="tgme_widget_message_wrap" data-post="elecpinar/NNN"> con
 * <time datetime="ISO"> y <div class="tgme_widget_message_text">.
 * La página viene en orden cronológico (el más viejo primero).
 */
export function parseTmePage(html: string): {
  messages: StoredMessage[];
  before: string | null;
} {
  const messages: StoredMessage[] = [];
  // Enlace "before" para la página anterior (mensajes más viejos).
  const beforeM = html.match(/href="\/s\/elecpinar\?before=(\d+)"/);
  const before = beforeM ? beforeM[1] : null;

  const blocks = [...html.matchAll(/data-post="elecpinar\/(\d+)"([\s\S]*?)(?=data-post="elecpinar\/\d+"|$)/g)];
  for (const b of blocks) {
    const postId = b[1];
    const body = b[2];
    const timeM = body.match(/datetime="([^"]+)"/);
    const textM = body.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    if (!timeM || !textM) continue;
    const raw = htmlToText(textM[1]).replace(/[\n]{3,}/g, "\n\n").trim();
    if (!raw || isServiceMessage(raw)) continue;
    const parsed = parseMessage(raw);
    const parsedOk =
      parsed.kind !== "otro" ||
      parsed.afectados.length > 0 ||
      parsed.restablecidos.length > 0 ||
      parsed.averiaCircuitos.length > 0
        ? 1
        : 0;
    messages.push({
      id: messageId("elecpinar", raw),
      source: "elecpinar",
      externalId: postId,
      postedAt: timeM[1],
      postedAtInferred: 0,
      demo: 1,
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
  return { messages, before };
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Lee la página actual y hasta MAX_PAGES-1 anteriores (mensajes más viejos). */
export async function fetchElecpinar(): Promise<ElecpinarResult> {
  const all: StoredMessage[] = [];
  let url = ELECIPINAR_URL;
  let reason: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const html = await fetchPage(url);
    if (html === null) {
      reason = page === 0 ? "fetch_failed" : undefined;
      break;
    }
    const { messages, before } = parseTmePage(html);
    all.push(...messages);
    if (!before) break;
    url = `${ELECIPINAR_URL}?before=${before}`;
  }
  if (!all.length) {
    return { ok: false, fetched: 0, reason: reason || "sin_mensajes", messages: [] };
  }
  all.sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  return { ok: true, fetched: all.length, messages: all };
}
