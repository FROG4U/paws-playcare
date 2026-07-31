"use client";

import { useActionState } from "react";
import { loginAction, type AuthState } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    loginAction,
    {}
  );

  return (
    <form action={action} className="mt-5 space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          placeholder="••••••••"
        />
      </div>
      {state.error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
