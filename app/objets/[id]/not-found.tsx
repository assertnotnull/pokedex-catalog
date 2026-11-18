import Link from "next/link";

export default function ItemNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-col">
      <h1 className="font-display text-4xl">Objet introuvable</h1>
      <p>Ce numéro ne correspond à aucun objet du catalogue.</p>
      <Link href="/objets" className="btn btn-primary w-fit">
        Retour à la liste
      </Link>
    </div>
  );
}
