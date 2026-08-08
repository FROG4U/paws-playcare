import Link from "next/link";
import { Logo } from "./Logo";
import { Icon } from "./Icon";
import { SideNav, BottomNav, type NavItem } from "./NavLink";
import { InstallMenuButton } from "./pwa";
import { MobileMenu } from "./MobileMenu";
import { EnablePushButton, AppBadge } from "./PushNotifications";
import { logoutAction } from "@/app/actions/auth";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AppShell({
  user,
  items,
  unread,
  notifHref,
  children,
}: {
  user: { name: string; role: string };
  items: NavItem[];
  unread: number;
  notifHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted/70">
            Menu
          </p>
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
              <p className="text-xs capitalize text-muted">{user.role.toLowerCase()}</p>
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

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-1">
          <MobileMenu items={items} user={user} />
          <Logo />
        </div>
        <div className="flex items-center gap-1.5">
          <InstallMenuButton variant="chip" />
          <NotifBell unread={unread} href={notifHref} />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 pb-20 md:pb-0">
        {/* Desktop header with notifications */}
        <div className="hidden h-16 items-center justify-end border-b border-border bg-surface px-6 md:flex">
          <NotifBell unread={unread} href={notifHref} />
        </div>
        <div className="mx-auto w-full max-w-5xl p-4 md:p-6">{children}</div>
      </main>

      <BottomNav items={items} />
      <AppBadge count={unread} />
    </div>
  );
}

function NotifBell({ unread, href }: { unread: number; href: string }) {
  return (
    <Link
      href={href}
      className="relative grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-brand-soft hover:text-brand-dark"
      aria-label="Notifications"
    >
      <Icon name="bell" className="h-[1.3rem] w-[1.3rem]" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
