import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function PendingPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logo className="text-2xl" />
        </div>
        <div className="card">
          <div className="text-4xl">🐾</div>
          <h1 className="mt-3 text-xl font-bold">Account created!</h1>
          <p className="mt-2 text-muted">
            Thanks for registering. A Paws Playcare admin will review and
            approve your account shortly. You&apos;ll be able to add a payment
            card and book walks once you&apos;re approved.
          </p>
          <Link href="/login" className="btn-primary mt-6 w-full">
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}
