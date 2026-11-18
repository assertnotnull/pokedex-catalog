"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { segment: "pokemon", label: "Pokémon" },
  { segment: "objets", label: "Objets" },
  { segment: "lieux", label: "Lieux" },
] as const;

export function GameHubNav({ gameId }: { gameId: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dans ce jeu">
      <ul className="menu menu-horizontal w-fit rounded-box bg-base-100">
        {sections.map((section) => {
          const href = `/jeux/${gameId}/${section.segment}`;
          return (
            <li key={section.segment}>
              <Link href={href} className={pathname === href ? "menu-active" : undefined}>
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
