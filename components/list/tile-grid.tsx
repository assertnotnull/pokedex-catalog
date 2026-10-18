import Link from "next/link";
import type { ReactNode } from "react";
import { CatalogueImage } from "@/components/list/catalogue-image";

export type CatalogueTile = {
  href: string;
  imageUrl: string | null;
  imageAlt: string;
  kicker: string;
  title: string;
  tags: ReactNode;
};

export function TileGrid({ tiles, emptyLabel }: { tiles: CatalogueTile[]; emptyLabel: string }) {
  if (tiles.length === 0) {
    return <p className="text-base-content/70">{emptyLabel}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <li key={tile.href}>
          <Link
            href={tile.href}
            className="card h-full bg-base-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <figure className="px-4 pt-4">
              <CatalogueImage src={tile.imageUrl} alt={tile.imageAlt} size={96} />
            </figure>
            <div className="card-body gap-2 p-4">
              <p className="text-xs text-base-content/60">{tile.kicker}</p>
              <h2 className="card-title text-base">{tile.title}</h2>
              {tile.tags}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
