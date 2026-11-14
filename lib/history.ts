/**
 * Apagón PR — reconstrucción del histórico de horas CON/SIN corriente.
 *
 * LA EMPRESA NO PUBLICA HORAS POR CIRCUITO. El estado se reconstruye de
 * nota en nota (PLAN.md):
 * - Un circuito está SIN corriente desde la primera NOTA que lo lista en
 *   "Circuitos Afectados" (o desde que aparece en una avería) hasta:
 *   a) la NOTA que lo lista en "Circuito Restablecido" (restauración
 *      explícita), o
 *   b) la NOTA que deja de incluirlo en afectados (restauración INFERIDA,
 *      marcada con inferred=1).
 * - La precisión depende de la frecuencia de lectura (NOTAs cada 10-67 min
 *   en crisis). El histórico empieza con el primer dato disponible.
 * - Las horas se cuentan hasta el CORTE DE DATOS: si el último mensaje es
 *   reciente (<48 h), el corte es "ahora"; si es viejo (semilla demo 2024),
 *   el corte es la hora del último mensaje, para no inventar meses de
 *   apagón. La UI muestra siempre "Datos hasta: <último parte>".
 */
import { getClient } from "./turso";
import type { CircuitState, CircuitSummary, StoredMessage } from "./types";

export const DATA_FRESH_MS = 48 * 60 * 60 * 1000;

/** Mensajes que informan del estado de los circuitos (los demás no). */
const STATE_KINDS = new Set(["nota", "averia", "restaurado_total"]);

export function dataCutoff(messages: StoredMessage[]): {
  cutoff: Date;
  lastAt: Date | null;
  isLive: boolean;
} {
  if (!messages.length) return { cutoff: new Date(), lastAt: null, isLive: false };
  // El corte lo marca el último mensaje que INFORMA del estado de los
  // circuitos (NOTA/avería/restablecido). Un anuncio sin contenido
  // eléctrico (migración de canal, convocatoria...) no alarga el corte:
  // sin esto, la semilla de oct 2024 parecería llegar hasta mar 2025.
  const bearing = messages.filter((m) => STATE_KINDS.has(m.kind));
  const pool = bearing.length ? bearing : messages;
  const last = pool
    .map((m) => new Date(m.postedAt).getTime())
    .reduce((a, b) => Math.max(a, b), 0);
  const lastAt = new Date(last);
  const isLive = Date.now() - last < DATA_FRESH_MS;
  return { cutoff: isLive ? new Date() : lastAt, lastAt, isLive };
}

/** Reconstruye TODOS los periodos CON/SIN a partir de los mensajes ordenados (asc). */
export function reconstructStates(messages: StoredMessage[]): CircuitState[] {
  const states: CircuitState[] = [];
  // circuit -> periodo abierto
  const open = new Map<string, CircuitState>();

  function closePeriod(circuit: string, until: string) {
    const p = open.get(circuit);
    if (!p) return;
    p.until = until;
    states.push(p);
    open.delete(circuit);
  }

  function openPeriod(
    circuit: string,
    status: "sin" | "con",
    since: string,
    inferred: number,
    sourceMsgId: string
  ) {
    open.set(circuit, {
      circuit,
      since,
      until: null,
      status,
      inferred,
      sourceMsgId,
    });
  }

  function setStatus(
    circuit: string,
    status: "sin" | "con",
    at: string,
    inferred: number,
    sourceMsgId: string
  ) {
    const cur = open.get(circuit);
    if (cur && cur.status === status) return; // sin cambio
    if (cur) closePeriod(circuit, at);
    openPeriod(circuit, status, at, inferred, sourceMsgId);
  }

  for (const m of messages) {
    const at = m.postedAt;
    if (m.kind === "nota") {
      // Afectados -> SIN (si no lo estaba).
      for (const code of m.afectados) setStatus(code, "sin", at, 0, m.id);
      // Restablecidos explícitos -> CON.
      for (const code of m.restablecidos) setStatus(code, "con", at, 0, m.id);
      // Los que estaban SIN y ya no aparecen en afectados -> CON inferido.
      // SOLO si la NOTA trae lista de afectados: una NOTA sin lista
      // (solo déficit/bloque) no dice nada de los circuitos y no cambia nada.
      if (m.hasAfetadosSection) {
        for (const [code, p] of [...open.entries()]) {
          if (
            p.status === "sin" &&
            !m.afectados.includes(code) &&
            !m.restablecidos.includes(code)
          ) {
            setStatus(code, "con", at, 1, m.id);
          }
        }
      }
    } else if (m.kind === "restaurado_total") {
      // "La provincia no presenta afectación por déficit": todo lo que
      // estaba SIN vuelve a CON (restablecimiento explícito, no inferido).
      for (const [code, p] of [...open.entries()]) {
        if (p.status === "sin") setStatus(code, "con", at, 0, m.id);
      }
    } else if (m.kind === "averia") {
      if (m.averiaRestablecido) {
        for (const code of m.averiaCircuitos) setStatus(code, "con", at, 0, m.id);
      } else {
        for (const code of m.averiaCircuitos) setStatus(code, "sin", at, 0, m.id);
      }
    }
    // prevision / aviso / otro: no cambian el estado.
  }

  // Periodos que siguen abiertos.
  for (const p of open.values()) states.push(p);
  states.sort((a, b) => a.since.localeCompare(b.since));
  return states;
}

/** Guarda en Turso los periodos reconstruidos (reconstrucción completa). */
export async function rebuildStates(states: CircuitState[]): Promise<void> {
  const db = getClient();
  await db.execute("DELETE FROM apagonpr_states");
  for (const s of states) {
    await db.execute({
      sql: "INSERT INTO apagonpr_states (circuit, since, until, status, inferred, source_msg_id) VALUES (?, ?, ?, ?, ?, ?)",
      args: [s.circuit, s.since, s.until, s.status, s.inferred, s.sourceMsgId],
    });
  }
}

/** Actualiza el catálogo de circuitos (primer/último visto, zona). */
export async function refreshCircuits(messages: StoredMessage[]): Promise<void> {
  const db = getClient();
  const byCode = new Map<string, { zona: string | null; first: string; last: string }>();
  const touch = (code: string, at: string, zona: string | null) => {
    const cur = byCode.get(code);
    if (!cur) {
      byCode.set(code, { zona, first: at, last: at });
    } else {
      if (at < cur.first) cur.first = at;
      if (at > cur.last) cur.last = at;
      if (!cur.zona && zona) cur.zona = zona;
    }
  };
  for (const m of messages) {
    for (const c of m.afectados) touch(c, m.postedAt, m.zonas[c] || null);
    for (const c of m.restablecidos) touch(c, m.postedAt, m.zonas[c] || null);
    for (const c of m.averiaCircuitos) touch(c, m.postedAt, m.zonas[c] || null);
  }
  for (const [code, v] of byCode) {
    await db.execute({
      sql: `INSERT INTO apagonpr_circuits (code, zona, first_seen, last_seen)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
              zona = COALESCE(apagonpr_circuits.zona, excluded.zona),
              first_seen = MIN(apagonpr_circuits.first_seen, excluded.first_seen),
              last_seen = MAX(apagonpr_circuits.last_seen, excluded.last_seen)`,
      args: [code, v.zona, v.first, v.last],
    });
  }
}

/** Periodos guardados de un circuito (orden cronológico). */
export async function getCircuitStates(code: string): Promise<CircuitState[]> {
  const db = getClient();
  const r = await db.execute({
    sql: "SELECT * FROM apagonpr_states WHERE circuit = ? ORDER BY since ASC",
    args: [code],
  });
  return r.rows.map((row) => ({
    id: Number(row.id),
    circuit: String(row.circuit),
    since: String(row.since),
    until: row.until === null ? null : String(row.until),
    status: row.status as "sin" | "con",
    inferred: Number(row.inferred || 0),
    sourceMsgId: row.source_msg_id === null ? null : String(row.source_msg_id),
  }));
}

/** Resumen de un circuito: estado actual + horas CON/SIN hasta el corte. */
export async function getCircuitSummary(
  code: string,
  messages: StoredMessage[]
): Promise<CircuitSummary | null> {
  const db = getClient();
  const meta = await db.execute({
    sql: "SELECT * FROM apagonpr_circuits WHERE code = ?",
    args: [code],
  });
  const states = await getCircuitStates(code);
  if (!meta.rows.length && !states.length) return null;

  const { cutoff } = dataCutoff(messages);
  const cutoffMs = cutoff.getTime();
  let hoursSin = 0;
  let hoursCon = 0;
  for (const s of states) {
    const start = new Date(s.since).getTime();
    const end = s.until ? new Date(s.until).getTime() : cutoffMs;
    const h = Math.max(0, (end - start) / 3600000);
    if (s.status === "sin") hoursSin += h;
    else hoursCon += h;
  }
  const open = states.find((s) => s.until === null) || null;
  const mentions = messages.filter(
    (m) =>
      m.afectados.includes(code) ||
      m.restablecidos.includes(code) ||
      m.averiaCircuitos.includes(code)
  ).length;
  const lastMsgAt =
    messages
      .filter(
        (m) =>
          m.afectados.includes(code) ||
          m.restablecidos.includes(code) ||
          m.averiaCircuitos.includes(code)
      )
      .map((m) => m.postedAt)
      .sort()
      .pop() || null;

  return {
    code,
    zona: meta.rows.length ? (meta.rows[0].zona as string | null) : null,
    firstSeen: meta.rows.length ? String(meta.rows[0].first_seen) : states[0]?.since || null,
    lastSeen: meta.rows.length ? String(meta.rows[0].last_seen) : null,
    status: open ? open.status : states.length ? "con" : "desconocido",
    since: open ? open.since : null,
    inferred: open ? open.inferred : 0,
    hoursSin,
    hoursCon,
    lastMsgAt,
    mentions,
  };
}

/** Resúmenes de todos los circuitos, con su estado actual. */
export async function getAllCircuitSummaries(
  messages: StoredMessage[]
): Promise<CircuitSummary[]> {
  const db = getClient();
  const r = await db.execute(
    "SELECT code FROM apagonpr_circuits ORDER BY code ASC"
  );
  const out: CircuitSummary[] = [];
  for (const row of r.rows) {
    const s = await getCircuitSummary(String(row.code), messages);
    if (s) out.push(s);
  }
  return out;
}

/** Formatea horas acumuladas en forma legible. Ver lib/format.ts. */
