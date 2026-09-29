"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { saveClientSlots, approveSlotRequest, declineSlotRequest } from "./actions";

export type PendingSlotRequest = {
  id: string;
  requested: string[];
  note: string | null;
  askedLabel: string;
};

// The client's regular weekly days, editable by the admin. Saving rebuilds
// their bookings, so what shows here is always what they'll be billed for.
export function RegularDays({
  clientId,
  options,
  initialSlots,
  pending: pendingRequest,
}: {
  clientId: string;
  options: string[];
  initialSlots: string[];
  pending: PendingSlotRequest | null;
}) {
  const [slots, setSlots] = useState<string[]>(initialSlots);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const dirty = JSON.stringify([...slots].sort()) !== JSON.stringify([...initialSlots].sort());
  const spare = options.filter((o) => !slots.includes(o));

  function run(fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMessage(res.message);
        setEditing(false);
        setDeclining(false);
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {/* A change the client has asked for, waiting on the admin */}
      {pendingRequest && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-bold text-warn">
            <Icon name="alert" className="h-4 w-4" />
            {pendingRequest.askedLabel} they asked to change their days
          </p>
          <p className="mt-1">
            They want:{" "}
            <strong>
              {pendingRequest.requested.length ? pendingRequest.requested.join(", ") : "no regular days"}
            </strong>
          </p>
          {pendingRequest.note && <p className="mt-1 text-muted">&ldquo;{pendingRequest.note}&rdquo;</p>}
          <p className="mt-1 text-muted">
            Approving books the new days from today and cancels the dropped ones with no charge.
          </p>

          {declining ? (
            <div className="mt-2 space-y-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional, sent to the client)"
                className="input w-full py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => run(() => declineSlotRequest(pendingRequest.id, reason))}
                  disabled={pending}
                  className="rounded-xl bg-danger px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {pending ? "Saving..." : "Confirm decline"}
                </button>
                <button onClick={() => setDeclining(false)} className="btn-ghost text-sm">
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => run(() => approveSlotRequest(pendingRequest.id))}
                disabled={pending}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {pending ? "Applying..." : "Approve change"}
              </button>
              <button onClick={() => setDeclining(true)} disabled={pending} className="btn-outline text-sm">
                Decline
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Requested slots</p>
        {!editing ? (
          <button
            onClick={() => { setEditing(true); setMessage(null); setError(null); }}
            className="text-xs font-semibold text-brand hover:underline"
          >
            Edit
          </button>
        ) : (
          <button
            onClick={() => { setSlots(initialSlots); setEditing(false); setError(null); }}
            className="text-xs font-semibold text-muted hover:underline"
          >
            Cancel
          </button>
        )}
      </div>

      {slots.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <span key={s} className="badge bg-brand-soft text-brand-dark">
              {s}
              {editing && (
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
        <p className="text-sm text-muted">No regular days.</p>
      )}

      {editing && (
        <div className="space-y-2">
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
          <p className="text-xs text-muted">
            Saving rebuilds their walks from today: days you remove are cancelled with no charge,
            days you add are booked for the next 12 weeks and billed on their usual cycle. Walks
            already done stay on their invoice.
          </p>
          <button
            onClick={() => run(() => saveClientSlots(clientId, slots))}
            disabled={pending || !dirty}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save days and update walks"}
          </button>
        </div>
      )}

      {message && <p className="text-sm font-semibold text-brand">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
