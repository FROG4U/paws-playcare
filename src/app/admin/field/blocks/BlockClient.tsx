"use client";

import { useActionState, useState, useTransition } from "react";
import { createBlock, removeBlock, removeBlocksForDay, type FormState } from "../actions";

const WEEKDAYS = [
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
  { v: 7, label: "Sun" },
];

export function BlockForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createBlock, {});
  const [whole, setWhole] = useState(true);
  const [from, setFrom] = useState(9);
  const [to, setTo] = useState(12);
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState<number[]>([]);

  const toggleDay = (v: number) =>
    setDays((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));

  return (
    <form action={action} className="card space-y-4">
      <div>
        <h2 className="font-bold">Block out time</h2>
        <p className="text-xs text-muted">
          Blocked slots can&apos;t be booked (maintenance, private events, holidays). Already-booked
          slots are left alone.
        </p>
      </div>

      {/* Dates */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">From date</span>
          <input name="fromDate" type="date" required className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">To date (optional)</span>
          <input name="toDate" type="date" className="input" />
        </label>
      </div>
      <p className="-mt-2 text-xs text-muted">
        Leave “To date” empty to block a single day. Set it to block a range of days.
      </p>

      {/* Repeat on weekdays */}
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          <span>Repeat — only block certain weekdays in that range</span>
        </label>
        {repeat && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = days.includes(d.v);
              return (
                <button
                  type="button"
                  key={d.v}
                  onClick={() => toggleDay(d.v)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    on ? "bg-brand text-white" : "bg-mist text-muted hover:bg-brand-soft"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
            {days.map((v) => (
              <input key={v} type="hidden" name="repeatDays" value={v} />
            ))}
          </div>
        )}
      </div>

      {/* Times */}
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} />
          <span>Block the whole day</span>
        </label>
        {whole ? (
          <input type="hidden" name="whole" value="1" />
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <HourSelect name="fromHour" value={from} onChange={setFrom} />
            <span className="text-muted">to</span>
            <HourSelect name="toHour" value={to} onChange={setTo} />
          </div>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Reason (optional)</span>
        <input name="note" className="input" placeholder="e.g. Private event, maintenance" />
      </label>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Blocked ✓</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Blocking…" : "Block these times"}
      </button>
    </form>
  );
}

function HourSelect({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="input w-28"
    >
      {Array.from({ length: 25 }).map((_, h) => (
        <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
      ))}
    </select>
  );
}

export function RemoveBlockButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => removeBlock(id))}
      disabled={pending}
      className="btn-ghost text-xs text-danger"
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}

export function ClearDayButton({ dateKey }: { dateKey: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await removeBlocksForDay(dateKey); })}
      disabled={pending}
      className="btn-ghost text-xs text-danger"
    >
      {pending ? "…" : "Clear day"}
    </button>
  );
}
