import Link from "next/link";
import { ensureSchema, listMessagesAsc } from "@/lib/turso";
import { getAllCircuitSummaries } from "@/lib/history";
import PushBell from "@/components/PushBell";
import { IconBell, IconBoltOff } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function AvisosPage() {
  let summaries: Awaited<ReturnType<typeof getAllCircuitSummaries>> = [];
  let error: string | null = null;
  try {
    await ensureSchema();
    const messages = await listMessagesAsc();
    summaries = await getAllCircuitSummaries(messages);
  } catch (e) {
    error = e instanceof Error ? e.message : "backend no configurado";
  }

  const sin = summaries.filter((s) => s.status === "sin");

  return (
    <div className="px-4 pt-4 space-y-5">
      <div>
        <h1 className="font-black text-xl">Avisos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Notificaciones push cuando un circuito pierda o recupere la
          corriente. Activa los avisos de todos los circuitos, o entra en la
          ficha de un circuito y actívalos solo para ese.
        </p>
      </div>

      {error && (
        <div className="ap-card p-4 border-l-4 border-red-500">
          <p className="font-bold text-red-600">No se pudo leer la base de datos</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
        </div>
      )}

      <section className="ap-card p-4">
        <h2 className="font-black text-base mb-1 flex items-center gap-2">
          <IconBell className="w-5 h-5 text-amber-500" />
          Todos los circuitos
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          Recibe un aviso cada vez que cualquier circuito cambie de estado.
        </p>
        <PushBell circuit={null} />
      </section>

      <section>
        <h2 className="font-black text-base mb-2 px-1">
          Circuitos sin corriente ahora ({sin.length})
        </h2>
        {sin.length === 0 ? (
          <div className="ap-card p-4 text-sm text-slate-500">
            Ningún circuito sin corriente en el último parte.
          </div>
        ) : (
          <div className="ap-card divide-y divide-slate-100 dark:divide-slate-700">
            {sin.map((s) => (
              <Link
                key={s.code}
                href={`/circuito/${encodeURIComponent(s.code)}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                  <IconBoltOff className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-black">{s.code}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                    {s.zona ? `${s.zona} · ` : ""}Toca para activar su aviso
                  </span>
                </span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0">
                  Avisarme
                </span>
              </Link>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-1">
          Los avisos llegan como notificación del navegador. Si el navegador
          no admite notificaciones, la campana lo indicará.
        </p>
      </section>
    </div>
  );
}
