"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { setUpRegularWalks } from "./actions";

// Shown on a client who has no walks yet: books the regular schedule they
// asked for at sign-up, starting today, on their pay cycle.
export function SetUpWalks({
  clientId,
  slots,
  hasCard,
  cadenceWord,
}: {
  clientId: string;
  slots: string[];
  hasCard: boolean;
  cadenceWord: string; // "weekly" / "daily" / "monthly"
}) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    start(async () => {
      const res = await setUpRegularWalks(clientId);
      if (res.ok) setDone(res.message);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="card space-y-1 border-brand/30 bg-brand-soft/40 text-sm">
        <p className="font-semibold text-brand-dark">Regular walks set up ✓</p>
        <p className="text-muted">{done}</p>
      </div>
    );
  }

  return (
    <div className="card space-y-2 text-sm">
      <p className="text-muted">No walks for this client yet.</p>
      <p>
        They asked for{" "}
        <strong>{slots.join(", ")}</strong> at sign-up — set these up as a repeat
        booking from today, billed {cadenceWord}. Past dates are never added.
      </p>

      {!hasCard ? (
        <p className="flex items-start gap-1.5 text-warn">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          No payment card on file yet — add a card before setting up their walks.
        </p>
      ) : (
        <button onClick={run} disabled={pending} className="btn-primary text-sm disabled:opacity-50">
          {pending ? "Setting up…" : "Set up their regular walks"}
        </button>
      )}

      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
