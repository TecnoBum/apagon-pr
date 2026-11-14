"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBell,
  IconChart,
  IconHome,
  IconList,
  IconSearch,
} from "./Icons";

const TABS = [
  { href: "/", label: "Inicio", Icon: IconHome },
  { href: "/circuitos", label: "Circuitos", Icon: IconSearch },
  { href: "/partes", label: "Partes", Icon: IconList },
  { href: "/estadisticas", label: "Estadísticas", Icon: IconChart },
  { href: "/avisos", label: "Avisos", Icon: IconBell },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  // La ficha de un circuito pertenece a la pestaña Circuitos.
  if (href === "/circuitos") return pathname.startsWith("/circuito/");
  return pathname.startsWith(href + "/");
}

/** Navegación inferior estilo APK: 5 pestañas con iconos SVG. */
export default function BottomNav() {
  const pathname = usePathname() || "/";
  return (
    <nav className="bottom-nav fixed bottom-0 inset-x-0 z-40">
      <div className="mx-auto max-w-[480px] bg-white dark:bg-[#0F172A] border-t border-slate-200 dark:border-slate-800 shadow-[0_-2px_12px_rgba(16,24,40,0.08)]">
        <div className="grid grid-cols-5">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[58px] py-2 text-[10px] font-bold ${
                  active
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <Icon className="w-6 h-6" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
