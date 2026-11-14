import { NextResponse } from "next/server";
import { ensureSchema, isBlockedError } from "@/lib/turso";
import { saveSubscription, deleteSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

/** POST /api/push/subscribe { subscription: {endpoint, keys:{p256dh,auth}}, circuits: [..] } */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sub = body?.subscription;
    const circuits = Array.isArray(body?.circuits)
      ? body.circuits.map(String).map((c: string) => c.toUpperCase().replace(/\s+/g, ""))
      : [];
    if (
      !sub ||
      typeof sub.endpoint !== "string" ||
      !sub.keys ||
      typeof sub.keys.p256dh !== "string" ||
      typeof sub.keys.auth !== "string"
    ) {
      return NextResponse.json(
        { ok: false, error: "suscripcion_invalida" },
        { status: 400 }
      );
    }
    await ensureSchema();
    await saveSubscription({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      circuits,
    });
    return NextResponse.json({ ok: true, circuits });
  } catch (e) {
    const blocked = isBlockedError(e);
    return NextResponse.json(
      { ok: false, error: blocked ? "almacenamiento_bloqueado" : "subscribe_failed" },
      { status: blocked ? 503 : 500 }
    );
  }
}

/** DELETE /api/push/subscribe { endpoint } — borra una suscripción. */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const endpoint = body?.endpoint;
    if (typeof endpoint !== "string") {
      return NextResponse.json({ ok: false, error: "endpoint_invalido" }, { status: 400 });
    }
    await ensureSchema();
    await deleteSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const blocked = isBlockedError(e);
    return NextResponse.json(
      { ok: false, error: blocked ? "almacenamiento_bloqueado" : "delete_failed" },
      { status: blocked ? 503 : 500 }
    );
  }
}
