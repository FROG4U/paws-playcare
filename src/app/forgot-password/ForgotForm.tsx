"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, {});

  if (state.done) {
    return (
      <div className="mt-5 space-y-3">
        <p className="rounded-lg bg-success/15 px-3 py-2.5 text-sm text-success">
          If that email is registered, we&apos;ve sent a link to reset your password. Please check your inbox
          (and spam) — the link expires in 1 hour.
        </p>
        <Link href="/login" className="btn-outline w-full">Back to login</Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-5 space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" />
      </div>
      {state.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Sending…" : "Email me a reset link"}
      </button>
    </form>
  );
}
