"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/money";
import {
  updateBookingDogs,
  saveWalkDates,
  addWalk,
  removeWalk,
  setBookingDecision,
  setWalkNoCharge,
  pauseBooking,
  resumeBooking,
  setBookingDays,
  type EditResult,
} from "./actions";

export type WalkLite = {
  id: string;
  dateIso: string;
  label: string;
  status: string;
  statusLabel: string;
  editable: boolean;
  price: number;
  noCharge: boolean;
};
export type DogLite = { id: string; name: string };

const DAY_NAMES: Record<number, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};

export function BookingEditor({
  bookingId,
  dogs,
  selectedDogIds,
  walks,
  decision,
  isPending,
  pricePerDog,
  paused,
  recurring,
  bookingDays,
  serviceDays,
  todayIso,
}: {
  bookingId: string;
  dogs: DogLite[];
  selectedDogIds: string[];
  walks: WalkLite[];
  decision: string | null;
  isPending: boolean;
  pricePerDog: number | null;
  paused: boolean;
  recurring: boolean;
  bookingDays: number[];   // weekdays this booking currently runs (ISO, Mon=1)
  serviceDays: number[];   // weekdays the service offers
  todayIso: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [dogSel, setDogSel] = useState<Set<string>>(() => new Set(selectedDogIds));
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(walks.map((w) => [w.id, w.dateIso]))
  );
  const [addDate, setAddDate] = useState("");
  const [daySel, setDaySel] = useState<Set<number>>(() => new Set(bookingDays));
  const [daysFrom, setDaysFrom] = useState("");
  const daysDirty =
    daySel.size !== bookingDays.length || bookingDays.some((d) => !daySel.has(d));

  function run(fn: () => Promise<EditResult | void>) {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res && !res.ok) setError(res.error);
      else if (res && res.ok && res.message) setMessage(res.message);
    });
  }

  const editableWalks = walks.filter((w) => w.editable);
  const selectedCount = dogSel.size;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
      {message && <p className="rounded-lg bg-success/15 px-3 py-2 text-sm font-medium text-success">{message}</p>}

      {/* Approval decision */}
      <section className="card space-y-3">
        <h2 className="text-base font-bold">Approval</h2>
        <p className="text-sm text-muted">
          {isPending
            ? "This booking is awaiting review."
            : decision === "ACCEPTED"
              ? "This booking is accepted."
              : decision === "REJECTED"
                ? "This booking was rejected and its walks cancelled."
                : "This booking has been reviewed."}
        </p>
        <div className="flex flex-wrap gap-2">
          {decision !== "ACCEPTED" && (
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() => run(() => setBookingDecision(bookingId, "ACCEPT"))}
            >
              <Icon name="check" className="h-4 w-4" />
              Accept
            </button>
          )}
          {decision !== "REJECTED" && (
            <button
              className="btn-danger"
              disabled={pending}
              onClick={() => {
                const reason = window.prompt("Reason for rejecting (optional — shown to client)") || "";
                run(() => setBookingDecision(bookingId, "REJECT", reason));
              }}
            >
              <Icon name="x" className="h-4 w-4" />
              Reject
            </button>
          )}
          {!isPending && (
            <button
              className="btn-outline"
              disabled={pending}
              onClick={() => run(() => setBookingDecision(bookingId, "REOPEN"))}
            >
              <Icon name="inbox" className="h-4 w-4" />
              Re-open for review
            </button>
          )}
        </div>
      </section>

      {/* Pause / resume */}
      <section className="card space-y-3">
        <h2 className="text-base font-bold">Pause</h2>
        <p className="text-sm text-muted">
          {paused
            ? "This booking is paused — its upcoming walks are cancelled and won't be charged."
            : "Pause this booking to stop upcoming walks (cancelled with no charge). You can resume it any time."}
        </p>
        {paused ? (
          <button className="btn-primary" disabled={pending} onClick={() => run(() => resumeBooking(bookingId))}>
            <Icon name="check" className="h-4 w-4" />
            Resume booking
          </button>
        ) : (
          <button className="btn-outline" disabled={pending} onClick={() => run(() => pauseBooking(bookingId))}>
            <Icon name="clock" className="h-4 w-4" />
            Pause booking
          </button>
        )}
      </section>

      {/* Which weekdays this repeat booking runs on */}
      {recurring && (
        <section className="card space-y-3">
          <h2 className="text-base font-bold">Repeat days</h2>
          <p className="text-sm text-muted">
            Take a day off and its upcoming walks are cancelled with no charge — and it
            won't come back. Add a day and it's booked out for the next 12 weeks.
          </p>

          <div className="flex flex-wrap gap-2">
            {serviceDays.map((d) => {
              const on = daySel.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setDaySel((prev) => {
                      const n = new Set(prev);
                      n.has(d) ? n.delete(d) : n.add(d);
                      return n;
                    })
                  }
                  className={
                    on
                      ? "rounded-full bg-brand px-3.5 py-1.5 text-sm font-bold text-white"
                      : "rounded-full border border-border px-3.5 py-1.5 text-sm font-semibold text-muted hover:border-brand hover:text-brand"
                  }
                >
                  {DAY_NAMES[d] ?? d}
                </button>
              );
            })}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted">
              From (leave blank for today)
            </span>
            <input
              type="date"
              min={todayIso}
              value={daysFrom}
              onChange={(e) => setDaysFrom(e.target.value)}
              className="input py-1.5 text-sm sm:max-w-xs"
            />
          </label>

          <button
            onClick={() => run(() => setBookingDays(bookingId, [...daySel], daysFrom || null))}
            disabled={pending || !daysDirty}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save repeat days"}
          </button>
        </section>
      )}

      {/* Dogs */}
      <section className="card space-y-3">
        <h2 className="text-base font-bold">Dogs on this booking</h2>
        {dogs.length === 0 ? (
          <p className="text-sm text-muted">This client has no dogs on file.</p>
        ) : (
          <div className="space-y-2">
            {dogs.map((d) => {
              const on = dogSel.has(d.id);
              return (
                <label key={d.id} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={on}
                    onChange={(e) =>
                      setDogSel((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(d.id);
                        else next.delete(d.id);
                        return next;
                      })
                    }
                  />
                  <span className="font-medium">{d.name}</span>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-sm text-muted">
          {selectedCount} dog{selectedCount !== 1 ? "s" : ""}
          {pricePerDog != null ? ` · ${formatMoney(pricePerDog * Math.max(1, selectedCount))} per walk` : ""}
        </p>
        <button
          className="btn-primary"
          disabled={pending || selectedCount === 0}
          onClick={() => run(() => updateBookingDogs(bookingId, [...dogSel]))}
        >
          Save dogs & reprice
        </button>
      </section>

      {/* Walks */}
      <section className="card space-y-3">
        <h2 className="text-base font-bold">Walks</h2>
        {walks.length === 0 ? (
          <p className="text-sm text-muted">No walks on this booking yet.</p>
        ) : (
          <div className="space-y-2">
            {walks.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-2">
                {w.editable ? (
                  <input
                    type="date"
                    className="input max-w-[11rem]"
                    value={dates[w.id] ?? ""}
                    onChange={(e) => setDates((d) => ({ ...d, [w.id]: e.target.value }))}
                  />
                ) : (
                  <span className="w-28 text-sm">{w.label}</span>
                )}
                <span className="badge bg-mist text-muted">{w.statusLabel}</span>
                <span className={`text-sm ${w.noCharge ? "text-muted line-through" : "text-muted"}`}>{formatMoney(w.price)}</span>
                {w.noCharge && <span className="badge bg-success/15 text-success">No charge</span>}
                {w.status !== "CANCELLED" && (
                  <button
                    className="text-sm font-semibold text-brand hover:underline"
                    disabled={pending}
                    onClick={() => run(() => setWalkNoCharge(w.id, !w.noCharge))}
                  >
                    {w.noCharge ? "Charge" : "No charge"}
                  </button>
                )}
                {w.status !== "COMPLETED" && w.status !== "CANCELLED" && (
                  <button
                    className="text-sm font-semibold text-danger"
                    disabled={pending}
                    onClick={() => run(() => removeWalk(w.id))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {editableWalks.length > 0 && (
          <button
            className="btn-primary"
            disabled={pending}
            onClick={() => {
              const changes = editableWalks
                .filter((w) => dates[w.id] && dates[w.id] !== w.dateIso)
                .map((w) => ({ walkId: w.id, date: dates[w.id] }));
              if (changes.length === 0) {
                setMessage("No date changes to save.");
                return;
              }
              run(() => saveWalkDates(bookingId, changes));
            }}
          >
            Save dates & notify client
          </button>
        )}

        {/* Add a walk */}
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <input
            type="date"
            className="input max-w-[11rem]"
            value={addDate}
            onChange={(e) => setAddDate(e.target.value)}
          />
          <button
            className="btn-outline"
            disabled={pending || !addDate}
            onClick={() =>
              run(async () => {
                const res = await addWalk(bookingId, addDate);
                if (res.ok) setAddDate("");
                return res;
              })
            }
          >
            <Icon name="plus" className="h-4 w-4" />
            Add walk
          </button>
        </div>
      </section>
    </div>
  );
}
