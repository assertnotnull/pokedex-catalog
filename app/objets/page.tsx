import type { Metadata } from "next";

export const metadata: Metadata = { title: "Objets" };

export default function ItemsPage() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold">Objets</h1>
      <p className="text-base-content/70">Cette section n’est pas encore disponible.</p>
    </section>
  );
}
