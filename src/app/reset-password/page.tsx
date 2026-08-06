import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { checkResetToken } from "@/app/forgot-password/actions";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Reset password — Paws Playcare" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = await checkResetToken(token ?? "");

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo className="text-2xl" />
        </div>
        <div className="card">
          <h1 className="text-xl font-bold">Set a new password</h1>
          {valid ? (
            <>
              <p className="mt-1 text-sm text-muted">Choose a new password for your account.</p>
              <ResetForm token={token ?? ""} />
            </>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
                This reset link is invalid or has expired. Reset links last 1 hour and can only be used once.
              </p>
              <Link href="/forgot-password" className="btn-primary w-full">Request a new link</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
