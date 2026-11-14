/**
 * Apagón PR — capa de datos en Turso (base compartida con Klick/CubaOnline).
 * Credenciales SOLO por variables de entorno (TURSO_DATABASE_URL,
 * TURSO_AUTH_TOKEN). Nunca se imprimen ni se guardan en archivos.
 *
 * Tablas apagonpr_*:
 * - apagonpr_messages: mensajes crudos + parseo (siempre se guarda el texto).
 * - apagonpr_circuits: catálogo de circuitos (código, zona, primer/último visto).
 * - apagonpr_states: periodos CON/SIN por circuito, reconstruidos de nota en
 *   nota (ver lib/history.ts). Se reconstruyen completos en cada sync.
 * - apagonpr_push_subs: suscripciones Web Push por circuito.
 * - apagonpr_meta: metadatos (último sync, último mensaje notificado...).
 */
import { createClient, type Client } from "@libsql/client";
import type { StoredMessage } from "./types";

let client: Client | null = null;

export function getClient(): Client {
  if (client) return client;
  // Recortar: un espacio o salto de línea al copiar el valor desde el panel
  // de Vercel rompe la autenticación con Turso (HTTP 400).
  const url = (process.env.TURSO_DATABASE_URL || "").trim();
  const authToken = (process.env.TURSO_AUTH_TOKEN || "").trim();
  // Las bases locales file: no necesitan token; las remotas (libsql://) sí.
  if (!url || (!authToken && !url.startsWith("file:"))) {
    throw new Error("backend no configurado");
  }
  client = createClient({ url, authToken: authToken || undefined });
  return client;
}

export function isBlockedError(e: unknown): boolean {
  const txt =
    String((e as { message?: string })?.message || "") +
    " " +
    String((e as { code?: string })?.code || "");
  return /blocked/i.test(txt);
}

export async function ensureSchema(): Promise<void> {
  const db = getClient();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS apagonpr_messages (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      external_id TEXT NOT NULL,
      posted_at TEXT NOT NULL,
      posted_at_inferred INTEGER NOT NULL DEFAULT 0,
      demo INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL,
      nota_num INTEGER,
      deficit_mw INTEGER,
      bloques TEXT,
      has_afectados_section INTEGER NOT NULL DEFAULT 0,
      raw_text TEXT NOT NULL,
      afectados TEXT NOT NULL DEFAULT '[]',
      restablecidos TEXT NOT NULL DEFAULT '[]',
      averia_circuitos TEXT NOT NULL DEFAULT '[]',
      averia_restablecido INTEGER NOT NULL DEFAULT 0,
      zonas TEXT NOT NULL DEFAULT '{}',
      municipio TEXT,
      parsed_ok INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS apagonpr_messages_posted ON apagonpr_messages(posted_at);
    CREATE INDEX IF NOT EXISTS apagonpr_messages_kind ON apagonpr_messages(kind);
    CREATE TABLE IF NOT EXISTS apagonpr_circuits (
      code TEXT PRIMARY KEY,
      zona TEXT,
      first_seen TEXT,
      last_seen TEXT
    );
    CREATE TABLE IF NOT EXISTS apagonpr_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circuit TEXT NOT NULL,
      since TEXT NOT NULL,
      until TEXT,
      status TEXT NOT NULL,
      inferred INTEGER NOT NULL DEFAULT 0,
      source_msg_id TEXT
    );
    CREATE INDEX IF NOT EXISTS apagonpr_states_circuit ON apagonpr_states(circuit, since);
    CREATE TABLE IF NOT EXISTS apagonpr_push_subs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      circuits TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS apagonpr_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonMap(v: unknown): Record<string, string> {
  if (v && typeof v === "object") return v as Record<string, string>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return p && typeof p === "object" ? p : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function rowToMessage(row: Record<string, unknown>): StoredMessage {
  return {
    id: String(row.id),
    source: row.source as StoredMessage["source"],
    externalId: String(row.external_id),
    postedAt: String(row.posted_at),
    postedAtInferred: Number(row.posted_at_inferred || 0),
    demo: Number(row.demo || 0),
    kind: row.kind as StoredMessage["kind"],
    notaNum: row.nota_num === null || row.nota_num === undefined ? null : Number(row.nota_num),
    deficitMw:
      row.deficit_mw === null || row.deficit_mw === undefined
        ? null
        : Number(row.deficit_mw),
    bloques: row.bloques === null ? null : String(row.bloques),
    hasAfetadosSection: Number(row.has_afectados_section || 0) === 1,
    rawText: String(row.raw_text),
    afectados: parseJsonArray(row.afectados),
    restablecidos: parseJsonArray(row.restablecidos),
    averiaCircuitos: parseJsonArray(row.averia_circuitos),
    averiaRestablecido: Number(row.averia_restablecido || 0),
    zonas: parseJsonMap(row.zonas),
    municipio: row.municipio === null ? null : String(row.municipio),
    parsedOk: Number(row.parsed_ok ?? 1),
  };
}

export async function getMeta(key: string): Promise<string | null> {
  const db = getClient();
  const r = await db.execute({
    sql: "SELECT value FROM apagonpr_meta WHERE key = ?",
    args: [key],
  });
  return r.rows.length ? String(r.rows[0].value) : null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = getClient();
  await db.execute({
    sql: "INSERT INTO apagonpr_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });
}

export async function insertMessage(
  msg: StoredMessage
): Promise<"inserted" | "exists"> {
  const db = getClient();
  const existing = await db.execute({
    sql: "SELECT id FROM apagonpr_messages WHERE id = ?",
    args: [msg.id],
  });
  if (existing.rows.length) return "exists";
  await db.execute({
    sql: `INSERT INTO apagonpr_messages
      (id, source, external_id, posted_at, posted_at_inferred, demo, kind,
       nota_num, deficit_mw, bloques, has_afectados_section, raw_text, afectados, restablecidos,
       averia_circuitos, averia_restablecido, zonas, municipio, parsed_ok, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      msg.id,
      msg.source,
      msg.externalId,
      msg.postedAt,
      msg.postedAtInferred,
      msg.demo,
      msg.kind,
      msg.notaNum,
      msg.deficitMw,
      msg.bloques,
      msg.hasAfetadosSection ? 1 : 0,
      msg.rawText,
      JSON.stringify(msg.afectados),
      JSON.stringify(msg.restablecidos),
      JSON.stringify(msg.averiaCircuitos),
      msg.averiaRestablecido,
      JSON.stringify(msg.zonas),
      msg.municipio,
      msg.parsedOk,
      Date.now(),
    ],
  });
  return "inserted";
}

export async function listMessages(limit = 100): Promise<StoredMessage[]> {
  const db = getClient();
  const r = await db.execute({
    sql: "SELECT * FROM apagonpr_messages ORDER BY posted_at DESC LIMIT ?",
    args: [limit],
  });
  return r.rows.map((row) => rowToMessage(row as unknown as Record<string, unknown>));
}

export async function listMessagesAsc(limit = 5000): Promise<StoredMessage[]> {
  const db = getClient();
  const r = await db.execute({
    sql: "SELECT * FROM apagonpr_messages ORDER BY posted_at ASC LIMIT ?",
    args: [limit],
  });
  return r.rows.map((row) => rowToMessage(row as unknown as Record<string, unknown>));
}

export async function latestMessage(): Promise<StoredMessage | null> {
  const list = await listMessages(1);
  return list[0] || null;
}

export async function countMessages(): Promise<number> {
  const db = getClient();
  const r = await db.execute("SELECT COUNT(*) AS n FROM apagonpr_messages");
  return Number(r.rows[0]?.n || 0);
}
