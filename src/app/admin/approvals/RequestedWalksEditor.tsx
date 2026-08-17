"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { BOOKING_SLOTS } from "@/lib/constants";
import { updateRequestedWalks } from "./actions";

const SLOT_KEYS = BOOKING_SLOTS.map((s) => s.key);

export function RequestedWalksEditor({
  userId,
  initialSlots,
  initialStart,
}: {
  userId: string;
  initialSlots: string[];
  initialStart: string | null; // yyyy-mm-dd
}) {
  const [slots, setSlots] = useState<string[]>(initialSlots);
  const [start, setStart] = useState<string>(initialStart ?? "");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    JSON.stringify(slots) !== JSON.stringify(initialSlots) ||
    (start || "") !== (initialStart ?? "");

  // First slot not already chosen — used when adding a new walk row.
  const firstFree = SLOT_KEYS.find((k) => !slots.includes(k)) ?? SLOT_KEYS[0];

  function setSlotAt(i: number, key: string) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? key : s)));
    setSaved(false);
  }
  function removeSlotAt(i: number) {
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }
  function addSlot() {
    setSlots((prev) => [...prev, firstFree]);
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateRequestedWalks(userId, slots, start || null);
      if (res.ok) {
        setSaved(true);
        setEditing(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-lg bg-brand-soft/60 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Requested walks</p>
        {!editing ? (
          <button
            type="button"
            onClick={() => { setEditing(true); setSaved(false); }}
            className="text-xs font-semibold text-brand hover:underline"
          >
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setSlots(initialSlots); setStart(initialStart ?? ""); setEditing(false); setError(null); }}
            className="text-xs font-semibold text-muted hover:underline"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Read-only view */}
      {!editing && (
        <>
          {slots.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {slots.map((s, i) => (
                <span key={`${s}-${i}`} className="badge bg-surface text-brand-dark">
                  {BOOKING_SLOTS.find((b) => b.key === s)?.label ?? s}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-muted">No walks requested.</p>
          )}
          {start && (
            <p className="mt-1 text-muted">
              Preferred start:{" "}
              {new Date(start + "T00:00:00").toLocaleDateString("en-GB", {
                weekday: "short", day: "numeric", month: "short", year: "numeric",
              })}
            </p>
          )}
          {saved && <p className="mt-1 text-xs text-brand">Saved ✓</p>}
        </>
      )}

      {/* Edit view — each requested walk on its own row */}
      {editing && (
        <div className="mt-2 space-y-2">
          {slots.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={s}
                onChange={(e) => setSlotAt(i, e.target.value)}
                className="input flex-1 py-1.5 text-sm"
              >
                {BOOKING_SLOTS.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeSlotAt(i)}
                aria-label="Remove walk"
                className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addSlot}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            <Icon name="plus" className="h-3.5 w-3.5" /> Add a walk
          </button>

          <label className="mt-1 block">
            <span className="mb-1 block text-xs font-semibold text-muted">Preferred start date</span>
            <input
              type="date"
              value={start}
              onChange={(e) => { setStart(e.target.value); setSaved(false); }}
              className="input py-1.5 text-sm"
            />
          </label>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
