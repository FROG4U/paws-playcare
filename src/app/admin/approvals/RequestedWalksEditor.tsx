"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { BOOKING_SLOT_LABELS } from "@/lib/constants";
import { updateRequestedWalks } from "./actions";

// What a stored slot should read as. Sign-up saves the readable label itself
// ("Field Play — Monday (AM)"), but very old accounts hold a key ("MON_AM").
function labelFor(value: string) {
  return BOOKING_SLOT_LABELS[value] ?? value;
}

export function RequestedWalksEditor({
  userId,
  options,
  initialSlots,
  initialStart,
}: {
  userId: string;
  options: string[]; // the services on offer, e.g. "Field Play — Monday (AM)"
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

  // A slot this client asked for that the business no longer offers (service
  // renamed, day dropped, or an old-style key) still has to appear in its own
  // dropdown — otherwise the browser would silently switch it to another walk.
  const optionsFor = (value: string) =>
    options.includes(value) ? options : [...options, value];

  const firstFree = options.find((o) => !slots.includes(o)) ?? options[0] ?? "";

  function setSlotAt(i: number, value: string) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? value : s)));
    setSaved(false);
  }
  function removeSlotAt(i: number) {
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }
  function addSlot() {
    if (!firstFree) return;
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
                  {labelFor(s)}
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
          {options.length === 0 && (
            <p className="text-xs text-warn">
              No active services — add one on the Services page first.
            </p>
          )}

          {slots.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={s}
                onChange={(e) => setSlotAt(i, e.target.value)}
                className="input flex-1 py-1.5 text-sm"
              >
                {optionsFor(s).map((o) => (
                  <option key={o} value={o}>
                    {labelFor(o)}
                    {options.includes(o) ? "" : " (no longer offered)"}
                  </option>
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

          {firstFree && (
            <button
              type="button"
              onClick={addSlot}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              <Icon name="plus" className="h-3.5 w-3.5" /> Add a walk
            </button>
          )}

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
