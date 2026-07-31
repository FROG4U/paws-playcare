import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Logo className="text-xl" />
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/register" className="btn-primary">
            Register
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-5 py-16 text-center">
        <div className="space-y-5">
          <span className="badge bg-brand-soft text-brand-dark">
            <Icon name="paw" className="h-3.5 w-3.5" />
            Trusted local dog walking
          </span>
          <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Happy dogs, effortless bookings.
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted">
            Book walks, manage your dog&apos;s care and pay automatically — all
            in one place. Choose one-off or repeat walks and pay daily, weekly
            or monthly.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/register" className="btn-primary px-6 py-3 text-base">
              Create an account
            </Link>
            <Link href="/login" className="btn-outline px-6 py-3 text-base">
              I already have an account
            </Link>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-3">
          {[
            {
              icon: "calendar",
              title: "Book in seconds",
              body: "Pick one-off or repeating walks from an easy calendar.",
            },
            {
              icon: "footprints",
              title: "Trusted walkers",
              body: "Every walk is assigned to a vetted Paws Playcare walker.",
            },
            {
              icon: "card",
              title: "Automatic payments",
              body: "Detailed invoices, charged to your card on your schedule.",
            },
          ].map((f) => (
            <div key={f.title} className="card text-left">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Icon name={f.icon} className="h-[1.35rem] w-[1.35rem]" />
              </span>
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 py-8 text-center text-sm text-muted">
        © {new Date().getFullYear()} Paws Playcare · Dog walking
      </footer>
    </div>
  );
}
