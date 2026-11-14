import Link from "next/link";
import { ensureSchema, listMessagesAsc } from "@/lib/turso";
import { dataCutoff, getAllCircuitSummaries } from "@/lib/history";
import { fmtFecha, fmtFechaHora, formatHours } from "@/lib/format";
import {
  IconAlert,
  IconBoltOff,
  IconChart,
  IconClock,
  IconWrench,
} from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function EstadisticasPage() {
  let messages: Awaited<ReturnType<typeof listMessagesAsc>> = [];
  let summaries: Awaited<ReturnType<typeof getAllCircuitSummaries>> = [];
  let error: string | null = null;
  try {
    await ensureSchema();
    messages = await listMessagesAsc();
    summaries = await getAllCircuitSummaries(messages);
  } catch (e) {
    error = e instanceof Error ? e.message : "backend no configurado";
  }

  const { lastAt, isLive } = dataCutoff(messages);
  const totalSin = summaries.reduce((a, s) => a + s.hoursSin, 0);
  const totalCon = summaries.reduce((a, s) => a + s.hoursCon, 0);
  const totalAverias = messages.filter((m) => m.kind === "averia").length;

  // Ranking: circuitos con más horas sin corriente.
  const ranking = [...summaries]
    .sort((a, b) => b.hoursSin - a.hoursSin)
    .slice(0, 10);
  const maxSin = ranking.length ? ranking[0].hoursSin : 0;

  // Historial del déficit (NOTAs con MW), en orden cronológico.
  const deficit = messages
    .filter((m) => m.kind === "nota" && m.deficitMw !== null)
    .map((m) => ({ at: m.postedAt, notaNum: m.notaNum, mw: m.deficitMw as number }));
  const mwVals = deficit.map((d) => d.mw);
  const mwMax = mwVals.length ? Math.max(...mwVals) : 0;
  const mwMin = mwVals.length ? Math.min(...mwVals) : 0;
  const mwAvg = mwVals.length
    ? Math.round(mwVals.reduce((a, b) => a + b, 0) / mwVals.length)
    : 0;

  // Por día: partes, circuitos afectados distintos y déficit máximo.
  const porDia = new Map<
    string,
    { partes: number; afectados: Set<string>; maxMw: number | null }
  >();
  for (const m of messages) {
    const key = fmtFecha(m.postedAt);
    let d = porDia.get(key);
    if (!d) {
      d = { partes: 0, afectados: new Set<string>(), maxMw: null };
      porDia.set(key, d);
    }
    d.partes += 1;
    for (const c of m.afectados) d.afectados.add(c);
    for (const c of m.averiaCircuitos) d.afectados.add(c);
    if (m.deficitMw !== null) {
      d.maxMw = d.maxMw === null ? m.deficitMw : Math.max(d.maxMw, m.deficitMw);
    }
  }
  const dias = [...porDia.entries()].reverse();

  return (
    <div className="px-4 pt-4 space-y-5">
      <div>
        <h1 className="font-black text-xl">Estadísticas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Totales y ranking calculados de los partes guardados. Datos hasta{" "}
          {lastAt ? fmtFechaHora(lastAt.toISOString()) : "—"}
          {isLive ? " (en vivo)" : " (no vigente)"}.
        </p>
      </div>

      {error && (
        <div className="ap-card p-4 border-l-4 border-red-500">
          <p className="font-bold text-red-600">No se pudo leer la base de datos</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
        </div>
      )}

      {messages.length === 0 && !error ? (
        <div className="ap-card p-5 text-center">
          <p className="font-bold">No hay datos todavía</p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Vuelve al inicio y carga la semilla de demostración.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2">
            <div className="ap-card p-3 text-center">
              <div className="text-2xl font-black">{summaries.length}</div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">CIRCUITOS</div>
            </div>
            <div className="ap-card p-3 text-center">
              <div className="text-2xl font-black text-red-600 flex items-center justify-center gap-1">
                <IconBoltOff className="w-5 h-5" />
                {formatHours(totalSin)}
              </div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">HORAS SIN LUZ (TOTAL)</div>
            </div>
            <div className="ap-card p-3 text-center">
              <div className="text-2xl font-black">{messages.length}</div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">PARTES</div>
            </div>
            <div className="ap-card p-3 text-center">
              <div className="text-2xl font-black flex items-center justify-center gap-1">
                <IconWrench className="w-5 h-5 text-slate-400" />
                {totalAverias}
              </div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">AVERÍAS</div>
            </div>
          </section>

          <section>
            <h2 className="font-black text-base mb-2 px-1">
              Circuitos con más horas sin corriente
            </h2>
            <div className="ap-card divide-y divide-slate-100 dark:divide-slate-700">
              {ranking.map((s, i) => {
                const total = s.hoursSin + s.hoursCon;
                const pct = total > 0 ? Math.round((s.hoursSin / total) * 100) : 0;
                return (
                  <Link
                    key={s.code}
                    href={`/circuito/${encodeURIComponent(s.code)}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="w-6 text-center font-black text-slate-400">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-black">{s.code}</span>
                      <span className="block h-2 rounded-full bg-slate-100 dark:bg-slate-700 mt-1.5 overflow-hidden">
                        <span
                          className="block h-full bg-red-500 rounded-full"
                          style={{ width: `${maxSin > 0 ? Math.round((s.hoursSin / maxSin) * 100) : 0}%` }}
                        />
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block font-black text-red-600 dark:text-red-400">
                        {formatHours(s.hoursSin)}
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {pct}% del tiempo · {s.mentions} menciones
                      </span>
                    </span>
                  </Link>
                );
              })}
              {ranking.length === 0 && (
                <p className="p-4 text-sm text-slate-500">Sin circuitos todavía.</p>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-1">
              Total con corriente en el mismo periodo: {formatHours(totalCon)}.
            </p>
          </section>

          <section>
            <h2 className="font-black text-base mb-2 px-1">Déficit de generación</h2>
            <div className="ap-card p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2">
                  <div className="text-lg font-black">{mwMax} MW</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">MÁXIMO</div>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2">
                  <div className="text-lg font-black">{mwMin} MW</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">MÍNIMO</div>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2">
                  <div className="text-lg font-black">{mwAvg} MW</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">PROMEDIO</div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {deficit.map((d) => (
                  <div key={d.at + String(d.notaNum)} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <IconClock className="w-3.5 h-3.5" />
                      {fmtFechaHora(d.at)}
                    </span>
                    <span className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <span
                        className="block h-full bg-amber-500 rounded-full"
                        style={{ width: `${mwMax > 0 ? Math.round((d.mw / mwMax) * 100) : 0}%` }}
                      />
                    </span>
                    <span className="w-16 text-right font-bold shrink-0">
                      {d.mw} MW
                    </span>
                    <span className="w-16 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                      {d.notaNum ? `NOTA ${d.notaNum}` : ""}
                    </span>
                  </div>
                ))}
                {deficit.length === 0 && (
                  <p className="text-sm text-slate-500">Sin datos de déficit.</p>
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-black text-base mb-2 px-1">Por día</h2>
            <div className="ap-card divide-y divide-slate-100 dark:divide-slate-700">
              {dias.map(([dia, d]) => (
                <div key={dia} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex items-center gap-1.5 w-16 shrink-0 text-sm font-bold">
                    <IconChart className="w-4 h-4 text-slate-400" />
                    {dia}
                  </span>
                  <span className="flex-1 text-sm text-slate-600 dark:text-slate-300">
                    {d.partes} partes · {d.afectados.size} circuitos afectados
                  </span>
                  <span className="text-sm font-bold shrink-0">
                    {d.maxMw !== null ? `máx ${d.maxMw} MW` : "sin déficit"}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-1 flex items-center gap-1.5">
              <IconAlert className="w-4 h-4 shrink-0" />
              Las horas se reconstruyen de parte en parte; la empresa no
              publica horarios por circuito.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
