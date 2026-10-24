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
    <header className="navbar flex-wrap gap-y-2 bg-primary px-4 text-primary-content">
      <Link href="/" className="font-display text-2xl leading-none">
        Pokédex
      </Link>
      <nav aria-label="Sections" className="order-last flex w-full flex-wrap gap-1 md:order-none md:ml-6 md:w-auto md:flex-1">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="btn btn-ghost btn-sm">
            {section.label}
          </Link>
        ))}
      </nav>
      <ThemeToggle />
    </header>
  );
}
