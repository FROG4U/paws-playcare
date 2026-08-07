"use client";

import { useState, useTransition } from "react";
import { requestPause, cancelPauseRequest } from "@/app/actions/client";

// A committed plan can only be paused by an admin — the client requests it.
export function RequestPauseButton({ requested }: { requested: boolean }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (requested) {
    return (
      <button
        className="btn-outline"
        disabled={pending}
        onClick={() => start(() => cancelPauseRequest())}
        title="Withdraw your pause request"
      >
        {pending ? "…" : "Cancel pause request"}
      </button>
    );
  }

  if (!open) {
    return (
      <button className="btn-outline" onClick={() => setOpen(true)}>
        Request a pause
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-2 rounded-xl border border-border bg-surface p-3">
      <p className="text-sm font-semibold">Ask us to pause your walks</p>
      <textarea
        className="input"
        rows={2}
        placeholder="Optional — anything we should know? (e.g. away for 2 weeks)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() => start(async () => { await requestPause(reason); setOpen(false); })}
        >
          {pending ? "Sending…" : "Send request"}
        </button>
        <button className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  );
}
