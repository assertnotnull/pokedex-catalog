"use client";

export default function CatalogueError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="catalogue-page gap-4">
      <h1 className="font-display text-4xl">Le catalogue a rencontré un problème</h1>
      <p>Les données n’ont pas pu être affichées.</p>
      <button type="button" className="btn btn-primary w-fit" onClick={() => reset()}>
        Réessayer
      </button>
    </div>
  );
}
