"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { updateWalkDetails } from "./actions";

function monthLabel(ym: string): string {
  return new Date(ym + "-01T00:00:00.000Z").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type WalkLite = {
  id: string;
  dateIso: string;
  dateLabel: string;
  timeSlot: string;
  serviceName: string | null;
  numDogs: number;
  pricePounds: string; // "16.00"
  statusLabel: string;
  noCharge: boolean;
  workerName: string | null;
  editable: boolean;
};

const SLOTS = [
  { v: "AM", label: "AM" },
  { v: "LUNCH", label: "Lunch" },
  { v: "PM", label: "PM" },
];

export function ClientWalks({ upcoming, past }: { upcoming: WalkLite[]; past: WalkLite[] }) {
  // Distinct months (yyyy-mm) present in the upcoming walks, in order.
  const months = useMemo(
    () => [...new Set(upcoming.map((w) => w.dateIso.slice(0, 7)))].sort(),
    [upcoming]
  );
  const [mi, setMi] = useState(0);
  const currentYm = months[mi];
  const monthWalks = currentYm ? upcoming.filter((w) => w.dateIso.slice(0, 7) === currentYm) : [];

  if (upcoming.length === 0 && past.length === 0) {
    return <p className="card text-sm text-muted">No walks for this client yet.</p>;
  }

  return (
    <div className="space-y-4">
      {months.length > 0 && (
        <div className="space-y-2">
          {/* Month navigation */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Upcoming · {upcoming.length} total
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMi((i) => Math.max(0, i - 1))}
                disabled={mi === 0}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-brand-soft disabled:opacity-30"
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="min-w-[8.5rem] text-center text-sm font-bold">
                {monthLabel(currentYm)} <span className="font-normal text-muted">· {monthWalks.length}</span>
              </span>
              <button
                onClick={() => setMi((i) => Math.min(months.length - 1, i + 1))}
                disabled={mi >= months.length - 1}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-brand-soft disabled:opacity-30"
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </div>
          {monthWalks.map((w) => <WalkRow key={w.id} w={w} />)}
        </div>
      )}
      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Recent</p>
          {past.map((w) => <WalkRow key={w.id} w={w} />)}
        </div>
      )}
    </div>
  );
}

function WalkRow({ w }: { w: WalkLite }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [dateIso, setDateIso] = useState(w.dateIso);
  const [timeSlot, setTimeSlot] = useState(w.timeSlot);
  const [price, setPrice] = useState(w.pricePounds);
  const [noCharge, setNoCharge] = useState(w.noCharge);

  function save() {
    setError(null);
    start(async () => {
      const res = await updateWalkDetails(w.id, {
        dateIso,
        timeSlot,
        pricePounds: price,
        noCharge,
      });
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  if (!editing) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-2 py-3">
        <div>
          <p className="font-semibold">
            {w.dateLabel}
            <span className="ml-2 text-sm font-normal text-muted">{w.timeSlot}</span>
          </p>
          <p className="text-sm text-muted">
            {w.serviceName ?? "Walk"} · {w.numDogs} dog{w.numDogs === 1 ? "" : "s"} ·{" "}
            {w.noCharge ? <span className="text-warn">No charge</span> : `£${w.pricePounds}`}
            {w.workerName ? ` · ${w.workerName}` : ""} · {w.statusLabel}
          </p>
        </div>
        {w.editable ? (
          <button onClick={() => setEditing(true)} className="btn-ghost text-sm">
            <Icon name="pencil" className="h-4 w-4" /> Edit
          </button>
        ) : (
          <span className="badge bg-mist text-muted">{w.statusLabel}</span>
        )}
      </div>
    );
  }

  return (
    <div className="card space-y-3 py-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Date</span>
          <input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Time slot</span>
          <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className="input">
            {SLOTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Price (£)</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="input" disabled={noCharge} />
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" checked={noCharge} onChange={(e) => setNoCharge(e.target.checked)} />
          No charge for this walk
        </label>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save"}
        </button>
        <button onClick={() => { setEditing(false); setError(null); }} disabled={pending} className="btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}
