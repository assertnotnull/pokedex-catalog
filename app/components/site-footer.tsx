export function SiteFooter() {
  return (
    <footer className="border-t border-base-300 bg-base-100 px-4 py-6 text-sm text-base-content/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <p>
          Données fournies par{" "}
          <a className="link" href="https://pokeapi.co/" target="_blank" rel="noreferrer">
            PokeAPI
          </a>
          .
        </p>
        <p>
          Projet de fan non commercial, sans affiliation avec Nintendo, Game Freak ou The Pokémon
          Company.
        </p>
      </div>
    </footer>
  );
}
