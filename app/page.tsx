import Link from "next/link";

const sections = [
  { href: "/jeux", name: "Jeux", text: "Les titres de la série" },
  { href: "/pokemon", name: "Pokémon", text: "Espèces, types et évolutions" },
  { href: "/objets", name: "Objets", text: "Ce que l'on utilise dans les jeux" },
  { href: "/lieux", name: "Lieux", text: "Régions et endroits" },
] as const;

export default function Home() {
  return (
    <div className="catalogue-page">
      <h1 className="sr-only">Catalogue</h1>
      <ul className="grid gap-5 sm:grid-cols-2">
        {sections.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="catalogue-panel block transition-[box-shadow] hover:ring-primary/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex flex-col gap-2 px-6 pb-7 pt-8">
                <span className="font-display text-4xl leading-tight text-base-content">{section.name}</span>
                <span className="max-w-[28ch] text-base-content/70">{section.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
