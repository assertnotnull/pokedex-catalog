"use client";

export default function CatalogueError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <h1 className="font-display text-4xl">Le catalogue a rencontré un problème</h1>
      <p>Les données n’ont pas pu être affichées.</p>
      <button type="button" className="btn btn-primary w-fit" onClick={() => reset()}>
        Réessayer
      </button>
    </div>
  );
}
