"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  // Optional group heading. When an item's section differs from the previous
  // item's, the sidebar renders a small divider label above it.
  section?: string;
};

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/admin" || href === "/worker" || href === "/client"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
}

export function SideNav({ items }: { items: NavItem[] }) {
  const isActive = useActive();
  let lastSection: string | undefined;
  return (
    <nav className="space-y-0.5">
      {items.map((it) => {
        const active = isActive(it.href);
        const showSection = it.section && it.section !== lastSection;
        lastSection = it.section ?? lastSection;
        return (
          <div key={it.href}>
            {showSection && (
              <p className="px-3 pb-1 pt-4 text-[0.6rem] font-bold uppercase tracking-wider text-muted/60">
                {it.section}
              </p>
            )}
          <Link
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9rem] font-medium transition ${
              active
                ? "bg-brand text-white shadow-sm shadow-brand/25"
                : "text-muted hover:bg-brand-soft hover:text-brand-dark"
            }`}
          >
            <Icon
              name={it.icon}
              className={`h-[1.15rem] w-[1.15rem] shrink-0 ${
                active ? "text-white" : "text-muted group-hover:text-brand"
              }`}
            />
            <span className="flex-1 tracking-tight">{it.label}</span>
            {it.badge ? (
              <span
                className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold ${
                  active ? "bg-white text-brand" : "bg-danger text-white"
                }`}
              >
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            ) : null}
          </Link>
          </div>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const isActive = useActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.slice(0, 5).map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition ${
              active ? "text-brand" : "text-muted"
            }`}
          >
            <span
              className={`relative grid h-8 w-14 place-items-center rounded-full transition ${
                active ? "bg-brand-soft" : ""
              }`}
            >
              <Icon name={it.icon} className="h-[1.35rem] w-[1.35rem]" />
              {it.badge ? (
                <span className="absolute right-2 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                  {it.badge > 9 ? "9+" : it.badge}
                </span>
              ) : null}
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
