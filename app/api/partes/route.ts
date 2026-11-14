import { NextResponse } from "next/server";
import { ensureSchema, listMessages, isBlockedError } from "@/lib/turso";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
  try {
    await ensureSchema();
    const messages = await listMessages(limit);
    return NextResponse.json({ ok: true, total: messages.length, messages });
  } catch (e) {
    const blocked = isBlockedError(e);
    return NextResponse.json(
      {
        ok: false,
        error: blocked
          ? "almacenamiento_bloqueado"
          : e instanceof Error
            ? e.message
            : "read_failed",
      },
      { status: blocked ? 503 : 500 }
    );
  }
}
