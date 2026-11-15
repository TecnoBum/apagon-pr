import Link from "next/link";
import {
  ensureSchema,
  listMessagesAsc,
} from "@/lib/turso";
import {
  dataCutoff,
  getAllCircuitSummaries,
} from "@/lib/history";
import { fmtFecha, fmtFechaHora, formatHours, hace } from "@/lib/format";
import CircuitCard from "@/components/CircuitCard";
import ParteCard from "@/components/ParteCard";
import {
  IconAlert,
  IconBolt,
  IconBoltOff,
  IconChart,
  IconClock,
  IconLayers,
} from "@/components/Icons";

export const dynamic = "force-dynamic";

function SectionHead({
  title,
  href,
  hrefLabel,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2 px-1">
      <h2 className="font-black text-base">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-xs font-bold text-amber-600 dark:text-amber-400"
        >
          {hrefLabel || "Ver todos"}
        </Link>
      )}
    </div>
  );
}

export default async function Home() {
  let messages: Awaited<ReturnType<typeof listMessagesAsc>> = [];
  let summaries: Awaited<ReturnType<typeof getAllCircuitSummaries>> = [];
  let dbError: string | null = null;
  try {
    await ensureSchema();
    messages = await listMessagesAsc();
    summaries = await getAllCircuitSummaries(messages);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "backend no configurado";
  }

  const { lastAt, isLive } = dataCutoff(messages);
  const isDemo = messages.length > 0 && messages.every((m) => m.demo === 1);
  const sin = summaries.filter((s) => s.status === "sin");
  const con = summaries.filter((s) => s.status === "con");
  const latestNota = messages.filter((m) => m.kind === "nota").pop();
  const ultimosPartes = [...messages].reverse().slice(0, 4);

  // (c) Restablecidos recientemente: en CON, por cambio más reciente.
  const restablecidos = [...con]
    .filter((s) => s.since)
    .sort((a, b) => (b.since || "").localeCompare(a.since || ""))
    .slice(0, 6);

  // (e) Resumen del último día con datos.
  const diaKey = lastAt ? fmtFecha(lastAt.toISOString()) : "";
  const delDia = messages.filter((m) => fmtFecha(m.postedAt) === diaKey);
  const afectadosDia = new Set<string>();
  for (const m of delDia) {
    for (const c of m.afectados) afectadosDia.add(c);
    for (const c of m.averiaCircuitos) afectadosDia.add(c);
  }
  const deficitDia = delDia
    .filter((m) => m.deficitMw !== null)
    .map((m) => m.deficitMw as number);
  const totalHorasSin = summaries.reduce((a, s) => a + s.hoursSin, 0);
  const totalAverias = messages.filter((m) => m.kind === "averia").length;

  return (
    <div className="px-4 pt-4 space-y-5">
      {dbError && (
        <div className="ap-card p-4 border-l-4 border-red-500">
          <p className="font-bold text-red-600">No se pudo leer la base de datos</p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{dbError}</p>
        </div>
      )}

      {isDemo && (
        <div className="ap-card p-4 border-l-4 border-amber-500">
          <p className="font-bold flex items-center gap-2">
            <IconAlert className="w-5 h-5 text-amber-500" />
            Datos de demostración
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Estos partes son del <strong>12 de octubre de 2024</strong> (canal
            viejo @elecpinar, hoy congelado) y <strong>no están vigentes</strong>.
            El lector en vivo del canal oficial está pendiente. El histórico y
            las horas se calculan igual que con datos en vivo.
          </p>
        </div>
      )}

      {messages.length > 0 && (
        <>
          {/* (a) Estado actual */}
          <section>
            <SectionHead title="Estado actual" />
            <div className="ap-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-black text-base flex items-center gap-2">
                  <IconBolt className="w-5 h-5 text-amber-500" />
                  Último parte
                  {latestNota?.notaNum ? ` · NOTA ${latestNota.notaNum}` : ""}
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1">
                  <IconClock className="w-3.5 h-3.5" />
                  {lastAt ? fmtFechaHora(lastAt.toISOString()) : "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2">
                  <div className="flex items-center justify-center gap-1 text-xl font-black">
                    <IconChart className="w-4 h-4 text-slate-400" />
                    {latestNota?.deficitMw ?? "—"}
                    <span className="text-xs font-bold"> MW</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Déficit</div>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2">
                  <div className="flex items-center justify-center gap-1 text-xl font-black">
                    <IconLayers className="w-4 h-4 text-slate-400" />
                    {latestNota?.bloques ?? "—"}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Bloque(s)</div>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2">
                  <div className="text-xl font-black">{sin.length}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Sin corriente</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-2">
                  <div className="text-lg font-black text-red-600">{sin.length}</div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">SIN CORRIENTE</div>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-2">
                  <div className="text-lg font-black text-emerald-600">{con.length}</div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">CON CORRIENTE</div>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2">
                  <div className="text-lg font-black">{summaries.length}</div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">CIRCUITOS</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                {isLive ? "Datos en vivo" : "Datos no vigentes"} · última
                actualización{" "}
                {lastAt ? `${fmtFechaHora(lastAt.toISOString())} (${hace(lastAt.toISOString())})` : "—"}
              </p>
            </div>
          </section>

          {/* Buscador rápido */}
          <form action="/circuitos" method="get" className="flex gap-2">
            <input
              name="q"
              type="search"
              placeholder="Buscar circuito: P916, PD1082, S606…"
              className="ap-input flex-1"
            />
            <button
              type="submit"
              className="px-4 rounded-xl bg-amber-500 text-[#0F172A] font-bold text-sm"
            >
              Buscar
            </button>
          </form>

          {/* (b) Circuitos sin corriente ahora */}
          <section>
            <SectionHead title={`Sin corriente ahora (${sin.length})`} href="/circuitos" hrefLabel="Ver todos" />
            <div className="space-y-2.5">
              {sin.map((s) => (
                <CircuitCard key={s.code} s={s} />
              ))}
              {sin.length === 0 && (
                <div className="ap-card p-4 text-sm text-slate-500 flex items-center gap-2">
                  <IconBolt className="w-5 h-5 text-emerald-500" />
                  Ningún circuito sin corriente en el último parte.
                </div>
              )}
            </div>
          </section>

          {/* (c) Restablecidos recientemente */}
          <section>
            <SectionHead title="Restablecidos recientemente" href="/circuitos" hrefLabel="Ver todos" />
            {restablecidos.length === 0 ? (
              <div className="ap-card p-4 text-sm text-slate-500">
                Ningún circuito restablecido todavía en los datos.
              </div>
            ) : (
              <div className="ap-card divide-y divide-slate-100 dark:divide-slate-700">
                {restablecidos.map((s) => (
                  <Link
                    key={s.code}
                    href={`/circuito/${encodeURIComponent(s.code)}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <IconBolt className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-black">{s.code}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                        {s.zona ? `${s.zona} · ` : ""}
                        {s.since ? `desde ${hace(s.since)}` : ""}
                        {s.inferred === 1 ? " · restablecimiento inferido" : ""}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                      {formatHours(s.hoursSin)} sin luz
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* (d) Últimos partes */}
          <section>
            <SectionHead title="Últimos partes" href="/partes" hrefLabel="Ver todos" />
            <div className="space-y-2.5">
              {ultimosPartes.map((m) => (
                <ParteCard key={m.id} m={m} compact />
              ))}
            </div>
          </section>

          {/* (e) Resumen del día / estadísticas rápidas */}
          <section>
            <SectionHead title={`Resumen · ${diaKey}`} href="/estadisticas" hrefLabel="Estadísticas" />
            <div className="ap-card p-4">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3">
                  <div className="text-xl font-black">{delDia.length}</div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">PARTES ESE DÍA</div>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3">
                  <div className="text-xl font-black">{afectadosDia.size}</div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">CIRCUITOS AFECTADOS</div>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3">
                  <div className="text-xl font-black">
                    {deficitDia.length ? `${Math.max(...deficitDia)} MW` : "—"}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">DÉFICIT MÁXIMO</div>
                </div>
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
                  <div className="text-xl font-black text-red-600 flex items-center justify-center gap-1">
                    <IconBoltOff className="w-5 h-5" />
                    {formatHours(totalHorasSin)}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">HORAS SIN LUZ (TOTAL)</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                {messages.length} partes en total · {totalAverias} averías
                registradas · {summaries.length} circuitos con historial.
              </p>
              <Link
                href="/avisos"
                className="inline-flex items-center gap-2 mt-3 text-sm font-bold text-amber-600 dark:text-amber-400"
              >
                <IconAlert className="w-4 h-4" />
                Activa los avisos por circuito
              </Link>
            </div>
          </section>

          <footer className="text-center text-xs text-slate-500 dark:text-slate-400 pt-1">
            Fuente: canal de Telegram de la Empresa Eléctrica de Pinar del Río
            (semilla: canal viejo @elecpinar, 12 oct 2024).
            <br />
            Las horas por circuito se reconstruyen de parte en parte; la
            empresa no publica horarios por circuito.
            <br />
            Datos hasta: {lastAt ? fmtFechaHora(lastAt.toISOString()) : "—"}
            {isLive ? " (en vivo)" : " (no vigente)"}
          </footer>
        </>
      )}
    </div>
  );
}
