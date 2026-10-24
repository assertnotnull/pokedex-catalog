import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <h1 className="font-display text-4xl">Page introuvable</h1>
      <p>Cette adresse ne correspond à aucune page du catalogue.</p>
      <Link href="/" className="btn btn-primary w-fit">
        Retour à l’accueil
      </Link>
    </div>
  );
}
