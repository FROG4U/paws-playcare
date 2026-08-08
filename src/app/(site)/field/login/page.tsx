import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { LoginForm } from "@/app/login/LoginForm";

export const metadata: Metadata = {
  title: "Field account login — Paws Playcare",
  description: "Log in to your Paws Playcare field-hire account to see your bookings.",
};

// Separate login entry for field/playground customers (distinct from the
// dog-walking client login). Sign-in routes field clients to /field-account.
export default async function FieldLoginPage() {
  const session = await getSession();
  if (session) {
    redirect(
      session.role === ROLES.FIELD_CLIENT
        ? "/field-account"
        : session.role === ROLES.ADMIN
        ? "/admin"
        : session.role === ROLES.WORKER
        ? "/worker"
        : "/client"
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-14">
      <div className="card">
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <Icon name="calendar" className="h-[1.15rem] w-[1.15rem]" />
          </span>
          <h1 className="text-xl font-bold">Field account login</h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          Sign in to see your playground bookings, details and saved card.
        </p>
        <LoginForm />
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/field" className="font-semibold text-brand">
          Book the field
        </Link>{" "}
        — you can create an account at checkout, or check out as a guest.
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        Booking dog walking instead?{" "}
        <Link href="/online-booking-form" className="font-semibold text-brand">
          Dog-walking login
        </Link>
      </p>
    </div>
  );
}
