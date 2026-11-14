import { NextResponse } from "next/server";
import { ensureSchema, listMessagesAsc, isBlockedError } from "@/lib/turso";
import { getAllCircuitSummaries } from "@/lib/history";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toUpperCase().replace(/\s+/g, "");
  try {
    await ensureSchema();
    const messages = await listMessagesAsc();
    let summaries = await getAllCircuitSummaries(messages);
    if (q) {
      summaries = summaries.filter(
        (s) =>
          s.code.toUpperCase().includes(q) ||
          (s.zona || "").toUpperCase().includes(q)
      );
    }
    return NextResponse.json({ ok: true, total: summaries.length, circuitos: summaries });
  } catch (e) {
    const blocked = isBlockedError(e);
    return NextResponse.json(
      { ok: false, error: blocked ? "almacenamiento_bloqueado" : "read_failed" },
      { status: blocked ? 503 : 500 }
    );
  }
}
