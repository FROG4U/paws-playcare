"use client";

import { useActionState, useEffect, useState } from "react";
import { submitContact, type ContactState } from "./actions";
import { EmptyState } from "@/components/ui";

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, {});
  const [ts, setTs] = useState("0");
  useEffect(() => setTs(String(Date.now())), []);

  if (state.ok) {
    return (
      <EmptyState icon="check" title="Message sent — thank you!">
        We&apos;ve got your message and will get back to you soon.
      </EmptyState>
    );
  }

  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">Send us a message</h2>
      {state.error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {/* honeypot: hidden from humans, tempting to bots */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="ts" value={ts} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input name="name" required className="input" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" required className="input" />
        </div>
      </div>
      <div>
        <label className="label">Phone (optional)</label>
        <input name="phone" className="input" />
      </div>
      <div>
        <label className="label">Message</label>
        <textarea name="message" required rows={4} className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
