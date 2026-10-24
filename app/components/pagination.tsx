import Link from "next/link";
import type { ReactNode } from "react";

export function Pagination({
  page,
  total,
  pageSize,
}: {
  page: number;
  total: number;
  pageSize: number;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  const items = pageWindow(page, last);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2">
      <PageLink page={page - 1} disabled={page <= 1}>
        Page précédente
      </PageLink>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} className="px-1 text-base-content/50" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <PageLink page={item} current={item === page}>
                {item}
              </PageLink>
            </li>
          ),
        )}
      </ol>
      <PageLink page={page + 1} disabled={page >= last}>
        Page suivante
      </PageLink>
    </nav>
  );
}

function PageLink({
  page,
  disabled = false,
  current = false,
  children,
}: {
  page: number;
  disabled?: boolean;
  current?: boolean;
  children: ReactNode;
}) {
  const className = current ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost";
  if (disabled) {
    return (
      <span className={`${className} btn-disabled`} aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={page === 1 ? "/pokemon" : `/pokemon?page=${page}`}
      className={className}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

function pageWindow(current: number, last: number): (number | "gap")[] {
  const wanted = new Set<number>([1, last, current - 2, current - 1, current, current + 1, current + 2]);
  const pages = [...wanted].filter((page) => page >= 1 && page <= last).sort((left, right) => left - right);
  const items: (number | "gap")[] = [];
  for (const page of pages) {
    const previous = items.at(-1);
    if (typeof previous === "number" && page - previous > 1) {
      items.push("gap");
    }
    items.push(page);
  }
  return items;
}
