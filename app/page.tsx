import Link from "next/link";

const sections = [
  { href: "/jeux", name: "Jeux", text: "Les titres de la série" },
  { href: "/pokemon", name: "Pokémon", text: "Espèces, types et évolutions" },
  { href: "/objets", name: "Objets", text: "Ce que l'on utilise dans les jeux" },
  { href: "/lieux", name: "Lieux", text: "Régions et endroits" },
] as const;

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="sr-only">Catalogue</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="card block border border-base-300 border-l-4 border-l-primary bg-base-100 transition-colors hover:bg-base-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="card-body">
                <span className="card-title font-display text-4xl">{section.name}</span>
                <span className="text-base-content/70">{section.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
