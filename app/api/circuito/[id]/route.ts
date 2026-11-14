import { NextResponse } from "next/server";
import { ensureSchema, listMessagesAsc, isBlockedError } from "@/lib/turso";
import { getCircuitStates, getCircuitSummary } from "@/lib/history";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const code = decodeURIComponent(params.id).toUpperCase().replace(/\s+/g, "");
  try {
    await ensureSchema();
    const messages = await listMessagesAsc();
    const summary = await getCircuitSummary(code, messages);
    if (!summary) {
      return NextResponse.json(
        { ok: false, error: "circuito_no_encontrado" },
        { status: 404 }
      );
    }
    const states = await getCircuitStates(code);
    const mentions = messages
      .filter(
        (m) =>
          m.afectados.includes(code) ||
          m.restablecidos.includes(code) ||
          m.averiaCircuitos.includes(code)
      )
      .map((m) => ({
        id: m.id,
        postedAt: m.postedAt,
        kind: m.kind,
        notaNum: m.notaNum,
        deficitMw: m.deficitMw,
      }));
    return NextResponse.json({ ok: true, summary, states, mentions });
  } catch (e) {
    const blocked = isBlockedError(e);
    return NextResponse.json(
      { ok: false, error: blocked ? "almacenamiento_bloqueado" : "read_failed" },
      { status: blocked ? 503 : 500 }
    );
  }
}
