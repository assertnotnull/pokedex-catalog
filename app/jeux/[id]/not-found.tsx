import Link from "next/link";

export default function GameNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <h1 className="font-display text-4xl">Jeu introuvable</h1>
      <p>Cet identifiant ne correspond à aucun jeu du catalogue.</p>
      <Link href="/jeux" className="btn btn-primary w-fit">
        Retour à la liste
      </Link>
    </div>
  );
}
