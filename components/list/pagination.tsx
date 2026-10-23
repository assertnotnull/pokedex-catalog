import Link from "next/link";
import type { ReactNode } from "react";

export function Pagination({
  page,
  pageSize,
  total,
  hrefForPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const items = visiblePages(current, totalPages);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2">
      <PageLink href={hrefForPage(current - 1)} disabled={current <= 1}>
        Précédent
      </PageLink>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} className="px-1 text-base-content/50" aria-hidden>
              …
            </li>
          ) : (
            <li key={item}>
              <PageLink href={hrefForPage(item)} current={item === current}>
                {item}
              </PageLink>
            </li>
          ),
        )}
      </ol>
      <PageLink href={hrefForPage(current + 1)} disabled={current >= totalPages}>
        Suivant
      </PageLink>
      <p className="basis-full text-center text-sm text-base-content/70">
        Page {current} sur {totalPages}
      </p>
    </nav>
  );
}

function PageLink({
  href,
  disabled = false,
  current = false,
  children,
}: {
  href: string;
  disabled?: boolean;
  current?: boolean;
  children: ReactNode;
}) {
  const className = `btn btn-sm ${current ? "btn-primary" : "btn-ghost"}`;
  if (disabled) {
    return (
      <span className={`${className} btn-disabled`} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

function visiblePages(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const wanted = new Set([1, total, current - 2, current - 1, current, current + 1, current + 2]);
  const sorted = [...wanted].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  for (const page of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1) result.push("gap");
    result.push(page);
  }
  return result;
}
