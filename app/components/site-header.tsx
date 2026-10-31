import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const sections = [
  { href: "/jeux", label: "Jeux" },
  { href: "/pokemon", label: "Pokémon" },
  { href: "/objets", label: "Objets" },
  { href: "/lieux", label: "Lieux" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-base-300 bg-base-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-stretch gap-x-4 gap-y-2 px-4">
        <Link
          href="/"
          className="font-display flex items-center self-stretch rounded-br-2xl bg-primary px-5 py-4 text-2xl leading-none text-primary-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Pokédex
        </Link>
        <nav
          aria-label="Sections"
          className="flex min-h-12 flex-1 flex-wrap items-center gap-1 py-2 md:py-0"
        >
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-field px-3 py-2 text-base-content/85 hover:bg-base-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {section.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center py-2 md:py-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
