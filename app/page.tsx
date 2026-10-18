import Link from "next/link";
import { SECTIONS } from "@/lib/catalogue/sections";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold">Catalogue</h1>
        <p className="max-w-2xl text-base-content/70">
          Parcourez les quatre sections du monde Pokémon, sans créer de compte.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link href={section.href} className="card bg-base-100 shadow-sm transition hover:shadow-md">
              <div className="card-body">
                <h2 className="card-title text-primary">{section.label}</h2>
                <p>{section.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
