"use client";

import { useState, useTransition } from "react";
import { cancelFieldBooking } from "../actions";

export function CancelButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn-ghost text-xs text-danger">
        Cancel
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button
        onClick={() => start(() => cancelFieldBooking(id))}
        disabled={pending}
        className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white"
      >
        {pending ? "…" : "Confirm cancel"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-xs text-muted">
        Keep
      </button>
    </span>
  );
}
