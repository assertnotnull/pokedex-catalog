import Link from "next/link";
import type { ReactNode } from "react";
import { CatalogueImage } from "@/components/list/catalogue-image";
import type { GameDetail } from "@/lib/catalogue/dto";

const HUB_LINKS = [
  { segment: "pokemon", label: "Pokémon" },
  { segment: "objets", label: "Objets" },
  { segment: "lieux", label: "Lieux" },
] as const;

export function GameHubFrame({ game, children }: { game: GameDetail; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-8">
      <p>
        <Link href="/jeux" className="link link-hover">
          Retour à la liste
        </Link>
      </p>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="grid place-items-center rounded-box bg-base-100 p-4 shadow-sm">
          <CatalogueImage src={game.artworkUrl} alt={game.name} size={192} priority />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-base-content/60">{game.generationLabel}</p>
          <h1 className="text-4xl font-semibold">{game.name}</h1>
        </div>
      </header>
      <GameHubNav gameId={game.id} />
      {children}
    </article>
  );
}

export function GameHubNav({ gameId }: { gameId: number }) {
  return (
    <nav aria-label="Dans ce jeu">
      <ul className="menu menu-horizontal w-fit rounded-box bg-base-100 p-1 shadow-sm">
        {HUB_LINKS.map((link) => (
          <li key={link.segment}>
            <Link href={`/jeux/${gameId}/${link.segment}`}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function GameHubUnfiltered({ section }: { section: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold">{section}</h2>
      <p className="text-base-content/70">Cette liste n’est pas encore filtrée pour cette version.</p>
    </section>
  );
}
