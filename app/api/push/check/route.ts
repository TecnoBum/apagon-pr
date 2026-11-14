import { NextResponse } from "next/server";
import { ensureSchema, listMessagesAsc, isBlockedError } from "@/lib/turso";
import { checkAndNotify, pushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * GET /api/push/check — objetivo de cron (cada pocos minutos).
 * Detecta los mensajes nuevos desde la última revisión y envía push a
 * los suscritos de cada circuito afectado/restablecido. La primera vez
 * solo marca el punto de partida (no bombardea con el histórico).
 */
export async function GET() {
  try {
    if (!pushConfigured()) {
      return NextResponse.json(
        { ok: false, error: "push_no_configurado" },
        { status: 503 }
      );
    }
    await ensureSchema();
    const messages = await listMessagesAsc();
    const result = await checkAndNotify(messages);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const blocked = isBlockedError(e);
    return NextResponse.json(
      { ok: false, error: blocked ? "almacenamiento_bloqueado" : "check_failed" },
      { status: blocked ? 503 : 500 }
    );
  }
}
