/**
 * Apagón PR — bot de Telegram para enviar partes a mano.
 *
 * Cómo funciona: Johan reenvía un parte del canal (o pega su texto)
 * al bot en Telegram. El bot lo parsea igual que los del canal, lo
 * guarda, reconstruye los periodos CON/SIN de los circuitos y responde
 * confirmando qué guardó. Así la app se actualiza sin esperar al lector
 * MTProto del canal vivo.
 *
 * Seguridad: solo los usuarios cuyo id numérico de Telegram esté en
 * TELEGRAM_ALLOWED_USER_IDS (separados por coma) pueden enviar partes.
 * Si la lista está vacía, nadie puede enviar (fail closed). El id se
 * obtiene con @userinfobot en Telegram.
 *
 * Variables de entorno:
 * - TELEGRAM_BOT_TOKEN: token del bot creado en @BotFather.
 * - TELEGRAM_WEBHOOK_SECRET: secreto que Telegram envía en la cabecera
 *   x-telegram-bot-api-secret-token (se fija al hacer setWebhook).
 * - TELEGRAM_ALLOWED_USER_IDS: ids numéricos permitidos, p. ej. "123456789".
 */
import {
  countMessages,
  ensureSchema,
  getMeta,
  insertMessage,
  latestMessage,
  listMessagesAsc,
  isBlockedError,
} from "./turso";
import { messageId, parseMessage } from "./parser";
import { reconstructStates, rebuildStates, refreshCircuits } from "./history";

export type BotIngestResult = {
  ok: boolean;
  inserted: boolean;
  alreadySaved?: boolean;
  kind?: string;
  notaNum?: number | null;
  deficitMw?: number | null;
  afectados?: string[];
  restablecidos?: string[];
  averiaCircuitos?: string[];
  error?: string;
};

export function isAllowedTelegramUser(userId: number | null | undefined): boolean {
  if (!userId) return false;
  const raw = (process.env.TELEGRAM_ALLOWED_USER_IDS || "").trim();
  if (!raw) return false;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(String(userId));
}

export async function sendTelegramMessage(
  chatId: number,
  text: string
): Promise<boolean> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Guarda un parte enviado por el bot y reconstruye los estados. */
export async function ingestBotMessage(
  rawText: string,
  postedAt?: string
): Promise<BotIngestResult> {
  const raw = rawText.trim();
  if (!raw) return { ok: false, inserted: false, error: "texto_vacio" };
  try {
    await ensureSchema();
    const at =
      postedAt && !isNaN(Date.parse(postedAt))
        ? new Date(postedAt).toISOString()
        : new Date().toISOString();
    const parsed = parseMessage(raw);
    const res = await insertMessage({
      id: messageId("telegram-bot", raw),
      source: "telegram-bot",
      externalId: messageId("telegram-bot", raw),
      postedAt: at,
      postedAtInferred: postedAt ? 0 : 1,
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
      parsedOk:
        parsed.kind !== "otro" ||
        parsed.afectados.length > 0 ||
        parsed.restablecidos.length > 0 ||
        parsed.averiaCircuitos.length > 0
          ? 1
          : 0,
    });
    const all = await listMessagesAsc();
    await rebuildStates(reconstructStates(all));
    await refreshCircuits(all);
    return {
      ok: true,
      inserted: res === "inserted",
      alreadySaved: res !== "inserted",
      kind: parsed.kind,
      notaNum: parsed.notaNum,
      deficitMw: parsed.deficitMw,
      afectados: parsed.afectados,
      restablecidos: parsed.restablecidos,
      averiaCircuitos: parsed.averiaCircuitos,
    };
  } catch (e) {
    const blocked = isBlockedError(e);
    return {
      ok: false,
      inserted: false,
      error: blocked ? "almacenamiento_bloqueado" : "guardar_failed",
    };
  }
}

/** Resumen corto en español para la confirmación al usuario (sin emojis). */
export function summarizeIngest(r: BotIngestResult): string {
  if (!r.ok) return "No pude guardar ese parte. Intenta de nuevo en un momento.";
  if (r.alreadySaved) return "Ese parte ya estaba guardado, no se duplicó.";
  const parts: string[] = ["Parte guardado y app actualizada."];
  if (r.kind === "nota") {
    if (r.notaNum !== null && r.notaNum !== undefined)
      parts.push(`NOTA ${r.notaNum}.`);
    if (r.deficitMw !== null && r.deficitMw !== undefined)
      parts.push(`Déficit: ${r.deficitMw} MW.`);
    if (r.afectados && r.afectados.length)
      parts.push(`Circuitos sin corriente: ${r.afectados.length} (${r.afectados.slice(0, 8).join(", ")}${r.afectados.length > 8 ? ", ..." : ""}).`);
    else parts.push("Sin lista de circuitos afectados.");
    if (r.restablecidos && r.restablecidos.length)
      parts.push(`Restablecidos: ${r.restablecidos.join(", ")}.`);
  } else if (r.kind === "averia") {
    if (r.averiaCircuitos && r.averiaCircuitos.length)
      parts.push(`Avería en: ${r.averiaCircuitos.join(", ")}.`);
    else parts.push("Avería guardada sin circuito identificado.");
  } else if (r.kind === "restaurado_total") {
    parts.push("La provincia ya no presenta afectación por déficit: todos los circuitos vuelven a CON corriente.");
  } else if (r.kind === "otro") {
    parts.push("No lo reconocí como NOTA ni avería, pero quedó guardado con el texto íntegro.");
  }
  return parts.join(" ");
}

/** Texto de ayuda del bot (/start). Sin emojis. */
export const BOT_HELP = [
  "Apagón PR: envíame partes del canal de la Empresa Eléctrica de Pinar del Río y actualizo la app.",
  "",
  "Cómo usarme:",
  "- Reenvíame un parte del canal, o pega su texto tal cual.",
  "- También acepto el texto de una NOTA, una avería o un aviso.",
  "",
  "Comandos:",
  "/start - ver esta ayuda",
  "/estado - cuántos partes hay guardados y cuál es el último",
].join("\n");

/** Estado corto para /estado. Sin emojis. */
export async function botStatusText(): Promise<string> {
  try {
    await ensureSchema();
    const total = await countMessages();
    const last = await latestMessage();
    const lastSync = await getMeta("last_sync");
    const lines = [`Partes guardados: ${total}.`];
    if (last) {
      lines.push(
        `Último: ${last.kind}${last.notaNum ? ` NOTA ${last.notaNum}` : ""} del ${last.postedAt.slice(0, 16).replace("T", " ")} UTC.`
      );
    } else {
      lines.push("Todavía no hay partes guardados.");
    }
    if (lastSync) lines.push(`Última sincronización: ${lastSync.slice(0, 16).replace("T", " ")} UTC.`);
    lines.push("Web: https://apagon-pr.vercel.app");
    return lines.join("\n");
  } catch {
    return "No pude leer la base de datos ahora mismo.";
  }
}
