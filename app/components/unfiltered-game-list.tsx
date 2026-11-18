export function UnfilteredGameList({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-2xl">{title}</h2>
      <p>Cette liste n’est pas encore filtrée pour ce jeu.</p>
    </section>
  );
}
