"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export type SiteNavItem = { href: string; label: string };

export function SiteNavBar({
  items,
  accountHref,
}: {
  items: SiteNavItem[];
  accountHref: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href;

  const AccountCta = ({ full }: { full?: boolean }) =>
    accountHref ? (
      <Link href={accountHref} onClick={() => setOpen(false)} className={`btn-primary ${full ? "w-full py-3" : ""}`}>
        <Icon name="user" className="h-4 w-4" />
        My account
      </Link>
    ) : (
      <Link href="/online-booking-form" onClick={() => setOpen(false)} className={`btn-primary ${full ? "w-full py-3" : ""}`}>
        <Icon name="calendar" className="h-4 w-4" />
        Book / Log in
      </Link>
    );

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition ${
          scrolled ? "bg-surface/90 shadow-sm backdrop-blur" : "bg-surface"
        } border-b border-border`}
      >
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5">
          <Link href="/" aria-label="Paws Playcare home" onClick={() => setOpen(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.webp" alt="Paws Playcare" className="h-14 w-auto sm:h-16" />
          </Link>

          {/* Desktop floating pill nav */}
          <nav className="hidden items-center gap-0.5 rounded-full border border-border bg-mist p-1 lg:flex">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                    active ? "bg-brand text-white shadow-sm" : "text-charcoal/70 hover:bg-surface hover:text-brand-dark"
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:block">
            <AccountCta />
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface text-charcoal lg:hidden"
          >
            <Icon name={open ? "x" : "menu"} className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Full-screen mobile menu */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[76px] z-30 overflow-y-auto bg-surface px-5 pb-10 pt-4 lg:hidden">
          <nav className="flex flex-col">
            {items.map((it, i) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-baseline gap-4 border-b border-border py-4 text-2xl font-extrabold tracking-tight ${
                    active ? "text-brand" : "text-foreground"
                  }`}
                >
                  <span className="text-xs font-medium text-muted">{String(i + 1).padStart(2, "0")}</span>
                  {it.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8">
            <AccountCta full />
          </div>
        </div>
      )}
    </>
  );
}
