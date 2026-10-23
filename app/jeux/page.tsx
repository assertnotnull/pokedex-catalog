import type { Metadata } from "next";

export const metadata: Metadata = { title: "Jeux" };

export default function GamesPage() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold">Jeux</h1>
      <p className="text-base-content/70">Cette section n’est pas encore disponible.</p>
    </section>
  );
}
