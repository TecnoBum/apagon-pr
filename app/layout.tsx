import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  metadataBase: new URL("https://apagon-pr.vercel.app"),
  title: "Apagón PR — Partes eléctricos de Pinar del Río",
  description:
    "Partes de la Empresa Eléctrica de Pinar del Río: circuitos afectados, horas con y sin corriente por circuito, y avisos por circuito.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "Apagón PR",
    description:
      "Partes eléctricos de Pinar del Río: circuitos afectados y horas con y sin corriente por circuito.",
    url: "https://apagon-pr.vercel.app",
    siteName: "Apagón PR",
    locale: "es_CU",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('apagonpr-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <RegisterSW />
        <div className="app-frame">
          <Header />
          <main className="pb-28">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
