import Link from "next/link";
import { SectionNav } from "@/components/shell/section-nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export function Navbar() {
  return (
    <header className="navbar border-b border-base-300 bg-base-100 px-2 sm:px-4">
      <div className="navbar-start gap-2">
        <details className="dropdown lg:hidden">
          <summary className="btn btn-ghost btn-sm" aria-label="Ouvrir le menu">
            Menu
          </summary>
          <SectionNav className="menu dropdown-content z-20 mt-2 w-52 rounded-box bg-base-100 p-2 shadow" />
        </details>
        <Link href="/" className="btn btn-ghost px-2 text-lg font-semibold">
          <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-full bg-primary" />
          Pokédex
        </Link>
      </div>
      <nav className="navbar-center hidden lg:flex" aria-label="Sections">
        <SectionNav className="menu menu-horizontal px-1" />
      </nav>
      <div className="navbar-end">
        <ThemeToggle />
      </div>
    </header>
  );
}
