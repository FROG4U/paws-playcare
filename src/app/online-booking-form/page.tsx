import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { LoginForm } from "@/app/login/LoginForm";

export const metadata: Metadata = {
  title: "Book online — Paws Playcare Watford",
  description: "Log in or create an account to book dog walking and play with Paws Playcare Watford.",
};

export default async function OnlineBookingForm() {
  const session = await getSession();
  if (session) {
    // Clients came here to book — take them straight to the calendar.
    redirect(session.role === ROLES.CLIENT ? "/client/book" : "/dashboard");
  }
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/">
          <Logo className="text-xl" />
        </Link>
        <Link href="/" className="text-sm font-semibold text-muted hover:text-brand-dark">
          ← Back to home
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 px-5 py-8 md:grid-cols-2">
        {/* New clients */}
        <div className="space-y-4">
          <span className="badge bg-brand-soft text-brand-dark">
            <Icon name="paw" className="h-3.5 w-3.5" />
            New to Paws Playcare?
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Book your dog&apos;s first walk</h1>
          <p className="text-muted">
            Create an account, tell us about your dog, and once you&apos;re approved you can book
            walks and play sessions online — with payment collected automatically.
          </p>
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            <Icon name="userPlus" className="h-5 w-5" />
            Create an account
          </Link>
        </div>

        {/* Returning clients */}
        <div className="card">
          <h2 className="text-xl font-bold">Log in</h2>
          <p className="mt-1 text-sm text-muted">Already have an account? Welcome back.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
