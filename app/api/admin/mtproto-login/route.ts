import { NextResponse } from "next/server";
import {
  ensureSchema,
  getMeta,
  setMeta,
  isBlockedError,
} from "@/lib/turso";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/mtproto-login { secret, action: "start"|"confirm"|"status", phone?, code? }
 * Crea la sesión MTProto del lector EN Vercel, porque la VM de desarrollo
 * no puede completar el handshake MTProto (la conexión se corta al escribir
 * los primeros bytes; dos intentos fallidos el 14 nov 2026).
 * - start: pide el código de Telegram para el número dado y guarda el
 *   phoneCodeHash en apagonpr_meta. No devuelve nada sensible.
 * - confirm: completa el inicio con el código y guarda la sesión
 *   (StringSession) en apagonpr_meta (clave mtproto_session). La sesión
 *   NUNCA se devuelve en la respuesta.
 * - status: indica si hay api configurada y sesión guardada (sin valores).
 * El secreto es ADMIN_SECRET (igual que /api/admin/pegar). El lector
 * (lib/mtproto.ts) usa la sesión de meta si no hay
 * TELEGRAM_SESSION_STRING en el entorno.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const secret = process.env.ADMIN_SECRET || "";
    if (!secret || body?.secret !== secret) {
      return NextResponse.json({ ok: false, error: "no_autorizado" }, { status: 401 });
    }
    const apiId = Number(process.env.TELEGRAM_API_ID || 0);
    const apiHash = (process.env.TELEGRAM_API_HASH || "").trim();
    if (!apiId || !apiHash) {
      return NextResponse.json({ ok: false, error: "no_api_configured" }, { status: 400 });
    }
    await ensureSchema();
    const action = String(body?.action || "");

    if (action === "status") {
      const envSession = (process.env.TELEGRAM_SESSION_STRING || "").trim();
      const metaSession = (await getMeta("mtproto_session")) || "";
      const phoneStored = (await getMeta("mtproto_phone")) || "";
      const codeAt = (await getMeta("mtproto_code_at")) || "";
      const hash = (await getMeta("mtproto_code_hash")) || "";
      const dcStored = (await getMeta("mtproto_dc")) || "";
      return NextResponse.json({
        ok: true,
        api: true,
        session: Boolean(envSession || metaSession),
        phone_last4: phoneStored ? phoneStored.slice(-4) : "",
        code_at: codeAt,
        hash_len: hash.length,
        dc: dcStored,
      });
    }

    const { TelegramClient } = await import("teleproto");
    const { StringSession } = await import("teleproto/sessions");

    if (action === "start") {
      const phone = String(body?.phone || "").trim();
      if (!/^\+\d{8,15}$/.test(phone)) {
        return NextResponse.json({ ok: false, error: "telefono_invalido" }, { status: 400 });
      }
      const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
        connectionRetries: 2,
      });
      try {
        await client.connect();
        const sent = await client.sendCode({ apiId, apiHash }, phone);
        await setMeta("mtproto_phone", phone);
        await setMeta("mtproto_code_hash", String(sent.phoneCodeHash || ""));
        await setMeta("mtproto_code_at", new Date().toISOString());
        // El código queda registrado en el DC al que se conectó este cliente;
        // el confirm debe usar el MISMO DC o Telegram dice "expired".
        await setMeta("mtproto_dc", String(client.session.dcId || 0));
        return NextResponse.json({ ok: true, step: "code_waiting" });
      } finally {
        try {
          await client.disconnect();
        } catch {}
      }
    }

    if (action === "confirm") {
      const code = String(body?.code || "").trim();
      if (!/^\d{4,8}$/.test(code)) {
        return NextResponse.json({ ok: false, error: "codigo_invalido" }, { status: 400 });
      }
      const phone = (await getMeta("mtproto_phone")) || "";
      const phoneCodeHash = (await getMeta("mtproto_code_hash")) || "";
      if (!phone || !phoneCodeHash) {
        return NextResponse.json({ ok: false, error: "sin_codigo_pendiente" }, { status: 400 });
      }
      const { Api } = await import("teleproto");
      const session = new StringSession("");
      const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 2,
      });
      // Anclar el confirm al mismo DC que usó el start (guardado en meta);
      // sin esto, cada cliente puede caer en un DC distinto y el hash del
      // código no existe ahí (Telegram responde "phone code expired").
      const storedDc = Number((await getMeta("mtproto_dc")) || 0);
      if (storedDc > 0) {
        session.setDC(storedDc, "", 443);
      }
      try {
        await client.connect();
        await client.invoke(
          new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code })
        );
        const session = client.session.save();
        await setMeta("mtproto_session", session);
        await setMeta("mtproto_code_hash", "");
        return NextResponse.json({ ok: true, step: "done" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (/SESSION_PASSWORD_NEEDED/i.test(msg)) {
          return NextResponse.json({ ok: true, step: "password_needed" });
        }
        throw e;
      } finally {
        try {
          await client.disconnect();
        } catch {}
      }
    }

    return NextResponse.json({ ok: false, error: "accion_invalida" }, { status: 400 });
  } catch (e) {
    const blocked = isBlockedError(e);
    return NextResponse.json(
      {
        ok: false,
        error: blocked
          ? "almacenamiento_bloqueado"
          : e instanceof Error
            ? e.message.slice(0, 200)
            : "mtproto_login_failed",
      },
      { status: blocked ? 503 : 500 }
    );
  }
}
