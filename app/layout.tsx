import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
});

const themeScript = `(function(){try{var t=localStorage.getItem("catalogue-theme");var theme=t==="zubat-dark"||t==="dark"?"zubat-dark":"zubat";document.documentElement.setAttribute("data-theme",theme);}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Pokédex",
  description: "Catalogue de référence en français pour les jeux Pokémon.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      data-theme="zubat"
      className={`${fraunces.variable} ${sourceSans.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-base-200 font-sans text-base-content">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
