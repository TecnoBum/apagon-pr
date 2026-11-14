"use client";

import { useState } from "react";
import { IconRefresh } from "./Icons";

export default function SyncButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/sync?source=elecpinar", { method: "GET" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "sync_failed");
      setMsg(
        `Listo: ${data.inserted} partes nuevos, ${data.total} en total. Recargando…`
      );
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setMsg("No se pudo sincronizar ahora. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 text-[#0F172A] font-bold disabled:opacity-60"
      >
        <IconRefresh className="w-4 h-4" />
        {busy ? "Cargando…" : "Cargar partes de demostración"}
      </button>
      {msg && <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{msg}</p>}
    </div>
  );
}
