"use client";

import { useActionState } from "react";
import { sendTestEmail } from "./actions";

export function TestEmailButton({ defaultTo }: { defaultTo: string }) {
  const [state, action, pending] = useActionState(sendTestEmail, null);

  return (
    <form action={action} className="card space-y-3">
      <h2 className="text-lg font-bold">Email test</h2>
      <p className="text-sm text-muted">
        Send a test email to confirm Resend is connected (invoices use the same setup).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="to"
          type="email"
          defaultValue={defaultTo}
          placeholder="you@example.com"
          className="input min-w-[220px] flex-1"
        />
        <button className="btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Send test email"}
        </button>
      </div>
      {state?.ok && (
        <p className="text-sm text-success">Sent ✓ — check that inbox (and the spam folder just in case).</p>
      )}
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
