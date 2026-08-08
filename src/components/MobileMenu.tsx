"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { Icon } from "./Icon";
import { SideNav, type NavItem } from "./NavLink";
import { InstallMenuButton } from "./pwa";
import { EnablePushButton } from "./PushNotifications";
import { logoutAction } from "@/app/actions/auth";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// Full slide-out menu for mobile / installed-app view, so every menu item is
// reachable (the bottom bar only shows the first few). Desktop keeps its
// permanent sidebar; this is hidden there (md:hidden on the trigger).
export function MobileMenu({
  items,
  user,
}: {
  items: NavItem[];
  user: { name: string; role: string };
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Close the drawer whenever the route changes (i.e. a menu item was tapped).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand-dark md:hidden"
      >
        <Icon name="menu" className="h-6 w-6" />
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-soft"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <SideNav items={items} />
              <div className="mt-3 space-y-1">
                <InstallMenuButton variant="sidebar" />
                <EnablePushButton publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""} />
              </div>
            </div>

            <div className="border-t border-border p-3">
              <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">
                  {initials(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs capitalize text-muted">{user.role.toLowerCase()}</p>
                </div>
                <form action={logoutAction}>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger"
                    aria-label="Log out"
                    title="Log out"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-[1.15rem] w-[1.15rem]">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5M21 12H9" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
