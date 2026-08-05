"use client";

import { useState, useTransition } from "react";
import { setClientCadence } from "./actions";

export function CadenceSelect({ clientId, current }: { clientId: string; current: string }) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <select
        defaultValue={current}
        disabled={pending}
        className="input h-9 w-auto py-1 text-sm"
        onChange={(e) => {
          const value = e.target.value;
          setError(null);
          setSaved(false);
          start(async () => {
            const res = await setClientCadence(clientId, value);
            if (res.ok) setSaved(true);
            else setError(res.error);
          });
        }}
      >
        <option value="DAILY">Daily</option>
        <option value="WEEKLY">Weekly</option>
        <option value="MONTHLY">Monthly</option>
      </select>
      {pending && <span className="text-xs text-muted">Saving…</span>}
      {saved && !pending && <span className="text-xs text-success">Saved ✓</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
