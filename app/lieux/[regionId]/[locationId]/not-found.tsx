import Link from "next/link";

export default function LocationNotFound() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold">Lieu introuvable</h1>
      <p>Ce numéro ne correspond à aucun lieu du catalogue.</p>
      <p>
        <Link href="/lieux" className="btn btn-primary btn-sm">
          Retour aux régions
        </Link>
      </p>
    </div>
  );
}
