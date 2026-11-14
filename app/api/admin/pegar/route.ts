import { NextResponse } from "next/server";
import {
  ensureSchema,
  insertMessage,
  listMessagesAsc,
  isBlockedError,
} from "@/lib/turso";
import { messageId, parseMessage } from "@/lib/parser";
import { reconstructStates, rebuildStates, refreshCircuits } from "@/lib/history";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pegar { secret, messages: [{raw_text, posted_at?}] }
 * Pegado manual de partes (vía de escape mientras no hay lector MTProto).
 * El secreto es ADMIN_SECRET (.env.local). Cada mensaje se parsea igual
 * que los del canal y se guarda con source="manual". posted_at opcional
 * (ISO); si falta, se usa el momento de la recepción.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const secret = process.env.ADMIN_SECRET || "";
    if (!secret || body?.secret !== secret) {
      return NextResponse.json({ ok: false, error: "no_autorizado" }, { status: 401 });
    }
    const items = Array.isArray(body?.messages) ? body.messages : [];
    if (!items.length) {
      return NextResponse.json({ ok: false, error: "sin_mensajes" }, { status: 400 });
    }
    await ensureSchema();
    let inserted = 0;
    let skipped = 0;
    for (const it of items) {
      const raw = typeof it?.raw_text === "string" ? it.raw_text.trim() : "";
      if (!raw) {
        skipped++;
        continue;
      }
      const postedAt =
        typeof it?.posted_at === "string" && !isNaN(Date.parse(it.posted_at))
          ? new Date(it.posted_at).toISOString()
          : new Date().toISOString();
      const parsed = parseMessage(raw);
      const id = messageId("manual", raw);
      const res = await insertMessage({
        id,
        source: "manual",
        externalId: id,
        postedAt,
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
        parsedOk:
          parsed.kind !== "otro" ||
          parsed.afectados.length > 0 ||
          parsed.restablecidos.length > 0 ||
          parsed.averiaCircuitos.length > 0
            ? 1
            : 0,
      });
      if (res === "inserted") inserted++;
      else skipped++;
    }
    const all = await listMessagesAsc();
    await rebuildStates(reconstructStates(all));
    await refreshCircuits(all);
    return NextResponse.json({ ok: true, inserted, skipped, total: all.length });
  } catch (e) {
    const blocked = isBlockedError(e);
    return NextResponse.json(
      { ok: false, error: blocked ? "almacenamiento_bloqueado" : "pegar_failed" },
      { status: blocked ? 503 : 500 }
    );
  }
}
