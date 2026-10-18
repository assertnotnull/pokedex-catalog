import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lieux" };

export default function LocationsPage() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold">Lieux</h1>
      <p className="text-base-content/70">Cette section n’est pas encore disponible.</p>
    </section>
  );
}
