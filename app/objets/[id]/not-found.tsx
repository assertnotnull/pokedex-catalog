import Link from "next/link";

export default function ItemNotFound() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold">Objet introuvable</h1>
      <p>Cet identifiant ne correspond à aucun objet du catalogue.</p>
      <p>
        <Link href="/objets" className="btn btn-primary btn-sm">
          Retour à la liste
        </Link>
      </p>
    </div>
  );
}
