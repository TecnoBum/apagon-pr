"use client";

import { useEffect } from "react";

/** Registra el service worker de notificaciones push (si el navegador lo permite). */
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sin service worker no hay push; la app sigue funcionando */
      });
    }
  }, []);
  return null;
}
