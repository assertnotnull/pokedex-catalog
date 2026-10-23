import Link from "next/link";
import { SECTIONS } from "@/lib/catalogue/sections";

export function SectionNav({ className }: { className: string }) {
  return (
    <ul className={className}>
      {SECTIONS.map((section) => (
        <li key={section.href}>
          <Link href={section.href}>{section.label}</Link>
        </li>
      ))}
    </ul>
  );
}
