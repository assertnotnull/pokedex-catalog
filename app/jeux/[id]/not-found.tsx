import Link from "next/link";

export default function GameNotFound() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold">Jeu introuvable</h1>
      <p>Cet identifiant ne correspond à aucun jeu du catalogue.</p>
      <p>
        <Link href="/jeux" className="btn btn-primary btn-sm">
          Retour à la liste
        </Link>
      </p>
    </div>
  );
}
