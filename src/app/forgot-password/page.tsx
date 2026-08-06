import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Forgot password — Paws Playcare" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo className="text-2xl" />
        </div>
        <div className="card">
          <h1 className="text-xl font-bold">Forgot your password?</h1>
          <p className="mt-1 text-sm text-muted">
            Enter your email and we&apos;ll send you a link to set a new one.
          </p>
          <ForgotForm />
        </div>
      </div>
    </div>
  );
}
