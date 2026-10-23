import Link from "next/link";

export default function PokemonNotFound() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold">Pokémon introuvable</h1>
      <p>Ce numéro ne correspond à aucune espèce du catalogue.</p>
      <p>
        <Link href="/pokemon" className="btn btn-primary btn-sm">
          Retour à la liste
        </Link>
      </p>
    </div>
  );
}
