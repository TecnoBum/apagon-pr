import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ensureSchema,
  listMessagesAsc,
} from "@/lib/turso";
import {
  dataCutoff,
  getCircuitStates,
  getCircuitSummary,
} from "@/lib/history";
import { fmtFechaHora, formatHours, hace } from "@/lib/format";
import { StatusChip } from "@/components/CircuitCard";
import PushBell from "@/components/PushBell";
import { IconArrowLeft, IconArrowRight, IconBolt, IconBoltOff, IconClock, IconInfo } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function CircuitoPage({
  params,
}: {
  params: { id: string };
}) {
  const code = decodeURIComponent(params.id).toUpperCase().replace(/\s+/g, "");
  let messages: Awaited<ReturnType<typeof listMessagesAsc>> = [];
  try {
    await ensureSchema();
    messages = await listMessagesAsc();
  } catch (e) {
    return (
      <div className="px-4 pt-4">
        <div className="ap-card p-4 border-l-4 border-red-500">
          <p className="font-bold text-red-600">No se pudo leer la base de datos</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {e instanceof Error ? e.message : "backend no configurado"}
          </p>
        </div>
      </div>
    );
  }

  const summary = await getCircuitSummary(code, messages);
  if (!summary) notFound();
  const states = await getCircuitStates(code);
  const { cutoff, lastAt, isLive } = dataCutoff(messages);
  const mentions = messages.filter(
    (m) =>
      m.afectados.includes(code) ||
      m.restablecidos.includes(code) ||
      m.averiaCircuitos.includes(code)
  );

  const totalHoras = summary.hoursSin + summary.hoursCon;
  const pctSin = totalHoras > 0 ? Math.round((summary.hoursSin / totalHoras) * 100) : 0;

  return (
    <div className="px-4 pt-4 space-y-4">
      <div>
        <Link
          href="/circuitos"
          className="text-sm font-bold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1"
        >
          <IconArrowLeft className="w-4 h-4" /> Todos los circuitos
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="font-black text-2xl">{summary.code}</h1>
          <StatusChip status={summary.status} />
        </div>
        {summary.zona && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            {summary.zona}
          </p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
          <IconClock className="w-3.5 h-3.5" />
          Datos hasta {lastAt ? fmtFechaHora(lastAt.toISOString()) : "—"}
          {isLive ? " (en vivo)" : " (no vigente)"}
          {summary.since
            ? ` · en este estado desde ${fmtFechaHora(summary.since)} (${hace(summary.since)})`
            : ""}
          {summary.inferred === 1 && summary.status === "con"
            ? " · restablecimiento inferido"
            : ""}
        </p>
      </div>

      <section className="ap-card p-4">
        <h2 className="font-black text-base mb-2">Horas acumuladas</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Desde el primer dato disponible
          {summary.firstSeen ? ` (${fmtFechaHora(summary.firstSeen)})` : ""} hasta{" "}
          {fmtFechaHora(cutoff.toISOString())}. La empresa no publica horarios
          por circuito: las horas se reconstruyen de parte en parte.
        </p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-red-50 dark:bg-red-900/30 p-3">
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <IconBoltOff className="w-5 h-5" />
            </div>
            <div className="text-xl font-black text-red-600 dark:text-red-400">
              {formatHours(summary.hoursSin)}
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              SIN CORRIENTE
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 p-3">
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <IconBolt className="w-5 h-5" />
            </div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {formatHours(summary.hoursCon)}
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              CON CORRIENTE
            </div>
          </div>
        </div>
        {totalHoras > 0 && (
          <div className="mt-3">
            <div className="h-3 rounded-full overflow-hidden flex bg-emerald-200 dark:bg-emerald-900">
              <div
                className="bg-red-500 h-full"
                style={{ width: `${pctSin}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {pctSin}% del tiempo registrado sin corriente · {100 - pctSin}%
              con corriente
            </p>
          </div>
        )}
      </section>

      <section className="ap-card p-4">
        <h2 className="font-black text-base mb-1">Avísame de este circuito</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          Notificación cuando el {summary.code} pierda o recupere la corriente.
        </p>
        <PushBell circuit={summary.code} />
      </section>

      <section className="ap-card p-4">
        <h2 className="font-black text-base mb-2">Línea de tiempo</h2>
        {states.length === 0 ? (
          <p className="text-sm text-slate-500">Sin periodos registrados.</p>
        ) : (
          <ol className="space-y-2">
            {[...states].reverse().map((s) => {
              const end = s.until || cutoff.toISOString();
              const dur = formatHours(
                Math.max(0, (new Date(end).getTime() - new Date(s.since).getTime()) / 3600000)
              );
              return (
                <li
                  key={s.id}
                  className={`border-l-4 pl-3 py-1 ${
                    s.status === "sin"
                      ? "border-red-500"
                      : "border-emerald-500"
                  }`}
                >
                  <p className="text-sm font-bold">
                    {s.status === "sin" ? "SIN corriente" : "CON corriente"}
                    <span className="font-normal text-slate-500 dark:text-slate-400">
                      {" · "}
                      {dur}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    {fmtFechaHora(s.since)}
                    {s.until ? (
                      <>
                        <IconArrowRight className="w-3.5 h-3.5 shrink-0" />
                        {fmtFechaHora(s.until)}
                      </>
                    ) : (
                      <>
                        <IconArrowRight className="w-3.5 h-3.5 shrink-0" />
                        sigue
                      </>
                    )}
                    {s.inferred === 1 ? " · restauración inferida (dejó de aparecer en los afectados)" : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 flex gap-1.5">
          <IconInfo className="w-4 h-4 shrink-0" />
          "Restauración inferida" significa que el circuito dejó de aparecer en
          la lista de afectados de una NOTA posterior, sin que la empresa lo
          nombrara como restablecido.
        </p>
      </section>

      <section className="ap-card p-4">
        <h2 className="font-black text-base mb-2">
          Partes que mencionan al {summary.code} ({mentions.length})
        </h2>
        {mentions.length === 0 ? (
          <p className="text-sm text-slate-500">Ningún parte lo menciona.</p>
        ) : (
          <ul className="space-y-2">
            {[...mentions].reverse().map((m) => (
              <li key={m.id} className="text-sm border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0">
                <span className="font-bold">
                  {m.kind === "nota" ? `NOTA ${m.notaNum ?? ""}` : m.kind === "averia" ? "Avería" : m.kind}
                </span>
                {" · "}
                <span className="text-slate-500 dark:text-slate-400">
                  {fmtFechaHora(m.postedAt)}
                </span>
                <span className="block text-slate-600 dark:text-slate-300 mt-0.5">
                  {m.afectados.includes(code) && "Afectado en este parte. "}
                  {m.restablecidos.includes(code) && "Restablecido en este parte. "}
                  {m.averiaCircuitos.includes(code) && "Mencionado en una avería. "}
                  {m.deficitMw !== null && `Déficit: ${m.deficitMw} MW.`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/partes"
          className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-amber-600 dark:text-amber-400"
        >
          Ver todos los partes
          <IconArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
