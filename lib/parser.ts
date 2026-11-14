/**
 * Apagón PR — parser de los partes de la Empresa Eléctrica de Pinar del Río.
 *
 * Formato real (canal @EmpresaElectricaPROficial, ejemplos íntegros del
 * 10 oct 2024, espejo telegramian). Reglas:
 * - Un circuito es letra(s) + número: "P 916", "PD 1082", "S 606".
 *   Normalizar: quitar espacios, mayúsculas -> "P916", "PD1082", "S606".
 * - "Bloque Afectado: 1 y 2" es OTRA cosa (bloques de rotación), no el circuito.
 * - La empresa NO publica hora de inicio/fin por circuito. Las horas se
 *   reconstruyen de nota en nota (ver lib/history.ts).
 * - Si el parseo falla, se guarda el texto crudo con kind="otro" y parsedOk=0.
 *   NUNCA se inventa un dato.
 */
import type { MessageKind, ParsedMessage } from "./types";
import { createHash } from "crypto";

/** Código de circuito normalizado, o null si no hay código en el texto. */
export function normalizeCircuitCode(raw: string): string | null {
  const m = raw
    .replace(/[⚜️⚜]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .match(/^([A-Za-z]{1,3})\s*(\d{2,5})/);
  if (!m) return null;
  return (m[1] + m[2]).toUpperCase();
}

/** Extrae códigos (letra+ número) de un fragmento de texto. */
function extractCodes(text: string): string[] {
  const out: string[] = [];
  const re = /([A-Za-z]{1,3})\s*(\d{2,5})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // El código no puede ser el final de una palabra más larga ("NOTA 12"
    // no es el circuito "OTA12"): el carácter previo no puede ser letra.
    const prev = m.index > 0 ? text[m.index - 1] : " ";
    if (/[A-Za-zÀ-ÿ]/.test(prev)) continue;
    // Evitar falsos positivos: "NOTA 18", "MW 600", horas "4:54", años.
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    if (/nota\s*$/i.test(before)) continue;
    if (/déficit[^:]{0,20}$/i.test(before)) continue;
    const code = (m[1] + m[2]).toUpperCase();
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * Extrae por línea: código + zona (texto que sigue al código en la misma línea).
 * P. ej. "⚜️P 526 Reparto Hermanos Cruz (Micro I, III, IV y V), EIDE Ormany Arenado."
 * -> { code: "P526", zona: "Reparto Hermanos Cruz (Micro I, III, IV y V), EIDE Ormany Arenado" }
 */
function extractCodesWithZona(section: string): {
  codes: string[];
  zonas: Record<string, string>;
} {
  const codes: string[] = [];
  const zonas: Record<string, string> = {};
  for (const rawLine of section.split(/\n/)) {
    const line = rawLine.replace(/[⚜️⚜]/g, " ").replace(/\s+/g, " ").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z]{1,3})\s*(\d{2,5})\b(.*)$/);
    if (!m) continue;
    const code = (m[1] + m[2]).toUpperCase();
    if (!codes.includes(code)) codes.push(code);
    // Si el resto es una lista separada por "/", la zona del primer
    // código es solo lo que hay antes de la primera barra (o nada).
    const restBeforeSlash = m[3].split("/")[0];
    const zona = restBeforeSlash
      .replace(/^[\s:,\-.]+/, "")
      .replace(/[\s.]+$/, "")
      .trim();
    if (zona && !zonas[code]) zonas[code] = zona;
    // La lista a veces viene en UNA sola línea separada por "/"
    // ("P 916 / PD 1082 / PD 100"): recoger también los códigos
    // que siguen al primero en la misma línea.
    for (const extra of extractCodes(m[3])) {
      if (!codes.includes(extra)) codes.push(extra);
    }
  }
  return { codes, zonas };
}

/** Devuelve el bloque de líneas que sigue a una cabecera hasta el próximo marcador. */
function sectionAfter(text: string, headerRe: RegExp): string | null {
  const m = text.match(headerRe);
  if (!m || m.index === undefined) return null;
  const rest = text.slice(m.index + m[0].length);
  // Cortar ante la próxima sección conocida o el pie del mensaje.
  const cut = rest.search(/\n\s*(📌|💡|⚠|🔰|❗|📍|Equipo de Atención)/);
  return cut >= 0 ? rest.slice(0, cut) : rest;
}

export function parseMessage(rawText: string): ParsedMessage {
  const text = rawText.replace(/\r/g, "").trim();
  const empty: ParsedMessage = {
    kind: "otro",
    notaNum: null,
    deficitMw: null,
    bloques: null,
    hasAfetadosSection: false,
    afectados: [],
    restablecidos: [],
    averiaCircuitos: [],
    averiaRestablecido: false,
    zonas: {},
    municipio: null,
  };

  const isNota = /Actualización del SEN|NOTA\s*\d+/i.test(text);
  // Avería SOLO si nombra un circuito ("Circuito: ..."). Un resumen que
  // mencione "las averías" en prosa (p. ej. la Nota informativa diaria)
  // NO es una avería: antes caía aquí y el fallback extraía códigos
  // basura del texto ("DE2024", "LAS24", "EL12"...).
  const isAveria = /Aver[ií]a/i.test(text) && /Circuito/i.test(text);
  const isPrevision =
    /Horario Diurno|Pico Nocturno|Afectación de Déficit por Capacidad/i.test(
      text
    );
  // "En estos momentos la provincia no presenta afectación por déficit..."
  // = restablecimiento TOTAL de todos los circuitos afectados.
  const isRestauradoTotal = /no presenta afectación por déficit/i.test(text);

  let kind: MessageKind = "otro";
  if (isNota) kind = "nota";
  else if (isRestauradoTotal) kind = "restaurado_total";
  else if (isAveria) kind = "averia";
  else if (isPrevision) kind = "prevision";
  else if (/Le informamos|Fuera del Plan|fuera de planificación/i.test(text))
    kind = "aviso";

  const out: ParsedMessage = { ...empty, kind };

  if (kind === "nota") {
    const nota = text.match(/NOTA\s*(\d+)/i);
    out.notaNum = nota ? parseInt(nota[1], 10) : null;
    const def = text.match(/Déficit(?:\s+de\s+Generación)?\s*:\s*(\d+)\s*MW/i);
    out.deficitMw = def ? parseInt(def[1], 10) : null;
    const blq = text.match(/Bloque Afectado\s*:\s*([^\n]+)/i);
    out.bloques = blq ? blq[1].replace(/\s+/g, " ").trim() : null;

    const af = sectionAfter(text, /Circuitos?\s+Afectados?\s*:/i);
    out.hasAfetadosSection = af !== null;
    if (af !== null) {
      const r = extractCodesWithZona(af);
      out.afectados = r.codes;
      Object.assign(out.zonas, r.zonas);
    }
    const rs = sectionAfter(text, /Circuitos?\s+Restablecidos?\s*:/i);
    if (rs !== null) {
      out.restablecidos = extractCodes(rs);
    }
  }

  if (kind === "averia") {
    // Líneas "Circuito: ⚜️P 526 ..." / "⚜ Circuito⚜️ P 266 Briones, ...".
    const circLine = text.match(/Circuito\s*:?\s*([^\n]+)/i);
    if (circLine) {
      const r = extractCodesWithZona(circLine[1]);
      out.averiaCircuitos = r.codes;
      Object.assign(out.zonas, r.zonas);
    }
    // Sin línea de circuito no se extrae nada: una avería sin circuito
    // identificado se muestra con su texto íntegro, sin inventar códigos.
    out.averiaRestablecido = /RESTABLECIDO/i.test(text);
    const mun = text.match(/Municipio\s*:\s*([^\n]+)/i);
    out.municipio = mun ? mun[1].replace(/\s+/g, " ").trim() : null;
  }

  return out;
}

/** Id estable de un mensaje: hash del texto normalizado (deduplicación). */
export function messageId(source: string, rawText: string): string {
  const norm = rawText.replace(/\s+/g, " ").trim();
  const h = createHash("sha256").update(source + "|" + norm).digest("hex");
  return `${source}-${h.slice(0, 16)}`;
}

/** Limpia el HTML del espejo a texto plano (br -> salto, resto de etiquetas fuera). */
export function htmlToText(html: string): string {
  let t = html.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/p>/gi, "\n");
  t = t.replace(/<[^>]+>/g, "");
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return t;
}

/**
 * Divide el texto del espejo en mensajes individuales.
 * Cada mensaje empieza con uno de estos marcadores; el pie del mensaje
 * anterior ("Les mantendremos informados. Equipo de Atención...") queda
 * al final del bloque previo.
 */
const MESSAGE_STARTS = [
  "Actualización del SEN",
  "Avería",
  "Afectación de Déficit",
  "Le informamos",
] as const;

export function splitMirrorText(text: string): string[] {
  const escaped = MESSAGE_STARTS.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const re = new RegExp(`(?=${escaped.join("|")})`, "g");
  const parts = text
    .split(re)
    .map((p) => p.replace(/\n{3,}/g, "\n\n").trim())
    .filter((p) => p.length > 10);
  // El primer fragmento puede ser basura previa al primer marcador.
  return parts.filter((p) => MESSAGE_STARTS.some((s) => p.includes(s)));
}

/** Meses en español para "10 de octubre del 2024". */
const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** Extrae ({dia, mes, anio}, hora) de una NOTA: "10 de octubre del 2024" + "Hora: 4:54 pm". */
export function parseNotaDate(
  text: string
): { date: string; hour: string } | null {
  const d = text.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+del\s+(\d{4})/i);
  const h = text.match(/Hora:\s*(\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i);
  if (!d || !h) return null;
  const mes = MESES[d[2].toLowerCase()];
  if (!mes) return null;
  const day = parseInt(d[1], 10);
  const yyyy = parseInt(d[3], 10);
  const hm = h[1].replace(/\./g, "").toLowerCase().match(/(\d{1,2}):(\d{2})\s*([ap])m/);
  if (!hm) return null;
  let hh = parseInt(hm[1], 10);
  const mm = parseInt(hm[2], 10);
  if (hm[3] === "p" && hh !== 12) hh += 12;
  if (hm[3] === "a" && hh === 12) hh = 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${yyyy}-${pad(mes)}-${pad(day)}`,
    hour: `${pad(hh)}:${pad(mm)}`,
  };
}

/**
 * Convierte fecha+hora en hora de Cuba (UTC-4, vigente desde 1 nov 2026)
 * a ISO UTC. Cuba NO atrasó los relojes: UTC-4 todo el año.
 */
export function cubaToIso(date: string, hour: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [hh, mm] = hour.split(":").map(Number);
  const utc = Date.UTC(y, mo - 1, d, hh + 4, mm);
  return new Date(utc).toISOString();
}
