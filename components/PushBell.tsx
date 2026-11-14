"use client";

import { useEffect, useState } from "react";
import { IconBell, IconBellOff } from "./Icons";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State =
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on" }
  | { kind: "busy" };

/**
 * Campana de avisos por circuito: "avísame cuando este circuito pierda
 * o recupere la corriente". circuits=[] significa "todos los circuitos".
 */
export default function PushBell({ circuit }: { circuit: string | null }) {
  const [state, setState] = useState<State>({ kind: "off" });
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState({ kind: "unsupported" });
      return;
    }
    if (Notification.permission === "denied") {
      setState({ kind: "denied" });
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState({ kind: sub ? "on" : "off" }))
      .catch(() => setState({ kind: "off" }));
  }, []);

  async function subscribe() {
    setState({ kind: "busy" });
    setNote("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState({ kind: "denied" });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
      if (!key) {
        setNote("Las notificaciones no están configuradas en el servidor.");
        setState({ kind: "off" });
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const circuits = circuit ? [circuit] : [];
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), circuits }),
      });
      if (!res.ok) throw new Error("subscribe_failed");
      setState({ kind: "on" });
      setNote(
        circuit
          ? `Avisos activos para el circuito ${circuit}.`
          : "Avisos activos para todos los circuitos."
      );
    } catch {
      setNote("No se pudo activar el aviso en este navegador.");
      setState({ kind: "off" });
    }
  }

  async function unsubscribe() {
    setState({ kind: "busy" });
    setNote("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState({ kind: "off" });
      setNote("Avisos desactivados.");
    } catch {
      setState({ kind: "on" });
    }
  }

  if (state.kind === "unsupported") {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Este navegador no admite notificaciones push.
      </p>
    );
  }
  if (state.kind === "denied") {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Las notificaciones están bloqueadas en los ajustes del navegador.
      </p>
    );
  }

  const on = state.kind === "on";
  return (
    <div>
      <button
        onClick={on ? unsubscribe : subscribe}
        disabled={state.kind === "busy"}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${
          on
            ? "bg-emerald-600 text-white"
            : "bg-amber-500 text-[#0F172A]"
        } disabled:opacity-60`}
      >
        {on ? <IconBell className="w-4 h-4" /> : <IconBellOff className="w-4 h-4" />}
        {state.kind === "busy"
          ? "Procesando…"
          : on
            ? "Avisos activos"
            : circuit
              ? `Avísame del circuito ${circuit}`
              : "Avísame de todos los circuitos"}
      </button>
      {note && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{note}</p>
      )}
    </div>
  );
}
