"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { segment: "pokemon", label: "Pokémon" },
  { segment: "objets", label: "Objets" },
  { segment: "lieux", label: "Lieux" },
] as const;

export function GameHubNav({ gameId }: { gameId: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Contenu du jeu">
      <ul className="menu menu-vertical rounded-box bg-base-100 sm:menu-horizontal">
        {links.map((link) => {
          const href = `/jeux/${gameId}/${link.segment}`;
          const current = pathname === href;
          return (
            <li key={link.segment}>
              <Link
                href={href}
                className={current ? "menu-active" : undefined}
                aria-current={current ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
