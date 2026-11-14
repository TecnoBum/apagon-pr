import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { IconBolt } from "./Icons";

/** Barra superior de la app: nombre + cambio de tema. La navegación va abajo. */
export default function Header() {
  return (
    <header className="sticky top-0 z-40 bg-[#0F172A] text-white shadow-md">
      <div className="flex items-center gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 flex-1 min-w-0" aria-label="Apagón PR — Inicio">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500 text-[#0F172A]">
            <IconBolt className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-black text-lg leading-none tracking-tight">
              Apagón PR
            </span>
            <span className="block text-[11px] text-slate-300 leading-tight mt-0.5">
              Partes eléctricos · Pinar del Río
            </span>
          </span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
