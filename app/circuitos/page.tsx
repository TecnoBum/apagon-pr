import { ensureSchema, listMessagesAsc } from "@/lib/turso";
import { getAllCircuitSummaries } from "@/lib/history";
import CircuitSearch from "@/components/CircuitSearch";

export const dynamic = "force-dynamic";

export default async function CircuitosPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  let summaries: Awaited<ReturnType<typeof getAllCircuitSummaries>> = [];
  let error: string | null = null;
  try {
    await ensureSchema();
    const messages = await listMessagesAsc();
    summaries = await getAllCircuitSummaries(messages);
  } catch (e) {
    error = e instanceof Error ? e.message : "backend no configurado";
  }

  return (
    <div className="px-4 pt-4 space-y-3">
      <div>
        <h1 className="font-black text-xl">Circuitos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Busca por código (P916, PD1082, S606…) o por zona. Toca un circuito
          para ver su línea de tiempo y sus horas con y sin corriente.
        </p>
      </div>
      {error ? (
        <div className="ap-card p-4 border-l-4 border-red-500">
          <p className="font-bold text-red-600">No se pudo leer la base de datos</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
        </div>
      ) : (
        <CircuitSearch summaries={summaries} initialQ={q} />
      )}
    </div>
  );
}
