"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { saveClientSlots, approveSlotRequest, declineSlotRequest } from "./actions";

type Pending = { slot: string; action: "ADD" | "REMOVE"; from: string };

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
  todayIso,
  pending: pendingRequest,
}: {
  clientId: string;
  options: string[];
  initialSlots: string[];
  todayIso: string;
  pending: PendingSlotRequest | null;
}) {
  // Changes are staged with their own start date, then saved together.
  const [changes, setChanges] = useState<Pending[]>([]);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const removing = new Set(changes.filter((c) => c.action === "REMOVE").map((c) => c.slot));
  const adding = changes.filter((c) => c.action === "ADD");
  const spare = options.filter(
    (o) => !initialSlots.includes(o) && !adding.some((a) => a.slot === o)
  );
  const dirty = changes.length > 0;

  const stage = (slot: string, action: "ADD" | "REMOVE") =>
    setChanges((prev) => [...prev, { slot, action, from: todayIso }]);
  const unstage = (slot: string) => setChanges((prev) => prev.filter((c) => c.slot !== slot));
  const setFrom = (slot: string, from: string) =>
    setChanges((prev) => prev.map((c) => (c.slot === slot ? { ...c, from } : c)));

  function run(fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMessage(res.message);
        setEditing(false);
        setDeclining(false);
        setChanges([]);
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
            onClick={() => { setChanges([]); setEditing(false); setError(null); }}
            className="text-xs font-semibold text-muted hover:underline"
          >
            Cancel
          </button>
        )}
      </div>

      {initialSlots.length > 0 ? (
        <div className="space-y-1.5">
          {initialSlots.map((s) => {
            const change = changes.find((c) => c.slot === s && c.action === "REMOVE");
            return (
              <div key={s} className="flex flex-wrap items-center gap-2">
                <span
                  className={`badge ${change ? "bg-danger/10 text-danger line-through" : "bg-brand-soft text-brand-dark"}`}
                >
                  {s}
                </span>
                {editing && !change && (
                  <button
                    type="button"
                    onClick={() => stage(s, "REMOVE")}
                    className="text-xs font-semibold text-danger hover:underline"
                  >
                    Remove
                  </button>
                )}
                {change && (
                  <span className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted">stops from</span>
                    <input
                      type="date"
                      min={todayIso}
                      value={change.from}
                      onChange={(e) => setFrom(s, e.target.value)}
                      className="input py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => unstage(s)}
                      className="font-semibold text-muted hover:underline"
                    >
                      Keep it
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted">No regular days.</p>
      )}

      {editing && (
        <div className="space-y-3">
          {adding.length > 0 && (
            <div className="space-y-1.5">
              {adding.map((a) => (
                <div key={a.slot} className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-success/15 text-success">{a.slot}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted">starts from</span>
                    <input
                      type="date"
                      min={todayIso}
                      value={a.from}
                      onChange={(e) => setFrom(a.slot, e.target.value)}
                      className="input py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => unstage(a.slot)}
                      className="font-semibold text-muted hover:underline"
                    >
                      Undo
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {spare.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">Add a day</p>
              <div className="flex flex-wrap gap-1.5">
                {spare.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => stage(o, "ADD")}
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
            Each change starts on its own date - to swap a day, remove one and add another. Days
            you remove are cancelled from that date with no charge; days you add are booked from
            their date and billed on the client&apos;s usual cycle. Walks before the date, and any
            already done, stay exactly as they are.
          </p>

          <button
            onClick={() => run(() => saveClientSlots(clientId, changes.map((c) => ({ slot: c.slot, action: c.action, from: c.from }))))}
            disabled={pending || !dirty}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save changes and update walks"}
          </button>
        </div>
      )}

      {message && <p className="text-sm font-semibold text-brand">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
