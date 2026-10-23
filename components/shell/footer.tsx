export function Footer() {
  return (
    <footer className="mt-auto border-t border-base-300 bg-base-100 px-4 py-6 text-center text-sm text-base-content/70">
      <p>
        Données fournies par{" "}
        <a className="link" href="https://pokeapi.co/" target="_blank" rel="noopener noreferrer">
          PokeAPI
        </a>
        .
      </p>
      <p className="mt-1">
        Projet de fan non commercial. Ce catalogue n’est pas affilié à Nintendo, Game Freak ou The Pokémon Company.
      </p>
    </footer>
  );
}
