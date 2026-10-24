import Link from "next/link";

export default function PokemonNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <h1 className="font-display text-4xl">Pokémon introuvable</h1>
      <p>Ce numéro ne correspond à aucun Pokémon du catalogue.</p>
      <Link href="/pokemon" className="btn btn-primary w-fit">
        Retour à la liste
      </Link>
    </div>
  );
}
