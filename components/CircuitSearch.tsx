"use client";

import { useMemo, useState } from "react";
import type { CircuitSummary } from "@/lib/types";
import CircuitCard from "@/components/CircuitCard";
import { IconSearch } from "@/components/Icons";

export default function CircuitSearch({
  summaries,
  initialQ,
}: {
  summaries: CircuitSummary[];
  initialQ: string;
}) {
  const [q, setQ] = useState(initialQ);
  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase().replace(/\s+/g, "");
    if (!needle) return summaries;
    return summaries.filter(
      (s) =>
        s.code.toUpperCase().includes(needle) ||
        (s.zona || "").toUpperCase().includes(q.trim().toUpperCase())
    );
  }, [q, summaries]);

  const sin = filtered.filter((s) => s.status === "sin");
  const resto = filtered.filter((s) => s.status !== "sin");

  return (
    <div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <IconSearch className="w-4 h-4" />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Buscar circuito: P916, PD1082, S606… o por zona"
          className="ap-input pl-9"
          autoFocus
        />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-3">
        {filtered.length} circuito(s)
        {q.trim() ? ` para «${q.trim()}»` : ` en total`}
      </p>
      <div className="space-y-2.5">
        <p className="px-1 pt-1 text-xs font-black tracking-wide text-red-600 dark:text-red-400">
          SIN CORRIENTE ({sin.length})
        </p>
        {sin.map((s) => (
          <CircuitCard key={s.code} s={s} />
        ))}
        {sin.length === 0 && (
          <p className="text-sm text-slate-500 px-1">
            Ningún circuito sin corriente.
          </p>
        )}
        <p className="px-1 pt-3 text-xs font-black tracking-wide text-emerald-600 dark:text-emerald-400">
          CON CORRIENTE ({resto.length})
        </p>
        {resto.map((s) => (
          <CircuitCard key={s.code} s={s} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500">
            Ningún circuito coincide con la búsqueda. Prueba con el código
            (P916, PD1082) o parte de la zona.
          </p>
        )}
      </div>
    </div>
  );
}
