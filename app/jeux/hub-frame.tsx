import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CatalogueUnavailable } from "../components/catalogue-unavailable";
import { Sprite } from "../components/sprite";
import { getCatalogueGateway } from "@/src/catalogue/composition";
import type { GameDetail } from "@/src/catalogue/catalogue-gateway";
import { CatalogueUnavailableError, UnknownGameError } from "@/src/catalogue/errors";

export type GameHubSection = "apercu" | "pokemon" | "objets" | "lieux";

const sections: readonly {
  id: Exclude<GameHubSection, "apercu">;
  path: string;
  label: string;
}[] = [
  { id: "pokemon", path: "/pokemon", label: "Pokémon" },
  { id: "objets", path: "/objets", label: "Objets" },
  { id: "lieux", path: "/lieux", label: "Lieux" },
];

export async function GameHubFrame({
  params,
  current,
  children,
}: {
  params: Promise<{ id: string }>;
  current: GameHubSection;
  children: ReactNode;
}) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) {
    notFound();
  }

  const game = await loadGame(Number(id));
  if (game === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <CatalogueUnavailable />
      </div>
    );
  }

  const section = sections.find((item) => item.id === current);

  return (
    <div className="catalogue-page">
      <div className="breadcrumbs">
        <ul>
          <li>
            <Link href="/jeux">Jeux</Link>
          </li>
          <li>
            {current === "apercu" ? (
              game.frenchName
            ) : (
              <Link href={`/jeux/${game.id}`}>{game.frenchName}</Link>
            )}
          </li>
          {section ? <li>{section.label}</li> : null}
        </ul>
      </div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Sprite src={game.artworkUrl} size={160} />
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-5xl leading-none">{game.frenchName}</h1>
          <p>
            <span className="badge badge-outline">{game.label}</span>
          </p>
        </div>
      </header>
      <nav aria-label="Contenu du jeu">
        <ul className="menu menu-horizontal flex-wrap">
          {sections.map((item) => (
            <li key={item.id}>
              <Link
                href={`/jeux/${game.id}${item.path}`}
                aria-current={item.id === current ? "page" : undefined}
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}

export function GameHubPending({ title, message }: { title: string; message: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-2xl">{title}</h2>
      <p>{message}</p>
    </section>
  );
}

async function loadGame(id: number): Promise<GameDetail | "unavailable"> {
  try {
    return await getCatalogueGateway().getGame(id);
  } catch (error) {
    if (error instanceof UnknownGameError) {
      notFound();
    }
    if (error instanceof CatalogueUnavailableError) {
      return "unavailable";
    }
    throw error;
  }
}
