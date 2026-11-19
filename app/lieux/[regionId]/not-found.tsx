import Link from "next/link";

export default function RegionNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <h1 className="font-display text-4xl">Région introuvable</h1>
      <p>Ce numéro ne correspond à aucune région du catalogue.</p>
      <Link href="/lieux" className="btn btn-primary w-fit">
        Retour aux lieux
      </Link>
    </div>
  );
}
