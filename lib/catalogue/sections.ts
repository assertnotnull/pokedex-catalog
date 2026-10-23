export const SECTIONS = [
  {
    href: "/jeux",
    label: "Jeux",
    description: "Les titres publiés, et le contenu propre à chaque version.",
  },
  {
    href: "/pokemon",
    label: "Pokémon",
    description: "Espèces, types, évolutions et statistiques.",
  },
  {
    href: "/objets",
    label: "Objets",
    description: "Balles, soins, objets rares et objets clés.",
  },
  {
    href: "/lieux",
    label: "Lieux",
    description: "Régions et endroits où les Pokémon apparaissent.",
  },
] as const;

export type Section = (typeof SECTIONS)[number];
