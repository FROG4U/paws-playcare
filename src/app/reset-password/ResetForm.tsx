"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword, type ResetState } from "@/app/forgot-password/actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});

  if (state.ok) {
    return (
      <div className="mt-5 space-y-3">
        <p className="rounded-lg bg-success/15 px-3 py-2.5 text-sm text-success">
          Your password has been updated. You can now log in with your new password.
        </p>
        <Link href="/login" className="btn-primary w-full">Go to login</Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input" placeholder="At least 8 characters" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} className="input" placeholder="Re-enter your password" />
      </div>
      {state.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
