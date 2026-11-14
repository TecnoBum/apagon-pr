"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./Icons";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("apagonpr-theme", next ? "dark" : "light");
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-amber-300"
    >
      {dark ? <IconSun className="w-5 h-5" /> : <IconMoon className="w-5 h-5" />}
    </button>
  );
}
