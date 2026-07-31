import Link from "next/link";
import { Logo } from "./Logo";
import { Icon } from "./Icon";
import { getNavPages } from "@/lib/pages";
import { getSettings } from "@/lib/pricing";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export async function SiteHeader() {
  const [nav, session] = await Promise.all([getNavPages(), getSession()]);
  const accountHref =
    session?.role === ROLES.ADMIN
      ? "/admin"
      : session?.role === ROLES.WORKER
      ? "/worker"
      : session?.role === ROLES.CLIENT
      ? "/client"
      : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="Paws Playcare home">
          <Logo className="text-xl" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((p) => (
            <Link
              key={p.slug}
              href={p.slug === "home" ? "/" : `/${p.slug}`}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-brand-soft hover:text-brand-dark"
            >
              {p.navLabel}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {accountHref ? (
            <Link href={accountHref} className="btn-primary">
              My account
            </Link>
          ) : (
            <>
              <Link href="/PPC" className="hidden text-sm font-semibold text-muted hover:text-brand-dark sm:inline">
                Staff
              </Link>
              <Link href="/online-booking-form" className="btn-primary">
                <Icon name="calendar" className="h-4 w-4" />
                Book / Log in
              </Link>
            </>
          )}
        </div>
      </div>
      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
        {nav.map((p) => (
          <Link
            key={p.slug}
            href={p.slug === "home" ? "/" : `/${p.slug}`}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-brand-soft"
          >
            {p.navLabel}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export async function SiteFooter() {
  const [nav, s] = await Promise.all([getNavPages(), getSettings()]);
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3">
        <div className="space-y-2">
          <Logo className="text-lg" />
          <p className="text-sm text-muted">{s.tagline}</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted/70">Pages</p>
          <ul className="space-y-1.5">
            {nav.map((p) => (
              <li key={p.slug}>
                <Link href={p.slug === "home" ? "/" : `/${p.slug}`} className="text-sm text-muted hover:text-brand-dark">
                  {p.navLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted/70">Get in touch</p>
          <ul className="space-y-1.5 text-sm text-muted">
            {s.contactEmail && (
              <li className="flex items-center gap-2"><Icon name="mail" className="h-4 w-4" />{s.contactEmail}</li>
            )}
            {s.contactPhone && (
              <li className="flex items-center gap-2"><Icon name="phone" className="h-4 w-4" />{s.contactPhone}</li>
            )}
            {s.address && (
              <li className="flex items-center gap-2"><Icon name="mapPin" className="h-4 w-4" />{s.address}</li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} {s.siteName} · Dog walking &amp; play
      </div>
    </footer>
  );
}

export function PageHero({
  heading,
  sub,
  image,
}: {
  heading: string;
  sub?: string | null;
  image?: string | null;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-brand-soft">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className={`absolute inset-0 ${image ? "bg-brand-dark/55" : ""}`} />
      <div className="relative mx-auto w-full max-w-4xl px-5 py-16 text-center sm:py-24">
        <h1 className={`text-3xl font-extrabold tracking-tight sm:text-5xl ${image ? "text-white" : "text-brand-dark"}`}>
          {heading}
        </h1>
        {sub && (
          <p className={`mx-auto mt-3 max-w-2xl text-lg ${image ? "text-white/90" : "text-brand-dark/80"}`}>
            {sub}
          </p>
        )}
      </div>
    </section>
  );
}
