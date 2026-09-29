"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { requestSlotChange, withdrawSlotChange } from "./actions";

// The client's own view of their regular days. They can propose a change -
// drop one, add one, or swap - but an admin has to approve it before anything
// moves, so their bill never changes without someone saying yes.
export function RegularDaysRequest({
  options,
  current,
  pending,
}: {
  options: string[];
  current: string[];
  pending: { requested: string[]; note: string | null } | null;
}) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>(current);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const dirty = JSON.stringify([...slots].sort()) !== JSON.stringify([...current].sort());
  const spare = options.filter((o) => !slots.includes(o));

  function send() {
    setError(null);
    start(async () => {
      const res = await requestSlotChange(slots, note);
      if (res.ok) {
        setSent(res.message);
        setOpen(false);
      } else setError(res.error);
    });
  }

  if (pending) {
    return (
      <section className="card space-y-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Icon name="hourglass" className="h-5 w-5 text-warn" />
          Day change waiting for approval
        </h2>
        <p className="text-sm">
          You&apos;ve asked for:{" "}
          <strong>{pending.requested.length ? pending.requested.join(", ") : "no regular days"}</strong>
        </p>
        {pending.note && <p className="text-sm text-muted">&ldquo;{pending.note}&rdquo;</p>}
        <p className="text-sm text-muted">
          Your walks and your bill stay exactly as they are until we approve it.
        </p>
        <button
          onClick={() => start(async () => { await withdrawSlotChange(); })}
          disabled={busy}
          className="btn-ghost self-start text-sm disabled:opacity-50"
        >
          {busy ? "Withdrawing..." : "Withdraw request"}
        </button>
      </section>
    );
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Icon name="calendar" className="h-5 w-5 text-brand" />
          Your regular days
        </h2>
        {!open ? (
          <button onClick={() => { setOpen(true); setSent(null); }} className="btn-outline text-sm">
            Request a change
          </button>
        ) : (
          <button
            onClick={() => { setSlots(current); setNote(""); setOpen(false); setError(null); }}
            className="btn-ghost text-sm"
          >
            Cancel
          </button>
        )}
      </div>

      {current.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {(open ? slots : current).map((s) => (
            <span key={s} className="badge bg-brand-soft text-brand-dark">
              {s}
              {open && (
                <button
                  type="button"
                  onClick={() => setSlots((prev) => prev.filter((x) => x !== s))}
                  aria-label={`Remove ${s}`}
                  className="ml-1 text-brand hover:text-danger"
                >
                  <Icon name="x" className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">You haven&apos;t got any regular days set up.</p>
      )}

      {open && (
        <div className="space-y-3">
          {spare.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">Add a day</p>
              <div className="flex flex-wrap gap-1.5">
                {spare.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setSlots((prev) => [...prev, o])}
                    className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-muted hover:border-brand hover:text-brand"
                  >
                    <Icon name="plus" className="mr-1 inline h-3.5 w-3.5" />
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted">
              Anything we should know? (optional)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. swapping Monday for Wednesday from next month"
              className="input w-full"
            />
          </label>

          <p className="text-xs text-muted">
            Remove a day, add a day, or do both to swap. We&apos;ll check it and confirm - nothing
            changes, and nothing is charged or refunded, until it&apos;s approved.
          </p>

          <button onClick={send} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-50">
            {busy ? "Sending..." : "Send request"}
          </button>
        </div>
      )}

      {sent && <p className="text-sm font-semibold text-brand">{sent}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
