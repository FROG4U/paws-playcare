"use client";

import { useState, useTransition } from "react";
import { closeDay, reopenDay } from "./actions";

export function CloseDayForm() {
  const [pending, start] = useTransition();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function submit() {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await closeDay(date, reason);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(
        res.cancelled === 0
          ? "Day closed — no walks were booked that day."
          : `Day closed — ${res.cancelled} walk${res.cancelled === 1 ? "" : "s"} cancelled (no charge) and ${res.clients} client${res.clients === 1 ? "" : "s"} emailed.`
      );
      setDate("");
      setReason("");
    });
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-bold">Close a day</h2>
      <p className="-mt-1 text-xs text-muted">
        Cancels every walk on that day (no charge), emails the affected clients your reason, and
        stops new walks being scheduled on it.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Reason (clients see this)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
            placeholder="e.g. I'm not working today — feeling unwell"
          />
        </label>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {done && <p className="text-sm text-success">{done}</p>}
      <button onClick={submit} disabled={pending || !date || !reason.trim()} className="btn-primary">
        {pending ? "Closing…" : "Close day & notify clients"}
      </button>
    </div>
  );
}

export function ReopenButton({ dateKey }: { dateKey: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await reopenDay(dateKey); })}
      disabled={pending}
      className="btn-ghost text-sm text-brand"
    >
      {pending ? "…" : "Reopen"}
    </button>
  );
}
