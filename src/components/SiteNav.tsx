"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SiteNavItem = { href: string; label: string };

export function SiteNav({ items }: { items: SiteNavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex max-w-6xl items-stretch justify-center overflow-x-auto px-2">
      {items.map((it) => {
        const active =
          it.href === "/" ? pathname === "/" : pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap px-5 py-4 text-sm font-semibold tracking-wide transition ${
              active
                ? "bg-brand text-white"
                : "text-white/85 hover:bg-white/10 hover:text-white"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
