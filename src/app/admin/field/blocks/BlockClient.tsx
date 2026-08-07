"use client";

import { useActionState, useState, useTransition } from "react";
import { createBlock, removeBlock, type FormState } from "../actions";

export function BlockForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createBlock, {});
  const [whole, setWhole] = useState(true);
  const [from, setFrom] = useState(9);
  const [to, setTo] = useState(12);
  const hours: number[] = [];
  for (let h = from; h < to; h++) hours.push(h);

  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-bold">Block out time</h2>
      <p className="-mt-2 text-xs text-muted">
        Blocked hours can&apos;t be booked (maintenance, private events, holidays). Already-booked hours are left alone.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Date</span>
          <input name="date" type="date" required className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Reason (optional)</span>
          <input name="note" className="input" placeholder="e.g. Private event" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} />
        <span>Block the whole day</span>
      </label>
      {whole && <input type="hidden" name="whole" value="1" />}

      {!whole && (
        <div className="flex items-center gap-2">
          <HourSelect value={from} onChange={setFrom} />
          <span className="text-muted">to</span>
          <HourSelect value={to} onChange={setTo} />
          {hours.map((h) => (
            <input key={h} type="hidden" name="hours" value={h} />
          ))}
        </div>
      )}

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Blocked ✓</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Blocking…" : "Block these times"}
      </button>
    </form>
  );
}

function HourSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="input w-28">
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
