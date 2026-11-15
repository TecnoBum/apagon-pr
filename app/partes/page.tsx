import { ensureSchema, listMessages } from "@/lib/turso";
import ParteCard from "@/components/ParteCard";

export const dynamic = "force-dynamic";

export default async function PartesPage() {
  let messages: Awaited<ReturnType<typeof listMessages>> = [];
  let error: string | null = null;
  try {
    await ensureSchema();
    messages = await listMessages(200);
  } catch (e) {
    error = e instanceof Error ? e.message : "backend no configurado";
  }

  return (
    <div className="px-4 pt-4 space-y-3">
      <div>
        <h1 className="font-black text-xl">Todos los partes</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cada campo viene con su icono y el texto original se muestra sin
          emojis. Nada se inventa: si un parte no se pudo clasificar, se
          muestra solo su texto.
        </p>
      </div>

      {error && (
        <div className="ap-card p-4 border-l-4 border-red-500">
          <p className="font-bold text-red-600">No se pudo leer la base de datos</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
        </div>
      )}

      {messages.map((m) => (
        <ParteCard key={m.id} m={m} />
      ))}
    </div>
  );
}
