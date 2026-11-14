import Link from "next/link";
import type { CircuitSummary } from "@/lib/types";
import { formatHours } from "@/lib/format";
import { fmtFechaHora, hace } from "@/lib/format";
import { IconBolt, IconBoltOff, IconChevron, IconClock } from "./Icons";

export function StatusChip({ status }: { status: "sin" | "con" | "desconocido" }) {
  if (status === "sin") {
    return (
      <span className="ap-chip bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
        <span className="w-2 h-2 rounded-full bg-red-500 ap-pulse-dot" />
        SIN CORRIENTE
      </span>
    );
  }
  if (status === "con") {
    return (
      <span className="ap-chip bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        CON CORRIENTE
      </span>
    );
  }
  return (
    <span className="ap-chip bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      SIN DATOS
    </span>
  );
}

/** Tarjeta de un circuito en el inicio / listado. */
export default function CircuitCard({ s }: { s: CircuitSummary }) {
  const sinceLabel = s.since
    ? `desde ${fmtFechaHora(s.since)} (${hace(s.since)})`
    : "sin registro de cambio";
  return (
    <Link href={`/circuito/${encodeURIComponent(s.code)}`} className="block">
      <article className="ap-card ap-enter p-4 flex gap-3 items-start hover:ring-2 hover:ring-amber-400 transition">
        <span
          className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-xl ${
            s.status === "sin"
              ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
              : s.status === "con"
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {s.status === "sin" ? (
            <IconBoltOff className="w-6 h-6" />
          ) : (
            <IconBolt className="w-6 h-6" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-lg leading-none">{s.code}</span>
            <StatusChip status={s.status} />
          </div>
          {s.zona && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
              {s.zona}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <IconClock className="w-3.5 h-3.5" />
            {s.status === "desconocido" ? "Sin datos todavía" : sinceLabel}
            {s.inferred === 1 && s.status === "con"
              ? " · restablecimiento inferido"
              : ""}
          </p>
          <p className="text-xs mt-1.5 text-slate-600 dark:text-slate-300">
            <span className="font-bold text-red-600 dark:text-red-400">
              {formatHours(s.hoursSin)} sin luz
            </span>
            {" · "}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {formatHours(s.hoursCon)} con luz
            </span>
            <span className="text-slate-400"> · {s.mentions} menciones</span>
          </p>
        </div>
        <IconChevron className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
      </article>
    </Link>
  );
}
