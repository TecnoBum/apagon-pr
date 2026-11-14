import { NextResponse } from "next/server";
import {
  ensureSchema,
  insertMessage,
  listMessagesAsc,
  setMeta,
  isBlockedError,
} from "@/lib/turso";
import { fetchElecpinar } from "@/lib/elecpinar";
import { readTelegramChannel } from "@/lib/mtproto";
import { reconstructStates, rebuildStates, refreshCircuits } from "@/lib/history";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync?source=elecpinar|mtproto|all
 * Lee las fuentes, guarda los mensajes nuevos (deduplicados por id),
 * reconstruye los periodos CON/SIN de cada circuito y actualiza el catálogo.
 * - elecpinar: canal viejo por t.me/s (semilla demo, oct 2024).
 * - mtproto: canal vivo; sin sesión configurada reporta no_session_configured
 *   y NO inventa datos.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "all";
  try {
    await ensureSchema();
    const result: Record<string, unknown> = {
      ok: true,
      sources: {},
      inserted: 0,
      total: 0,
      states: 0,
    };
    const toStore: Parameters<typeof insertMessage>[0][] = [];

    if (source === "all" || source === "elecpinar") {
      const r = await fetchElecpinar();
      (result.sources as Record<string, unknown>).elecpinar = {
        ok: r.ok,
        fetched: r.fetched,
        reason: r.reason,
      };
      if (r.ok) toStore.push(...r.messages);
    }
    if (source === "all" || source === "mtproto") {
      const r = await readTelegramChannel();
      (result.sources as Record<string, unknown>).mtproto = {
        ok: r.ok,
        reason: r.reason,
        detail: r.detail,
      };
    }

    let inserted = 0;
    for (const m of toStore) {
      if ((await insertMessage(m)) === "inserted") inserted++;
    }

    const all = await listMessagesAsc();
    const states = reconstructStates(all);
    await rebuildStates(states);
    await refreshCircuits(all);
    await setMeta("last_sync", new Date().toISOString());

    result.inserted = inserted;
    result.total = all.length;
    result.states = states.length;
    return NextResponse.json(result);
  } catch (e) {
    const blocked = isBlockedError(e);
    return NextResponse.json(
      {
        ok: false,
        error: blocked
          ? "almacenamiento_bloqueado"
          : e instanceof Error
            ? e.message
            : "sync_failed",
      },
      { status: blocked ? 503 : 500 }
    );
  }
}
