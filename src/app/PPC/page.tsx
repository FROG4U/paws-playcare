import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/app/login/LoginForm";

export const metadata: Metadata = {
  title: "Staff login — Paws Playcare",
  robots: { index: false, follow: false },
};

export default async function StaffLogin() {
  if (await getSession()) redirect("/dashboard");
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
        </div>
        <div className="card">
          <div className="mb-1 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
              <Icon name="footprints" className="h-[1.15rem] w-[1.15rem]" />
            </span>
            <h1 className="text-xl font-bold">Staff login</h1>
          </div>
          <p className="mt-1 text-sm text-muted">Admins and walkers sign in here.</p>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Are you a client?{" "}
          <Link href="/online-booking-form" className="font-semibold text-brand">
            Book / log in here
          </Link>
        </p>
      </div>
    </div>
  );
}
