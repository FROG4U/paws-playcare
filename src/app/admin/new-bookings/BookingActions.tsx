"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { acceptBooking, rejectBooking, updateBookingDates } from "./actions";

export type WalkLite = { id: string; dateIso: string; label: string; editable: boolean };

export function BookingActions({
  bookingId,
  walks,
}: {
  bookingId: string;
  walks: WalkLite[];
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(walks.map((w) => [w.id, w.dateIso]))
  );

  function save() {
    setError(null);
    const changes = walks
      .filter((w) => w.editable && draft[w.id] && draft[w.id] !== w.dateIso)
      .map((w) => ({ walkId: w.id, date: draft[w.id] }));
    if (changes.length === 0) {
      setEditing(false);
      return;
    }
    start(async () => {
      const res = await updateBookingDates(bookingId, changes);
      if (res?.ok) setEditing(false);
      else setError(res?.error ?? "Couldn't save changes.");
    });
  }

  if (editing) {
    const editable = walks.filter((w) => w.editable);
    return (
      <div className="mt-3 rounded-lg border border-border p-3">
        <p className="mb-2 text-sm font-semibold">Edit dates</p>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <div className="space-y-2">
          {editable.map((w) => (
            <div key={w.id} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-xs text-muted">{w.label}</span>
              <input
                type="date"
                className="input"
                value={draft[w.id] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [w.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn-primary" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save & notify client"}
          </button>
          <button className="btn-ghost" disabled={pending} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() => start(() => acceptBooking(bookingId))}
      >
        <Icon name="check" className="h-4 w-4" />
        Accept
      </button>
      <button
        className="btn-outline"
        disabled={pending || walks.every((w) => !w.editable)}
        onClick={() => setEditing(true)}
      >
        <Icon name="pencil" className="h-4 w-4" />
        Edit dates
      </button>
      <button
        className="btn-danger"
        disabled={pending}
        onClick={() => {
          const reason = window.prompt("Reason for rejecting (optional — shown to client)") || "";
          start(() => rejectBooking(bookingId, reason));
        }}
      >
        <Icon name="x" className="h-4 w-4" />
        Reject
      </button>
    </div>
  );
}
