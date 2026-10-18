import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold">Page introuvable</h1>
      <p>Cette adresse ne correspond à aucune page du catalogue.</p>
      <p>
        <Link href="/" className="btn btn-primary btn-sm">
          Retour à l’accueil
        </Link>
      </p>
    </div>
  );
}
