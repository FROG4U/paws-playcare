import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo className="text-2xl" />
        </div>
        <div className="card">
          <h1 className="text-xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">
            Log in to manage your walks and bookings.
          </p>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/register" className="font-semibold text-brand">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
