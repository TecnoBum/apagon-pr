import Link from "next/link";
import type { MessageKind, StoredMessage } from "@/lib/types";
import { fmtFechaHora } from "@/lib/format";
import { stripEmoji } from "@/lib/stripEmoji";
import {
  IconAlert,
  IconChart,
  IconCheck,
  IconInfo,
  IconLayers,
  IconNote,
  IconSun,
  IconWrench,
} from "./Icons";

const KIND_LABEL: Record<
  MessageKind,
  { text: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  nota: {
    text: "NOTA",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    Icon: IconNote,
  },
  averia: {
    text: "AVERÍA",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    Icon: IconWrench,
  },
  prevision: {
    text: "PREVISIÓN",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
    Icon: IconSun,
  },
  aviso: {
    text: "AVISO",
    cls: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    Icon: IconInfo,
  },
  restaurado_total: {
    text: "RESTABLECIDO",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    Icon: IconCheck,
  },
  otro: {
    text: "PARTE",
    cls: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    Icon: IconNote,
  },
};

function Chip({ code, ok }: { code: string; ok?: boolean }) {
  return (
    <Link
      href={`/circuito/${encodeURIComponent(code)}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${
        ok
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      }`}
    >
      {ok && <IconCheck className="w-3 h-3" />}
      {code}
    </Link>
  );
}

/**
 * Tarjeta de un parte: cada campo del parseo lleva su icono SVG y el texto
 * original se muestra SIN emojis (stripEmoji). En modo compacto (inicio)
 * solo se muestra el resumen, sin el texto original.
 */
export default function ParteCard({
  m,
  compact = false,
}: {
  m: StoredMessage;
  compact?: boolean;
}) {
  const k = KIND_LABEL[m.kind];
  const KindIcon = k.Icon;
  const cleanText = stripEmoji(m.rawText);
  const hasParsed =
    m.deficitMw !== null ||
    m.bloques ||
    m.afectados.length > 0 ||
    m.restablecidos.length > 0 ||
    m.averiaCircuitos.length > 0;

  return (
    <article className="ap-card ap-enter p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`ap-chip ${k.cls}`}>
          <KindIcon className="w-3.5 h-3.5" />
          {k.text}
          {m.notaNum ? ` ${m.notaNum}` : ""}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {fmtFechaHora(m.postedAt)}
          {m.postedAtInferred ? " (hora aproximada)" : ""}
        </span>
        {m.demo === 1 && (
          <span className="ap-chip bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            DEMO 2024
          </span>
        )}
      </div>

      {hasParsed && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-sm">
          {m.deficitMw !== null && (
            <span className="inline-flex items-center gap-1.5">
              <IconChart className="w-4 h-4 text-slate-400" />
              Déficit: <strong>{m.deficitMw} MW</strong>
            </span>
          )}
          {m.bloques && (
            <span className="inline-flex items-center gap-1.5">
              <IconLayers className="w-4 h-4 text-slate-400" />
              Bloque: <strong>{m.bloques}</strong>
            </span>
          )}
          {m.afectados.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <IconAlert className="w-4 h-4 text-red-500" />
              Afectados: <strong>{m.afectados.length}</strong>
            </span>
          )}
          {m.restablecidos.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <IconCheck className="w-4 h-4" />
              Restablecidos: <strong>{m.restablecidos.length}</strong>
            </span>
          )}
          {m.averiaCircuitos.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <IconWrench className="w-4 h-4 text-red-500" />
              Avería:{" "}
              <strong>
                {m.averiaCircuitos.join(", ")}
                {m.averiaRestablecido ? " (restablecida)" : ""}
              </strong>
              {m.municipio ? ` · ${m.municipio}` : ""}
            </span>
          )}
        </div>
      )}

      {m.afectados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {m.afectados.map((c) => (
            <Chip key={c} code={c} />
          ))}
        </div>
      )}
      {m.restablecidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {m.restablecidos.map((c) => (
            <Chip key={c} code={c} ok />
          ))}
        </div>
      )}

      {!compact &&
        (hasParsed ? (
          <details className="mt-3">
            <summary className="text-sm font-bold text-amber-600 dark:text-amber-400 cursor-pointer">
              Ver el texto original del parte
            </summary>
            <p className="whitespace-pre-wrap text-sm leading-relaxed mt-2 text-slate-700 dark:text-slate-200">
              {cleanText}
            </p>
          </details>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed mt-3 text-slate-700 dark:text-slate-200">
            {cleanText}
          </p>
        ))}
    </article>
  );
}
