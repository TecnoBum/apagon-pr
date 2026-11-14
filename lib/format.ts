/** Formato de fechas/horas para la UI (español, hora de Cuba UTC-4). */

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Un ISO UTC -> Date en hora de Cuba (UTC-4 fijo). */
export function cubaDate(iso: string): Date {
  return new Date(new Date(iso).getTime() - 4 * 3600000);
}

export function fmtFechaHora(iso: string): string {
  const d = cubaDate(iso);
  const dia = DIAS[d.getUTCDay()];
  const dd = d.getUTCDate();
  const mes = MESES[d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dia} ${dd} ${mes}, ${hh}:${mm}`;
}

export function fmtFecha(iso: string): string {
  const d = cubaDate(iso);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtHora(iso: string): string {
  const d = cubaDate(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** "hace 25 min" / "hace 2 h" / "hace 3 d" desde un ISO. */
export function hace(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "ahora mismo";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

/** Formatea horas acumuladas en forma legible: "36 h 20 min" / "2 d 4 h". */
export function formatHours(h: number): string {
  if (!isFinite(h) || h <= 0) return "0 min";
  if (h < 1) return `${Math.round(h * 60)} min`;
  const days = Math.floor(h / 24);
  const rem = h - days * 24;
  const hrs = Math.floor(rem);
  const mins = Math.round((rem - hrs) * 60);
  if (days > 0) return `${days} d ${hrs} h`;
  if (mins === 0) return `${hrs} h`;
  return `${hrs} h ${mins} min`;
}

/** Duración entre dos ISO en horas (puede ser negativa -> 0). */
export function hoursBetween(aIso: string, bIso: string): number {
  return Math.max(
    0,
    (new Date(bIso).getTime() - new Date(aIso).getTime()) / 3600000
  );
}
