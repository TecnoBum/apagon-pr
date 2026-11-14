import { NextResponse } from "next/server";
import {
  BOT_HELP,
  botStatusText,
  ingestBotMessage,
  isAllowedTelegramUser,
  sendTelegramMessage,
  summarizeIngest,
} from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

/**
 * POST /api/telegram/webhook — webhook del bot de Apagón PR.
 *
 * Telegram envía cada mensaje como update. Se verifica la cabecera
 * x-telegram-bot-api-secret-token contra TELEGRAM_WEBHOOK_SECRET.
 * Solo los usuarios en TELEGRAM_ALLOWED_USER_IDS pueden enviar partes.
 * Un reenvío del canal llega como message con forward_from_chat y el
 * texto íntegro; un pegado llega como message.text normal. Ambos se
 * parsean y guardan igual que en /api/admin/pegar.
 */
type TgMessage = {
  message_id?: number;
  from?: { id?: number; username?: string };
  date?: number;
  forward_date?: number;
  text?: string;
  caption?: string;
  forward_from_chat?: { id?: number; title?: string };
};

function extractText(msg: TgMessage | undefined): string {
  if (!msg) return "";
  return (msg.text || msg.caption || "").trim();
}

export async function POST(req: Request) {
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const header = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!secret || header !== secret) {
    return NextResponse.json({ ok: false, error: "no_autorizado" }, { status: 401 });
  }
  let update: { message?: TgMessage; channel_post?: TgMessage };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }
  const msg = update.message;
  // Los channel_post no tienen remitente al que responder: no se procesan.
  if (!msg) {
    return NextResponse.json({ ok: true, ignored: "sin_mensaje" });
  }
  const chatId = (msg as { chat?: { id?: number } }).chat?.id;
  const fromId = msg.from?.id;
  const text = extractText(msg);

  if (!chatId || !text) {
    return NextResponse.json({ ok: true, ignored: "sin_texto" });
  }
  if (!isAllowedTelegramUser(fromId)) {
    await sendTelegramMessage(
      chatId,
      "No estás autorizado para enviar partes a Apagón PR."
    );
    return NextResponse.json({ ok: false, error: "no_autorizado" }, { status: 403 });
  }

  if (text === "/start" || text === "/ayuda" || text.startsWith("/start ")) {
    await sendTelegramMessage(chatId, BOT_HELP);
    return NextResponse.json({ ok: true, action: "start" });
  }
  if (text === "/estado" || text.startsWith("/estado ")) {
    await sendTelegramMessage(chatId, await botStatusText());
    return NextResponse.json({ ok: true, action: "estado" });
  }
  if (text.startsWith("/")) {
    await sendTelegramMessage(chatId, BOT_HELP);
    return NextResponse.json({ ok: true, action: "ayuda" });
  }

  // Fecha del parte: si es un reenvío, la original del canal
  // (forward_date); si es un pegado, la del mensaje.
  const origDate = msg.forward_date || msg.date;
  const postedAt = origDate
    ? new Date(origDate * 1000).toISOString()
    : undefined;
  const result = await ingestBotMessage(text, postedAt);
  await sendTelegramMessage(chatId, summarizeIngest(result));
  return NextResponse.json({ ok: result.ok, inserted: result.inserted });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "apagon-pr-telegram-webhook" });
}
