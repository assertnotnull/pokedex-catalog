"use client";

import { useEffect } from "react";

export default function CatalogueError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="alert alert-error flex-col items-start gap-3">
      <span>Une erreur inattendue a interrompu l’affichage.</span>
      <button type="button" className="btn btn-sm" onClick={() => retry()}>
        Réessayer
      </button>
    </div>
  );
}
