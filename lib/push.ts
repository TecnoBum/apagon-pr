/**
 * Apagón PR — notificaciones Web Push (VAPID).
 * Claves en .env.local (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY),
 * nunca commiteadas. El service worker vive en public/sw.js.
 */
import webpush from "web-push";
import { getClient } from "./turso";
import type { PushSubscription, StoredMessage } from "./types";

let configured = false;

function setup(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const priv = process.env.VAPID_PRIVATE_KEY || "";
  // En el navegador (service worker) estas env no existen; setup solo se
  // usa en el servidor.
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "https://apagon-pr.vercel.app",
      pub,
      priv
    );
    configured = true;
  }
  return true;
}

export function pushConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

export async function listSubscriptions(): Promise<PushSubscription[]> {
  const db = getClient();
  const r = await db.execute("SELECT * FROM apagonpr_push_subs ORDER BY created_at ASC");
  return r.rows.map((row) => ({
    id: Number(row.id),
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
    circuits: (() => {
      try {
        const p = JSON.parse(String(row.circuits));
        return Array.isArray(p) ? p.map(String) : [];
      } catch {
        return [];
      }
    })(),
    createdAt: Number(row.created_at),
  }));
}

export async function saveSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  circuits: string[];
}): Promise<void> {
  const db = getClient();
  await db.execute({
    sql: `INSERT INTO apagonpr_push_subs (endpoint, p256dh, auth, circuits, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            circuits = excluded.circuits`,
    args: [sub.endpoint, sub.keys.p256dh, sub.keys.auth, JSON.stringify(sub.circuits), Date.now()],
  });
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  const db = getClient();
  await db.execute({
    sql: "DELETE FROM apagonpr_push_subs WHERE endpoint = ?",
    args: [endpoint],
  });
}

export type PushEvent =
  | { type: "afectado"; circuit: string; notaNum: number | null; deficitMw: number | null }
  | { type: "restablecido"; circuit: string; notaNum: number | null; inferred: boolean }
  | { type: "nota"; notaNum: number | null; deficitMw: number | null; afectados: number };

function payloadFor(ev: PushEvent): { title: string; body: string; url: string } {
  if (ev.type === "afectado") {
    return {
      title: `Sin corriente: circuito ${ev.circuit}`,
      body:
        `El circuito ${ev.circuit} quedó sin electricidad` +
        (ev.notaNum ? ` (NOTA ${ev.notaNum})` : "") +
        (ev.deficitMw ? ` · Déficit provincial: ${ev.deficitMw} MW.` : "."),
      url: `/circuito/${encodeURIComponent(ev.circuit)}`,
    };
  }
  if (ev.type === "restablecido") {
    return {
      title: `Corriente restablecida: circuito ${ev.circuit}`,
      body:
        `El circuito ${ev.circuit} volvió a tener electricidad` +
        (ev.inferred ? " (ya no aparece en los afectados)." : "."),
      url: `/circuito/${encodeURIComponent(ev.circuit)}`,
    };
  }
  return {
    title: `Nuevo parte eléctrico${ev.notaNum ? ` — NOTA ${ev.notaNum}` : ""}`,
    body:
      `Déficit provincial: ${ev.deficitMw ?? "?"} MW · ${ev.afectados} circuitos afectados.`,
    url: "/partes",
  };
}

/** Envía un evento a todas las suscripciones interesadas en ese circuito. */
export async function sendPushEvent(ev: PushEvent): Promise<{
  sent: number;
  failed: number;
  removed: number;
}> {
  if (!setup()) return { sent: 0, failed: 0, removed: 0 };
  const subs = await listSubscriptions();
  let sent = 0;
  let failed = 0;
  let removed = 0;
  const payload = payloadFor(ev);
  for (const s of subs) {
    const wantsAll = s.circuits.length === 0;
    const circuit = ev.type === "nota" ? null : ev.circuit;
    if (!wantsAll && circuit && !s.circuits.includes(circuit)) continue;
    if (ev.type === "nota" && !wantsAll) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      failed++;
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        // Suscripción muerta: se borra para no reintentarla siempre.
        try {
          await deleteSubscription(s.endpoint);
          removed++;
        } catch {
          /* best-effort */
        }
      }
    }
  }
  return { sent, failed, removed };
}

/**
 * A partir del último mensaje ya notificado, detecta qué cambió y notifica.
 * Se guarda el id del último mensaje procesado en apagonpr_meta
 * ("last_notified_msg_id"). Devuelve un resumen (sin exponer endpoints).
 */
export async function checkAndNotify(
  messagesAsc: StoredMessage[]
): Promise<{
  checked: number;
  events: number;
  sent: number;
  failed: number;
  removed: number;
  lastNotified: string | null;
}> {
  const { getMeta, setMeta } = await import("./turso");
  const lastNotified = await getMeta("last_notified_msg_id");
  const lastTime = lastNotified ? await lastTimeOf(lastNotified) : null;
  const fresh = lastTime
    ? messagesAsc.filter((m) => m.postedAt > lastTime)
    : messagesAsc;
  // Si es la primera vez, no bombardear con todo el histórico: solo el
  // último mensaje marca el punto de partida, sin notificar.
  if (!lastNotified && messagesAsc.length) {
    await setMeta("last_notified_msg_id", messagesAsc[messagesAsc.length - 1].id);
    return { checked: messagesAsc.length, events: 0, sent: 0, failed: 0, removed: 0, lastNotified: messagesAsc[messagesAsc.length - 1].id };
  }
  let events = 0;
  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const m of fresh) {
    if (m.kind === "nota") {
      for (const c of m.afectados) {
        const r = await sendPushEvent({ type: "afectado", circuit: c, notaNum: m.notaNum, deficitMw: m.deficitMw });
        events++;
        sent += r.sent;
        failed += r.failed;
        removed += r.removed;
      }
      for (const c of m.restablecidos) {
        const r = await sendPushEvent({ type: "restablecido", circuit: c, notaNum: m.notaNum, inferred: false });
        events++;
        sent += r.sent;
        failed += r.failed;
        removed += r.removed;
      }
      const r = await sendPushEvent({ type: "nota", notaNum: m.notaNum, deficitMw: m.deficitMw, afectados: m.afectados.length });
      events++;
      sent += r.sent;
      failed += r.failed;
      removed += r.removed;
    } else if (m.kind === "averia") {
      for (const c of m.averiaCircuitos) {
        const r = await sendPushEvent(
          m.averiaRestablecido
            ? { type: "restablecido", circuit: c, notaNum: null, inferred: false }
            : { type: "afectado", circuit: c, notaNum: null, deficitMw: null }
        );
        events++;
        sent += r.sent;
        failed += r.failed;
        removed += r.removed;
      }
    }
  }
  if (fresh.length) {
    await setMeta("last_notified_msg_id", fresh[fresh.length - 1].id);
  }
  return {
    checked: fresh.length,
    events,
    sent,
    failed,
    removed,
    lastNotified: fresh.length ? fresh[fresh.length - 1].id : lastNotified,
  };
}

async function lastTimeOf(msgId: string): Promise<string> {
  const db = getClient();
  const r = await db.execute({
    sql: "SELECT posted_at FROM apagonpr_messages WHERE id = ?",
    args: [msgId],
  });
  return r.rows.length ? String(r.rows[0].posted_at) : "1970-01-01T00:00:00.000Z";
}
