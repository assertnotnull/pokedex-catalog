import Link from "next/link";
import { Sprite } from "./sprite";

const SECTION_LINKS = [
  { href: "/jeux", label: "Jeux" },
  { href: "/pokemon", label: "Pokémon" },
  { href: "/objets", label: "Objets" },
  { href: "/lieux", label: "Lieux" },
] as const;

const BULB_SPRITE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png";

export function HomeLanding() {
  return (
    <div className="catalogue-page gap-10 py-10">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-5">
          <h1 className="font-display text-5xl leading-[1.05] text-balance">
            Le monde Pokémon, en français
          </h1>
          <p className="max-w-[38ch] text-base-content/80">
            Un Pokédex de fan pour feuilleter espèces, objets, cartes et versions — comme sur un
            appareil de poche, mais dans le navigateur.
          </p>
          <nav aria-label="Sections du catalogue" className="flex flex-wrap gap-2 pt-2">
            {SECTION_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="btn btn-outline btn-sm border-base-300 bg-base-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <aside className="rounded-2xl bg-base-300/40 p-6 ring-1 ring-inset ring-base-300">
          <div className="rounded-xl bg-base-100 p-6 shadow-inner">
            <p className="text-xs text-base-content/50">Exemple d’entrée</p>
            <div className="mt-4 flex items-end gap-4">
              <Sprite src={BULB_SPRITE} size={120} />
              <div className="flex flex-col gap-1 pb-2">
                <p className="text-sm text-base-content/60">N° 001</p>
                <p className="font-display text-3xl leading-none">Bulbizarre</p>
                <p className="text-sm">Plante · Poison</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
