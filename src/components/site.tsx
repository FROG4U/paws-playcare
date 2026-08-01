import Link from "next/link";
import { Logo } from "./Logo";
import { Icon } from "./Icon";
import { SiteNavBar, type SiteNavItem } from "./SiteNav";
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

  const items: SiteNavItem[] = [
    ...nav.map((p) => ({
      href: p.slug === "home" ? "/" : `/${p.slug}`,
      label: p.navLabel,
    })),
    { href: "/online-booking-form", label: "Booking Form" },
  ];

  return <SiteNavBar items={items} accountHref={accountHref} />;
}

export async function SiteFooter() {
  const [nav, s] = await Promise.all([getNavPages(), getSettings()]);
  return (
    <footer className="mt-20 bg-slate text-white/90">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3">
        <div className="space-y-2">
          <Logo className="text-lg text-white" />
          <p className="text-sm text-white/70">{s.tagline}</p>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-white/50">Pages</p>
          <ul className="space-y-2">
            {nav.map((p) => (
              <li key={p.slug}>
                <Link href={p.slug === "home" ? "/" : `/${p.slug}`} className="text-sm text-white/80 hover:text-white">
                  {p.navLabel}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/terms" className="text-sm text-white/80 hover:text-white">
                Terms &amp; Conditions
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-white/50">Get in touch</p>
          <ul className="space-y-2 text-sm text-white/80">
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
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/60">
        <Link href="/terms" className="hover:text-white">Terms &amp; Conditions</Link> · © {new Date().getFullYear()} {s.siteName}. All rights reserved.
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
    <section className="relative overflow-hidden">
      {image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/45" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-dark" />
      )}
      <div className="relative mx-auto w-full max-w-4xl px-5 py-20 text-center sm:py-28">
        <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow sm:text-6xl">
          {heading}
        </h1>
        {sub && <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">{sub}</p>}
      </div>
    </section>
  );
}
