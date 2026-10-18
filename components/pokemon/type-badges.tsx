const TYPE_BADGE: Record<string, string> = {
  Normal: "bg-stone-400 text-stone-950 border-transparent",
  Combat: "bg-red-700 text-white border-transparent",
  Vol: "bg-indigo-400 text-white border-transparent",
  Poison: "bg-purple-600 text-white border-transparent",
  Sol: "bg-amber-700 text-white border-transparent",
  Roche: "bg-yellow-800 text-white border-transparent",
  Insecte: "bg-lime-600 text-white border-transparent",
  Spectre: "bg-violet-800 text-white border-transparent",
  Acier: "bg-slate-400 text-slate-950 border-transparent",
  Feu: "bg-orange-600 text-white border-transparent",
  Eau: "bg-blue-600 text-white border-transparent",
  Électrik: "bg-yellow-400 text-yellow-950 border-transparent",
  Psy: "bg-pink-500 text-white border-transparent",
  Glace: "bg-cyan-300 text-cyan-950 border-transparent",
  Dragon: "bg-indigo-700 text-white border-transparent",
  Ténèbres: "bg-stone-800 text-white border-transparent",
  Fée: "bg-pink-300 text-pink-950 border-transparent",
  Plante: "bg-green-600 text-white border-transparent",
};

export function TypeBadges({ types }: { types: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1">
      {types.map((type) => (
        <li key={type} className={`badge badge-sm ${TYPE_BADGE[type] ?? "badge-ghost"}`}>
          {type}
        </li>
      ))}
    </ul>
  );
}
